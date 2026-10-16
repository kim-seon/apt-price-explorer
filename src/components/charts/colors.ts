// 차트 공통 색 (dataviz reference palette, light). 같은 의미에는 화면이 달라도 같은 색을 쓴다:
// 파랑 = 거래가 분포(개별 거래, 25~75% 밴드, 중위가), 주황 = 역대 최고가 / 신고가, 회색 = 해제 거래

export const CHART_COLORS = {
  price: "#2a78d6",
  priceBand: "#b7d3f6",
  high: "#eb6834",
  cancelled: "#8a8984",
  volume: "#86b6ef",
  surface: "#fcfcfb",
  grid: "#e8e7e3",
  textSecondary: "#52514e",
} as const;
