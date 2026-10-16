import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PERIODS,
  parseApartmentParams,
  periodStartDate,
  type ApartmentParams,
} from "@/lib/apartment-params";
import {
  pillClass,
  segmentItemClass,
  segmentRootClass,
} from "@/components/ui/styles";
import { toPyeong } from "@/lib/format";
import { displaySggName } from "@/lib/regions";
import {
  getAreaTypes,
  getMonthlyStats,
  getTrades,
} from "@/server/queries/apartment-detail";
import { getComplex, getDataFreshness } from "@/server/queries/complexes";
import { TradeExplorer } from "./trade-explorer";

// 단지 상세 (docs/03-ux-design.md ③). 캐시는 아직 쓰지 않는다 — baseline 측정 후 결정.
//
// Suspense 경계를 둘로 나눈다 (docs/performance/frontend-baseline.md):
// - 헤더: PK 조회 수준의 가벼운 쿼리만 기다린다 → 먼저 표시 (LCP 요소)
// - 본문(타입 탭 · 차트 · 테이블): 분석 쿼리를 기다린 뒤 스트리밍

export default function ApartmentPage({
  params,
  searchParams,
}: PageProps<"/apartments/[id]">) {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <Suspense fallback={<HeaderSkeleton />}>
        <ApartmentHeader params={params} />
      </Suspense>
      <Suspense fallback={<BodySkeleton />}>
        <ApartmentBody params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function ApartmentHeader({
  params,
}: Pick<PageProps<"/apartments/[id]">, "params">) {
  const { id } = await params;
  const [complex, freshness] = await Promise.all([
    getComplex(decodeURIComponent(id)),
    getDataFreshness(),
  ]);
  if (!complex) notFound();

  const sggName = displaySggName(complex.sggName);
  const regionHref = `/regions/${complex.sggCode}`;
  return (
    <header>
      <Breadcrumb
        items={[
          { label: "홈", href: "/" },
          { label: complex.sidoName },
          { label: sggName, href: regionHref },
          {
            label: complex.umdName,
            href: `${regionHref}?dong=${encodeURIComponent(complex.umdName)}`,
          },
          { label: complex.name },
        ]}
      />
      <h1 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
        {complex.name}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {complex.sidoName} {sggName} {complex.umdName} {complex.jibun ?? ""}
      </p>
      <ul className="mt-3 flex flex-wrap gap-1.5 text-xs text-muted-foreground">
        {complex.buildYear && (
          <li className={metaChip}>{complex.buildYear}년 준공</li>
        )}
        <li className={metaChip}>
          누적 거래 {complex.tradeCount.toLocaleString("ko-KR")}건
        </li>
        <li
          className={metaChip}
          title="최근 1~2개월은 신고 기한(계약 후 30일) 때문에 거래가 추가될 수 있습니다"
        >
          데이터 기준{" "}
          {freshness ? new Date(freshness).toLocaleDateString("ko-KR") : "-"}
        </li>
      </ul>
    </header>
  );
}

const metaChip = "rounded-md bg-muted px-2 py-1";

async function ApartmentBody({
  params,
  searchParams,
}: Pick<PageProps<"/apartments/[id]">, "params" | "searchParams">) {
  const [{ id }, rawSearch] = await Promise.all([params, searchParams]);
  const aptSeq = decodeURIComponent(id);
  const query = parseApartmentParams(rawSearch);

  const areaTypes = await getAreaTypes(aptSeq);
  // 없는 단지는 헤더가 notFound()를 처리한다
  if (areaTypes.length === 0) return null;

  // 기본 면적 타입: 거래가 가장 많은 타입 (docs/02 Decisions #5)
  const selected =
    areaTypes.find((t) => t.label === query.type) ??
    areaTypes.reduce(
      (best, t) => (t.tradeCount > best.tradeCount ? t : best),
      areaTypes[0],
    );

  const today = new Date();
  const periodStart = periodStartDate(query.period, today);
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

  const [stats, trades] = selected
    ? await Promise.all([
        getMonthlyStats(aptSeq, selected.label, periodStart),
        getTrades(aptSeq, selected.label, periodStart),
      ])
    : [[], []];

  // 타입 / 기간 링크: brush 범위(from, to)는 데이터가 바뀌므로 넘기지 않는다
  const href = (next: Partial<ApartmentParams>) => {
    const merged = { ...query, ...next };
    const search = new URLSearchParams();
    if (merged.type) search.set("type", merged.type);
    if (merged.period !== "5y") search.set("period", merged.period);
    if (merged.cancelled) search.set("cancelled", "1");
    const qs = search.toString();
    return `/apartments/${encodeURIComponent(aptSeq)}${qs ? `?${qs}` : ""}`;
  };

  // 기간 프리셋은 서버 재렌더(데이터 범위가 바뀜)라 링크로 두고, 차트 카드 머리에 넣는다 (시안 02)
  const periodNav = (
    <nav aria-label="기간" className={segmentRootClass}>
      {PERIODS.map((p) => (
        <Link
          key={p.value}
          href={href({ period: p.value })}
          aria-current={p.value === query.period ? "page" : undefined}
          className={segmentItemClass}
          scroll={false}
        >
          {p.label}
        </Link>
      ))}
    </nav>
  );

  return (
    <>
      <div className="sticky top-14 z-10 -mx-4 mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-background/95 px-4 py-2.5 backdrop-blur sm:-mx-6 sm:px-6">
        {/* 모바일에서는 면적 타입을 한 줄로 두고 가로로 넘긴다 */}
        <nav
          aria-label="면적 타입"
          className="-mx-4 flex w-[calc(100%+2rem)] gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:w-auto sm:flex-wrap sm:overflow-visible sm:px-0"
        >
          {areaTypes.map((t) => (
            <Link
              key={t.label}
              href={href({ type: t.label })}
              aria-current={t.label === selected?.label ? "page" : undefined}
              className={pillClass}
              scroll={false}
            >
              전용 {t.label}㎡
              <span className="text-xs opacity-60">
                ({toPyeong(t.minArea)}평 · {t.tradeCount}건)
              </span>
            </Link>
          ))}
        </nav>
      </div>

      {trades.length === 0 ? (
        <div className="mt-10 flex flex-col items-center gap-3 text-muted-foreground">
          <p>이 기간에는 거래가 없습니다. 기간을 넓혀 보세요.</p>
          {periodNav}
        </div>
      ) : (
        <TradeExplorer
          // 타입 / 기간이 바뀌면 brush 상태를 초기화한다
          key={`${selected?.label}-${query.period}`}
          trades={trades}
          stats={stats}
          periodStart={periodStart}
          currentMonth={currentMonth}
          initialRange={
            query.from && query.to ? { from: query.from, to: query.to } : null
          }
          initialShowCancelled={query.cancelled}
          areaLabel={selected ? `전용 ${selected.label}㎡` : ""}
          periodNav={periodNav}
        />
      )}
    </>
  );
}

function HeaderSkeleton() {
  // 실제 헤더와 같은 높이로 맞춰 레이아웃 이동(CLS)을 막는다
  return (
    <div
      className="space-y-2"
      aria-busy="true"
      aria-label="단지 정보 불러오는 중"
    >
      <Skeleton className="h-4 w-64" />
      <Skeleton className="h-9 w-72" />
      <Skeleton className="h-5 w-56" />
      <Skeleton className="h-5 w-96 max-w-full" />
    </div>
  );
}

function BodySkeleton() {
  return (
    <div
      className="mt-4 space-y-4"
      aria-busy="true"
      aria-label="거래 데이터 불러오는 중"
    >
      <Skeleton className="h-10 w-full" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
      <Skeleton className="h-[420px] w-full" />
    </div>
  );
}
