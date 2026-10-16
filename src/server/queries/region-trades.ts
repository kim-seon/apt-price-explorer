import "server-only";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  lt,
  lte,
  not,
  sql,
  type SQL,
} from "drizzle-orm";
import {
  AREA_BANDS,
  tradePeriodStart,
  type TradeFilters,
  type TradeSortKey,
} from "@/lib/region-params";
import { getDb } from "../db";
import { transactions } from "../db/schema";

// 지역 페이지 · 거래 탐색 탭 (docs/02 F4). 필터 · 정렬 · pagination은 모두 서버에서 한다 (CLAUDE.md 3.4).
// offset pagination으로 baseline을 잡고, 깊은 스크롤 저하를 측정한 뒤 keyset 전환을 판단한다 (docs/03 Decisions 1-1).
// 동적 필터라 쿼리 빌더를 쓴다 (docs/decisions/0003).

export const TRADE_PAGE_SIZE = 100;

const perPyeong = sql<number>`${transactions.price} / ${transactions.area} * 3.305785`;

const SORT_COLUMNS: Record<TradeSortKey, SQL> = {
  dealDate: sql`${transactions.dealDate}`,
  price: sql`${transactions.price}`,
  perPyeong,
  area: sql`${transactions.area}`,
  floor: sql`${transactions.floor}`,
};

export type RegionTrade = {
  id: number;
  dealDate: string;
  aptSeq: string;
  aptName: string;
  dong: string;
  area: number;
  floor: number | null;
  price: number;
  cancelled: boolean;
  dealType: string | null;
};

export type RegionTradePage = {
  rows: RegionTrade[];
  /** 필터에 맞는 전체 건수. 첫 페이지에서만 센다 */
  total: number | null;
  nextOffset: number | null;
};

function whereClause(sggCode: string, f: TradeFilters, today: Date) {
  const conds: SQL[] = [eq(transactions.sggCode, sggCode)];
  if (f.dong) conds.push(eq(transactions.umdName, f.dong));
  const start = tradePeriodStart(f.period, today);
  if (start) conds.push(gte(transactions.dealDate, start));
  const band = AREA_BANDS.find((b) => b.value === f.area);
  if (band?.min != null) conds.push(gte(transactions.area, band.min));
  if (band?.max != null) conds.push(lt(transactions.area, band.max));
  if (f.priceMin !== undefined) conds.push(gte(transactions.price, f.priceMin));
  if (f.priceMax !== undefined) conds.push(lte(transactions.price, f.priceMax));
  if (!f.cancelled) conds.push(not(transactions.cancelled));
  return and(...conds)!;
}

export async function getRegionTrades(
  sggCode: string,
  filters: TradeFilters,
  offset: number,
  today = new Date(),
): Promise<RegionTradePage> {
  const db = await getDb();
  const where = whereClause(sggCode, filters, today);
  const column = SORT_COLUMNS[filters.sort.key];
  const direction = filters.sort.desc ? desc : asc;

  const rowsQuery = db
    .select({
      id: transactions.id,
      dealDate: transactions.dealDate,
      aptSeq: transactions.aptSeq,
      aptName: transactions.aptName,
      dong: transactions.umdName,
      area: transactions.area,
      floor: transactions.floor,
      price: transactions.price,
      cancelled: transactions.cancelled,
      dealType: transactions.dealType,
    })
    .from(transactions)
    .where(where)
    .orderBy(
      // 층 등 값이 없는 거래는 방향과 관계없이 뒤로
      sql`${direction(column)} NULLS LAST`,
      // 같은 값끼리 순서가 페이지마다 바뀌지 않도록 고정한다 (offset pagination의 중복 / 누락 방지)
      direction(transactions.id),
    )
    // 다음 페이지 존재 여부를 알기 위해 한 행 더 읽는다
    .limit(TRADE_PAGE_SIZE + 1)
    .offset(offset);

  const countQuery =
    offset === 0
      ? db
          .select({ n: sql<string>`count(*)` })
          .from(transactions)
          .where(where)
      : null;

  const [rows, count] = await Promise.all([rowsQuery, countQuery]);
  const hasMore = rows.length > TRADE_PAGE_SIZE;
  return {
    rows: hasMore ? rows.slice(0, TRADE_PAGE_SIZE) : rows,
    total: count ? Number(count[0].n) : null,
    nextOffset: hasMore ? offset + TRADE_PAGE_SIZE : null,
  };
}
