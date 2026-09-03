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
    totalGames: 32,
    overallAvgRank: 8.9,
    ...partial,
  };
}

// Ez_Daks 의 실제 값이다 — 역대 56경기 평균 9.18등에 맵마다 14경기씩.
// 맵마다 정확히 같은 수인 것은 우연이 아니다. 내전 참가는 전부 아니면 전무라
// 한 번 나오면 네 맵을 다 뛴다(scrimCounting 의 4경기/1내전 불변식).
const STATS: MapStat[] = [
  stat({ mapName: 'Neon_Main', label: '론도', games: 14, avgRank: 7.36, totalGames: 56, overallAvgRank: 9.18 }),
  stat({ mapName: 'Baltic_Main', label: '에란겔', games: 14, avgRank: 9.71, totalGames: 56, overallAvgRank: 9.18 }),
  stat({ mapName: 'Desert_Main', label: '미라마', games: 14, avgRank: 9.0, totalGames: 56, overallAvgRank: 9.18 }),
  stat({ mapName: 'Tiger_Main', label: '태이고', games: 14, avgRank: 10.64, totalGames: 56, overallAvgRank: 9.18 }),
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

  // 기준선은 네 줄이 공유하는 '내 전체 평균'이다. 9.18 − 7.36 = 1.82.
  it('내 전체 평균과의 차이를 적는다', () => {
    render(<MapRecords stats={STATS} />);
    const row = screen.getByTestId('map-row-Neon_Main');
    expect(row.textContent).toContain('7.4등');
    expect(row.textContent).toContain('▲1.8');
  });

  it('경기 수를 같이 적는다 — 표본이 얇으면 얇다는 것이 숫자로 보여야 한다', () => {
    render(<MapRecords stats={STATS} />);
    expect(screen.getByTestId('map-row-Tiger_Main').textContent).toContain('14경기');
    expect(screen.getByText(/56경기 · 평균 9.2등/)).toBeInTheDocument();
  });

  // 스크린샷 시대의 맵을 라운드 번호에서 되살린 뒤로(0042) 맵 기록이 전적 요약과
  // 같은 경기를 센다. 그래서 시기를 자르는 딱지를 떼고 다른 화면과 같은 말을 쓴다.
  it('역대 전체를 센다고 밝힌다 — 위 전적 요약과 경기 수가 같다', () => {
    render(<MapRecords stats={STATS} />);
    expect(screen.getByText(/^역대 전체 56경기/)).toBeInTheDocument();
  });

  it('평균보다 못한 맵은 반대쪽으로 적는다', () => {
    render(<MapRecords stats={STATS} />);
    expect(screen.getByTestId('map-row-Tiger_Main').textContent).toContain('▼1.5');
  });

  // 0.0 은 "아주 작은 차이가 있다"로 읽히지만 실제로는 차이가 없다는 뜻이다.
  // 화살표까지 달면 없는 우열을 있다고 말하게 된다.
  it('차이가 없으면 0.0 대신 줄표를 적는다 — 화살표도 안 붙인다', () => {
    render(
      <MapRecords
        stats={[
          stat({ mapName: 'Neon_Main', label: '론도', avgRank: 8.9, overallAvgRank: 8.9 }),
        ]}
      />,
    );
    const row = screen.getByTestId('map-row-Neon_Main');
    expect(row.textContent).not.toContain('0.0');
    expect(row.textContent).not.toMatch(/[▲▼]/);
    expect(screen.getByLabelText('차이 없음')).toBeInTheDocument();
  });

  // 그림만으로는 오른쪽이 좋은 쪽인지 알 수 없다.
  it('읽는 법을 한 줄로 적는다', () => {
    render(<MapRecords stats={STATS} />);
    expect(screen.getByText(/잘한 맵은 오른쪽/)).toBeInTheDocument();
  });

  it('기록이 없으면 안내 문구를 보인다', () => {
    render(<MapRecords stats={[]} />);
    expect(screen.getByText('아직 맵별로 나눠 볼 기록이 없습니다.')).toBeInTheDocument();
  });
});
