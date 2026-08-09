// 클랜원 명단 TSV를 다루는 순수 함수들.
// 외부 의존(파일 시스템, 네트워크)이 없어야 테스트가 쉽고 빠르다.

const CONFUSABLE_GROUPS = [
  ['0', 'O'],
  ['1', 'l', 'I'],
];

// 혼동 문자 자리가 이보다 많으면 조합이 2^n으로 터진다.
// 그런 이름은 자동 추측을 포기하고 사람이 확인하게 둔다.
const MAX_CONFUSABLE_POSITIONS = 4;

export function parseRosterTsv(text) {
  const rows = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    if (line.startsWith('>') || line.startsWith('#')) continue;

    const cols = line.split('\t');
    if (cols.length < 4) continue;

    rows.push({
      tier: Number(cols[0]),
      displayNick: cols[1],
      discordUsername: cols[2],
      ignGuess: cols[3],
      note: (cols[4] ?? '').trim(),
    });
  }
  return rows;
}

export function extractAlternates(note) {
  const match = note.match(/\(대안:\s*([^)]+)\)/);
  if (!match) return [];
  return match[1]
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function confusableVariants(ign) {
  // 각 자리마다 바꿔 넣을 수 있는 문자 목록을 만든다.
  const positions = [];
  for (let i = 0; i < ign.length; i++) {
    const group = CONFUSABLE_GROUPS.find((g) => g.includes(ign[i]));
    if (group) positions.push({ index: i, options: group });
  }

  if (positions.length === 0) return [];
  if (positions.length > MAX_CONFUSABLE_POSITIONS) return null; // 폭발 방지 신호

  let results = [ign];
  for (const { index, options } of positions) {
    const next = [];
    for (const partial of results) {
      for (const option of options) {
        next.push(partial.slice(0, index) + option + partial.slice(index + 1));
      }
    }
    results = next;
  }
  return results;
}

function repeatVariants(ign) {
  // 같은 글자가 3번 이상 이어지면 개수를 하나 늘리고 줄인 것을 후보로 만든다.
  // (스크린샷에서 UUUU 개수를 정확히 세기 어렵다)
  const results = [];
  const runs = ign.match(/(.)\1{2,}/g) ?? [];
  for (const run of runs) {
    const ch = run[0];
    const start = ign.indexOf(run);
    const before = ign.slice(0, start);
    const after = ign.slice(start + run.length);
    results.push(before + ch.repeat(run.length - 1) + after);
    results.push(before + ch.repeat(run.length + 1) + after);
  }
  return results;
}

export function generateVariants(ign, explicit = []) {
  const confusable = confusableVariants(ign);

  // 혼동 문자 자리가 너무 많으면 자동 추측을 포기하고 명시된 대안만 쓴다.
  if (confusable === null) {
    return [...new Set(explicit)].filter((v) => v !== ign);
  }

  const all = [...explicit, ...confusable, ...repeatVariants(ign)];
  return [...new Set(all)].filter((v) => v !== ign);
}

export function chunk(items, size) {
  const result = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}
