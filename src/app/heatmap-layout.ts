import type { HeatmapData } from "@/server/queries/heatmap";

// 히트맵 Canvas 구현의 순수 계산 (docs/charts/heatmap.md). 그리기 · 이벤트는 heatmap-canvas.tsx
//
// 색 = 그 지역의 "평소" 대비 배율. 절대 건수로 칠하면 큰 지역은 늘 진하고 작은 지역은 늘 옅어
// 지역 크기만 보인다 → "지금 그 지역치고 활발한가"를 보여 준다.
// - 평소 = 직전 60개월(5년) 월평균 (이동 평균, 그달 제외). 이력 12개월 미만이면 계산하지 않는다
// - diverging: 평소(회색) 기준 파랑(적음) ↔ 빨강(많음), 양쪽 3단계 · 배율 대칭(0.5↔2, 0.7↔1.4, 0.9↔1.1)

export const BASELINE_MONTHS = 60;
const BASELINE_MIN_MONTHS = 12;

/** 월마다 직전 60개월(그달 제외) 평균. 이력이 12개월 미만이면 null */
export function trailingBaseline(counts: number[]): (number | null)[] {
  const out: (number | null)[] = [];
  let sum = 0;
  for (let i = 0; i < counts.length; i++) {
    const n = Math.min(i, BASELINE_MONTHS);
    out.push(n >= BASELINE_MIN_MONTHS ? sum / n : null);
    sum += counts[i];
    if (i >= BASELINE_MONTHS) sum -= counts[i - BASELINE_MONTHS];
  }
  return out;
}

export const NEUTRAL_COLOR = "#f0efec";
export const NO_BASELINE_COLOR = "#f7f7f5";
export const RATIO_PIECES = [
  { max: 0.5, label: "0.5배 미만", color: "#256abf" },
  { max: 0.7, label: "0.5–0.7", color: "#6da7ec" },
  { max: 0.9, label: "0.7–0.9", color: "#b7d3f6" },
  { max: 1.1, label: "평소", color: NEUTRAL_COLOR },
  { max: 1.4, label: "1.1–1.4", color: "#f5c2c1" },
  { max: 2, label: "1.4–2", color: "#ea8584" },
  { max: Infinity, label: "2배 이상", color: "#c93a39" },
] as const;

export function ratioColor(ratio: number | null): string {
  if (ratio === null) return NO_BASELINE_COLOR;
  return RATIO_PIECES.find((p) => ratio < p.max)!.color;
}

/** 평소가 0이면(거래가 전혀 없던 지역) 비교하지 않는다 */
export function ratioOf(count: number, baseline: number | null): number | null {
  return baseline ? count / baseline : null;
}

export const PERIODS = [
  { value: "3y", label: "3년", months: 36 },
  { value: "10y", label: "10년", months: 120 },
  { value: "all", label: "전체", months: Infinity },
] as const;
export type HeatmapPeriod = (typeof PERIODS)[number]["value"];

/** 신고 기한(계약 후 30일) 때문에 아직 거래가 더 들어올 수 있는 최근 개월 수 */
export const PROVISIONAL_MONTHS = 2;

export type Layout = {
  width: number;
  height: number;
  /** 지역 이름 열 너비 */
  left: number;
  rowHeight: number;
  cellWidth: number;
  months: number;
  rows: number;
  /** 월 라벨이 시작하는 y */
  axisTop: number;
};

const AXIS_HEIGHT = 22;

export function rowHeightFor(compact: boolean) {
  return compact ? 16 : 18;
}

/** 서버 렌더 · 첫 측정 전에도 같은 높이로 자리를 잡는다 (CLS 방지) */
export function heatmapHeight(rows: number, compact = false) {
  return rows * rowHeightFor(compact) + AXIS_HEIGHT;
}

export function computeLayout(
  width: number,
  months: number,
  rows: number,
  compact: boolean,
): Layout {
  const left = compact ? 84 : 104;
  const rowHeight = rowHeightFor(compact);
  return {
    width,
    height: heatmapHeight(rows, compact),
    left,
    rowHeight,
    cellWidth: Math.max(1, (width - left) / months),
    months,
    rows,
    axisTop: rows * rowHeight + 6,
  };
}

/** 포인터 위치 → 칸. 지역 이름 열이면 month = null(행 전체), 바깥이면 null */
export function hitTest(
  x: number,
  y: number,
  l: Layout,
): { row: number; month: number | null } | null {
  if (y < 0 || x < 0 || x >= l.width) return null;
  const row = Math.floor(y / l.rowHeight);
  if (row >= l.rows) return null;
  if (x < l.left) return { row, month: null };
  const month = Math.min(l.months - 1, Math.floor((x - l.left) / l.cellWidth));
  return { row, month };
}

/** x축 라벨: 3년은 1 · 7월("24.07"), 10년은 매년 1월, 전체는 2년마다 1월 */
export function monthLabel(ym: string, period: HeatmapPeriod): string | null {
  const [y, m] = ym.split("-");
  if (period === "3y")
    return m === "01" || m === "07" ? `${y.slice(2)}.${m}` : null;
  if (period === "10y") return m === "01" ? y : null;
  return m === "01" && Number(y) % 2 === 0 ? y : null;
}

export type HeatmapView = {
  months: string[];
  regions: HeatmapData["regions"];
  counts: number[][];
  baselines: (number | null)[][];
  /** 보이는 범위 안에서 "집계 중"인 첫 열 (없으면 months.length) */
  provisionalFrom: number;
};

/** 시도 · 기간으로 보이는 부분을 잘라낸다. 평소(이동 평균)는 전체 기간으로 계산한 뒤 자른다 */
export function selectView(
  data: HeatmapData,
  baselines: (number | null)[][],
  sido: string,
  period: HeatmapPeriod,
): HeatmapView {
  const months = PERIODS.find((p) => p.value === period)!.months;
  const from = Math.max(0, data.months.length - months);
  const rows = data.regions
    .map((region, i) => ({ region, i }))
    .filter(({ region }) => region.sido === sido);
  const shownMonths = data.months.slice(from);
  return {
    months: shownMonths,
    regions: rows.map(({ region }) => region),
    counts: rows.map(({ i }) => data.counts[i].slice(from)),
    baselines: rows.map(({ i }) => baselines[i].slice(from)),
    provisionalFrom: Math.max(0, shownMonths.length - PROVISIONAL_MONTHS),
  };
}
