import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";
import { SGG_CODE } from "@/lib/region-params";
import { getDongs, getRegion } from "@/server/queries/regions";
import { DongSelect, RegionTabs } from "./region-nav";

// 지역 페이지 (docs/03-ux-design.md ②). 탭은 중첩 라우트로 나눈다:
// /regions/[code] 단지 목록 · /stats 통계 · /trades 거래 탐색
// 탭을 옮겨도 헤더와 법정동 선택은 유지되고, 탭별 쿼리와 JS만 새로 불러온다.

export default function RegionLayout({
  params,
  children,
}: LayoutProps<"/regions/[code]">) {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <Suspense fallback={<HeaderSkeleton />}>
        <RegionHeader params={params} />
      </Suspense>
      {/* 탭 링크는 현재 search params(법정동)를 이어받는다 → 요청 시점 값이라 Suspense 필요 */}
      <Suspense fallback={<div className="mt-4 h-11 border-b" />}>
        <RegionTabs />
      </Suspense>
      {children}
    </main>
  );
}

async function RegionHeader({
  params,
}: Pick<LayoutProps<"/regions/[code]">, "params">) {
  const { code } = await params;
  if (!SGG_CODE.test(code)) notFound();
  const [region, dongs] = await Promise.all([getRegion(code), getDongs(code)]);
  if (!region) notFound();

  return (
    <header>
      <Breadcrumb
        items={[
          { label: "홈", href: "/" },
          { label: "지역 통계", href: "/#regions" },
          { label: region.sidoName },
          { label: region.sggName },
        ]}
      />
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            {region.sggName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {region.sidoName} {region.sggName} 아파트 매매 실거래 동향
          </p>
        </div>
        <DongSelect dongs={dongs} />
      </div>
    </header>
  );
}

function HeaderSkeleton() {
  return (
    <div aria-busy="true" aria-label="지역 정보 불러오는 중">
      <Skeleton className="h-4 w-56" />
      <div className="mt-3 flex items-end justify-between">
        <div className="space-y-2">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-5 w-64" />
        </div>
        <Skeleton className="h-8 w-40" />
      </div>
    </div>
  );
}
