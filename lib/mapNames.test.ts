import { describe, expect, it } from 'vitest';
import { mapLabel } from './mapNames';

describe('mapLabel', () => {
  it('API 맵 값을 한글로 바꾼다', () => {
    expect(mapLabel('Neon_Main')).toBe('론도');
    expect(mapLabel('Baltic_Main')).toBe('에란겔');
    expect(mapLabel('Desert_Main')).toBe('미라마');
    expect(mapLabel('Tiger_Main')).toBe('태이고');
  });

  it('맵을 모르는 경기는 - 로 둔다', () => {
    expect(mapLabel(null)).toBe('-');
  });

  it('처음 보는 맵은 API 값을 그대로 보여준다', () => {
    // '-' 로 덮으면 새 맵이 나온 것과 맵이 없는 것이 구분되지 않는다.
    expect(mapLabel('Newmap_Main')).toBe('Newmap_Main');
  });
});
