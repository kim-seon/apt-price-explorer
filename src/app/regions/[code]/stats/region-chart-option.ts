import { CHART_COLORS } from "@/components/charts/colors";
import type { ChartOption } from "@/components/charts/echarts";
import { formatPrice, formatYearMonth } from "@/lib/format";
import { monthSequence } from "@/lib/months";
import type { RegionMonthlyStat } from "@/server/queries/region-stats";

// 지역 월별 3.3㎡당 가격 + 거래량 (docs/charts/region-stats.md)
// 단지 상세 차트와 같은 문법: 위 grid 가격 분포(밴드 + 중위가), 아래 grid 거래량, x축(시간)만 공유.

/** 처음 보여줄 기간. 전체(2006~)는 슬라이더로 넓힌다 */
const INITIAL_YEARS = 10;

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
        const head = `<b>${formatYearMonth(month)}</b>`;
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
        scale: true,
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
        data: months.map((m) => pick(m, (s) => s.median)),
        symbol: "none",
        lineStyle: { width: 2, color: CHART_COLORS.price },
        itemStyle: { color: CHART_COLORS.price },
      },
      {
        name: "거래량",
        type: "bar",
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: months.map((m) => [monthMid(m), byMonth.get(m)?.count ?? 0]),
        barMaxWidth: 12,
        itemStyle: { color: CHART_COLORS.volume, borderRadius: [2, 2, 0, 0] },
      },
    ],
  };
}
