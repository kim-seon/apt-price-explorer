import "server-only";
import { eq, sql } from "drizzle-orm";
import { displaySggName, querySggCodes } from "@/lib/regions";
import { getDb } from "../db";
import { regions } from "../db/schema";

export type SidoGroup = {
  sidoName: string;
  sggs: { sggCode: string; sggName: string }[];
};

/** 진입 화면의 지역 선택용: 거래 데이터가 있는 시군구(일반구 단위)를 시도별로 묶는다 */
export async function getRegionGroups(): Promise<SidoGroup[]> {
  const db = await getDb();
  const rows = await db
    .select({
      sggCode: regions.sggCode,
      sggName: regions.sggName,
      sidoName: regions.sidoName,
    })
    .from(regions)
    .where(eq(regions.level, "sgg"))
    .orderBy(regions.sggCode);

  const targets = new Set(querySggCodes(rows));
  const groups = new Map<string, SidoGroup>();
  for (const row of rows) {
    if (!targets.has(row.sggCode)) continue;
    const group = groups.get(row.sidoName) ?? {
      sidoName: row.sidoName,
      sggs: [],
    };
    group.sggs.push({
      sggCode: row.sggCode,
      sggName: displaySggName(row.sggName),
    });
    groups.set(row.sidoName, group);
  }
  return [...groups.values()];
}

export type RegionInfo = {
  sggCode: string;
  sidoName: string;
  sggName: string;
};

/** 지역 페이지 헤더. 조회 대상이 아닌 코드(일반구를 가진 상위 시, 없는 코드)는 null */
export async function getRegion(sggCode: string): Promise<RegionInfo | null> {
  const db = await getDb();
  const rows = await db
    .select({
      sggCode: regions.sggCode,
      sggName: regions.sggName,
      sidoName: regions.sidoName,
    })
    .from(regions)
    .where(eq(regions.level, "sgg"));
  if (!querySggCodes(rows).includes(sggCode)) return null;
  const row = rows.find((r) => r.sggCode === sggCode)!;
  return { ...row, sggName: displaySggName(row.sggName) };
}

export type DongOption = { name: string; complexCount: number };

/**
 * 법정동 선택 목록. regions의 읍면동 이름은 거래 데이터의 표기("오남읍 오남리")와 달라서
 * 단지 테이블의 실제 값으로 만든다.
 */
export async function getDongs(sggCode: string): Promise<DongOption[]> {
  const db = await getDb();
  const result = await db.execute<{ umd_name: string; n: string }>(sql`
    SELECT umd_name, count(*) AS n
    FROM complexes
    WHERE sgg_code = ${sggCode}
    GROUP BY umd_name
    ORDER BY umd_name
  `);
  return result.rows.map((r) => ({
    name: r.umd_name,
    complexCount: Number(r.n),
  }));
}
