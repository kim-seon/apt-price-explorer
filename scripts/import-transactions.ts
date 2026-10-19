// 아파트 매매 실거래 적재. 파티션(시군구 × 계약년월) 단위로 교체한다 (docs/05 §3).
//
// 사용:
//   pnpm import:transactions --from 200601 --to 202610            # 전체 (캐시 우선)
//   pnpm import:transactions --recent 7 --refresh                 # 정기 갱신: 최근 7개월 재수집
//   옵션: --sgg 11440,11680  --max-calls 9500  --refresh(캐시 무시)
//         --skip-imported (이미 import_partitions에 있는 파티션은 건너뜀 — 예산 소진 후 이어서 적재할 때)
//
// 파티션별 측정값은 data/import-logs/<run>.jsonl에 남긴다.

import "./lib/env";
import { appendFile, mkdir } from "node:fs/promises";
import { parseArgs } from "node:util";
import { and, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { createDb } from "../src/server/db/client";
import {
  areaTypes,
  importPartitions,
  regions,
  transactions,
} from "../src/server/db/schema";
import { requireEnv } from "./lib/env";
import { CallBudgetExhausted, createMolitClient } from "./lib/molit-client";
import { MolitQuotaError, normalizeItems } from "./lib/molit-parse";
import { querySggCodes } from "../src/lib/regions";

const INSERT_CHUNK = 1000;

function monthRange(from: string, to: string): string[] {
  const months: string[] = [];
  let y = Number(from.slice(0, 4));
  let m = Number(from.slice(4));
  while (`${y}${String(m).padStart(2, "0")}` <= to) {
    months.push(`${y}${String(m).padStart(2, "0")}`);
    if (++m > 12) {
      m = 1;
      y++;
    }
  }
  return months;
}

function currentYm(offsetMonths = 0) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - offsetMonths);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthBounds(ym: string) {
  const y = Number(ym.slice(0, 4));
  const m = Number(ym.slice(4));
  const next =
    m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  return { start: `${y}-${ym.slice(4)}-01`, next };
}

type NewTransaction = typeof transactions.$inferInsert;

