import Link from "next/link";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPercent, formatPrice } from "@/lib/format";
import { parseSharedRegionParams } from "@/lib/region-params";
import {
  getDongSummaries,
  getRegionMonthlyStats,
} from "@/server/queries/region-stats";
import { RegionChart } from "./region-chart";

// 지역 페이지 · 통계 탭 (docs/03-ux-design.md ②: 월별 거래량 / 중위가 차트, 법정동별 요약 테이블)
// 차트와 표는 쿼리가 서로 독립이라 Suspense를 나눠 먼저 끝난 쪽부터 보여준다.

export default function RegionStatsPage({
  params,
  searchParams,
}: PageProps<"/regions/[code]/stats">) {
  return (
    <>
      <Suspense fallback={<Skeleton className="mt-4 h-[460px] w-full" />}>
        <MonthlyChart params={params} searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={<Skeleton className="mt-8 h-64 w-full" />}>
        <DongTable params={params} searchParams={searchParams} />
      </Suspense>
    </>
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
    <section aria-labelledby="monthly-heading" className="mt-4">
      <h2 id="monthly-heading" className="font-semibold">
        월별 거래가와 거래량{dong ? ` · ${dong}` : ""}
      </h2>
      <p className="mt-1 text-sm text-neutral-500">
        면적이 섞여 있어 전용 3.3㎡당 가격으로 비교합니다. 해제 거래 제외, 거래
        5건 미만인 달은 가격을 표시하지 않습니다.
      </p>
      {stats.length === 0 ? (
        <p className="mt-10 text-center text-neutral-500">거래가 없습니다.</p>
      ) : (
        <RegionChart
          stats={stats}
          currentMonth={currentMonth}
          label={dong ?? "지역"}
        />
      )}
    </section>
  );
}

async function DongTable({
  params,
  searchParams,
}: PageProps<"/regions/[code]/stats">) {
  const [{ code }, rawSearch] = await Promise.all([params, searchParams]);
  const { dong: selected } = parseSharedRegionParams(rawSearch);
  const rows = (await getDongSummaries(code)).sort((a, b) => b.count - a.count);

  return (
    <section aria-labelledby="dong-heading" className="mt-8">
      <h2 id="dong-heading" className="font-semibold">
        법정동별 최근 1년
      </h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-500">
          최근 2년간 거래가 없습니다.
        </p>
      ) : (
        <div className="mt-2 overflow-x-auto rounded-lg border border-neutral-200">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-neutral-600">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  법정동
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  거래
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  3.3㎡당 중위가 (전용)
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
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
                    className="border-t border-neutral-100 tabular-nums aria-[current=true]:bg-blue-50"
                  >
                    <td className="px-3 py-2">
                      <Link
                        href={`/regions/${code}/stats?dong=${encodeURIComponent(r.dong)}`}
                        scroll={false}
                        className="hover:underline"
                      >
                        {r.dong}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {r.count.toLocaleString("ko-KR")}건
                    </td>
                    <td className="px-3 py-2 text-right">
                      {r.median === null ? "-" : formatPrice(r.median)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {change === null ? "-" : formatPercent(change)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-xs text-neutral-500">
        전년 대비는 직전 1년 중위가와 비교합니다. 그 기간에 거래된 단지·면적
        구성이 달라도 값이 바뀌므로 개별 단지의 시세 변화와는 다를 수 있습니다.
      </p>
    </section>
  );
}
