// data/departed-members.tsv 읽기·쓰기. apply-departed-members / verify-dakgg-import 가 같이 쓴다.
//
// 형식 (한 사람당 한 줄, '>' 로 시작하는 줄은 주석):
//   본계정IGN \t 디코ID \t 배그계정ID \t 확인한 날짜 \t 비고
// 2026-09-15 이전 줄은 디코ID·배그계정ID 가 비어 있다.
//
// 부계정은 사람이 적지 않는다. apply-departed-members 가 정리할 때 비고 끝에
// "부계정: A, B" 로 붙여 둔다 — 그래야 남겨 둔 참가 기록의 부계정 닉을
// 점검 스크립트가 '누구인지 모르는 닉'으로 다시 띄우지 않는다.

import { readFileSync, writeFileSync } from 'node:fs';

export const DEPARTED_PATH = 'data/departed-members.tsv';

const ALT_MARK = '부계정:';

export function readDeparted(path = DEPARTED_PATH) {
  const lines = readFileSync(path, 'utf-8').split('\n');
  const people = [];
  lines.forEach((raw, index) => {
    const line = raw.replace(/\r$/, '');
    if (!line.trim() || line.startsWith('>')) return;
    const [ign = '', discordUsername = '', accountId = '', date = '', note = ''] = line
      .split('\t')
      .map((s) => s.trim());
    const altIgns = note.includes(ALT_MARK)
      ? note.slice(note.indexOf(ALT_MARK) + ALT_MARK.length).split(',').map((s) => s.trim()).filter(Boolean)
      : [];
    people.push({ lineIndex: index, ign, discordUsername, accountId, date, note, altIgns });
  });
  return { lines, people };
}

// 점검용 — 남겨 둔 참가 기록에서 탈퇴자로 볼 닉네임과 계정 ID 전부
export function departedIdentifiers(path = DEPARTED_PATH) {
  const { people } = readDeparted(path);
  return {
    igns: new Set(people.flatMap((p) => [p.ign, ...p.altIgns]).filter(Boolean)),
    accountIds: new Set(people.map((p) => p.accountId).filter(Boolean)),
  };
}

// 한 사람 줄을 고쳐 쓴다. 비어 있던 디코ID·계정ID 를 채우고 부계정을 비고에 붙인다.
export function updateDepartedLine(path, lines, person, { discordUsername, accountId, altIgns }) {
  const baseNote = person.note.includes(ALT_MARK)
    ? person.note.slice(0, person.note.indexOf(ALT_MARK)).trim()
    : person.note;
  const note = altIgns.length ? `${baseNote} ${ALT_MARK} ${altIgns.join(', ')}`.trim() : baseNote;
  lines[person.lineIndex] = [
    person.ign,
    person.discordUsername || discordUsername || '',
    person.accountId || accountId || '',
    person.date,
    note,
  ].join('\t');
  writeFileSync(path, lines.join('\n'));
}
