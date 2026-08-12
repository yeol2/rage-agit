// 인게임 스크린샷 한 장에서 읽은 한 라운드를 전사 JSON 에 채워 넣는다.
// 사용법: node scripts/add-screenshot-round.mjs <날짜> <라운드> <출처파일> "<팀들>"
//
//   팀들 = 팀번호:등수:닉=킬,닉=킬,... ; 팀번호:등수:...
//   예: "14:1:Dotnl=7,isfp=2,ekrtm=1,Dongpal=1;5:2:Yubin01=0,Zzang9=0"
//
// 닉네임에 Ez_ 가 없으면 붙여준다. 스크린샷 아래쪽에서 4번째 선수가 잘렸으면
// 킬 자리에 ? 를 적는다 — 시트의 팀 총킬에서 역산해 채운다.
//
// 라운드를 여러 번 넣어도 같은 라운드는 덮어쓴다.

import { readFileSync, writeFileSync } from 'node:fs';
import { crossCheck, validateFile } from './lib/screenshot-scrims.mjs';

const [date, roundArg, sourceFile, spec] = process.argv.slice(2);
if (!date || !roundArg || !sourceFile || !spec) {
  console.error('사용법: node scripts/add-screenshot-round.mjs <날짜> <라운드> <출처파일> "<팀들>"');
  process.exit(1);
}

const path = `data/screenshot-scrims/${date}.json`;
const file = JSON.parse(readFileSync(path, 'utf-8'));
const round = Number(roundArg);

// 시트에서 그 라운드의 팀별 총킬을 꺼내둔다 — 잘린 선수를 역산하는 데 쓴다.
const sheetKills = new Map();
for (const team of file.sheet) {
  const r = team.rounds.find((x) => x.round === round);
  if (r) sheetKills.set(team.teamNo, r.kills);
}

const teams = spec
  .split(';')
  .map((s) => s.trim())
  .filter(Boolean)
  .map((chunk) => {
    const [teamNo, place, roster] = chunk.split(':');
    const players = roster.split(',').map((entry) => {
      const [rawIgn, rawKills] = entry.split('=');
      const ign = rawIgn.startsWith('Ez_') ? rawIgn : `Ez_${rawIgn}`;
      return { ign, kills: rawKills === '?' ? null : Number(rawKills) };
    });

    // 잘린 선수: 시트의 팀 총킬에서 보이는 선수들의 킬을 뺀다.
    const unknown = players.filter((p) => p.kills === null);
    if (unknown.length > 0) {
      const total = sheetKills.get(Number(teamNo));
      if (total === undefined) {
        console.error(`${teamNo}팀이 시트에 없어서 잘린 선수를 역산할 수 없다`);
        process.exit(1);
      }
      if (unknown.length > 1) {
        console.error(`${teamNo}팀: 킬을 모르는 선수가 ${unknown.length}명이라 역산이 안 된다`);
        process.exit(1);
      }
      const seen = players.reduce((s, p) => s + (p.kills ?? 0), 0);
      unknown[0].kills = total - seen;
      if (unknown[0].kills < 0) {
        console.error(`${teamNo}팀: 보이는 킬 합(${seen})이 시트 총킬(${total})보다 크다`);
        process.exit(1);
      }
    }

    return { teamNo: Number(teamNo), place: Number(place), players };
  });

file.matches = file.matches.filter((m) => m.round !== round);
file.matches.push({ round, sourceFile, teams });
file.matches.sort((a, b) => a.round - b.round);

try {
  validateFile(file);
} catch (error) {
  console.error(`형식 오류: ${error.message}`);
  process.exit(1);
}

// 아직 안 넣은 라운드에 대한 '인게임에 없다' 경고는 걸러낸다 —
// 지금 넣은 라운드가 시트와 맞는지만 본다.
const problems = crossCheck(file).filter((p) => !/인게임 이미지에 없다|시트에 그 라운드가 없다/.test(p));
if (problems.length > 0) {
  console.error(`${date} ${round}경기 — 시트와 어긋난다:`);
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}

writeFileSync(path, JSON.stringify(file, null, 2));
const done = file.matches.map((m) => m.round).join(',');
console.log(`${date} ${round}경기 저장 — 시트 대조 통과 (${teams.length}팀). 지금까지 ${done}경기`);
