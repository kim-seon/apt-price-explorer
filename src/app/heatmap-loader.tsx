"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import type { HeatmapData } from "@/server/queries/heatmap";

// ECharts(gzip 약 230KB)를 진입 화면 첫 로드에 넣지 않는다. 검색창 · 제목(LCP)이 먼저 뜨고,
// 히트맵은 브라우저에서 별도 청크로 받는다. 캔버스 차트라 서버 렌더링으로 얻는 것도 없다.
// 또 2만 칸 초기화가 메인 스레드를 막으므로(TBT 43 → 278ms, CPU 4x) 화면 가까이 왔을 때만 만든다.
const HeatmapChartView = dynamic(() => import("./heatmap-chart"), {
  ssr: false,
  loading: () => <HeatmapSkeleton rows={82} />,
});

export function HeatmapLoader({ data }: { data: HeatmapData }) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px 0px" },
    );
    observer.observe(ref.current!);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref}>
      {near ? (
        <HeatmapChartView data={data} />
      ) : (
        <HeatmapSkeleton rows={data.regions.length} />
      )}
    </div>
  );
}

/** 실제 차트와 같은 높이로 자리를 잡아 레이아웃 이동(CLS)을 막는다 */
export function HeatmapSkeleton({ rows }: { rows: number }) {
  return (
    <Skeleton
      className="w-full rounded-md"
      style={{ height: rows * 9 + 60 }}
      aria-busy="true"
      aria-label="거래량 히트맵 불러오는 중"
    />
  );
}
