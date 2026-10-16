import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
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
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
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
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground">
            지역 선택
          </Link>
          <span aria-hidden> › </span>
          {region.sidoName}
        </p>
        <h1 className="mt-1 text-2xl font-bold">{region.sggName}</h1>
      </div>
      <DongSelect dongs={dongs} />
    </header>
  );
}

function HeaderSkeleton() {
  return (
    <div
      className="flex items-end justify-between"
      aria-busy="true"
      aria-label="지역 정보 불러오는 중"
    >
      <div className="space-y-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-8 w-32" />
      </div>
      <Skeleton className="h-9 w-40" />
    </div>
  );
}
