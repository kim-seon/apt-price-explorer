// Lighthouse 성능 측정 (모바일 기본 프리셋), N회 중앙값.
// 사용: pnpm bench:lh <url> [<url> ...] [--runs 3] [--throttling devtools|simulate]
// 스트리밍(Suspense) 효과는 simulate로 평가되지 않는다 → 기본값 devtools (docs/performance/cases/01-suspense-split.md)
// 첫 실행 편차를 줄이기 위해 측정 전에 각 URL을 한 번 요청해 서버를 데운다.
// 측정 방법: docs/performance/frontend-baseline.md

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    runs: { type: "string", default: "3" },
    throttling: { type: "string", default: "devtools" },
  },
});
if (positionals.length === 0) {
  throw new Error(
    "usage: pnpm bench:lh <url> [<url> ...] [--runs 3] [--throttling devtools|simulate]",
  );
}
const runs = Number(values.runs);
const dir = mkdtempSync(path.join(tmpdir(), "lh-"));

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

type Report = {
  categories: { performance: { score: number } };
  audits: Record<string, { numericValue: number }>;
};

async function main() {
  console.log(`| URL | score | FCP | LCP | TBT | CLS | DOM |`);
  console.log(`|---|---|---|---|---|---|---|`);
  for (const url of positionals) {
    await fetch(url); // warm-up
    const reports: Report[] = [];
    for (let i = 0; i < runs; i++) {
      const out = path.join(dir, `r${i}.json`);
      execFileSync(
        "npx",
        [
          "-y",
          "lighthouse@12",
          url,
          "--only-categories=performance",
          `--throttling-method=${values.throttling}`,
          "--output=json",
          `--output-path=${out}`,
          "--quiet",
          "--chrome-flags=--headless=new",
        ],
        { stdio: "ignore" },
      );
      reports.push(JSON.parse(readFileSync(out, "utf8")));
    }
    const m = (key: string) =>
      median(reports.map((r) => r.audits[key].numericValue));
    const score = median(
      reports.map((r) => r.categories.performance.score * 100),
    );
    console.log(
      `| ${url.replace(/^https?:\/\/[^/]+/, "")} | ${score.toFixed(0)} | ${m("first-contentful-paint").toFixed(0)}ms | ${m("largest-contentful-paint").toFixed(0)}ms | ${m("total-blocking-time").toFixed(0)}ms | ${m("cumulative-layout-shift").toFixed(3)} | ${m("dom-size").toFixed(0)} |`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
