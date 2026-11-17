import { NextResponse } from 'next/server';
import { fetchReactionRanking, getReactionSupabase } from '@/lib/reactionData';
import { COMMENT_MAX_CHARS, average, isValidRun, normalizeComment, suspiciousReason } from '@/lib/reaction';
import { checkRunToken, readRunTokenId } from '@/lib/reactionToken';
import { checkRoundPings, isValidNonce, type RoundPing } from '@/lib/reactionRounds';
import { formatRegisterFailAlert, notifyAdmin } from '@/lib/reactionAlert';

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

  // 등록이 막힌 경우(기록 이상·부정 검사·비밀번호·명단)는 운영자 디스코드로도 알린다(2026-11-16 사용자 요청) —
  // 게임 없이 숫자만 보내는 시도도 여기서 잡힌다. 빈칸·한 줄 평 길이·서버 오류는 알리지 않는다.
  const reject = async (status: number, error: string) => {
    await notifyAdmin(formatRegisterFailAlert({ nickname: nickname.slice(0, 40), error, times: body?.times }));
    return NextResponse.json({ error }, { status });
  };

  if (!nickname || !code) {
    return NextResponse.json({ error: 'PUBG 닉네임과 내전 비밀번호를 입력해주세요.' }, { status: 400 });
  }
  if (!isValidRun(body?.times)) {
    return reject(400, '랭킹에 올릴 수 없는 기록입니다. 다시 도전해주세요.');
  }
  // 몇 번째 판인지(브라우저가 센 값, 참고용). 이상한 값이면 그냥 비운다 — 이것 때문에 등록을 막진 않는다.
  const tryNumber =
    Number.isInteger(body?.tryNumber) && body.tryNumber >= 1 && body.tryNumber <= 1_000_000 ? (body.tryNumber as number) : null;
  const comment = normalizeComment(body?.comment);
  if (comment === 'too-long') {
    return NextResponse.json({ error: `한 줄 평은 ${COMMENT_MAX_CHARS}자까지 쓸 수 있어요.` }, { status: 400 });
  }
  const runProblem = checkRunToken(body.token, body.times) ?? suspiciousReason(body.times);
  if (runProblem) {
    return reject(400, runProblem);
  }

  // 회차마다 서버 확인(lib/reactionRounds) — 회차 신호가 실제로 왔고, 보고한 반응 시간이 서버가 잰
  // 간격과 맞아야 한다. 게임 없이 숫자만 보내면 여기서 막힌다.
  const pingSupabase = getReactionSupabase();
  const runId = readRunTokenId(body.token) as string; // checkRunToken 을 통과했으니 서명이 맞다.
  const nonceList = Array.isArray(body?.nonces) ? body.nonces.filter(isValidNonce).slice(0, 10) : [];
  const { data: pings, error: pingError } = nonceList.length
    ? await pingSupabase.from('reaction_round_pings').select('nonce, run_id, green_at, click_at').in('nonce', nonceList)
    : { data: [], error: null };
  if (pingError) {
    return NextResponse.json({ error: '회차 확인 기록을 읽지 못했습니다.' }, { status: 500 });
  }
  const roundProblem = checkRoundPings(runId, body.times, body?.nonces, (pings ?? []) as RoundPing[]);
  if (roundProblem) {
    return reject(400, roundProblem);
  }
  // 하루 지난 회차 신호는 정리한다(실패해도 상관없다).
  await pingSupabase
    .from('reaction_round_pings')
    .delete()
    .lt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  const expected = process.env.REACTION_CLAN_CODE;
  if (!expected) {
    return NextResponse.json({ error: '서버에 내전 비밀번호가 설정되지 않았습니다. 관리자에게 알려주세요.' }, { status: 500 });
  }
  if (code !== expected) {
    return reject(403, '내전 비밀번호가 틀렸습니다.');
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
    return reject(404, '클랜 명단에 없는 PUBG 닉네임입니다. 내전에 쓰는 닉네임 그대로 입력해주세요.');
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
        best_times: times,
        best_try: tryNumber,
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
