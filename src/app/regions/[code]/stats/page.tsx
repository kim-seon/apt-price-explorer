import Link from "next/link";
import { Suspense } from "react";
import { tableClass } from "@/components/ui/data-table";
import { Card, CardHeader } from "@/components/ui/card";
import { Delta } from "@/components/ui/delta";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { formatPrice } from "@/lib/format";
import { parseSharedRegionParams } from "@/lib/region-params";
import { cn } from "@/lib/utils";
import {
  getDongSummaries,
  getRegionMonthlyStats,
  getRegionSummary,
} from "@/server/queries/region-stats";
import { RegionChart } from "./region-chart";

// 지역 페이지 · 통계 탭 (docs/03-ux-design.md ②: 월별 거래량 / 중위가 차트, 법정동별 요약 테이블)
// 차트와 표는 쿼리가 서로 독립이라 Suspense를 나눠 먼저 끝난 쪽부터 보여준다.

export default function RegionStatsPage({
  params,
  searchParams,
}: PageProps<"/regions/[code]/stats">) {
  return (
    <div className="mt-5 space-y-4">
      <Suspense fallback={<KpiSkeleton />}>
        <Kpis params={params} searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-[500px] w-full rounded-xl" />}>
        <MonthlyChart params={params} searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
        <DongTable params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Kpis({
  params,
  searchParams,
}: PageProps<"/regions/[code]/stats">) {
  const [{ code }, rawSearch] = await Promise.all([params, searchParams]);
  const { dong } = parseSharedRegionParams(rawSearch);
  const s = await getRegionSummary(code, dong);
  const ratio = (a: number | null, b: number | null) =>
    a !== null && b ? a / b - 1 : null;
  const basis = `최근 1년${dong ? ` · ${dong}` : ""}`;
  return (
    // 모바일에서는 카드를 가로로 넘긴다 (세로로 쌓으면 차트가 화면 아래로 밀린다)
    <dl className="-mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 [&>*]:w-[72%] [&>*]:shrink-0 [&>*]:snap-start sm:[&>*]:w-auto">
      <StatCard
        label="중위 거래가"
        basis={`${basis} · 면적 무관`}
        value={s.medianPrice === null ? "-" : formatPrice(s.medianPrice)}
        footer={
          <Delta
            ratio={ratio(s.medianPrice, s.prevMedianPrice)}
            label="전년 대비"
          />
        }
      />
      <StatCard
        label="거래량"
        basis={`${basis} · 해제 제외`}
        value={`${s.count.toLocaleString("ko-KR")}건`}
        footer={<Delta ratio={ratio(s.count, s.prevCount)} label="전년 대비" />}
      />
      <StatCard
        label="3.3㎡당 중위가"
        basis={`${basis} · 전용면적 기준`}
        value={s.median === null ? "-" : formatPrice(s.median)}
        footer={
          <Delta ratio={ratio(s.median, s.prevMedian)} label="전년 대비" />
        }
      />
    </dl>
  );
}

function KpiSkeleton() {
  return (
    <div
      className="grid gap-3 sm:grid-cols-3"
      aria-busy="true"
      aria-label="지표 불러오는 중"
    >
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-[124px] rounded-xl" />
      ))}
    </div>
  );
}

async function MonthlyChart({
  params,
  searchParams,
}: PageProps<"/regions/[code]/stats">) {
  const [{ code }, rawSearch] = await Promise.all([params, searchParams]);
  const { dong } = parseSharedRegionParams(rawSearch);
  const stats = await getRegionMonthlyStats(code, dong);
  const today = new Date();
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

  return (
    <Card aria-labelledby="monthly-heading">
      {stats.length === 0 ? (
        <>
          <CardHeader id="monthly-heading" title="시세 추이" />
          <p className="mt-10 mb-6 text-center text-muted-foreground">
            거래가 없습니다.
          </p>
        </>
      ) : (
        <RegionChart
          stats={stats}
          currentMonth={currentMonth}
          label={dong ?? "지역"}
          title={`시세 추이${dong ? ` · ${dong}` : ""}`}
          description="전용 3.3㎡당 · 월별 · 해제 거래 제외"
        />
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        면적이 섞여 있어 전용 3.3㎡당 가격으로 비교합니다. 거래 5건 미만인 달은
        가격을 표시하지 않습니다. 최근 2개월(점선 · 흐린 막대)은 신고 기한
        전이라 거래가 더 늘어날 수 있습니다.
      </p>
    </Card>
  );
}

async function DongTable({
  params,
  searchParams,
}: PageProps<"/regions/[code]/stats">) {
  const [{ code }, rawSearch] = await Promise.all([params, searchParams]);
  const { dong: selected } = parseSharedRegionParams(rawSearch);
  const rows = (await getDongSummaries(code)).sort((a, b) => b.count - a.count);
  const maxCount = Math.max(1, ...rows.map((r) => r.count));

  return (
    <Card aria-labelledby="dong-heading">
      <CardHeader
        id="dong-heading"
        title="법정동별 주요 지표"
        description="최근 1년 · 해제 거래 제외 · 법정동을 누르면 해당 동의 추이를 봅니다"
      />
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          최근 2년간 거래가 없습니다.
        </p>
      ) : (
        <div className={cn(tableClass.wrapper, "mt-2")}>
          <table className={tableClass.table}>
            <thead className={tableClass.thead}>
              <tr>
                <th scope="col" className={tableClass.th}>
                  법정동
                </th>
                <th scope="col" className={cn(tableClass.th, "w-2/5")}>
                  거래
                </th>
                <th
                  scope="col"
                  className={cn(tableClass.th, tableClass.numeric)}
                >
                  3.3㎡당 중위가
                </th>
                <th
                  scope="col"
                  className={cn(tableClass.th, tableClass.numeric)}
                >
                  전년 대비
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const change =
                  r.median !== null && r.prevMedian !== null
                    ? r.median / r.prevMedian - 1
                    : null;
                return (
                  <tr
                    key={r.dong}
                    aria-current={r.dong === selected ? "true" : undefined}
                    className={cn(
                      tableClass.row,
                      "aria-[current=true]:bg-brand-soft",
                    )}
                  >
                    <td className={tableClass.td}>
                      <Link
                        href={`/regions/${code}/stats?dong=${encodeURIComponent(r.dong)}`}
                        scroll={false}
                        className="hover:text-brand-foreground hover:underline"
                      >
                        {r.dong}
                      </Link>
                    </td>
                    <td className={tableClass.td}>
                      {/* 거래량을 막대로 함께 보여 동 사이 비교를 쉽게 한다 (숫자가 원본, 막대는 보조) */}
                      <div className="flex items-center gap-2">
                        <span className="w-14 shrink-0 text-right">
                          {r.count.toLocaleString("ko-KR")}건
                        </span>
                        <span
                          aria-hidden
                          className="h-2 rounded-r-sm bg-brand/45"
                          style={{ width: `${(r.count / maxCount) * 100}%` }}
                        />
                      </div>
                    </td>
                    <td className={cn(tableClass.td, tableClass.numeric)}>
                      {r.median === null ? "-" : formatPrice(r.median)}
                    </td>
                    <td className={cn(tableClass.td, tableClass.numeric)}>
                      <Delta ratio={change} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        전년 대비는 직전 1년 중위가와 비교합니다. 그 기간에 거래된 단지·면적
        구성이 달라도 값이 바뀌므로 개별 단지의 시세 변화와는 다를 수 있습니다.
      </p>
    </Card>
  );
}
