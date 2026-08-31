import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MapRecords } from './MapRecords';
import { sortByScrimOrder, type MapStat } from '@/lib/mapStats';

afterEach(cleanup);

function stat(partial: Partial<MapStat> & { mapName: string; label: string }): MapStat {
  return {
    memberId: 'm-1',
    games: 8,
    avgRank: 8,
    avgKills: 1,
    totalGames: 32,
    overallAvgRank: 8.9,
    overallAvgKills: 0.9,
    ...partial,
  };
}

// Ez_Daks 의 실제 값이다 — 전체 16경기 평균 8.94등에 맵마다 4경기씩.
const STATS: MapStat[] = [
  stat({ mapName: 'Neon_Main', label: '론도', games: 4, avgRank: 4.25, avgKills: 0.75, totalGames: 16, overallAvgRank: 8.94, overallAvgKills: 0.5 }),
  stat({ mapName: 'Baltic_Main', label: '에란겔', games: 4, avgRank: 10.25, avgKills: 0.25, totalGames: 16, overallAvgRank: 8.94, overallAvgKills: 0.5 }),
  stat({ mapName: 'Desert_Main', label: '미라마', games: 4, avgRank: 8.75, avgKills: 0.5, totalGames: 16, overallAvgRank: 8.94, overallAvgKills: 0.5 }),
  stat({ mapName: 'Tiger_Main', label: '태이고', games: 4, avgRank: 12.5, avgKills: 0.5, totalGames: 16, overallAvgRank: 8.94, overallAvgKills: 0.5 }),
];

describe('sortByScrimOrder', () => {
  it('내전 라운드 순서대로 놓는다 — 사람들이 그날 겪은 순서다', () => {
    const rows = sortByScrimOrder([
      { mapName: 'Tiger_Main' },
      { mapName: 'Baltic_Main' },
      { mapName: 'Neon_Main' },
      { mapName: 'Desert_Main' },
    ]);
    expect(rows.map((r) => r.mapName)).toEqual([
      'Neon_Main',
      'Baltic_Main',
      'Desert_Main',
      'Tiger_Main',
    ]);
  });

  it('순서표에 없는 맵은 뒤에 붙인다 — 내전 구성이 바뀌어도 화면이 안 깨진다', () => {
    const rows = sortByScrimOrder([{ mapName: 'Savage_Main' }, { mapName: 'Neon_Main' }]);
    expect(rows.map((r) => r.mapName)).toEqual(['Neon_Main', 'Savage_Main']);
  });
});

describe('MapRecords', () => {
  it('뛴 맵을 전부, 라운드 순서대로 보여준다', () => {
    render(<MapRecords stats={STATS} />);
    const labels = screen.getAllByText(/^(론도|에란겔|미라마|태이고)$/).map((el) => el.textContent);
    expect(labels).toEqual(['론도', '에란겔', '미라마', '태이고']);
  });

  // 기준선은 네 줄이 공유하는 '내 전체 평균'이다. 8.94 − 4.25 = 4.69.
  it('내 전체 평균과의 차이를 적는다', () => {
    render(<MapRecords stats={STATS} />);
    const row = screen.getByTestId('map-row-Neon_Main');
    expect(row.textContent).toContain('4.3등');
    expect(row.textContent).toContain('▲4.7');
  });

  it('경기 수를 같이 적는다 — 표본이 얇으면 얇다는 것이 숫자로 보여야 한다', () => {
    render(<MapRecords stats={STATS} />);
    expect(screen.getByTestId('map-row-Tiger_Main').textContent).toContain('4경기');
    expect(screen.getByText(/16경기 · 평균 8.9등/)).toBeInTheDocument();
  });

  it('평균보다 못한 맵은 반대쪽으로 적는다', () => {
    render(<MapRecords stats={STATS} />);
    expect(screen.getByTestId('map-row-Tiger_Main').textContent).toContain('▼3.6');
  });

  it('기록이 없으면 안내 문구를 보인다', () => {
    render(<MapRecords stats={[]} />);
    expect(screen.getByText('아직 맵별로 나눠 볼 기록이 없습니다.')).toBeInTheDocument();
  });
});
