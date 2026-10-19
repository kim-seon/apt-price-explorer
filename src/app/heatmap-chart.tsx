"use client";

import { HeatmapChart } from "echarts/charts";
import { VisualMapPiecewiseComponent } from "echarts/components";
import * as echarts from "echarts/core";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";
import { EChart } from "@/components/charts/echarts";
import { useMediaQuery } from "@/lib/use-media-query";
import type { HeatmapData } from "@/server/queries/heatmap";
import { buildHeatmapOption, lastMonths } from "./heatmap-option";

// 히트맵 전용 모듈은 이 파일에서만 등록한다 → 진입 화면에서 지연 로딩되는 청크에만 포함 (docs/decisions/0004)
echarts.use([HeatmapChart, VisualMapPiecewiseComponent]);

/** 행 높이(px). 82개 시군구 × 9px */
const ROW_PX = 9;

export default function HeatmapChartView({ data }: { data: HeatmapData }) {
  const router = useRouter();
  const compact = useMediaQuery("(max-width: 639px)");
  const shown = useMemo(
    () => (compact ? lastMonths(data, 24) : data),
    [data, compact],
  );
  const option = useMemo(
    () => buildHeatmapOption(shown, { compact }),
    [shown, compact],
  );
  // 클릭 핸들러는 차트 생성 시 한 번 등록하므로 최신 표시 데이터를 ref로 읽는다
  const shownRef = useRef(shown);
  useEffect(() => {
    shownRef.current = shown;
  }, [shown]);

  return (
    <EChart
      option={option}
      onReady={(chart) => {
        // 칸을 누르면 그 지역 페이지로 (지역 선택 입구)
        chart.on("click", (p) => {
          const [, y] = p.value as [number, number, number];
          const region = shownRef.current.regions[y];
          if (region) router.push(`/regions/${region.code}`);
        });
      }}
      className="w-full"
      style={{ height: data.regions.length * ROW_PX + (compact ? 80 : 60) }}
      ariaLabel={`수도권 ${data.regions.length}개 시군구의 월별 아파트 매매 거래량 히트맵. 아래 지역 목록에서도 같은 지역으로 이동할 수 있습니다.`}
    />
  );
}
