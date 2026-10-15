import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "../db";

// 단지 상세 조회. 데이터 경계: docs/decisions/0005-apartment-detail-data-boundary.md
// 통계(분위수, 직전 최고가, 신고가 판정)는 SQL에서 계산하고, 클라이언트는 brush 필터링만 한다.

/** 신고가로 인정하기 위한 최소 선행 유효 거래 수 (docs/05 §2) */
const RECORD_HIGH_MIN_PRIOR = 5;

export type AreaTypeSummary = {
  label: string;
  minArea: number;
  maxArea: number;
  tradeCount: number;
};

export async function getAreaTypes(aptSeq: string): Promise<AreaTypeSummary[]> {
  const result = await getDb().execute<{
    label: string;
    min_area: string;
    max_area: string;
    trade_count: string;
  }>(sql`
    -- 거래 테이블을 한 번만 훑어 타입별 건수를 센다.
    -- (이전: 타입마다 상관 서브쿼리로 전체 스캔 → 타입 5개면 5회. docs/performance/cases/02-area-types-query.md)
    SELECT a.label, a.min_area, a.max_area, coalesce(c.trade_count, 0) AS trade_count
    FROM area_types a
    LEFT JOIN (
      SELECT area_type_label, count(*) AS trade_count
      FROM transactions
      WHERE apt_seq = ${aptSeq} AND NOT cancelled
      GROUP BY area_type_label
    ) c ON c.area_type_label = a.label
    WHERE a.apt_seq = ${aptSeq}
    ORDER BY a.min_area
  `);
  return result.rows.map((r) => ({
    label: r.label,
    minArea: Number(r.min_area),
    maxArea: Number(r.max_area),
    tradeCount: Number(r.trade_count),
  }));
}

/** 중위가 / 분위수 계산 구간(개월). 거래가 드문 달의 이상치가 추세처럼 보이는 것을 막는다 (docs/charts/price-trend.md) */
const STAT_WINDOW_MONTHS = 3;
/** 구간 거래가 이보다 적으면 통계를 그리지 않는다 */
const STAT_MIN_TRADES = 3;

export type MonthlyStat = {
  /** "2025-09" */
  month: string;
  /** 그달 거래 수 (거래량 막대) */
  count: number;
  /** 최근 3개월(그달 포함) 구간의 거래 수 */
  windowCount: number;
  /** 최근 3개월 구간 분위수. 구간 거래가 3건 미만이면 null */
  p25: number | null;
  median: number | null;
  p75: number | null;
};

/** 해제 거래를 제외한 월별 거래량과, 최근 3개월 이동 구간의 분위수 */
export async function getMonthlyStats(
  aptSeq: string,
  label: string,
  fromDate: string,
): Promise<MonthlyStat[]> {
  const result = await getDb().execute<{
    month: string;
    count: string;
    window_count: string;
    p25: number | null;
    median: number | null;
    p75: number | null;
  }>(sql`
    WITH months AS (
      SELECT generate_series(
        date_trunc('month', ${fromDate}::date),
        date_trunc('month', current_date),
        interval '1 month'
      )::date AS m
    ), t AS (
      SELECT deal_date, price FROM transactions
      WHERE apt_seq = ${aptSeq} AND area_type_label = ${label} AND NOT cancelled
        AND deal_date >= ${fromDate}::date - make_interval(months => ${STAT_WINDOW_MONTHS - 1})
    )
    SELECT to_char(m, 'YYYY-MM') AS month,
      (SELECT count(*) FROM t WHERE deal_date >= m AND deal_date < m + interval '1 month') AS count,
      w.window_count, w.p25, w.median, w.p75
    FROM months, LATERAL (
      SELECT count(*) AS window_count,
        percentile_cont(0.25) WITHIN GROUP (ORDER BY price) AS p25,
        percentile_cont(0.5)  WITHIN GROUP (ORDER BY price) AS median,
        percentile_cont(0.75) WITHIN GROUP (ORDER BY price) AS p75
      FROM t
      WHERE deal_date >= m - make_interval(months => ${STAT_WINDOW_MONTHS - 1})
        AND deal_date < m + interval '1 month'
    ) w
    ORDER BY m
  `);
  return result.rows.map((r) => {
    const windowCount = Number(r.window_count);
    const enough = windowCount >= STAT_MIN_TRADES;
    const round = (v: number | null) =>
      enough && v !== null ? Math.round(v) : null;
    return {
      month: r.month,
      count: Number(r.count),
      windowCount,
      p25: round(r.p25),
      median: round(r.median),
      p75: round(r.p75),
    };
  });
}

export type Trade = {
  id: number;
  dealDate: string;
  price: number;
  area: number;
  floor: number | null;
  cancelled: boolean;
  dealType: string | null;
  /** 이 거래 이전(같은 날 제외)의 유효 거래 최고가. 이력 부족 시 null */
  prevHigh: number | null;
  /** 이 거래일까지(같은 날 포함)의 유효 거래 최고가 — 역대 최고가 계단선 */
  highAfter: number | null;
  /** 신고가면 직전 최고가 대비 상승률, 아니면 null */
  recordHighRatio: number | null;
};

/**
 * 선택 기간의 개별 거래. 직전 최고가는 기간 이전 이력까지 포함해 계산해야 하므로
 * window function을 전체 이력에 적용한 뒤 기간으로 거른다.
 */
export async function getTrades(
  aptSeq: string,
  label: string,
  fromDate: string,
): Promise<Trade[]> {
  const result = await getDb().execute<{
    id: string;
    deal_date: string;
    price: number;
    area: string;
    floor: number | null;
    cancelled: boolean;
    deal_type: string | null;
    prev_high: number | null;
    prior_count: string;
    high_after: number | null;
  }>(sql`
    WITH t AS (
      SELECT id, deal_date, price, area, floor, cancelled, deal_type,
        max(price) FILTER (WHERE NOT cancelled) OVER before_day AS prev_high,
        count(*)   FILTER (WHERE NOT cancelled) OVER before_day AS prior_count,
        max(price) FILTER (WHERE NOT cancelled) OVER through_day AS high_after
      FROM transactions
      WHERE apt_seq = ${aptSeq} AND area_type_label = ${label}
      WINDOW
        before_day  AS (ORDER BY deal_date RANGE BETWEEN UNBOUNDED PRECEDING AND INTERVAL '1 day' PRECEDING),
        through_day AS (ORDER BY deal_date RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
    )
    -- 드라이버의 date 파싱(타임존 영향)을 피하려고 문자열로 받는다
    SELECT id, to_char(deal_date, 'YYYY-MM-DD') AS deal_date, price, area, floor,
      cancelled, deal_type, prev_high, prior_count, high_after
    FROM t
    WHERE t.deal_date >= ${fromDate}
    ORDER BY t.deal_date DESC, id DESC
  `);

  return result.rows.map((r) => {
    const priorCount = Number(r.prior_count);
    const isRecordHigh =
      !r.cancelled &&
      r.prev_high !== null &&
      priorCount >= RECORD_HIGH_MIN_PRIOR &&
      r.price > r.prev_high;
    return {
      id: Number(r.id),
      dealDate: r.deal_date,
      price: r.price,
      area: Number(r.area),
      floor: r.floor,
      cancelled: r.cancelled,
      dealType: r.deal_type,
      prevHigh: r.prev_high,
      highAfter: r.high_after,
      recordHighRatio: isRecordHigh ? r.price / r.prev_high! - 1 : null,
    };
  });
}
