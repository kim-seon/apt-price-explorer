"use client";

import { useMemo } from "react";
import { EChart } from "@/components/charts/echarts";
import type { RegionMonthlyStat } from "@/server/queries/region-stats";
import { buildRegionChartOption } from "./region-chart-option";

export function RegionChart({
  stats,
  currentMonth,
  label,
}: {
  stats: RegionMonthlyStat[];
  currentMonth: string;
  label: string;
}) {
  const option = useMemo(
    () => buildRegionChartOption(stats, currentMonth),
    [stats, currentMonth],
  );
  return (
    <EChart
      option={option}
      className="h-[420px] w-full"
      ariaLabel={`${label} 월별 전용 3.3㎡당 거래가와 거래량`}
    />
  );
}
