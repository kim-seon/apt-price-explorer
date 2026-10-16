import { BarChart3, ChartSpline, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { pillClass } from "@/components/ui/styles";
import { getMostTradedComplexes } from "@/server/queries/complexes";
import { getRegionGroups } from "@/server/queries/regions";
import { SearchBox } from "./search-box";

// 진입 화면 (docs/03-ux-design.md ①): 단지 상세로 최대한 빨리 보내는 것이 목적.
// 시안 01을 따르되 사진 대신 타이포 중심으로 둔다 (실제 단지 사진처럼 오인될 이미지를 쓰지 않는다).
// 수도권 히트맵은 MVP 마지막 작업(M6)에서 검색창 아래에 추가한다.

const FEATURES = [
  {
    icon: ChartSpline,
    title: "단지별 실거래 추이",
    body: "면적 타입별 거래가 분포(25~75%)와 중위가, 신고가를 한 차트에서 봅니다.",
  },
  {
    icon: BarChart3,
    title: "지역 통계",
    body: "시군구 · 법정동의 월별 거래량과 3.3㎡당 가격, 동별 전년 대비를 비교합니다.",
  },
  {
    icon: SlidersHorizontal,
    title: "조건별 거래 탐색",
    body: "기간 · 면적 · 가격으로 지역 전체 거래를 좁혀 보고 정렬합니다.",
  },
];

export default function HomePage() {
  return (
    <main className="w-full">
      <section className="border-b border-border bg-gradient-to-b from-card to-background">
        <div className="mx-auto w-full max-w-6xl px-4 pt-12 pb-10 sm:px-6 sm:pt-20 sm:pb-14">
          <h1 className="text-3xl leading-tight font-extrabold tracking-tight sm:text-5xl">
            실거래 데이터로
            <br />더 나은 주거 결정을
          </h1>
          <p className="mt-4 max-w-xl text-muted-foreground sm:text-lg">
            서울 · 경기 · 인천 아파트 매매 실거래를 기반으로 단지별 시세 흐름과
            거래 정보를 한눈에 확인할 수 있습니다.
          </p>
          <div className="mt-8 max-w-2xl">
            <SearchBox />
          </div>
          <Suspense fallback={<div className="mt-4 h-8" />}>
            <MostTraded />
          </Suspense>
        </div>
      </section>

      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <ul className="mt-10 grid gap-3 sm:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <li
              key={title}
              className="rounded-xl border border-border bg-card p-5"
            >
              <Icon aria-hidden className="size-6" strokeWidth={1.6} />
              <h2 className="mt-4 font-semibold">{title}</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
            </li>
          ))}
        </ul>

        <section
          id="regions"
          aria-labelledby="regions-heading"
          className="mt-14 mb-16 scroll-mt-20"
        >
          <h2 id="regions-heading" className="text-lg font-bold">
            지역에서 찾기
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            시군구를 고르면 단지 목록 · 지역 통계 · 거래 탐색을 볼 수 있습니다.
          </p>
          <Suspense fallback={<RegionSkeleton />}>
            <RegionList />
          </Suspense>
        </section>
      </div>
    </main>
  );
}

async function MostTraded() {
  const complexes = await getMostTradedComplexes();
  if (complexes.length === 0) return null;
  return (
    <div className="mt-4 flex flex-wrap items-center gap-1.5 text-sm">
      <span className="mr-1 font-medium">거래가 많은 단지</span>
      {complexes.map((c) => (
        <Link
          key={c.aptSeq}
          href={`/apartments/${encodeURIComponent(c.aptSeq)}`}
          className="rounded-md bg-muted px-2.5 py-1 text-[13px] text-muted-foreground outline-none hover:bg-foreground hover:text-background focus-visible:ring-2 focus-visible:ring-ring"
        >
          {c.name}
        </Link>
      ))}
    </div>
  );
}

async function RegionList() {
  const groups = await getRegionGroups();
  return (
    <div className="mt-5 space-y-6">
      {groups.map((group) => (
        <div key={group.sidoName}>
          <h3 className="text-sm font-medium text-muted-foreground">
            {group.sidoName}
          </h3>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {group.sggs.map((sgg) => (
              <li key={sgg.sggCode}>
                <Link href={`/regions/${sgg.sggCode}`} className={pillClass}>
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
      className="mt-5 space-y-3"
      aria-busy="true"
      aria-label="지역 목록 불러오는 중"
    >
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}
