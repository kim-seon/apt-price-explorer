import { CHART_COLORS } from "@/components/charts/colors";
import type { ChartOption } from "@/components/charts/echarts";
import { formatPrice, formatYearMonth } from "@/lib/format";
import { monthSequence } from "@/lib/months";
import type { RegionMonthlyStat } from "@/server/queries/region-stats";

// 지역 월별 3.3㎡당 가격 + 거래량 (docs/charts/region-stats.md)
// 단지 상세 차트와 같은 문법: 위 grid 가격 분포(밴드 + 중위가), 아래 grid 거래량, x축(시간)만 공유.

/** 처음 보여줄 기간. 전체(2006~)는 슬라이더로 넓힌다 */
const INITIAL_YEARS = 10;
/**
 * 신고 기한(계약 후 30일) 때문에 아직 거래가 더 들어올 수 있는 최근 개월 수 (이번 달 + 지난달).
 * 이 구간은 거래량을 흐리게, 중위가를 점선으로 그려 "급감"으로 읽히지 않게 한다.
 */
const PROVISIONAL_MONTHS = 2;

const monthMid = (month: string) => `${month}-15`;

export function buildRegionChartOption(
  stats: RegionMonthlyStat[],
  currentMonth: string,
): ChartOption {
  const months = stats.length
    ? monthSequence(stats[0].month, currentMonth)
    : [];
  const byMonth = new Map(stats.map((s) => [s.month, s]));
  const pick = (m: string, f: (s: RegionMonthlyStat) => number | null) => {
    const s = byMonth.get(m);
    return [monthMid(m), s ? f(s) : null];
  };
  const provisional = new Set(months.slice(-PROVISIONAL_MONTHS));
  // 점선 구간이 실선과 이어지도록 직전 달 하나를 겹쳐 그린다
  const dashedFrom = months.length - PROVISIONAL_MONTHS - 1;
  const [cy, cm] = currentMonth.split("-").map(Number);
  const zoomStart = `${cy - INITIAL_YEARS}-${String(cm).padStart(2, "0")}-01`;

  return {
    animation: false,
    aria: { enabled: true },
    textStyle: { fontFamily: "inherit", color: CHART_COLORS.textSecondary },
    legend: {
      top: 0,
      left: 0,
      icon: "roundRect",
      itemWidth: 12,
      itemHeight: 8,
      data: ["3.3㎡당 25~75%", "3.3㎡당 중위가", "거래량"],
      // 점선 구간(집계 중)은 범례에 따로 두지 않고 tooltip과 차트 아래 설명으로 안내한다
    },
    tooltip: {
      trigger: "axis",
      confine: true,
      formatter: (params) => {
        const list = Array.isArray(params) ? params : [params];
        const first = list[0];
        if (!first) return "";
        const month = String((first.value as [string, unknown])[0]).slice(0, 7);
        const s = byMonth.get(month);
        const head = `<b>${formatYearMonth(month)}</b>${
          provisional.has(month) ? " (집계 중 · 신고 기한 전)" : ""
        }`;
        if (!s) return `${head}<br/>거래 없음`;
        const price =
          s.median === null
            ? "거래가 적어 가격 통계 생략"
            : `중위 ${formatPrice(s.median)} (${formatPrice(s.p25!)} ~ ${formatPrice(s.p75!)})`;
        return `${head}<br/>${price}<br/>거래 ${s.count.toLocaleString("ko-KR")}건`;
      },
    },
    axisPointer: { link: [{ xAxisIndex: "all" }] },
    grid: [
      { left: 64, right: 16, top: 40, height: "56%" },
      { left: 64, right: 16, top: "74%", height: "14%" },
    ],
    xAxis: [
      {
        type: "time",
        gridIndex: 0,
        axisLabel: { show: false },
        axisTick: { show: false },
        axisLine: { lineStyle: { color: CHART_COLORS.grid } },
      },
      {
        type: "time",
        gridIndex: 1,
        axisLabel: { formatter: "{yyyy}.{MM}", hideOverlap: true },
        axisLine: { lineStyle: { color: CHART_COLORS.grid } },
      },
    ],
    yAxis: [
      {
        type: "value",
        gridIndex: 0,
        // 가격 축은 0부터 시작하지 않는다 (변화가 눌린다). 데이터 최솟값 아래 여유를 둔다
        min: (extent: { min: number }) =>
          Math.max(0, Math.floor((extent.min * 0.9) / 1000) * 1000),
        splitNumber: 4,
        axisLabel: { formatter: (v: number) => formatPrice(v) },
        splitLine: { lineStyle: { color: CHART_COLORS.grid, width: 1 } },
      },
      {
        type: "value",
        gridIndex: 1,
        splitNumber: 2,
        minInterval: 1,
        axisLabel: { formatter: "{value}건" },
        splitLine: { lineStyle: { color: CHART_COLORS.grid, width: 1 } },
      },
    ],
    dataZoom: [
      {
        type: "slider",
        xAxisIndex: [0, 1],
        bottom: 4,
        height: 22,
        filterMode: "none",
        startValue: zoomStart,
        labelFormatter: (value: number) => {
          const d = new Date(value);
          return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}`;
        },
      },
    ],
    series: [
      {
        name: "3.3㎡당 25~75%",
        type: "line",
        stack: "band",
        data: months.map((m) => pick(m, (s) => s.p25)),
        lineStyle: { opacity: 0 },
        symbol: "none",
        silent: true,
        itemStyle: { color: CHART_COLORS.priceBand },
      },
      {
        name: "3.3㎡당 25~75%",
        type: "line",
        stack: "band",
        data: months.map((m) =>
          pick(m, (s) =>
            s.p75 !== null && s.p25 !== null ? s.p75 - s.p25 : null,
          ),
        ),
        lineStyle: { opacity: 0 },
        symbol: "none",
        silent: true,
        areaStyle: { color: CHART_COLORS.priceBand, opacity: 1 },
        itemStyle: { color: CHART_COLORS.priceBand },
      },
      {
        name: "3.3㎡당 중위가",
        type: "line",
        data: months.map((m) =>
          provisional.has(m) ? [monthMid(m), null] : pick(m, (s) => s.median),
        ),
        symbol: "none",
        lineStyle: { width: 2, color: CHART_COLORS.price },
        itemStyle: { color: CHART_COLORS.price },
      },
      {
        name: "3.3㎡당 중위가",
        type: "line",
        data: months.map((m, i) =>
          i >= dashedFrom ? pick(m, (s) => s.median) : [monthMid(m), null],
        ),
        symbol: "none",
        lineStyle: { width: 2, type: "dashed", color: CHART_COLORS.price },
        itemStyle: { color: CHART_COLORS.price },
        tooltip: { show: false },
      },
      {
        name: "거래량",
        type: "bar",
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: months.map((m) => ({
          value: [monthMid(m), byMonth.get(m)?.count ?? 0],
          itemStyle: provisional.has(m) ? { opacity: 0.4 } : undefined,
        })),
        barMaxWidth: 12,
        itemStyle: { color: CHART_COLORS.volume, borderRadius: [2, 2, 0, 0] },
      },
    ],
  };
}
