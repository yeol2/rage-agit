// 내전을 세는 단위를 한 곳에 모은다.
//
// 화면과 코드가 "16매치", "10경기", "내전 4회", "2회 이상 함께"를 섞어 쓰고
// 있었다. 전부 같은 것을 세는 말인데 단위가 달라서, 어떤 기준이 어떤 기준보다
// 센지 머릿속에서 4로 나눠봐야 알 수 있었다.
//
// 기준 단위는 **내전 회차**다. 클랜이 실제로 세는 단위이고, 경기 수는 여기서
// 파생된다 — 참가하면 4라운드를 다 뛰기 때문이다. 실측으로도 예외가 없다:
// 참가 내전 1~17회인 170명 전원이 정확히 회차 × 4 경기다.
export const MATCHES_PER_SCRIM = 4;

export function matchesFor(scrims: number): number {
  return scrims * MATCHES_PER_SCRIM;
}

/**
 * 집계에 오를 자격 — 내전 이 횟수 이상 참가.
 *
 * 리더보드·6각형·맵 기록이 모두 이 값을 본다. 한두 판 뛰고 얻어걸린 성적이
 * 실력처럼 보이는 것을 막는 선이고, 지표마다 다른 값을 두면 "리더보드에는
 * 있는데 6각형은 왜 없냐"는 질문에 답할 말이 없다.
 */
export const MIN_SCRIMS_FOR_RANKING = 4;

/**
 * "최근" 창의 길이 — 본인이 참여한 가장 최근 내전 이 횟수.
 *
 * 리더보드의 최근 창과 6각형이 같은 창을 본다. 예전에는 리더보드가 16매치,
 * 6각형이 10경기를 봐서 같은 화면의 두 그림이 서로 다른 기간을 말하고 있었다.
 */
export const RECENT_WINDOW_SCRIMS = 4;

/** 최근 이 개월 수 안에 참가한 적이 없으면 집계에서 뺀다. */
export const ACTIVE_WITHIN_MONTHS = 3;

/**
 * 표본이 얇을수록 차이를 0 쪽으로 당기는 정도(내전 회차 단위).
 *
 * 깐부와 맵 기록이 같은 함정을 갖는다 — 두 번만 겹친 기록은 그날 운이 그대로
 * 평균이 돼서 차이가 크게 벌어지고, 그대로 순서를 매기면 늘 표본이 가장 얇은
 * 쪽이 1등을 한다. 2를 쓰면 2회는 차이의 절반, 4회는 3분의 2, 12회는 86%가
 * 남는다. 얇은 표본이 이기려면 그만큼 더 큰 차이를 보여야 한다.
 */
export const SHRINK_SCRIMS = 2;

export function shrink(delta: number, scrims: number): number {
  return (delta * scrims) / (scrims + SHRINK_SCRIMS);
}

/** 화면에 쓰는 말. 숫자와 단위를 한 곳에서 만든다. */
export const SCRIM_LABEL = {
  recentWindow: `최근 내전 ${RECENT_WINDOW_SCRIMS}회`,
  allTime: '역대 전체',
  minToRank: `내전 ${MIN_SCRIMS_FOR_RANKING}회 이상 참가`,
} as const;
