"use client";

import type { ECharts } from "echarts/core";
import { useCallback, useMemo, useRef, useState } from "react";
import { EChart } from "@/components/charts/echarts";
import { Card, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Switch } from "@/components/ui/switch";
import { formatPrice, formatShortDate } from "@/lib/format";
import type { MonthlyStat, Trade } from "@/server/queries/apartment-detail";
import { buildPriceChartOption, SERIES } from "./price-chart-option";
import {
  filterByRange,
  summarize,
  zoomToRange,
  type MonthRange,
} from "./summarize";
import { TradeTable } from "./trade-table";

// 단지 상세의 coordinated views (docs/03-ux-design.md A)
// 기간 brush → 요약 카드 + 테이블 + URL(replaceState, 서버 왕복 없음)
// 테이블 행 hover → 차트 포인트 하이라이트 (단방향)

type Props = {
  trades: Trade[];
  stats: MonthlyStat[];
  periodStart: string;
  currentMonth: string;
  initialRange: MonthRange | null;
  initialShowCancelled: boolean;
  /** "전용 84㎡" — 카드 설명용 */
  areaLabel: string;
  /** 기간 프리셋 링크 (서버 재렌더). 차트 카드 머리에 둔다 */
  periodNav: React.ReactNode;
};

const monthStartMs = (month: string) =>
  new Date(`${month}-01T00:00:00`).getTime();
const monthEndMs = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m, 0, 23, 59).getTime();
};

/** 현재 URL에서 일부 파라미터만 바꿔 replaceState (서버 왕복 없음) */
function patchUrl(patch: Record<string, string | null>) {
  const params = new URLSearchParams(window.location.search);
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) params.delete(key);
    else params.set(key, value);
  }
  const query = params.toString();
  window.history.replaceState(
    null,
    "",
    query ? `?${query}` : window.location.pathname,
  );
}

