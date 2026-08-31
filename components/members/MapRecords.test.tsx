import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MapRecords } from './MapRecords';
import type { MapBadge, MapStat } from '@/lib/mapStats';

afterEach(cleanup);

function stat(partial: Partial<MapStat> & { mapName: string; label: string }): MapStat {
  return {
    memberId: 'm-1',
    games: 8,
    avgRank: 6,
    avgKills: 1,
    otherAvgRank: 8,
    rankDelta: 2,
    ...partial,
  };
}

const STATS: MapStat[] = [
  stat({ mapName: 'Neon_Main', label: '론도', avgRank: 4.3, otherAvgRank: 10.6, rankDelta: 6.3, games: 4 }),
  stat({ mapName: 'Baltic_Main', label: '에란겔', avgRank: 10.3, otherAvgRank: 8.5, rankDelta: -1.8 }),
  stat({ mapName: 'Desert_Main', label: '미라마', avgRank: 8.8, otherAvgRank: 9.1, rankDelta: 0.3 }),
  stat({ mapName: 'Tiger_Main', label: '태이고', avgRank: 12.5, otherAvgRank: 7.8, rankDelta: -4.8 }),
];

describe('MapRecords', () => {
  it('네 맵을 라운드 순서대로 늘어놓는다', () => {
    render(<MapRecords stats={STATS} badges={[]} />);
    const labels = screen.getAllByText(/^(론도|에란겔|미라마|태이고)$/).map((el) => el.textContent);
    expect(labels).toEqual(['론도', '에란겔', '미라마', '태이고']);
  });

  it('내 평균등수와 다른 맵 평균을 같이 적는다', () => {
    render(<MapRecords stats={STATS} badges={[]} />);
    const row = screen.getByTestId('map-row-Neon_Main');
    expect(row.textContent).toContain('4.3등');
    expect(row.textContent).toContain('▲6.3');
    expect(row.textContent).toContain('4경기 · 다른 맵 10.6등');
  });

  it('자격(4경기) 미만이면 숫자 대신 기록 부족이라 적는다', () => {
    render(
      <MapRecords
        stats={[stat({ mapName: 'Neon_Main', label: '론도', games: 2, rankDelta: 9 })]}
        badges={[]}
      />,
    );
    expect(screen.getByTestId('map-row-Neon_Main').textContent).toContain('기록 부족');
  });

  it('그 맵의 신·똥이면 맵 이름 옆에 표시가 붙는다', () => {
    const badge: MapBadge = {
      memberId: 'm-1',
      mapName: 'Neon_Main',
      label: '론도',
      kind: 'god',
      games: 4,
      avgRank: 4.3,
      otherAvgRank: 10.6,
      rankDelta: 6.3,
    };
    render(<MapRecords stats={STATS} badges={[badge]} />);
    expect(within(screen.getByTestId('map-row-Neon_Main')).getByTitle('이 맵의 신')).toBeInTheDocument();
    expect(within(screen.getByTestId('map-row-Tiger_Main')).queryByTitle(/이 맵의/)).toBeNull();
  });

  it('기록이 없으면 안내 문구를 보인다', () => {
    render(<MapRecords stats={[]} badges={[]} />);
    expect(screen.getByText('아직 맵별로 나눠 볼 기록이 없습니다.')).toBeInTheDocument();
  });
});
