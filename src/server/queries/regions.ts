import "server-only";
import { eq } from "drizzle-orm";
import { querySggCodes } from "@/lib/regions";
import { getDb } from "../db";
import { regions } from "../db/schema";

export type SidoGroup = {
  sidoName: string;
  sggs: { sggCode: string; sggName: string }[];
};

/** 진입 화면의 지역 선택용: 거래 데이터가 있는 시군구(일반구 단위)를 시도별로 묶는다 */
export async function getRegionGroups(): Promise<SidoGroup[]> {
  const rows = await getDb()
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
    // "수원시장안구" → "수원시 장안구" (일반구는 시 이름과 붙어서 저장되어 있다)
    const sggName = row.sggName.replace(/^(.+시)(.+구)$/, "$1 $2");
    group.sggs.push({ sggCode: row.sggCode, sggName });
    groups.set(row.sidoName, group);
  }
  return [...groups.values()];
}
