// 종합 시트 한 장을 전사 JSON 으로 만든다 (그날의 첫 파일 = 라운드가 다 찬 최종본).
// 사용법: node scripts/add-screenshot-sheet.mjs <날짜> <시트파일> "<팀들>" [메모]
//
//   팀들 = 팀번호:PLACE:KILL:TOTAL:1라운드등수/킬,2라운드등수/킬,... ; 다음 팀 ...
//   예: "14:15:20:35:7/3,4/2,1/15,13/0;13:6:27:33:3/9,10/5,7/8,14/5"
//
// PLACE/KILL/TOTAL 은 시트 왼쪽의 합계 칸이다. 적어두면 옮겨 적다 틀린 칸이
// 여기서 걸린다 — 라운드 점수 합과 킬 합이 그 값과 맞아야 저장된다.
// 라운드별 점수는 등수에서 나오므로 따로 적지 않는다.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { crossCheck, placementPoints } from './lib/screenshot-scrims.mjs';

const [date, sheetFile, spec, note] = process.argv.slice(2);
if (!date || !sheetFile || !spec) {
  console.error('사용법: node scripts/add-screenshot-sheet.mjs <날짜> <시트파일> "<팀들>" [메모]');
  process.exit(1);
}

const sheet = spec
  .split(';')
  .map((s) => s.trim())
  .filter(Boolean)
  .map((chunk) => {
    const [teamNo, placePoints, totalKills, total, rounds] = chunk.split(':');
    return {
      teamNo: Number(teamNo),
      placePoints: Number(placePoints),
      totalKills: Number(totalKills),
      total: Number(total),
      rounds: rounds.split(',').map((r, i) => {
        const [place, kills] = r.split('/');
        return { round: i + 1, place: Number(place), kills: Number(kills) };
      }),
    };
  });

const path = `data/screenshot-scrims/${date}.json`;
// 이미 인게임을 넣어둔 파일이 있으면 시트만 갈아끼운다.
const existing = existsSync(path) ? JSON.parse(readFileSync(path, 'utf-8')) : { matches: [] };
const file = {
  scrimDate: date,
  sheetFile,
  note: note ?? existing.note ?? '',
  sheet,
  matches: existing.matches ?? [],
};

// 인게임을 아직 안 넣었으면 시트 자체 검산만 본다.
const problems = crossCheck(file).filter(
  (p) => !/인게임 이미지에 없다|시트에 그 라운드가 없다/.test(p),
);
if (problems.length > 0) {
  console.error(`${date} 시트 — 검산이 안 맞는다:`);
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}

if (!existsSync('data/screenshot-scrims')) mkdirSync('data/screenshot-scrims', { recursive: true });
writeFileSync(path, JSON.stringify(file, null, 2));

const rounds = sheet[0].rounds.length;
const winner = [...sheet].sort((a, b) => b.total - a.total)[0];
console.log(
  `${date} 시트 저장 — ${sheet.length}팀 ${rounds}라운드, 검산 통과 ` +
    `(1위 ${winner.teamNo}팀 ${winner.total}점)`,
);
// 등수가 1..N 순열인지는 crossCheck 가 이미 봤다. 점수표도 한 번 더 보여준다.
console.log(
  `  점수표 확인: ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(placementPoints).join('/')}`,
);
