import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { parseComplexListParams } from "@/lib/region-params";
import { getRegionComplexes } from "@/server/queries/region-complexes";
import { ComplexTable } from "./complex-table";

// 지역 페이지 · 단지 목록 탭 (docs/02 F2)

export default function RegionComplexesPage({
  params,
  searchParams,
}: PageProps<"/regions/[code]">) {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <ComplexList params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function ComplexList({
  params,
  searchParams,
}: PageProps<"/regions/[code]">) {
  const [{ code }, rawSearch] = await Promise.all([params, searchParams]);
  const { dong, sort } = parseComplexListParams(rawSearch);
  const complexes = await getRegionComplexes(code, dong);

  if (complexes.length === 0) {
    return (
      <p className="mt-10 text-center text-muted-foreground">
        {dong
          ? `${dong}에 거래 기록이 있는 단지가 없습니다.`
          : "단지가 없습니다."}
      </p>
    );
  }
  return <ComplexTable complexes={complexes} initialSort={sort} />;
}

function TableSkeleton() {
  return (
    <div
      className="mt-4 space-y-2"
      aria-busy="true"
      aria-label="단지 목록 불러오는 중"
    >
      <Skeleton className="h-5 w-32" />
      {Array.from({ length: 12 }, (_, i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  );
}
