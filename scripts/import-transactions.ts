// 아파트 매매 실거래 적재. 파티션(시군구 × 계약년월) 단위로 교체한다 (docs/05 §3).
//
// 사용:
//   pnpm import:transactions --from 200601 --to 202610            # 전체 (캐시 우선)
//   pnpm import:transactions --recent 7 --refresh                 # 정기 갱신: 최근 7개월 재수집
//   옵션: --sgg 11440,11680  --max-calls 9500  --refresh(캐시 무시)
//
// 파티션별 측정값은 data/import-logs/<run>.jsonl에 남긴다.

import "./lib/env";
import { appendFile, mkdir } from "node:fs/promises";
import { parseArgs } from "node:util";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { createDb } from "../src/server/db/client";
import {
  importPartitions,
  regions,
  transactions,
} from "../src/server/db/schema";
import { requireEnv } from "./lib/env";
import { CallBudgetExhausted, createMolitClient } from "./lib/molit-client";
import { MolitQuotaError, normalizeItems } from "./lib/molit-parse";
import { querySggCodes } from "./lib/regions";

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

async function main() {
  const { values } = parseArgs({
    options: {
      from: { type: "string" },
      to: { type: "string" },
      recent: { type: "string" },
      sgg: { type: "string" },
      "max-calls": { type: "string", default: "9500" },
      refresh: { type: "boolean", default: false },
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
  const partitions = months.flatMap((dealYm) =>
    sggCodes.map((sggCode) => ({ sggCode, dealYm })),
  );

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
