import { CHART_COLORS } from "@/components/charts/colors";
import type { ChartOption } from "@/components/charts/echarts";
import type { HeatmapData } from "@/server/queries/heatmap";

// 수도권 시군구 × 월 거래량 히트맵 (docs/charts/heatmap.md, docs/03 C)
// - 색: 순차 단일 색상(파랑 100→700). 거래 없음은 회색 바탕
// - 구간: 월 거래 수 분포가 크게 치우쳐(중앙값 187, 상위 3% 779, 최대 3,141) 균등 구간이면 대부분이 가장
//   옅은 색이 된다 → 분위수 근처의 읽기 쉬운 경계값으로 7구간

export const HEATMAP_PIECES = [
  { min: 1, max: 49, label: "1–49", color: "#cde2fb" },
  { min: 50, max: 99, label: "50–99", color: "#9ec5f4" },
  { min: 100, max: 199, label: "100–199", color: "#6da7ec" },
  { min: 200, max: 349, label: "200–349", color: "#3987e5" },
  { min: 350, max: 549, label: "350–549", color: "#256abf" },
  { min: 550, max: 799, label: "550–799", color: "#184f95" },
  { min: 800, label: "800+", color: "#0d366b" },
] as const;
const EMPTY = { value: 0, label: "없음", color: "#f0efec" };

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

export function buildHeatmapOption(
  data: HeatmapData,
  { compact }: { compact: boolean },
): ChartOption {
  const cells: [number, number, number][] = [];
  data.counts.forEach((row, y) =>
    row.forEach((value, x) => cells.push([x, y, value])),
  );

  return {
    animation: false,
    aria: { enabled: true },
    textStyle: { fontFamily: "inherit", color: CHART_COLORS.textSecondary },
    tooltip: {
      confine: true,
      formatter: (params) => {
        const p = Array.isArray(params) ? params[0] : params;
        const [x, y, value] = p.value as [number, number, number];
        const r = data.regions[y];
        const ym = data.months[x].replace("-", ".");
        return `${r.sido} <b>${r.name}</b><br/>${ym} · 거래 <b>${value.toLocaleString("ko-KR")}</b>건`;
      },
    },
    visualMap: {
      type: "piecewise",
      orient: "horizontal",
      top: 0,
      left: compact ? 0 : 92,
      itemWidth: 12,
      itemHeight: 10,
      itemGap: compact ? 4 : 8,
      textStyle: { fontSize: 11 },
      pieces: [EMPTY, ...HEATMAP_PIECES],
      // 범례를 눌러 구간을 숨기면 지역 선택 입구로서 혼란스럽다
      selectedMode: false,
    },
    grid: {
      left: compact ? 72 : 92,
      right: 4,
      top: compact ? 52 : 32,
      bottom: 24,
    },
    xAxis: {
      type: "category",
      data: data.months,
      splitArea: { show: false },
      axisTick: { show: false },
      axisLine: { show: false },
      axisLabel: {
        interval: 0,
        fontSize: 10,
        // 데스크톱: 매년 1월에 연도, 모바일(24개월): 6개월마다 "26.01"
        formatter: (v: string) => {
          const [y, m] = v.split("-");
          if (compact) return Number(m) % 6 === 1 ? `${y.slice(2)}.${m}` : "";
          return m === "01" && Number(y) % 2 === 0 ? y : "";
        },
      },
    },
    yAxis: {
      type: "category",
      data: data.regions.map((r) => r.name),
      inverse: true,
      axisTick: { show: false },
      axisLine: { show: false },
      axisLabel: { interval: 0, fontSize: compact ? 9 : 10 },
    },
    series: [
      {
        type: "heatmap",
        data: cells,
        cursor: "pointer",
        // 2만 칸을 한 번에 그린다 (점진 렌더링은 칸이 나눠 나타나 깜빡여 보인다)
        progressive: 0,
        itemStyle: { borderColor: CHART_COLORS.surface, borderWidth: 0.5 },
        emphasis: {
          itemStyle: {
            borderColor: CHART_COLORS.textSecondary,
            borderWidth: 1,
          },
        },
      },
    ],
  };
}
