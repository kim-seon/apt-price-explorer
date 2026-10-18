// 운영 DB 용량 감시 (docs/decisions/0002). 정기 갱신 워크플로 마지막에 실행한다.
// - Neon Free 한도 1GB. 900MB 이상이면 경고, 950MB 이상이면 실패시켜 GitHub 실패 알림으로 알린다
//   (그때 Launch 전환을 검토한다).
// - GITHUB_STEP_SUMMARY가 있으면 실행 요약에 표를 남긴다.
// 사용: pnpm db:size

import "./lib/env";
import { appendFile } from "node:fs/promises";
import pg from "pg";
import { requireEnv } from "./lib/env";

const MB = 1024 * 1024;
const WARN_MB = 900;
const FAIL_MB = 950;
const LIMIT_MB = 1024;

async function main() {
  const client = new pg.Client({
    connectionString: requireEnv("DATABASE_URL"),
  });
  await client.connect();
  try {
    const db = await client.query<{ bytes: string }>(
      "SELECT pg_database_size(current_database()) AS bytes",
    );
    const tables = await client.query<{
      name: string;
      total: string;
      live: string;
      dead: string;
    }>(`
      SELECT relname AS name, pg_total_relation_size(relid) AS total,
        n_live_tup AS live, n_dead_tup AS dead
      FROM pg_stat_user_tables ORDER BY pg_total_relation_size(relid) DESC LIMIT 5
    `);
    const totalMb = Number(db.rows[0].bytes) / MB;
    const lines = [
      `### DB 용량: ${totalMb.toFixed(0)}MB / ${LIMIT_MB}MB (경고 ${WARN_MB} · 실패 ${FAIL_MB})`,
      "",
      "| 테이블 | 크기(MB, 인덱스 포함) | live 행 | dead 행 |",
      "|---|---:|---:|---:|",
      ...tables.rows.map(
        (t) =>
          `| ${t.name} | ${(Number(t.total) / MB).toFixed(0)} | ${Number(t.live).toLocaleString()} | ${Number(t.dead).toLocaleString()} |`,
      ),
    ];
    console.log(lines.join("\n"));
    if (process.env.GITHUB_STEP_SUMMARY) {
      await appendFile(
        process.env.GITHUB_STEP_SUMMARY,
        lines.join("\n") + "\n",
      );
    }
    if (totalMb >= FAIL_MB) {
      console.log(
        `::error::DB ${totalMb.toFixed(0)}MB ≥ ${FAIL_MB}MB — Neon Free 한도(1GB) 임박. Launch 전환 검토`,
      );
      process.exitCode = 1;
    } else if (totalMb >= WARN_MB) {
      console.log(`::warning::DB ${totalMb.toFixed(0)}MB ≥ ${WARN_MB}MB`);
    }
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
