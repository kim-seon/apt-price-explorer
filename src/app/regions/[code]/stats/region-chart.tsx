"use client";

import type { ECharts } from "echarts/core";
import { useMemo, useRef, useState } from "react";
import { EChart } from "@/components/charts/echarts";
import { CardHeader } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import type { RegionMonthlyStat } from "@/server/queries/region-stats";
import { buildRegionChartOption, INITIAL_YEARS } from "./region-chart-option";

// 기간 프리셋은 데이터를 다시 받지 않고 차트의 보이는 범위(dataZoom)만 옮긴다 — 전체 기간이 이미 내려와 있다.
// 슬라이더를 직접 끌면 프리셋 선택을 해제한다.

const PRESETS = [
  { value: "1", label: "1년" },
  { value: "3", label: "3년" },
  { value: "5", label: "5년" },
  { value: "10", label: "10년" },
  { value: "all", label: "전체" },
] as const;
type Preset = (typeof PRESETS)[number]["value"];

export function RegionChart({
  stats,
  currentMonth,
  label,
  title,
  description,
}: {
  stats: RegionMonthlyStat[];
  currentMonth: string;
  label: string;
  title: string;
  description: string;
}) {
  const option = useMemo(
    () => buildRegionChartOption(stats, currentMonth),
    [stats, currentMonth],
  );
  const chartRef = useRef<ECharts | null>(null);
  const programmatic = useRef(false);
  const [preset, setPreset] = useState<Preset | "">(
    String(INITIAL_YEARS) as Preset,
  );

  const applyPreset = (value: Preset) => {
    setPreset(value);
    const chart = chartRef.current;
    if (!chart) return;
    const [y, m] = currentMonth.split("-").map(Number);
    programmatic.current = true;
    chart.dispatchAction(
      value === "all"
        ? { type: "dataZoom", start: 0, end: 100 }
        : {
            type: "dataZoom",
            startValue: `${y - Number(value)}-${String(m).padStart(2, "0")}-01`,
            end: 100,
          },
    );
  };

  return (
    <>
      <CardHeader
        id="monthly-heading"
        title={title}
        description={description}
        actions={
          <Segmented
            label="표시 기간"
            value={preset}
            options={PRESETS}
            onChange={applyPreset}
          />
        }
      />
      <EChart
        option={option}
        onReady={(chart) => {
          chartRef.current = chart;
          chart.on("datazoom", () => {
            if (programmatic.current) {
              programmatic.current = false;
              return;
            }
            setPreset("");
          });
        }}
        className="mt-3 h-[360px] w-full sm:h-[420px]"
        ariaLabel={`${label} 월별 전용 3.3㎡당 거래가와 거래량. 아래 법정동 표에서 최근 1년 수치를 확인할 수 있습니다.`}
      />
    </>
  );
}
