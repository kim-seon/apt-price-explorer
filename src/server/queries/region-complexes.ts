import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "../db";

// 지역 페이지 · 단지 목록 탭 (docs/02 F2). 시군구 하나의 단지(최대 약 800개)를 한 번에 내려보내고
// 정렬은 클라이언트에서 한다 — 0005와 같은 경계: 집계는 서버, 수백 행 정렬은 UI 표현.
//
// 대표 시군구 기준으로 단지를 고르고, 거래는 apt_seq로 모은다
// (시군구 경계에 걸친 단지의 다른 쪽 거래도 포함).

/** 최근 거래 수 / 대표 면적을 세는 기간 */
export const RECENT_YEARS = 3;
/** 3.3㎡당 중위가를 계산하는 기간 */
export const PER_PYEONG_YEARS = 1;

export type RegionComplex = {
  aptSeq: string;
  name: string;
  dong: string;
  buildYear: number | null;
  /** 해제 제외 최근 거래 */
  lastDealDate: string | null;
  lastPrice: number | null;
  lastArea: number | null;
  /** 최근 3년 거래가 가장 많은 면적 타입 */
  mainType: string | null;
  /** 최근 3년 거래 수 (해제 제외) */
  recentCount: number;
  /** 최근 1년 전용 3.3㎡당 중위가 (만원). 거래가 없으면 null */
  perPyeong: number | null;
};

export async function getRegionComplexes(
  sggCode: string,
  dong: string | undefined,
): Promise<RegionComplex[]> {
  const db = await getDb();
  const dongFilter = dong ? sql`AND umd_name = ${dong}` : sql``;
  const result = await db.execute<{
    apt_seq: string;
    name: string;
    umd_name: string;
    build_year: number | null;
    last_deal_date: string | null;
    last_price: number | null;
    last_area: string | null;
    main_type: string | null;
    recent_count: string | null;
    per_pyeong: number | null;
  }>(sql`
    SELECT c.apt_seq, c.name, c.umd_name, c.build_year, c.last_deal_date,
      t.last_price, t.last_area, t.main_type, t.recent_count, t.per_pyeong
    FROM complexes c
    LEFT JOIN (
      SELECT apt_seq,
        (array_agg(price ORDER BY deal_date DESC, id DESC))[1] AS last_price,
        (array_agg(area ORDER BY deal_date DESC, id DESC))[1] AS last_area,
        count(*) FILTER (
          WHERE deal_date >= current_date - make_interval(years => ${RECENT_YEARS})
        ) AS recent_count,
        mode() WITHIN GROUP (ORDER BY area_type_label) FILTER (
          WHERE deal_date >= current_date - make_interval(years => ${RECENT_YEARS})
        ) AS main_type,
        round(percentile_cont(0.5) WITHIN GROUP (ORDER BY price / area * 3.305785) FILTER (
          WHERE deal_date >= current_date - make_interval(years => ${PER_PYEONG_YEARS})
        )) AS per_pyeong
      FROM transactions
      WHERE NOT cancelled
        AND apt_seq IN (
          SELECT apt_seq FROM complexes WHERE sgg_code = ${sggCode} ${dongFilter}
        )
      GROUP BY apt_seq
    ) t USING (apt_seq)
    WHERE c.sgg_code = ${sggCode} ${dongFilter}
  `);
  return result.rows.map((r) => ({
    aptSeq: r.apt_seq,
    name: r.name,
    dong: r.umd_name,
    buildYear: r.build_year,
    lastDealDate: r.last_deal_date,
    lastPrice: r.last_price,
    lastArea: r.last_area === null ? null : Number(r.last_area),
    mainType: r.main_type,
    recentCount: Number(r.recent_count ?? 0),
    perPyeong: r.per_pyeong === null ? null : Number(r.per_pyeong),
  }));
}
