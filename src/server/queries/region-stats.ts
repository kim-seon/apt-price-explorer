import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "../db";

// 지역 페이지 · 통계 탭 (docs/02 F4). 통계는 모두 서버에서 계산한다 (CLAUDE.md 3.4).
//
// 지역 단위 가격은 면적이 섞여 있어 거래가 대신 전용 3.3㎡당 가격으로 본다.
// 지역은 거래 위치(transactions.sgg_code) 기준, 해제 거래 제외.
// 단지 상세와 달리 월별로 계산한다 — 지역 단위는 한 달 거래가 수십~수백 건이라 이동 구간이 필요 없고,
// 거래가 적은 달(법정동 필터 시)은 그리지 않는다 (docs/charts/region-stats.md).

/** 월 거래가 이보다 적으면 분위수를 그리지 않는다 */
export const REGION_STAT_MIN_TRADES = 5;

const PER_PYEONG = sql`price / area * 3.305785`;

export type RegionMonthlyStat = {
  /** "2025-09" */
  month: string;
  count: number;
  /** 전용 3.3㎡당 분위수 (만원). 거래가 5건 미만이면 null */
  p25: number | null;
  median: number | null;
  p75: number | null;
};

export async function getRegionMonthlyStats(
  sggCode: string,
  dong: string | undefined,
): Promise<RegionMonthlyStat[]> {
  const db = await getDb();
  const dongFilter = dong ? sql`AND umd_name = ${dong}` : sql``;
  const result = await db.execute<{
    month: string;
    n: string;
    q: number[];
  }>(sql`
    SELECT to_char(date_trunc('month', deal_date), 'YYYY-MM') AS month,
      count(*) AS n,
      percentile_cont(ARRAY[0.25, 0.5, 0.75]) WITHIN GROUP (ORDER BY ${PER_PYEONG}) AS q
    FROM transactions
    WHERE sgg_code = ${sggCode} ${dongFilter} AND NOT cancelled
    GROUP BY 1
    ORDER BY 1
  `);
  return result.rows.map((r) => {
    const count = Number(r.n);
    const pick = (i: number) =>
      count >= REGION_STAT_MIN_TRADES ? Math.round(r.q[i]) : null;
    return {
      month: r.month,
      count,
      p25: pick(0),
      median: pick(1),
      p75: pick(2),
    };
  });
}

export type DongSummary = {
  dong: string;
  /** 최근 1년 거래 수 */
  count: number;
  /** 최근 1년 전용 3.3㎡당 중위가 */
  median: number | null;
  /** 그 이전 1년 중위가 */
  prevMedian: number | null;
};

/** 법정동별 최근 1년 요약과 전년 동기 중위가 */
export async function getDongSummaries(
  sggCode: string,
): Promise<DongSummary[]> {
  const db = await getDb();
  const lastYear = sql`deal_date >= current_date - interval '1 year'`;
  const prevYear = sql`deal_date >= current_date - interval '2 years' AND deal_date < current_date - interval '1 year'`;
  const result = await db.execute<{
    umd_name: string;
    n: string;
    median: number | null;
    prev_median: number | null;
  }>(sql`
    SELECT umd_name,
      count(*) FILTER (WHERE ${lastYear}) AS n,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY ${PER_PYEONG}) FILTER (WHERE ${lastYear}) AS median,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY ${PER_PYEONG}) FILTER (WHERE ${prevYear}) AS prev_median
    FROM transactions
    WHERE sgg_code = ${sggCode} AND NOT cancelled
      AND deal_date >= current_date - interval '2 years'
    GROUP BY umd_name
    ORDER BY umd_name
  `);
  const round = (v: number | null) => (v === null ? null : Math.round(v));
  return result.rows.map((r) => ({
    dong: r.umd_name,
    count: Number(r.n),
    median: round(r.median),
    prevMedian: round(r.prev_median),
  }));
}
