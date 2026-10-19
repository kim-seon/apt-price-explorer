import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "../db";
import { getRegionGroups } from "./regions";

// 진입 화면 히트맵: 시군구 × 계약월 거래 수 (해제 제외). 사전 집계 테이블을 읽는다 (docs/charts/heatmap.md).

export type HeatmapData = {
  /** "2006-01" … 현재 월 */
  months: string[];
  /** 위에서 아래 순서 (서울 → 인천 → 경기, 시도 안에서는 코드 순) */
  regions: { code: string; name: string; sido: string }[];
  /** counts[region][month]. 거래가 없으면 0 */
  counts: number[][];
};

export async function getHeatmap(): Promise<HeatmapData> {
  const db = await getDb();
  const [groups, result] = await Promise.all([
    getRegionGroups(),
    db.execute<{ sgg_code: string; deal_ym: string; trade_count: number }>(
      sql`SELECT sgg_code, deal_ym, trade_count FROM sgg_monthly_counts`,
    ),
  ]);
  const regions = groups.flatMap((g) =>
    g.sggs.map((s) => ({ code: s.sggCode, name: s.sggName, sido: g.sidoName })),
  );

  let first = "9999-99";
  for (const r of result.rows) if (r.deal_ym < first) first = r.deal_ym;
  const now = new Date();
  const last = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const months: string[] = [];
  for (let [y, m] = first.split("-").map(Number); ;) {
    const ym = `${y}-${String(m).padStart(2, "0")}`;
    if (ym > last) break;
    months.push(ym);
    if (++m > 12) {
      m = 1;
      y++;
    }
  }

  const monthIndex = new Map(months.map((m, i) => [m, i]));
  const regionIndex = new Map(regions.map((r, i) => [r.code, i]));
  const counts = regions.map(() => new Array<number>(months.length).fill(0));
  for (const r of result.rows) {
    const ri = regionIndex.get(r.sgg_code);
    const mi = monthIndex.get(r.deal_ym);
    if (ri !== undefined && mi !== undefined) counts[ri][mi] = r.trade_count;
  }
  return { months, regions, counts };
}
