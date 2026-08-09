import { describe, expect, it } from 'vitest';
import { chunk, extractAlternates, generateVariants, parseRosterTsv } from './roster.mjs';

describe('parseRosterTsv', () => {
  it('주석과 머리말을 건너뛰고 데이터 행만 읽는다', () => {
    const text = [
      '> 설명 줄',
      '#',
      '# tier\tdisplay_nick\tdiscord_username\tign_guess\tnote',
      '2.5\tEz_LaPaz(현석/94)\tdlrpajsep\tEz_LaPaz\t',
      '0\tEz_Code(98)\tyeol2.\tEz_Code\tPhase1에서 이미 등록됨',
    ].join('\n');

    expect(parseRosterTsv(text)).toEqual([
      {
        tier: 2.5,
        displayNick: 'Ez_LaPaz(현석/94)',
        discordUsername: 'dlrpajsep',
        ignGuess: 'Ez_LaPaz',
        note: '',
      },
      {
        tier: 0,
        displayNick: 'Ez_Code(98)',
        discordUsername: 'yeol2.',
        ignGuess: 'Ez_Code',
        note: 'Phase1에서 이미 등록됨',
      },
    ]);
  });

  it('note 컬럼이 아예 없는 행도 읽는다', () => {
    const text = '3\tEz_BARA\telelelel4554\tEz_BARA';
    expect(parseRosterTsv(text)).toHaveLength(1);
    expect(parseRosterTsv(text)[0].note).toBe('');
  });

  it('티어를 숫자로 변환한다', () => {
    const text = '1.5\tEz_HoDDu(95)\tanyang95\tEz_HoDDu\t';
    expect(parseRosterTsv(text)[0].tier).toBe(1.5);
  });
});

describe('extractAlternates', () => {
  it('대안 하나를 뽑는다', () => {
    expect(extractAlternates('? 0(숫자)/O 판독 (대안: Ez_DRO1)')).toEqual(['Ez_DRO1']);
  });

  it('쉼표로 나열된 대안을 모두 뽑는다', () => {
    expect(extractAlternates('? I/l 판독 (대안: Ez_LiII, Ez_LilI)')).toEqual(['Ez_LiII', 'Ez_LilI']);
  });

  it('대안 표기가 없으면 빈 배열을 준다', () => {
    expect(extractAlternates('? U 개수')).toEqual([]);
    expect(extractAlternates('')).toEqual([]);
  });
});

describe('generateVariants', () => {
  it('명시된 대안을 포함한다', () => {
    expect(generateVariants('Ez_DR01', ['Ez_DRO1'])).toContain('Ez_DRO1');
  });

  it('0과 O를 서로 바꾼 변형을 만든다', () => {
    const variants = generateVariants('Ez_HaAng0_0', []);
    expect(variants).toContain('Ez_HaAngO_O');
    expect(variants).toContain('Ez_HaAngO_0');
  });

  it('1, l, I 를 서로 바꾼 변형을 만든다', () => {
    expect(generateVariants('Ez_wNgkdl', [])).toContain('Ez_wNgkd1');
    expect(generateVariants('Ez_T1ger', [])).toContain('Ez_Tlger');
  });

  it('3글자 이상 반복되는 문자의 개수를 하나 늘리고 줄인 변형을 만든다', () => {
    const variants = generateVariants('Ez_reddd', []);
    expect(variants).toContain('Ez_redd');
    expect(variants).toContain('Ez_redddd');
  });

  it('원본 자신은 후보에 넣지 않는다', () => {
    expect(generateVariants('Ez_Code', [])).not.toContain('Ez_Code');
  });

  it('중복 없이 돌려준다', () => {
    const variants = generateVariants('Ez_DR01', ['Ez_DRO1']);
    expect(new Set(variants).size).toBe(variants.length);
  });

  it('혼동 문자가 너무 많으면 조합 폭발을 막고 명시된 대안만 준다', () => {
    // 0/O/1/l/I 후보 자리가 5곳 이상이면 2^5=32개를 넘어간다
    const variants = generateVariants('Ez_0l1I0l1', ['Ez_안전한대안']);
    expect(variants).toEqual(['Ez_안전한대안']);
  });
});

describe('chunk', () => {
  it('지정한 크기로 나눈다', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('빈 배열은 빈 배열을 준다', () => {
    expect(chunk([], 10)).toEqual([]);
  });
});
