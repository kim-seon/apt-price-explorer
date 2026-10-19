"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { CHART_COLORS } from "@/components/charts/colors";
import { Segmented } from "@/components/ui/segmented";
import { useMediaQuery } from "@/lib/use-media-query";
import type { HeatmapData } from "@/server/queries/heatmap";
import {
  computeLayout,
  heatmapHeight,
  hitTest,
  monthLabel,
  NO_BASELINE_COLOR,
  PERIODS,
  RATIO_PIECES,
  ratioColor,
  ratioOf,
  selectView,
  trailingBaseline,
  type HeatmapPeriod,
  type Layout,
} from "./heatmap-layout";

// 수도권 시군구 × 월 거래 활발도 히트맵 — Canvas 직접 구현 (docs/charts/heatmap.md)
//
// - 시도 탭(서울 25 · 인천 11 · 경기 47행)과 기간(3년 기본)으로 한 번에 보는 칸 수를 줄인다
// - 색 = 그 지역 평소(직전 5년 월평균) 대비 배율. 최근 2개월은 신고 기한 전이라 흐리게("집계 중")
// - 바탕 캔버스(데이터 · 크기 · 탭이 바뀔 때)와 덮개 캔버스(hover 표시)를 나눠 마우스 이동마다 다시 그리지 않는다
// - ECharts 버전보다 진입 화면 TBT 259 → 40ms (라이브러리 없이 fillRect)
// 키보드로 지역을 고르는 경로는 아래 "지역에서 찾기" 목록이다.

type Hover = { row: number; month: number | null; x: number; y: number };

const PROVISIONAL_ALPHA = 0.35;

