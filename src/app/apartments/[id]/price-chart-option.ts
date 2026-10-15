import type { ChartOption } from "@/components/charts/echarts";
import { formatPrice } from "@/lib/format";
import type { MonthlyStat, Trade } from "@/server/queries/apartment-detail";

// 가격 추이 + 거래량 차트 옵션.
// - 하나의 인스턴스에 grid 2개(가격 / 거래량)를 두고 x축(시간)만 공유한다. y축 두 개를 겹치지 않는다.
// - 색: 같은 의미에 같은 색 (dataviz reference palette, light)
//   파랑 = 거래가 분포(개별 거래, p25~p75 밴드, 중위가), 주황 = 역대 최고가 / 신고가, 회색 = 해제 거래

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

export const SERIES = {
  bandBase: 0,
  bandWidth: 1,
  median: 2,
  trades: 3,
  recordHighs: 4,
  runningHigh: 5,
  cancelled: 6,
  volume: 7,
} as const;

const CROSS_PATH =
  "path://M2,0 L5,3 L8,0 L10,2 L7,5 L10,8 L8,10 L5,7 L2,10 L0,8 L3,5 L0,2 Z";

const monthMid = (month: string) => `${month}-15`;

/** 시작~끝 월을 빠짐없이 나열한다. 거래가 없는 달은 밴드 / 중위가 선을 끊기 위해 null로 채운다. */
export function monthSequence(from: string, to: string): string[] {
  const out: string[] = [];
  let [y, m] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    if (++m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

export function buildPriceChartOption(input: {
  trades: Trade[];
  stats: MonthlyStat[];
  periodStart: string;
  currentMonth: string;
  showCancelled: boolean;
  zoom?: { start: number; end: number };
}): ChartOption {
  const { trades, stats, periodStart, currentMonth, showCancelled, zoom } =
    input;
  const months = monthSequence(periodStart.slice(0, 7), currentMonth);
  const statByMonth = new Map(stats.map((s) => [s.month, s]));

  const asc = [...trades].reverse();
  const valid = asc.filter((t) => !t.cancelled);
  // 역대 최고가 계단선: 서버가 계산한 highAfter를 시간 순으로 잇는다 (기간 이전 이력 포함 값)
  const runningHigh = valid
    .filter((t) => t.highAfter !== null)
    .map((t) => [t.dealDate, t.highAfter]);
  if (runningHigh.length)
    runningHigh.push([`${currentMonth}-28`, runningHigh.at(-1)![1]]);

  const stat = (month: string, pick: (s: MonthlyStat) => number | null) => {
    const s = statByMonth.get(month);
    return [monthMid(month), s ? pick(s) : null];
  };

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
      data: [
        "개별 거래",
        "거래가 25~75% (3개월)",
        "중위가 (3개월)",
        "역대 최고가",
        "신고가",
        ...(showCancelled ? ["해제 거래"] : []),
      ],
    },
    tooltip: {
      trigger: "item",
      confine: true,
      formatter: (params) => {
        const p = Array.isArray(params) ? params[0] : params;
        const value = p.value as [string, number | null];
        if (value[1] === null) return "";
        if (p.seriesIndex === SERIES.volume)
          return `${p.name}<br/><b>${value[1]}건</b>`;
        return `${value[0]}<br/><b>${formatPrice(value[1])}</b><br/>${p.seriesName}`;
      },
    },
    axisPointer: { link: [{ xAxisIndex: "all" }] },
    grid: [
      { left: 56, right: 16, top: 40, height: "58%" },
      { left: 56, right: 16, top: "76%", height: "12%" },
    ],
    xAxis: [
      {
        type: "time",
        gridIndex: 0,
        axisLabel: { show: false },
        axisTick: { show: false },
        axisLine: { lineStyle: { color: CHART_COLORS.grid } },
        axisPointer: { show: true, label: { show: false } },
      },
      {
        type: "time",
        gridIndex: 1,
        axisLabel: { formatter: "{yyyy}.{MM}", hideOverlap: true },
        axisLine: { lineStyle: { color: CHART_COLORS.grid } },
        axisPointer: { show: true, label: { show: false } },
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
        labelFormatter: (value: number) => {
          const d = new Date(value);
          return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}`;
        },
        ...(zoom ? { startValue: zoom.start, endValue: zoom.end } : {}),
      },
    ],
    series: [
      {
        name: "거래가 25~75% (3개월)",
        type: "line",
        stack: "band",
        data: months.map((m) => stat(m, (s) => s.p25)),
        lineStyle: { opacity: 0 },
        itemStyle: { color: CHART_COLORS.priceBand },
        symbol: "none",
        tooltip: { show: false },
        silent: true,
      },
      {
        name: "거래가 25~75% (3개월)",
        type: "line",
        stack: "band",
        data: months.map((m) =>
          stat(m, (s) =>
            s.p75 !== null && s.p25 !== null ? s.p75 - s.p25 : null,
          ),
        ),
        lineStyle: { opacity: 0 },
        areaStyle: { color: CHART_COLORS.priceBand, opacity: 1 },
        itemStyle: { color: CHART_COLORS.priceBand },
        symbol: "none",
        tooltip: { show: false },
        silent: true,
      },
      {
        name: "중위가 (3개월)",
        type: "line",
        data: months.map((m) => stat(m, (s) => s.median)),
        connectNulls: false,
        showSymbol: false,
        symbolSize: 8,
        lineStyle: {
          width: 2,
          color: CHART_COLORS.price,
          cap: "round",
          join: "round",
        },
        itemStyle: {
          color: CHART_COLORS.price,
          borderColor: CHART_COLORS.surface,
          borderWidth: 2,
        },
      },
      {
        name: "개별 거래",
        type: "scatter",
        data: valid.map((t) => ({
          id: String(t.id),
          value: [t.dealDate, t.price],
        })),
        symbolSize: 8,
        itemStyle: {
          color: CHART_COLORS.price,
          opacity: 0.35,
          borderColor: CHART_COLORS.surface,
          borderWidth: 1,
        },
        emphasis: { scale: 1.6, itemStyle: { opacity: 1, borderWidth: 2 } },
        large: false,
      },
      {
        name: "신고가",
        type: "scatter",
        data: valid
          .filter((t) => t.recordHighRatio !== null)
          .map((t) => ({ id: String(t.id), value: [t.dealDate, t.price] })),
        symbol: "triangle",
        symbolSize: 10,
        itemStyle: {
          color: CHART_COLORS.high,
          borderColor: CHART_COLORS.surface,
          borderWidth: 1,
        },
        emphasis: { scale: 1.5 },
        z: 4,
      },
      {
        name: "역대 최고가",
        type: "line",
        step: "end",
        data: runningHigh,
        showSymbol: false,
        lineStyle: { width: 2, color: CHART_COLORS.high },
        itemStyle: { color: CHART_COLORS.high },
        tooltip: { show: false },
        z: 3,
      },
      {
        name: "해제 거래",
        type: "scatter",
        data: showCancelled
          ? asc
              .filter((t) => t.cancelled)
              .map((t) => ({ id: String(t.id), value: [t.dealDate, t.price] }))
          : [],
        symbol: CROSS_PATH,
        symbolSize: 9,
        itemStyle: { color: CHART_COLORS.cancelled },
        z: 2,
      },
      {
        name: "거래량",
        type: "bar",
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: months.map((m) => {
          const s = statByMonth.get(m);
          return {
            name: m.replace("-", "."),
            value: [monthMid(m), s ? s.count : 0],
          };
        }),
        barMaxWidth: 24,
        itemStyle: { color: CHART_COLORS.volume, borderRadius: [4, 4, 0, 0] },
      },
    ],
  };
}
