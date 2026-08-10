// dak.gg 에서 읽은 JSON 을 matches / match_participants 에 넣는다.
// 사용법: node scripts/import-dakgg-scrims.mjs [--dry-run] [파일.json ...]
//         (파일을 안 주면 data/dakgg-scrims/*.json 전부)
//
// 매치 ID 가 내용 해시라서 여러 번 돌려도 같은 행 하나다.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { loadEnvLocal, requireEnv } from './lib/env.mjs';
import { buildMatch, contentKey, validateFile } from './lib/dakgg.mjs';
import { classifyMatch } from '../supabase/functions/_shared/matches.mjs';
import { attachToSession } from '../supabase/functions/_shared/polling.mjs';

const DIR = 'data/dakgg-scrims';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const given = args.filter((a) => !a.startsWith('--'));
const paths =
  given.length > 0
    ? given
    : existsSync(DIR)
      ? readdirSync(DIR)
          .filter((f) => f.endsWith('.json'))
          .sort()
          .map((f) => join(DIR, f))
      : [];

if (paths.length === 0) {
  console.error(`${DIR} 에 JSON 이 없다 — scripts/read-dakgg-guide.md 를 볼 것`);
  process.exit(1);
}

// 형식 오류는 스택 트레이스가 아니라 한 줄로 보여준다 —
// 이 메시지를 읽고 JSON 을 고치는 게 이 스크립트의 절반이다.
function readAndValidate(path) {
  let file;
  try {
    file = JSON.parse(readFileSync(path, 'utf-8'));
  } catch (error) {
    console.error(`${path} 를 읽지 못했다: ${error.message}`);
    process.exit(1);
  }
  try {
    validateFile(file);
  } catch (error) {
    console.error(`${path}\n  ${error.message}`);
    process.exit(1);
  }
  return file;
}

// --dry-run 은 형식 검사만 한다 — DB 접속도 하지 않는다.
// 관리자가 화면을 읽은 직후 이걸 먼저 돌려서 못 읽은 칸을 찾는다.
if (dryRun) {
  for (const path of paths) {
    const file = readAndValidate(path);
    const people = file.matches[0].participants.length;
    console.log(`OK  ${path} — ${file.matches.length}경기, ${people}명`);
  }
  console.log('\n형식 검사만 했다. 적재하려면 --dry-run 없이 다시 돌릴 것.');
  process.exit(0);
}

loadEnvLocal();
const [url, serviceRoleKey] = requireEnv('NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY');
const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

function fail(message, error) {
  console.error(message, error?.message ?? '');
  process.exit(1);
}

const { data: clans, error: clanError } = await supabase.from('clans').select('id');
if (clanError) fail('clans 조회 실패:', clanError);
if (clans.length !== 1) fail(`clans 가 ${clans.length}개다 — 정확히 1개여야 한다`);
const clanId = clans[0].id;

// 닉네임 → 클랜원. 계정 ID 도 같이 가져온다.
// 계정 ID 가 붙어야 0005 의 중복 제약이 작동하고, 개인 지표를 낼 때
// dak.gg 경기가 API 경기와 같은 사람으로 합쳐진다.
const { data: accounts, error: accountError } = await supabase
  .from('member_pubg_accounts')
  .select('pubg_ign, pubg_account_id, member_id');
if (accountError) fail('member_pubg_accounts 조회 실패:', accountError);

const byIgn = new Map(
  accounts.map((a) => [a.pubg_ign, { memberId: a.member_id, accountId: a.pubg_account_id }]),
);

// 이미 저장된 매치에서도 닉네임↔계정 ID 를 배운다.
// 미등록 참가자(게스트, 탈퇴자)는 member_pubg_accounts 에 없지만
// API 로 들어온 매치에는 계정 ID 가 있다. 그걸 안 쓰면 같은 사람이
// 계정 ID 있는 행과 없는 행으로 갈라져서, 세션 참가자 수가 부풀어 오른다.
const { data: seen, error: seenError } = await supabase
  .from('match_participants')
  .select('pubg_ign, pubg_account_id')
  .not('pubg_account_id', 'is', null);
if (seenError) fail('기존 참가자 계정 조회 실패:', seenError);

