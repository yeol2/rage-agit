import { NextResponse } from 'next/server';
import { fetchReactionRanking, getReactionSupabase } from '@/lib/reactionData';
import { COMMENT_MAX_CHARS, average, isValidRun, normalizeComment, suspiciousReason } from '@/lib/reaction';
import { checkRunToken } from '@/lib/reactionToken';

// 반응속도 랭킹 등록. 로그인이 없어서 "클랜원인지"는 두 가지로 거른다:
//   1) PUBG 닉네임이 클랜 명단(member_pubg_accounts)에 있어야 하고(본계정·부계정 모두 그 사람으로)
//   2) 내전 비밀번호(REACTION_CLAN_CODE, 클랜 국룰)를 알아야 한다.
// 비밀번호는 공개 저장소에 안 남도록 서버 환경변수로만 둔다.
// 같은 사람이 여러 번 올리면 더 빠른 평균일 때만 기록을 바꾼다(도전 횟수는 매번 센다).
// 한 줄 평은 최고 기록과 함께 남는다 — 기록을 깨면 새 한 줄 평(빈칸이면 지움), 못 깨면 그대로.

export async function GET() {
  return NextResponse.json({ ranking: await fetchReactionRanking() });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const nickname = typeof body?.nickname === 'string' ? body.nickname.trim() : '';
  const code = typeof body?.code === 'string' ? body.code.trim() : '';

  if (!nickname || !code) {
    return NextResponse.json({ error: 'PUBG 닉네임과 내전 비밀번호를 입력해주세요.' }, { status: 400 });
  }
  if (!isValidRun(body?.times)) {
    return NextResponse.json({ error: '랭킹에 올릴 수 없는 기록입니다. 다시 도전해주세요.' }, { status: 400 });
  }
  const comment = normalizeComment(body?.comment);
  if (comment === 'too-long') {
    return NextResponse.json({ error: `한 줄 평은 ${COMMENT_MAX_CHARS}자까지 쓸 수 있어요.` }, { status: 400 });
  }
  const runProblem = checkRunToken(body.token, body.times) ?? suspiciousReason(body.times);
  if (runProblem) {
    return NextResponse.json({ error: runProblem }, { status: 400 });
  }

  const expected = process.env.REACTION_CLAN_CODE;
  if (!expected) {
    return NextResponse.json({ error: '서버에 내전 비밀번호가 설정되지 않았습니다. 관리자에게 알려주세요.' }, { status: 500 });
  }
  if (code !== expected) {
    return NextResponse.json({ error: '내전 비밀번호가 틀렸습니다.' }, { status: 403 });
  }

  const supabase = getReactionSupabase();
  // 닉네임은 대소문자 구분 없이 정확히 같은 것만. ilike 의 _ % 는 글자 그대로 보게 이스케이프.
  const pattern = nickname.replace(/[\\%_]/g, (c: string) => `\\${c}`);
  const { data: accounts, error: accountError } = await supabase
    .from('member_pubg_accounts')
    .select('member_id')
    .ilike('pubg_ign', pattern)
    .limit(2);
  if (accountError) {
    return NextResponse.json({ error: '클랜원 명단을 확인하지 못했습니다.' }, { status: 500 });
  }
  const memberIds = [...new Set((accounts ?? []).map((a) => a.member_id as string))];
  if (memberIds.length !== 1) {
    return NextResponse.json(
      { error: '클랜 명단에 없는 PUBG 닉네임입니다. 내전에 쓰는 닉네임 그대로 입력해주세요.' },
      { status: 404 },
    );
  }
  const memberId = memberIds[0];

  const times = body.times as number[];
  const avgMs = average(times);
  const singleMs = Math.min(...times);

  const { data: existing, error: readError } = await supabase
    .from('reaction_records')
    .select('best_avg_ms, best_single_ms, attempts')
    .eq('member_id', memberId)
    .maybeSingle();
  if (readError) {
    return NextResponse.json({ error: '기존 기록을 읽지 못했습니다.' }, { status: 500 });
  }

  const now = new Date().toISOString();
  const improved = !existing || avgMs < existing.best_avg_ms;
  // 기록을 못 깼으면 도전 횟수·최고 단일 기록만 바꾸고 달성 시각(동률 순서)은 건드리지 않는다.
  const { error: writeError } = improved
    ? await supabase.from('reaction_records').upsert({
        member_id: memberId,
        best_avg_ms: avgMs,
        best_single_ms: Math.min(singleMs, existing?.best_single_ms ?? singleMs),
        attempts: (existing?.attempts ?? 0) + 1,
        achieved_at: now,
        updated_at: now,
        comment,
      })
    : await supabase
        .from('reaction_records')
        .update({
          best_single_ms: Math.min(singleMs, existing.best_single_ms),
          attempts: existing.attempts + 1,
          updated_at: now,
        })
        .eq('member_id', memberId);
  if (writeError) {
    return NextResponse.json({ error: '기록을 저장하지 못했습니다.' }, { status: 500 });
  }

  const ranking = await fetchReactionRanking();
  const mine = ranking.find((entry) => entry.memberId === memberId) ?? null;
  return NextResponse.json({
    ok: true,
    improved,
    previousBestMs: existing?.best_avg_ms ?? null,
    memberId,
    rank: mine?.rank ?? null,
    ranking,
  });
}
