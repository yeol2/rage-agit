// 01 쪽 실측 너비(px) — 01은 CSS grid로 폭이 정해지므로 그리드 간격/패딩을 줄여
// 확보한 여유가 실제로 몇 px가 됐는지 브라우저로 재서 넣는다(페이지 전체 폭은
// 그대로 유지된 채로). 02는 <table> auto-layout이라 이 값을 그대로 강제해
// 01/02 카드 폭을 맞춘다. RosterBoard.tsx/RoundSheet.tsx가 같이 쓴다 — 순환
// import를 피하려고 별도 파일로 뺐다.
export const NAMEPLATE_WIDTH = 121;
export const NAMEPLATE_HEIGHT = 38;