let learned = 0;
for (const row of seen) {
  const known = byIgn.get(row.pubg_ign);
  if (!known) {
    byIgn.set(row.pubg_ign, { memberId: null, accountId: row.pubg_account_id });
    learned++;
  } else if (!known.accountId) {
    known.accountId = row.pubg_account_id;
    learned++;
  }
}
console.log(`닉네임 대응 ${byIgn.size}개 (기존 매치에서 배운 것 ${learned}개)`);

const resolve = (ign) => byIgn.get(ign) ?? null;

let inserted = 0;
let skipped = 0;
const unknownIgns = new Set();

for (const path of paths) {
  const file = readAndValidate(path);
  console.log(`\n${path} — ${file.scrimDate}`);

  // 그날 이미 DB 에 있는 매치의 (닉네임:킬) 집합.
  // 07-26 처럼 API 로 이미 들어온 경기를 dak.gg 에서 또 읽으면 지문이
  // matchId 와 달라 별개 행이 된다 — 그러면 그날 경기 수와 참가자 통계가 두 배가 된다.
  const dayStart = `${file.scrimDate}T00:00:00+09:00`;
  const dayEnd = `${file.scrimDate}T23:59:59+09:00`;
  const { data: existing, error: existingError } = await supabase
    .from('matches')
    .select('pubg_match_id')
    .gte('played_at', dayStart)
    .lte('played_at', dayEnd);
  if (existingError) fail('기존 매치 조회 실패:', existingError);

  const existingKeys = new Set();
  for (const m of existing) {
    const { data: rows, error: rowError } = await supabase
      .from('match_participants')
      .select('pubg_ign, kills')
      .eq('pubg_match_id', m.pubg_match_id);
    if (rowError) fail('기존 참가자 조회 실패:', rowError);
    existingKeys.add(contentKey(rows.map((r) => ({ ign: r.pubg_ign, kills: r.kills }))));
  }

  for (const raw of file.matches) {
    const { match, participants } = buildMatch(file, raw, resolve);

    const key = contentKey(raw.participants);
    if (existingKeys.has(key)) {
      console.log(`  건너뜀 ${raw.order}경기 (${raw.map}) — 이미 있는 경기다`);
      skipped++;
      continue;
    }

    const verdict = classifyMatch({
      matchType: match.match_type,
      participantCount: match.participant_count,
      clanMemberCount: match.clan_member_count,
    });
    if (!verdict.isScrim) {
      console.log(`  건너뜀 ${raw.order}경기 (${raw.map}) — 내전이 아니다: ${verdict.reason}`);
      skipped++;
      continue;
    }

    const sessionId = await attachToSession(supabase, { clanId, playedAt: match.played_at });

    const { error: matchError } = await supabase
      .from('matches')
      .upsert({ ...match, scrim_session_id: sessionId }, { onConflict: 'pubg_match_id' });
    if (matchError) fail(`${raw.order}경기 저장 실패:`, matchError);

    // 닉네임으로 충돌을 잡는다(0009 의 유니크 인덱스). 계정 ID 로 잡으면
    // 계정을 못 알아본 행은 NULL 이라 서로 같지 않아 중복이 그냥 들어간다.
    const { error: participantError } = await supabase
      .from('match_participants')
      .upsert(participants, { onConflict: 'pubg_match_id,pubg_ign' });
    if (participantError) fail(`${raw.order}경기 참가자 저장 실패:`, participantError);

    for (const p of participants) {
      if (p.pubg_account_id === null) unknownIgns.add(p.pubg_ign);
    }

    existingKeys.add(key);
    inserted++;
    console.log(
      `  저장 ${raw.order}경기 ${match.map_name} — ${participants.length}명 ` +
        `(클랜원 ${match.clan_member_count}명), ${match.pubg_match_id}`,
    );
  }
}

console.log(`\n저장 ${inserted}경기 / 건너뜀 ${skipped}경기`);
if (unknownIgns.size > 0) {
  console.log(`\n못 알아본 닉네임 ${unknownIgns.size}개:`);
  console.log(`  ${[...unknownIgns].join(', ')}`);
  console.log('  탈퇴한 옛 클랜원이거나 게스트다. 개명한 클랜원이 섞여 있으면');
  console.log(
    '  scripts/link-alt-account.mjs 로 별칭을 넣고 scripts/relink-participants.mjs 를 돌린다.',
  );
}
