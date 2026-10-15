import Link from "next/link";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { getRegionGroups } from "@/server/queries/regions";
import { SearchBox } from "./search-box";

// 진입 화면 (docs/03-ux-design.md ①): 단지 상세로 최대한 빨리 보내는 것이 목적.
// 수도권 히트맵은 MVP 마지막 작업(M6)에서 검색창 아래에 추가한다.

export default function HomePage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-20">
      <h1 className="text-3xl font-bold tracking-tight">
        아파트 실거래가 탐색기
      </h1>
      <p className="mt-2 text-neutral-600">
        서울 · 경기 · 인천 아파트 매매 실거래를 단지별로 살펴보세요.
      </p>

      <div className="mt-8">
        <SearchBox />
      </div>

      <section aria-labelledby="regions-heading" className="mt-12">
        <h2 id="regions-heading" className="font-semibold">
          지역에서 찾기
        </h2>
        <Suspense fallback={<RegionSkeleton />}>
          <RegionList />
        </Suspense>
      </section>
    </main>
  );
}

async function RegionList() {
  const groups = await getRegionGroups();
  return (
    <div className="mt-4 space-y-6">
      {groups.map((group) => (
        <div key={group.sidoName}>
          <h3 className="text-sm font-medium text-neutral-500">
            {group.sidoName}
          </h3>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {group.sggs.map((sgg) => (
              <li key={sgg.sggCode}>
                <Link
                  href={`/regions/${sgg.sggCode}`}
                  className="inline-block rounded-full border border-neutral-200 px-3 py-1 text-sm hover:border-neutral-900 focus-visible:border-neutral-900"
                >
                  {sgg.sggName}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function RegionSkeleton() {
  return (
    <div
      className="mt-4 space-y-3"
      aria-busy="true"
      aria-label="지역 목록 불러오는 중"
    >
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}