async function fillKnownAreaTypes(
  db: ReturnType<typeof createDb>["db"],
  rows: NewTransaction[],
) {
  const aptSeqs = [...new Set(rows.map((r) => r.aptSeq))];
  if (aptSeqs.length === 0) return;
  const types = await db
    .select({
      aptSeq: areaTypes.aptSeq,
      label: areaTypes.label,
      minArea: areaTypes.minArea,
      maxArea: areaTypes.maxArea,
    })
    .from(areaTypes)
    .where(inArray(areaTypes.aptSeq, aptSeqs));
  const byApt = Map.groupBy(types, (t) => t.aptSeq);
  for (const row of rows) {
    const match = byApt
      .get(row.aptSeq)
      ?.find((t) => row.area >= t.minArea && row.area <= t.maxArea);
    row.areaTypeLabel = match?.label ?? null;
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      from: { type: "string" },
      to: { type: "string" },
      recent: { type: "string" },
      sgg: { type: "string" },
      "max-calls": { type: "string", default: "9500" },
      refresh: { type: "boolean", default: false },
      "skip-imported": { type: "boolean", default: false },
    },
  });

  const to = values.to ?? currentYm();
  const from = values.recent
    ? currentYm(Number(values.recent) - 1)
    : values.from;
  if (!from) throw new Error("--from YYYYMM 또는 --recent N 이 필요합니다");

  const { db, pool } = createDb(requireEnv("DATABASE_URL"));
  const client = createMolitClient({
    serviceKey: requireEnv("DATA_GO_KR_SERVICE_KEY"),
    cacheDir: "data/raw",
    maxCalls: Number(values["max-calls"]),
    refresh: values.refresh,
  });

  const sggRows = await db
    .select({ sggCode: regions.sggCode, sggName: regions.sggName })
    .from(regions)
    .where(eq(regions.level, "sgg"));
  if (sggRows.length === 0)
    throw new Error("regions가 비어 있습니다. pnpm import:regions 먼저 실행");
  const sggCodes = values.sgg ? values.sgg.split(",") : querySggCodes(sggRows);

  // 최근 월부터 적재해 이후 마일스톤이 최신 데이터로 먼저 진행되게 한다.
  const months = monthRange(from, to).reverse();
  let partitions = months.flatMap((dealYm) =>
    sggCodes.map((sggCode) => ({ sggCode, dealYm })),
  );
  if (values["skip-imported"]) {
    // 캐시된 파티션도 재적재하면 파티션마다 DELETE(행 수에 비례, 수백 ms)가 다시 돈다
    const imported = await db
      .select({
        sggCode: importPartitions.sggCode,
        dealYm: importPartitions.dealYm,
      })
      .from(importPartitions);
    const done = new Set(imported.map((p) => `${p.sggCode}:${p.dealYm}`));
    const before = partitions.length;
    partitions = partitions.filter(
      (p) => !done.has(`${p.sggCode}:${p.dealYm}`),
    );
    console.log(`skip-imported: ${before - partitions.length} skipped`);
  }

  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const logFile = `data/import-logs/${runId}.jsonl`;
  await mkdir("data/import-logs", { recursive: true });
  console.log(
    `${partitions.length} partitions (${sggCodes.length} sgg × ${months.length} months), log: ${logFile}`,
  );

  const runStarted = performance.now();
  let done = 0;
  let totalRows = 0;
  let totalInvalid = 0;
  let stopReason: string | null = null;

  try {
    for (const { sggCode, dealYm } of partitions) {
      let fetched;
      try {
        fetched = await client.fetchPartition(sggCode, dealYm);
      } catch (error) {
        if (
          error instanceof CallBudgetExhausted ||
          error instanceof MolitQuotaError
        ) {
          stopReason = error.message;
          break;
        }
        throw error;
      }

      const { rows, invalid } = normalizeItems(fetched.items, {
        sggCode,
        dealYm,
      });
      for (const bad of invalid.slice(0, 3)) {
        console.warn(
          `  invalid ${sggCode} ${dealYm} #${bad.index}: ${bad.reason}`,
        );
      }

      // 기존 면적 타입으로 라벨을 미리 채운다. 비워 두면 derive가 다시 삽입된 행을 전부 UPDATE해
      // 매일 갱신마다 dead tuple이 두 배가 된다 (docs/performance/cases/05-refresh-churn.md).
      // 새 면적처럼 범위 밖이면 null로 두고 derive가 채운다.
      await fillKnownAreaTypes(db, rows);

      const { start, next } = monthBounds(dealYm);
      const t0 = performance.now();
      let deleteMs = 0;
      await db.transaction(async (tx) => {
        await tx
          .delete(transactions)
          .where(
            and(
              eq(transactions.sggCode, sggCode),
              gte(transactions.dealDate, start),
              lt(transactions.dealDate, next),
            ),
          );
        deleteMs = performance.now() - t0;
        for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
          await tx.insert(transactions).values(rows.slice(i, i + INSERT_CHUNK));
        }
        await tx
          .insert(importPartitions)
          .values({
            sggCode,
            dealYm,
            rowCount: rows.length,
            invalidCount: invalid.length,
            fetchedAt: fetched.fetchedAt,
          })
          .onConflictDoUpdate({
            target: [importPartitions.sggCode, importPartitions.dealYm],
            set: {
              rowCount: rows.length,
              invalidCount: invalid.length,
              fetchedAt: fetched.fetchedAt,
              importedAt: sql`now()`,
            },
          });
      });
      const dbMs = performance.now() - t0;

      done++;
      totalRows += rows.length;
      totalInvalid += invalid.length;
      await appendFile(
        logFile,
        JSON.stringify({
          sggCode,
          dealYm,
          rows: rows.length,
          invalid: invalid.length,
          apiCalls: fetched.apiCalls,
          fetchMs: Math.round(fetched.fetchMs),
          deleteMs: Math.round(deleteMs),
          insertMs: Math.round(dbMs - deleteMs),
        }) + "\n",
      );
      if (done % 100 === 0) {
        console.log(
          `  ${done}/${partitions.length} partitions, ${totalRows} rows, API calls ${client.callsUsed()}, last delete ${Math.round(deleteMs)}ms`,
        );
      }
    }
  } finally {
    await pool.end();
  }

  const minutes = ((performance.now() - runStarted) / 60000).toFixed(1);
  console.log(
    `done ${done}/${partitions.length} partitions, ${totalRows} rows, ${totalInvalid} invalid, API calls ${client.callsUsed()}, ${minutes} min`,
  );
  if (stopReason) {
    console.log(
      `stopped early: ${stopReason}. 다시 실행하면 캐시된 파티션은 API 호출 없이 재적재된다.`,
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