export function HeatmapCanvas({ data }: { data: HeatmapData }) {
  const router = useRouter();
  const compact = useMediaQuery("(max-width: 639px)");
  const sidos = useMemo(
    () => [...new Set(data.regions.map((r) => r.sido))],
    [data],
  );
  const [sido, setSido] = useState(sidos[0]);
  const [period, setPeriod] = useState<HeatmapPeriod>("3y");

  // 평소(이동 평균)는 전체 기간으로 한 번만 계산한다
  const baselines = useMemo(
    () => data.counts.map((row) => trailingBaseline(row)),
    [data],
  );
  const view = useMemo(
    () => selectView(data, baselines, sido, period),
    [data, baselines, sido, period],
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const [layout, setLayout] = useState<Layout | null>(null);
  const [hover, setHover] = useState<Hover | null>(null);

  useEffect(() => {
    const el = containerRef.current!;
    const update = () =>
      setLayout(
        computeLayout(
          el.clientWidth,
          view.months.length,
          view.regions.length,
          compact,
        ),
      );
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [view, compact]);

  // 바탕: 칸 · 지역 이름 · 월 라벨
  useEffect(() => {
    if (!layout) return;
    const draw = () => {
      const ctx = setupCanvas(baseRef.current!, layout);
      const font = getComputedStyle(document.body).fontFamily;
      const gapX = layout.cellWidth >= 6 ? 1 : 0;

      view.regions.forEach((_, r) => {
        const y = r * layout.rowHeight;
        view.counts[r].forEach((count, m) => {
          ctx.globalAlpha = m >= view.provisionalFrom ? PROVISIONAL_ALPHA : 1;
          ctx.fillStyle = ratioColor(ratioOf(count, view.baselines[r][m]));
          ctx.fillRect(
            layout.left + m * layout.cellWidth,
            y,
            layout.cellWidth - gapX,
            layout.rowHeight - 1,
          );
        });
      });
      ctx.globalAlpha = 1;

      ctx.fillStyle = CHART_COLORS.textSecondary;
      ctx.font = `11px ${font}`;
      ctx.textBaseline = "middle";
      ctx.textAlign = "right";
      view.regions.forEach((region, r) =>
        ctx.fillText(
          region.name,
          layout.left - 8,
          r * layout.rowHeight + layout.rowHeight / 2,
          layout.left - 10,
        ),
      );

      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      view.months.forEach((ym, m) => {
        const label = monthLabel(ym, period);
        if (label)
          ctx.fillText(
            label,
            layout.left + m * layout.cellWidth,
            layout.axisTop,
          );
      });
    };
    draw();
    // Pretendard가 늦게 오면 글자를 다시 그린다
    document.fonts?.ready.then(draw);
  }, [layout, view, period]);

  // 덮개: 가리키는 행 전체를 옅게, 칸은 테두리로
  useEffect(() => {
    if (!layout) return;
    const ctx = setupCanvas(overlayRef.current!, layout);
    if (!hover) return;
    const y = hover.row * layout.rowHeight;
    ctx.fillStyle = "rgba(27, 27, 25, 0.06)";
    ctx.fillRect(0, y, layout.left - 2, layout.rowHeight - 1);
    if (hover.month !== null) {
      ctx.strokeStyle = CHART_COLORS.textSecondary;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(
        layout.left + hover.month * layout.cellWidth,
        y,
        Math.max(layout.cellWidth - 1, 2),
        layout.rowHeight - 1,
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

  const counts = useMemo(
    () =>
      new Map(
        sidos.map((s) => [s, data.regions.filter((r) => r.sido === s).length]),
      ),
    [data, sidos],
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented
          label="시도"
          value={sido}
          options={sidos.map((s) => ({
            value: s,
            label: `${shortSido(s)} ${counts.get(s)}`,
          }))}
          onChange={(s) => {
            setSido(s);
            setHover(null);
          }}
        />
        <Segmented
          label="기간"
          value={period}
          options={PERIODS.map((p) => ({ value: p.value, label: p.label }))}
          onChange={(p) => {
            setPeriod(p);
            setHover(null);
          }}
        />
      </div>
      <Legend />
      <div
        ref={containerRef}
        className="relative mt-3 w-full cursor-pointer touch-manipulation"
        style={{
          height: layout?.height ?? heatmapHeight(view.regions.length, compact),
        }}
        role="img"
        aria-label={`${sido} ${view.regions.length}개 시군구의 월별 아파트 매매 거래 활발도(평소 대비) 히트맵, ${view.months[0]} ~ ${view.months.at(-1)}. 아래 지역 목록에서도 같은 지역으로 이동할 수 있습니다.`}
        onPointerMove={(e) => setHover(pointerTarget(e))}
        onPointerLeave={() => setHover(null)}
        onClick={(e) => {
          const hit = pointerTarget(e);
          if (hit) router.push(`/regions/${view.regions[hit.row].code}`);
        }}
      >
        <canvas ref={baseRef} className="absolute inset-0" />
        <canvas
          ref={overlayRef}
          className="pointer-events-none absolute inset-0"
        />
        {hover && layout && (
          <Tooltip hover={hover} layout={layout}>
            <TooltipBody view={view} hover={hover} />
          </Tooltip>
        )}
      </div>
    </div>
  );
}

function TooltipBody({
  view,
  hover,
}: {
  view: ReturnType<typeof selectView>;
  hover: Hover;
}) {
  const region = view.regions[hover.row];
  if (hover.month === null)
    return (
      <>
        <b>{region.name}</b>
        <br />
        눌러서 지역 페이지로
      </>
    );
  const count = view.counts[hover.row][hover.month];
  const baseline = view.baselines[hover.row][hover.month];
  const ratio = ratioOf(count, baseline);
  return (
    <>
      <b>{region.name}</b> · {view.months[hover.month].replace("-", ".")}
      {hover.month >= view.provisionalFrom && (
        <span className="text-muted-foreground"> (집계 중)</span>
      )}
      <br />
      거래 <b>{count.toLocaleString("ko-KR")}</b>건
      {ratio !== null && baseline !== null ? (
        <>
          {" "}
          · 평소 {Math.round(baseline).toLocaleString("ko-KR")}건의{" "}
          <b>{ratio.toFixed(2)}배</b>
        </>
      ) : (
        <span className="text-muted-foreground"> · 비교할 이력 부족</span>
      )}
    </>
  );
}

function shortSido(sido: string) {
  return sido.replace(/특별시|광역시|도$/, "");
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
  const flipX = hover.x > layout.width - 240;
  const flipY = hover.y > layout.height - 64;
  return (
    <div
      role="presentation"
      className="pointer-events-none absolute z-10 rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs leading-relaxed whitespace-nowrap shadow-md"
      style={{
        left: flipX ? undefined : hover.x + 14,
        right: flipX ? layout.width - hover.x + 14 : undefined,
        top: flipY ? undefined : hover.y + 14,
        bottom: flipY ? layout.height - hover.y + 14 : undefined,
      }}
    >
      {children}
    </div>
  );
}

function Legend() {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
      <span className="font-medium text-foreground">평소 대비</span>
      <ul aria-label="색 구간 (평소 대비 배율)" className="flex items-center">
        {RATIO_PIECES.map((p, i) => (
          <li key={p.label} className="flex w-14 flex-col items-center">
            <span
              aria-hidden
              className={`h-2.5 w-full ${i === 0 ? "rounded-l-sm" : ""} ${i === RATIO_PIECES.length - 1 ? "rounded-r-sm" : ""}`}
              style={{ background: p.color }}
            />
            <span className="mt-0.5 text-[10px] whitespace-nowrap">
              {p.label}
            </span>
          </li>
        ))}
      </ul>
      <span className="flex items-center gap-1">
        <span
          aria-hidden
          className="inline-block size-2.5 rounded-[2px] bg-[#e34948] opacity-35"
        />
        집계 중(최근 2개월)
      </span>
      <span className="flex items-center gap-1">
        <span
          aria-hidden
          className="inline-block size-2.5 rounded-[2px] border border-border"
          style={{ background: NO_BASELINE_COLOR }}
        />
        이력 부족
      </span>
    </div>
  );
}
