// 거래 데이터에서 단지(complexes) · 면적 타입(area_types) · 시군구 월별 거래 수(sgg_monthly_counts)를 파생하고,
// (TRUNCATE는 ACCESS EXCLUSIVE 잠금으로 갱신 중 앱 조회를 막으므로 DELETE를 쓴다 — 읽기는 MVCC로 이전 데이터를 본다)
// transactions.area_type_label을 채운다. 적재 후 매번 전체 재계산한다 (docs/05 §1, §4).
//
// 사용: pnpm derive

import "./lib/env";
import { sql } from "drizzle-orm";
import { createDb } from "../src/server/db/client";
import { areaTypes } from "../src/server/db/schema";
import { groupAreaTypes } from "../src/server/domain/area-types";
import { requireEnv } from "./lib/env";

const CHUNK = 5000;

async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const t0 = performance.now();
  const result = await fn();
  console.log(`  ${label}: ${Math.round(performance.now() - t0)}ms`);
  return result;
}

async function main() {
  const { db, pool } = createDb(requireEnv("DATABASE_URL"));
  try {
    await db.transaction(async (tx) => {
      // 단지: 이름은 가장 최근 거래 기준, 시군구는 최빈값(2개 시군구에 걸친 단지 존재)
      await timed("complexes", async () => {
        await tx.execute(sql`DELETE FROM complexes`);
        await tx.execute(sql`
          INSERT INTO complexes
            (apt_seq, name, build_year, sgg_code, umd_name, jibun, trade_count, last_deal_date)
          SELECT
            apt_seq,
            (array_agg(apt_name ORDER BY deal_date DESC))[1],
            max(build_year),
            mode() WITHIN GROUP (ORDER BY sgg_code),
            (array_agg(umd_name ORDER BY deal_date DESC))[1],
            (array_agg(jibun ORDER BY deal_date DESC))[1],
            count(*) FILTER (WHERE NOT cancelled),
            max(deal_date) FILTER (WHERE NOT cancelled)
          FROM transactions
          GROUP BY apt_seq
        `);
      });

      // 진입 화면 히트맵용 시군구 × 월 거래 수 (원본 집계는 운영에서 3.5초 → 사전 집계)
      await timed("sgg_monthly_counts", async () => {
        await tx.execute(sql`DELETE FROM sgg_monthly_counts`);
        await tx.execute(sql`
          INSERT INTO sgg_monthly_counts (sgg_code, deal_ym, trade_count)
          SELECT sgg_code, to_char(date_trunc('month', deal_date), 'YYYY-MM'), count(*)
          FROM transactions
          WHERE NOT cancelled
          GROUP BY 1, 2
        `);
      });

      // 면적 타입: 단지별 (면적, 건수)를 모아 TS 규칙으로 그룹핑
      const areaCounts = await timed("area counts", () =>
        tx.execute<{ apt_seq: string; area: string; count: string }>(sql`
          SELECT apt_seq, area, count(*) AS count FROM transactions GROUP BY apt_seq, area
        `),
      );
      const byComplex = new Map<string, { area: number; count: number }[]>();
      for (const row of areaCounts.rows) {
        const list = byComplex.get(row.apt_seq) ?? [];
        list.push({ area: Number(row.area), count: Number(row.count) });
        byComplex.set(row.apt_seq, list);
      }

      const typeRows: (typeof areaTypes.$inferInsert)[] = [];
      const labelRows: { aptSeq: string; area: number; label: string }[] = [];
      for (const [aptSeq, counts] of byComplex) {
        for (const type of groupAreaTypes(counts)) {
          typeRows.push({
            aptSeq,
            label: type.label,
            minArea: type.minArea,
            maxArea: type.maxArea,
          });
          for (const area of type.areas)
            labelRows.push({ aptSeq, area, label: type.label });
        }
      }

      await timed("area_types", async () => {
        await tx.execute(sql`DELETE FROM area_types`);
        for (let i = 0; i < typeRows.length; i += CHUNK) {
          await tx.insert(areaTypes).values(typeRows.slice(i, i + CHUNK));
        }
      });

      // 거래에 라벨 반영. 바뀐 행 수를 남긴다 (재계산으로 타입이 합쳐지거나 갈라진 경우 추적).
      const changed = await timed("label update", async () => {
        await tx.execute(
          sql`CREATE TEMP TABLE area_label_map (apt_seq text, area numeric(9,4), label text) ON COMMIT DROP`,
        );
        for (let i = 0; i < labelRows.length; i += CHUNK) {
          const chunk = labelRows.slice(i, i + CHUNK);
          await tx.execute(sql`
            INSERT INTO area_label_map (apt_seq, area, label) VALUES
            ${sql.join(
              chunk.map((r) => sql`(${r.aptSeq}, ${r.area}, ${r.label})`),
              sql`, `,
            )}
          `);
        }
        const result = await tx.execute(sql`
          UPDATE transactions t SET area_type_label = m.label
          FROM area_label_map m
          WHERE t.apt_seq = m.apt_seq AND t.area = m.area
            AND t.area_type_label IS DISTINCT FROM m.label
        `);
        return result.rowCount ?? 0;
      });

      console.log(
        `complexes ${byComplex.size}, area types ${typeRows.length}, transactions relabeled ${changed}`,
      );
    });
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
