import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PERIODS,
  parseApartmentParams,
  periodStartDate,
  type ApartmentParams,
} from "@/lib/apartment-params";
import { toPyeong } from "@/lib/format";
import {
  getAreaTypes,
  getMonthlyStats,
  getTrades,
} from "@/server/queries/apartment-detail";
import { getComplex, getDataFreshness } from "@/server/queries/complexes";
import { TradeExplorer } from "./trade-explorer";

// 단지 상세 (docs/03-ux-design.md ③). 캐시는 아직 쓰지 않는다 — baseline 측정 후 결정.

export default function ApartmentPage({
  params,
  searchParams,
}: PageProps<"/apartments/[id]">) {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      <Suspense fallback={<DetailSkeleton />}>
        <ApartmentDetail params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function ApartmentDetail({
  params,
  searchParams,
}: Pick<PageProps<"/apartments/[id]">, "params" | "searchParams">) {
  const [{ id }, rawSearch] = await Promise.all([params, searchParams]);
  const aptSeq = decodeURIComponent(id);
  const query = parseApartmentParams(rawSearch);

  const [complex, areaTypes, freshness] = await Promise.all([
    getComplex(aptSeq),
    getAreaTypes(aptSeq),
    getDataFreshness(),
  ]);
  if (!complex) notFound();

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

  return (
    <>
      <header>
        <p className="text-sm text-neutral-500">
          {complex.sidoName} {complex.sggName} {complex.umdName}
        </p>
        <h1 className="mt-1 text-2xl font-bold">{complex.name}</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {complex.buildYear ? `${complex.buildYear}년 준공 · ` : ""}데이터 기준{" "}
          {freshness ? new Date(freshness).toLocaleDateString("ko-KR") : "-"}
          <span className="ml-1">
            (최근 1~2개월은 신고 기한 때문에 거래가 추가될 수 있습니다)
          </span>
        </p>
      </header>

      <div className="sticky top-0 z-10 -mx-4 mt-4 flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <nav aria-label="면적 타입" className="flex flex-wrap gap-1">
          {areaTypes.map((t) => (
            <Link
              key={t.label}
              href={href({ type: t.label })}
              aria-current={t.label === selected?.label ? "page" : undefined}
              className="rounded-full border border-neutral-300 px-3 py-1 text-sm aria-[current=page]:border-neutral-900 aria-[current=page]:bg-neutral-900 aria-[current=page]:text-white"
              scroll={false}
            >
              전용 {t.label}㎡
              <span className="ml-1 text-xs opacity-70">
                ({toPyeong(t.minArea)}평 · {t.tradeCount}건)
              </span>
            </Link>
          ))}
        </nav>
        <nav aria-label="기간" className="flex gap-1">
          {PERIODS.map((p) => (
            <Link
              key={p.value}
              href={href({ period: p.value })}
              aria-current={p.value === query.period ? "page" : undefined}
              className="rounded px-2 py-1 text-sm text-neutral-600 aria-[current=page]:bg-neutral-100 aria-[current=page]:font-semibold aria-[current=page]:text-neutral-900"
              scroll={false}
            >
              {p.label}
            </Link>
          ))}
        </nav>
      </div>

      {trades.length === 0 ? (
        <p className="mt-10 text-center text-neutral-500">
          이 기간에는 거래가 없습니다.
        </p>
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
        />
      )}
    </>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="불러오는 중">
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-8 w-72" />
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
