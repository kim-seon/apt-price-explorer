"use client";

// ECharts 얇은 래퍼 (docs/decisions/0004-echarts-thin-wrapper.md)
// 사용하는 차트 / 컴포넌트만 등록해 번들에 필요한 모듈만 포함한다.

import { BarChart, LineChart, ScatterChart } from "echarts/charts";
import {
  AriaComponent,
  AxisPointerComponent,
  DataZoomSliderComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from "echarts/components";
import * as echarts from "echarts/core";
import type { ComposeOption, ECharts } from "echarts/core";
import type {
  BarSeriesOption,
  HeatmapSeriesOption,
  LineSeriesOption,
  ScatterSeriesOption,
} from "echarts/charts";
import type {
  DataZoomComponentOption,
  GridComponentOption,
  LegendComponentOption,
  TooltipComponentOption,
  VisualMapComponentOption,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { useEffect, useRef } from "react";

echarts.use([
  LineChart,
  ScatterChart,
  BarChart,
  GridComponent,
  TooltipComponent,
  AxisPointerComponent,
  LegendComponent,
  DataZoomSliderComponent,
  AriaComponent,
  CanvasRenderer,
]);

export type ChartOption = ComposeOption<
  | LineSeriesOption
  | ScatterSeriesOption
  | BarSeriesOption
  | GridComponentOption
  | TooltipComponentOption
  | LegendComponentOption
  | DataZoomComponentOption
  // 히트맵 전용 모듈은 사용하는 파일에서 등록한다 (공통 번들에 넣지 않음, docs/decisions/0004)
  | HeatmapSeriesOption
  | VisualMapComponentOption
>;

type Props = {
  option: ChartOption;
  className?: string;
  /** 데이터에 따라 높이가 정해지는 차트(히트맵)용 */
  style?: React.CSSProperties;
  /** 차트 인스턴스가 준비되면 호출. 이벤트 등록 / dispatchAction용. */
  onReady?: (chart: ECharts) => void;
  ariaLabel: string;
};

export function EChart({
  option,
  className,
  style,
  onReady,
  ariaLabel,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ECharts | null>(null);
  const onReadyRef = useRef(onReady);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    const el = containerRef.current!;
    const chart = echarts.init(el, undefined, { renderer: "canvas" });
    chartRef.current = chart;
    onReadyRef.current?.(chart);
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(el);
    return () => {
      observer.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    // 옵션 객체가 바뀌면 전체 교체한다 (시리즈 수가 바뀌는 경우 이전 시리즈가 남지 않게).
    chartRef.current?.setOption(option, { notMerge: true });
  }, [option]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={style}
      role="img"
      aria-label={ariaLabel}
    />
  );
}
