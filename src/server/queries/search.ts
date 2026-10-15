import "server-only";
import { sql } from "drizzle-orm";
import { escapeLike } from "@/lib/search-query";
import { getDb } from "../db";

// 단지명 검색. 인덱스 없이 단지 테이블(약 2만 행)을 부분 일치로 훑는다 — 측정 10ms (docs/08 M4).
// 정렬: 이름이 검색어로 시작하는 단지 → 거래 많은 단지 → 이름순.

export type ComplexSearchResult = {
  aptSeq: string;
  name: string;
  sidoName: string;
  sggName: string;
  umdName: string;
  buildYear: number | null;
  tradeCount: number;
};

export async function searchComplexes(
  normalizedQuery: string,
  limit = 10,
): Promise<ComplexSearchResult[]> {
  const pattern = escapeLike(normalizedQuery);
  const result = await getDb().execute<{
    apt_seq: string;
    name: string;
    sido_name: string;
    sgg_name: string;
    umd_name: string;
    build_year: number | null;
    trade_count: number;
  }>(sql`
    SELECT c.apt_seq, c.name, r.sido_name, r.sgg_name, c.umd_name, c.build_year, c.trade_count
    FROM complexes c
    JOIN regions r ON r.sgg_code = c.sgg_code AND r.level = 'sgg'
    WHERE replace(c.name, ' ', '') ILIKE '%' || ${pattern} || '%' ESCAPE '\\'
    ORDER BY
      (replace(c.name, ' ', '') ILIKE ${pattern} || '%' ESCAPE '\\') DESC,
      c.trade_count DESC,
      c.name
    LIMIT ${limit}
  `);
  return result.rows.map((r) => ({
    aptSeq: r.apt_seq,
    name: r.name,
    sidoName: r.sido_name,
    sggName: r.sgg_name,
    umdName: r.umd_name,
    buildYear: r.build_year,
    tradeCount: r.trade_count,
  }));
}