export function TradeExplorer({
  trades,
  stats,
  periodStart,
  currentMonth,
  initialRange,
  initialShowCancelled,
  areaLabel,
  periodNav,
}: Props) {
  const [range, setRange] = useState<MonthRange | null>(initialRange);
  const [showCancelled, setShowCancelled] = useState(initialShowCancelled);
  // 차트 옵션에 넣는 brush 위치. 드래그 중에는 바꾸지 않고(드래그마다 setOption 방지),
  // 옵션을 다시 만들어야 할 때(해제 거래 토글)만 현재 범위로 갱신한다.
  const [optionZoom, setOptionZoom] = useState<MonthRange | null>(initialRange);
  const chartRef = useRef<ECharts | null>(null);
  const bounds = useMemo(
    () => ({ from: periodStart.slice(0, 7), to: currentMonth }),
    [periodStart, currentMonth],
  );

  const option = useMemo(() => {
    const r = optionZoom;
    return buildPriceChartOption({
      trades,
      stats,
      periodStart,
      currentMonth,
      showCancelled,
      zoom: r
        ? { start: monthStartMs(r.from), end: monthEndMs(r.to) }
        : undefined,
    });
  }, [trades, stats, periodStart, currentMonth, showCancelled, optionZoom]);

  // 차트 시리즈 안에서의 dataIndex (테이블 → 차트 하이라이트용)
  const pointIndex = useMemo(() => {
    const map = new Map<number, { seriesIndex: number; dataIndex: number }>();
    const asc = [...trades].reverse();
    asc
      .filter((t) => !t.cancelled)
      .forEach((t, i) =>
        map.set(t.id, { seriesIndex: SERIES.trades, dataIndex: i }),
      );
    asc
      .filter((t) => t.cancelled)
      .forEach((t, i) =>
        map.set(t.id, { seriesIndex: SERIES.cancelled, dataIndex: i }),
      );
    return map;
  }, [trades]);

  const handleReady = useCallback(
    (chart: ECharts) => {
      chartRef.current = chart;
      chart.on("datazoom", () => {
        const dz = (
          chart.getOption().dataZoom as {
            startValue: number;
            endValue: number;
          }[]
        )[0];
        const next = zoomToRange(dz.startValue, dz.endValue, bounds);
        setRange((prev) =>
          prev?.from === next?.from && prev?.to === next?.to ? prev : next,
        );
        patchUrl({ from: next?.from ?? null, to: next?.to ?? null });
      });
    },
    [bounds],
  );

  const visible = useMemo(
    () => (showCancelled ? trades : trades.filter((t) => !t.cancelled)),
    [trades, showCancelled],
  );
  const inRange = useMemo(
    () => filterByRange(visible, range),
    [visible, range],
  );
  const summary = useMemo(() => summarize(inRange), [inRange]);

  const highlight = useCallback(
    (id: number | null) => {
      const chart = chartRef.current;
      if (!chart) return;
      chart.dispatchAction({
        type: "downplay",
        seriesIndex: [SERIES.trades, SERIES.cancelled],
      });
      const target = id === null ? undefined : pointIndex.get(id);
      if (target) chart.dispatchAction({ type: "highlight", ...target });
    },
    [pointIndex],
  );

  const resetRange = () => {
    chartRef.current?.dispatchAction({ type: "dataZoom", start: 0, end: 100 });
  };

  const shownRange = range ?? bounds;
  const basis = `${areaLabel} · ${shownRange.from.replace("-", ".")} ~ ${shownRange.to.replace("-", ".")}${range ? " (선택)" : ""}`;

  return (
    <div className="mt-5 space-y-4">
      <SummaryCards summary={summary} basis={basis} />

      <Card aria-labelledby="price-trend-heading">
        <CardHeader
          id="price-trend-heading"
          title="실거래가 추이"
          description={basis}
          actions={
            <>
              {periodNav}
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Switch
                  checked={showCancelled}
                  onCheckedChange={(checked) => {
                    setShowCancelled(checked);
                    // 옵션이 다시 만들어지므로 현재 brush 위치를 옵션에 반영해 유지한다
                    setOptionZoom(range);
                    patchUrl({ cancelled: checked ? "1" : null });
                  }}
                />
                해제 거래
              </label>
            </>
          }
        />
        <EChart
          option={option}
          onReady={handleReady}
          className="mt-3 h-[340px] w-full sm:h-[420px]"
          ariaLabel="면적 타입별 거래가 추이와 월별 거래량. 아래 거래 내역 표에서 같은 데이터를 확인할 수 있습니다."
        />
        <p className="mt-1 text-xs text-muted-foreground">
          아래 막대를 끌어 기간을 고르면 요약과 거래 내역이 함께 바뀝니다.
          2020년 2월 이전 거래는 해제 정보가 없어 해제된 거래가 포함되어 있을 수
          있습니다.
        </p>
      </Card>

      <Card aria-labelledby="trades-heading">
        <CardHeader
          id="trades-heading"
          title={
            <>
              실거래 내역{" "}
              <span className="font-normal text-muted-foreground">
                {inRange.length.toLocaleString("ko-KR")}건
              </span>
            </>
          }
          description={basis}
          actions={
            range && (
              <button
                type="button"
                onClick={resetRange}
                className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                기간 선택 해제
              </button>
            )
          }
        />
        <TradeTable trades={inRange} onHover={highlight} />
      </Card>
    </div>
  );
}

function SummaryCards({
  summary,
  basis,
}: {
  summary: ReturnType<typeof summarize>;
  basis: string;
}) {
  const latest = summary.latest;
  return (
    // 모두 선택 기간(brush) 기준. 해제 거래 제외
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard
        label="최근 실거래가"
        basis={latest ? formatShortDate(latest.dealDate) : basis}
        value={latest ? formatPrice(latest.price) : "-"}
        footer={
          latest && (
            <span className="text-muted-foreground">
              {latest.area.toFixed(2)}㎡ · {latest.floor ?? "-"}층
            </span>
          )
        }
      />
      <StatCard
        label="최고가"
        basis={
          summary.highest ? formatShortDate(summary.highest.dealDate) : basis
        }
        value={summary.highest ? formatPrice(summary.highest.price) : "-"}
        footer={
          latest &&
          summary.highest &&
          latest !== summary.highest && (
            <span className="text-muted-foreground">
              최근 거래는 최고가의{" "}
              {Math.round((latest.price / summary.highest.price) * 100)}%
            </span>
          )
        }
      />
      <StatCard
        label="거래량"
        basis="선택 기간 · 해제 제외"
        value={`${summary.count.toLocaleString("ko-KR")}건`}
      />
      <StatCard
        label="3.3㎡당 중위가"
        basis="선택 기간 · 전용면적 기준"
        value={
          summary.medianPerPyeong ? formatPrice(summary.medianPerPyeong) : "-"
        }
      />
    </dl>
  );
}
