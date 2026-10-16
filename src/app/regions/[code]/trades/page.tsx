import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { parseTradeFilters, serializeTradeFilters } from "@/lib/region-params";
import { getRegionTrades } from "@/server/queries/region-trades";
import { TradeExplorer } from "./trade-explorer";

// 지역 페이지 · 거래 탐색 탭 (docs/02 F4, docs/decisions/0006)
// 첫 페이지는 서버에서 렌더해 초기 화면이 API 왕복을 기다리지 않게 하고,
// 이후 필터 변경 · 무한 스크롤은 클라이언트(TanStack Query → Route Handler)가 맡는다.

export default function RegionTradesPage({
  params,
  searchParams,
}: PageProps<"/regions/[code]/trades">) {
  return (
    <Suspense fallback={<ExplorerSkeleton />}>
      <TradesData params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function TradesData({
  params,
  searchParams,
}: PageProps<"/regions/[code]/trades">) {
  const [{ code }, rawSearch] = await Promise.all([params, searchParams]);
  const filters = parseTradeFilters(rawSearch);
  const page = await getRegionTrades(code, filters, 0);
  return (
    <TradeExplorer
      code={code}
      initialKey={serializeTradeFilters(filters).toString()}
      initialPage={page}
    />
  );
}

function ExplorerSkeleton() {
  return (
    <div
      className="mt-4 space-y-2"
      aria-busy="true"
      aria-label="거래 불러오는 중"
    >
      <Skeleton className="h-10 w-full" />
      {Array.from({ length: 12 }, (_, i) => (
        <Skeleton key={i} className="h-8 w-full" />
      ))}
    </div>
  );
}
