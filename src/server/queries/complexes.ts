import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import { complexes, regions, transactions } from "../db/schema";

// M2 walking skeleton용 최소 조회. index 없이 시작해 baseline을 잰다 (CLAUDE.md 10).

export async function getComplex(aptSeq: string) {
  const db = await getDb();
  const [row] = await db
    .select({
      aptSeq: complexes.aptSeq,
      name: complexes.name,
      buildYear: complexes.buildYear,
      umdName: complexes.umdName,
      sidoName: regions.sidoName,
      sggName: regions.sggName,
    })
    .from(complexes)
    .innerJoin(
      regions,
      and(eq(regions.sggCode, complexes.sggCode), eq(regions.level, "sgg")),
    )
    .where(eq(complexes.aptSeq, aptSeq));
  return row ?? null;
}

export async function getRecentTransactions(aptSeq: string, limit = 20) {
  const db = await getDb();
  return db
    .select({
      id: transactions.id,
      dealDate: transactions.dealDate,
      price: transactions.price,
      area: transactions.area,
      areaTypeLabel: transactions.areaTypeLabel,
      floor: transactions.floor,
      cancelled: transactions.cancelled,
    })
    .from(transactions)
    .where(eq(transactions.aptSeq, aptSeq))
    .orderBy(desc(transactions.dealDate), desc(transactions.id))
    .limit(limit);
}

/** 화면의 "데이터 기준일": 가장 최근에 적재된 파티션의 수집 시각 */
export async function getDataFreshness() {
  const db = await getDb();
  const result = await db.execute<{ fetched_at: string | null }>(
    sql`SELECT max(fetched_at) AS fetched_at FROM import_partitions`,
  );
  return result.rows[0]?.fetched_at ?? null;
}
