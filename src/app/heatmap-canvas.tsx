"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { CHART_COLORS } from "@/components/charts/colors";
import { useMediaQuery } from "@/lib/use-media-query";
import type { HeatmapData } from "@/server/queries/heatmap";
import {
  colorFor,
  computeLayout,
  EMPTY_COLOR,
  HEATMAP_PIECES,
  heatmapHeight,
  hitTest,
  lastMonths,
  monthLabel,
  type Layout,
} from "./heatmap-layout";

// 수도권 시군구 × 월 거래량 히트맵 — Canvas 직접 구현 (docs/charts/heatmap.md)
//
// ECharts 버전은 진입 화면 TBT를 43 → 259ms로 올렸다(청크 실행 117ms + 2만 칸 setOption 202ms).
// 사각형 격자라 직접 그려도 복잡하지 않아, 라이브러리 없이 그린다:
// - 바탕 캔버스: 데이터 · 크기가 바뀔 때만 다시 그린다 (2만 칸 fillRect)
// - 덮개 캔버스: 마우스가 가리키는 행 · 칸 표시만 다시 그린다 (바탕을 다시 그리지 않음)
// - 툴팁 · 범례는 HTML (선명한 글자, 스크린 리더)
// 키보드로 지역을 고르는 경로는 아래 "지역에서 찾기" 목록이다.

type Hover = { row: number; month: number | null; x: number; y: number };

export function HeatmapCanvas({ data }: { data: HeatmapData }) {
  const router = useRouter();
  const compact = useMediaQuery("(max-width: 639px)");
  const shown = useMemo(
    () => (compact ? lastMonths(data, 24) : data),
    [data, compact],
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const [layout, setLayout] = useState<Layout | null>(null);
  const [hover, setHover] = useState<Hover | null>(null);

  // 컨테이너 너비가 바뀌면 배치를 다시 계산한다
  useEffect(() => {
    const el = containerRef.current!;
    const update = () =>
      setLayout(
        computeLayout(
          el.clientWidth,
          shown.months.length,
          shown.regions.map((r) => r.sido),
          compact,
        ),
      );
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [shown, compact]);

  // 바탕: 칸 · 지역 이름 · 연도 라벨
  useEffect(() => {
    if (!layout) return;
    const draw = () => {
      const ctx = setupCanvas(baseRef.current!, layout);
      const font = getComputedStyle(document.body).fontFamily;
      const gap = layout.cellWidth >= 3 ? 0.5 : 0;

      for (let r = 0; r < shown.regions.length; r++) {
        const row = shown.counts[r];
        const y = layout.rowTops[r];
        for (let m = 0; m < row.length; m++) {
          ctx.fillStyle = colorFor(row[m]);
          ctx.fillRect(
            layout.left + m * layout.cellWidth,
            y,
            layout.cellWidth - gap,
            layout.rowHeight - 1,
          );
        }
      }

      ctx.fillStyle = CHART_COLORS.textSecondary;
      ctx.font = `9px ${font}`;
      ctx.textBaseline = "middle";
      ctx.textAlign = "right";
      shown.regions.forEach((region, r) =>
        ctx.fillText(
          region.name,
          layout.left - 6,
          layout.rowTops[r] + layout.rowHeight / 2,
          layout.left - 8,
        ),
      );

      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      const axisY = layout.axisTop;
      shown.months.forEach((ym, m) => {
        const label = monthLabel(ym, compact);
        if (label)
          ctx.fillText(label, layout.left + m * layout.cellWidth, axisY);
      });
    };
    draw();
    // Pretendard가 늦게 오면 글자를 다시 그린다
    document.fonts?.ready.then(draw);
  }, [layout, shown, compact]);

  // 덮개: 가리키는 행 전체를 옅게, 칸은 테두리로
  useEffect(() => {
    if (!layout) return;
    const ctx = setupCanvas(overlayRef.current!, layout);
    if (!hover) return;
    const y = layout.rowTops[hover.row];
    ctx.fillStyle = "rgba(27, 27, 25, 0.06)";
    ctx.fillRect(0, y, layout.width, layout.rowHeight);
    if (hover.month !== null) {
      ctx.strokeStyle = CHART_COLORS.textSecondary;
      ctx.lineWidth = 1;
      ctx.strokeRect(
        layout.left + hover.month * layout.cellWidth - 0.5,
        y - 0.5,
        Math.max(layout.cellWidth, 2) + 1,
        layout.rowHeight + 1,
      );
    }
  }, [hover, layout]);

  const pointerTarget = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!layout) return null;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const hit = hitTest(x, y, layout);
    return hit ? { ...hit, x, y } : null;
  };

  const region = hover ? shown.regions[hover.row] : null;
  const count =
    hover && hover.month !== null ? shown.counts[hover.row][hover.month] : null;

  return (
    <div>
      <Legend />
      <div
        ref={containerRef}
        className="relative mt-2 w-full cursor-pointer touch-manipulation"
        style={{
          height:
            layout?.height ??
            heatmapHeight(
              shown.regions.length,
              new Set(shown.regions.map((r) => r.sido)).size,
            ),
        }}
        role="img"
        aria-label={`수도권 ${shown.regions.length}개 시군구의 월별 아파트 매매 거래량 히트맵 (${shown.months[0]} ~ ${shown.months.at(-1)}). 아래 지역 목록에서도 같은 지역으로 이동할 수 있습니다.`}
        onPointerMove={(e) => setHover(pointerTarget(e))}
        onPointerLeave={() => setHover(null)}
        onClick={(e) => {
          const hit = pointerTarget(e);
          if (hit) router.push(`/regions/${shown.regions[hit.row].code}`);
        }}
      >
        <canvas ref={baseRef} className="absolute inset-0" />
        <canvas
          ref={overlayRef}
          className="pointer-events-none absolute inset-0"
        />
        {hover && region && layout && (
          <Tooltip hover={hover} layout={layout}>
            <span className="text-muted-foreground">{region.sido}</span>{" "}
            <b>{region.name}</b>
            <br />
            {hover.month === null ? (
              "눌러서 지역 페이지로"
            ) : (
              <>
                {shown.months[hover.month].replace("-", ".")} · 거래{" "}
                <b>{count!.toLocaleString("ko-KR")}</b>건
              </>
            )}
          </Tooltip>
        )}
      </div>
    </div>
  );
}

