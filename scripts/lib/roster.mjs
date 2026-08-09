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

function caseVariants(ign) {
  // PUBG 닉네임은 대소문자를 구분하는데, 디스코드 별명에는 대충 적는 사람이 많다.
  // (실제로 별명 Ez_NARA 의 진짜 IGN 은 Ez_Nara 였다)
  //
  // 글자마다 대소문자를 다 시도하면 2^n 으로 터지므로, 사람이 실제로 쓰는
  // 몇 가지 형태만 만든다: 전부 소문자, 전부 대문자, 그리고 'Ez_' 같은
  // 클랜 태그 접두사는 그대로 두고 뒷부분만 바꾼 것들.
  const results = [ign.toLowerCase(), ign.toUpperCase()];

  const underscore = ign.indexOf('_');
  if (underscore > 0 && underscore < ign.length - 1) {
    const prefix = ign.slice(0, underscore + 1);
    const rest = ign.slice(underscore + 1);
    results.push(prefix + rest.toLowerCase());
    results.push(prefix + rest.toUpperCase());
    results.push(prefix + rest[0].toUpperCase() + rest.slice(1).toLowerCase());
  }

  return results;
}

export function generateVariants(ign, explicit = []) {
  const confusable = confusableVariants(ign);

  // 혼동 문자 자리가 너무 많으면 조합 폭발을 피해 그 부분만 건너뛴다.
  // 대소문자 변형은 개수가 고정이라 그대로 시도한다.
  const all = [
    ...explicit,
    ...(confusable ?? []),
    ...repeatVariants(ign),
    ...caseVariants(ign),
  ];
  return [...new Set(all)].filter((v) => v !== ign);
}

export function chunk(items, size) {
  const result = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}
