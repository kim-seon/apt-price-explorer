import type { HeatmapData } from "@/server/queries/heatmap";

// 히트맵 Canvas 구현의 순수 계산 (docs/charts/heatmap.md). 그리기 · 이벤트는 heatmap-canvas.tsx
//
// - 색: 순차 단일 색상(파랑 100→700, dataviz 기본 램프). 거래 없음은 회색 바탕
// - 구간: 월 거래 수 분포가 크게 치우쳐(중앙값 187, 상위 3% 779, 최대 3,141) 균등 구간이면 대부분이 가장
//   옅은 색이 된다 → 분위수 근처의 읽기 쉬운 경계값으로 7구간

export const EMPTY_COLOR = "#f0efec";
export const HEATMAP_PIECES = [
  { min: 1, label: "1–49", color: "#cde2fb" },
  { min: 50, label: "50–99", color: "#9ec5f4" },
  { min: 100, label: "100–199", color: "#6da7ec" },
  { min: 200, label: "200–349", color: "#3987e5" },
  { min: 350, label: "350–549", color: "#256abf" },
  { min: 550, label: "550–799", color: "#184f95" },
  { min: 800, label: "800+", color: "#0d366b" },
] as const;

export function colorFor(count: number): string {
  for (let i = HEATMAP_PIECES.length - 1; i >= 0; i--) {
    if (count >= HEATMAP_PIECES[i].min) return HEATMAP_PIECES[i].color;
  }
  return EMPTY_COLOR;
}

/** 마지막 n개월만 남긴다 (모바일: 최근 24개월) */
export function lastMonths(data: HeatmapData, n: number): HeatmapData {
  if (data.months.length <= n) return data;
  const from = data.months.length - n;
  return {
    ...data,
    months: data.months.slice(from),
    counts: data.counts.map((row) => row.slice(from)),
  };
}

export type Layout = {
  width: number;
  height: number;
  /** 지역 이름 열 너비 */
  left: number;
  rowHeight: number;
  cellWidth: number;
  months: number;
  /** 행마다 위쪽 y. 시도가 바뀌는 곳에 간격을 둔다 */
  rowTops: number[];
  /** 연도 라벨이 시작하는 y */
  axisTop: number;
};

const ROW_HEIGHT = 10;
const GROUP_GAP = 6;
const AXIS_HEIGHT = 20;

/** 서버 렌더 · 첫 측정 전에도 같은 높이로 자리를 잡는다 (CLS 방지) */
export function heatmapHeight(rows: number, groups: number) {
  return rows * ROW_HEIGHT + Math.max(0, groups - 1) * GROUP_GAP + AXIS_HEIGHT;
}

/** sidos: 행마다 시도 이름 (위에서 아래 순서) */
export function computeLayout(
  width: number,
  months: number,
  sidos: string[],
  compact: boolean,
): Layout {
  const left = compact ? 76 : 96;
  const rowTops: number[] = [];
  let y = 0;
  sidos.forEach((sido, i) => {
    if (i > 0 && sido !== sidos[i - 1]) y += GROUP_GAP;
    rowTops.push(y);
    y += ROW_HEIGHT;
  });
  return {
    width,
    height: y + AXIS_HEIGHT,
    left,
    rowHeight: ROW_HEIGHT,
    cellWidth: Math.max(1, (width - left) / months),
    months,
    rowTops,
    axisTop: y + 5,
  };
}

/** 포인터 위치 → 칸. 지역 이름 열이면 month = null(행 전체), 시도 사이 간격 · 바깥이면 null */
export function hitTest(
  x: number,
  y: number,
  l: Layout,
): { row: number; month: number | null } | null {
  if (y < 0 || x < 0 || x >= l.width) return null;
  const row = l.rowTops.findIndex((top) => y >= top && y < top + l.rowHeight);
  if (row === -1) return null;
  if (x < l.left) return { row, month: null };
  const month = Math.min(l.months - 1, Math.floor((x - l.left) / l.cellWidth));
  return { row, month };
}

/** x축 라벨: 데스크톱은 2년마다 1월에 연도, 모바일(24개월)은 6개월마다 "26.01" */
export function monthLabel(ym: string, compact: boolean): string | null {
  const [y, m] = ym.split("-");
  if (compact) return Number(m) % 6 === 1 ? `${y.slice(2)}.${m}` : null;
  return m === "01" && Number(y) % 2 === 0 ? y : null;
}