function setupCanvas(canvas: HTMLCanvasElement, l: Layout) {
  // 고해상도 화면에서 흐려지지 않게 기기 픽셀 비율만큼 크게 그린다
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(l.width * dpr);
  canvas.height = Math.round(l.height * dpr);
  canvas.style.width = `${l.width}px`;
  canvas.style.height = `${l.height}px`;
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, l.width, l.height);
  return ctx;
}

function Tooltip({
  hover,
  layout,
  children,
}: {
  hover: Hover;
  layout: Layout;
  children: React.ReactNode;
}) {
  // 포인터 오른쪽 아래에 두고, 가장자리에서는 반대쪽으로 넘긴다
  const flipX = hover.x > layout.width - 180;
  const flipY = hover.y > layout.height - 60;
  return (
    <div
      role="presentation"
      className="pointer-events-none absolute z-10 rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs whitespace-nowrap shadow-md"
      style={{
        left: flipX ? undefined : hover.x + 12,
        right: flipX ? layout.width - hover.x + 12 : undefined,
        top: flipY ? undefined : hover.y + 12,
        bottom: flipY ? layout.height - hover.y + 12 : undefined,
      }}
    >
      {children}
    </div>
  );
}

function Legend() {
  return (
    <ul
      aria-label="색 구간 (월 거래 수)"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground"
    >
      {[{ label: "없음", color: EMPTY_COLOR }, ...HEATMAP_PIECES].map((p) => (
        <li key={p.label} className="flex items-center gap-1">
          <span
            aria-hidden
            className="inline-block size-2.5 rounded-[2px]"
            style={{ background: p.color }}
          />
          {p.label}
        </li>
      ))}
      <li className="ml-auto">단위: 건/월</li>
    </ul>
  );
}
