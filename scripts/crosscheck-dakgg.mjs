// dak.gg 에서 읽은 JSON 을 이미 DB 에 있는 같은 날 API 데이터와 대조한다.
// 사용법: node scripts/crosscheck-dakgg.mjs data/dakgg-scrims/2026-07-26.json
//
// 아무것도 쓰지 않는다. 파서가 칼럼을 한 칸 밀어 읽어도 숫자는 그럴듯해
// 보이기 때문에, 적재하기 전에 사람 단위로 대조할 수 있는 유일한 기회를 쓴다.
// 07-26 은 API 로 넣은 2경기와 dak.gg 의 같은 2경기가 겹치는 날이다.

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { loadEnvLocal, requireEnv } from './lib/env.mjs';
import { contentKey, toMapName, validateFile } from './lib/dakgg.mjs';

loadEnvLocal();
const [url, serviceRoleKey] = requireEnv('NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY');
const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

const path = process.argv[2];
if (!path) {
  console.error('사용법: node scripts/crosscheck-dakgg.mjs <파일.json>');
  process.exit(1);
}

const file = JSON.parse(readFileSync(path, 'utf-8'));
validateFile(file);

// 그날 KST 하루에 해당하는 구간.
const dayStart = `${file.scrimDate}T00:00:00+09:00`;
const dayEnd = `${file.scrimDate}T23:59:59+09:00`;

const { data: dbMatches, error } = await supabase
  .from('matches')
  .select('pubg_match_id, map_name, played_at')
  .gte('played_at', dayStart)
  .lte('played_at', dayEnd)
  .order('played_at');
if (error) {
  console.error('matches 조회 실패:', error.message);
  process.exit(1);
}

if (dbMatches.length === 0) {
  console.log(`${file.scrimDate} 에 DB 매치가 없다 — 대조할 것이 없다.`);
  process.exit(0);
}

console.log(`${file.scrimDate}: DB ${dbMatches.length}경기 / JSON ${file.matches.length}경기\n`);

const problems = [];

for (const dbMatch of dbMatches) {
  const { data: dbRows, error: rowError } = await supabase
    .from('match_participants')
    .select('pubg_ign, kills, damage_dealt, team_rank')
    .eq('pubg_match_id', dbMatch.pubg_match_id);
  if (rowError) {
    console.error('participants 조회 실패:', rowError.message);
    process.exit(1);
  }

  // 어느 JSON 경기가 이 DB 경기인지는 (닉네임:킬) 집합으로 찾는다.
  // 같은 날 4경기는 인원이 같아서 닉네임만으로는 구분되지 않는다.
  const dbKey = contentKey(dbRows.map((r) => ({ ign: r.pubg_ign, kills: r.kills })));
  const jsonMatch = file.matches.find((m) => contentKey(m.participants) === dbKey);

  const when = dbMatch.played_at.slice(11, 16);
  if (!jsonMatch) {
    problems.push(`${when} (${dbMatch.map_name}): 대응하는 JSON 경기를 못 찾았다`);
    console.log(`  X ${when} ${dbMatch.map_name} — 짝을 못 찾음`);
    continue;
  }

  // 짝을 찾았다는 건 닉네임과 킬이 전부 같다는 뜻이다. 나머지를 본다.
  if (toMapName(jsonMatch.map) !== dbMatch.map_name) {
    problems.push(`${when}: 맵이 다르다 — DB ${dbMatch.map_name} / JSON ${jsonMatch.map}`);
  }

  const jsonByIgn = new Map(jsonMatch.participants.map((p) => [p.ign, p]));
  let mismatches = 0;
  for (const row of dbRows) {
    const p = jsonByIgn.get(row.pubg_ign);
    if (!p) continue; // 킬 집합이 같으므로 여기 걸릴 일은 없다
    if (p.teamRank !== row.team_rank) {
      problems.push(`${when} ${row.pubg_ign}: 순위 DB ${row.team_rank} / JSON ${p.teamRank}`);
      mismatches++;
    }
    // 딜량은 dak.gg 가 반올림해서 보여줄 수 있으므로 1 이내면 같다고 본다.
    if (Math.abs(Number(p.damageDealt) - Number(row.damage_dealt)) > 1) {
      problems.push(
        `${when} ${row.pubg_ign}: 딜량 DB ${Number(row.damage_dealt).toFixed(1)} / JSON ${p.damageDealt}`,
      );
      mismatches++;
    }
  }

  const mark = mismatches === 0 ? 'O' : 'X';
  console.log(
    `  ${mark} ${when} ${dbMatch.map_name} — ${dbRows.length}명 대조, 불일치 ${mismatches}건`,
  );
}

console.log('');
if (problems.length > 0) {
  console.log(`불일치 ${problems.length}건:`);
  for (const p of problems.slice(0, 20)) console.log(`  ${p}`);
  if (problems.length > 20) console.log(`  … 그리고 ${problems.length - 20}건 더`);
  console.log('\n적재하지 말 것. 파서를 먼저 고쳐야 한다.');
  process.exit(1);
}

console.log('두 출처가 일치한다. 적재해도 된다.');
