// 적재 로그(data/import-logs/*.jsonl) → 누적 행 수 구간별 파티션 처리 시간 표 (markdown)
// 사용: pnpm analyze:import [로그 파일]   (생략 시 가장 최근 로그)

import { readFile, readdir } from "node:fs/promises";

type Entry = {
  rows: number;
  apiCalls: number;
  fetchMs: number;
  deleteMs: number;
  insertMs: number;
};

const BUCKET_ROWS = 250_000;

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const p95 = (xs: number[]) =>
  [...xs].sort((a, b) => a - b)[Math.floor(xs.length * 0.95)];

async function main() {
  let file = process.argv[2];
  if (!file) {
    const logs = (await readdir("data/import-logs"))
      .filter((f) => f.endsWith(".jsonl"))
      .sort();
    file = `data/import-logs/${logs.at(-1)}`;
  }
  const entries: Entry[] = (await readFile(file, "utf8"))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));

  console.log(`log: ${file}, ${entries.length} partitions\n`);
  console.log(
    "| 누적 행 수 (이전) | 파티션 | 삭제 평균 | 삭제 p95 | 삽입 평균 | API 응답 평균 (호출 시) |",
  );
  console.log("|---|---|---|---|---|---|");

  let cumulative = 0;
  let bucket: (Entry & { before: number })[] = [];
  const flush = () => {
    if (bucket.length === 0) return;
    const fetched = bucket.filter((e) => e.apiCalls > 0).map((e) => e.fetchMs);
    console.log(
      `| ${bucket[0].before.toLocaleString()}~ | ${bucket.length} | ${avg(bucket.map((e) => e.deleteMs)).toFixed(0)}ms | ${p95(bucket.map((e) => e.deleteMs))}ms | ${avg(bucket.map((e) => e.insertMs)).toFixed(0)}ms | ${fetched.length ? `${avg(fetched).toFixed(0)}ms` : "-"} |`,
    );
    bucket = [];
  };
  for (const entry of entries) {
    if (
      bucket.length &&
      Math.floor(cumulative / BUCKET_ROWS) !==
        Math.floor(bucket[0].before / BUCKET_ROWS)
    ) {
      flush();
    }
    bucket.push({ ...entry, before: cumulative });
    cumulative += entry.rows;
  }
  flush();

  const sum = (k: keyof Entry) => entries.reduce((a, e) => a + e[k], 0);
  console.log(
    `\n합계: 행 ${cumulative.toLocaleString()}, API 호출 ${sum("apiCalls")}, 삭제 ${(sum("deleteMs") / 60000).toFixed(1)}분, 삽입 ${(sum("insertMs") / 60000).toFixed(1)}분, API ${(sum("fetchMs") / 60000).toFixed(1)}분`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
