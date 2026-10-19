// DB 쿼리 벤치마크 (CLAUDE.md 3.3 / 10). 화면별 대표 쿼리를 N회 실행해 중앙값을 낸다.
// 사용: pnpm bench:queries [--runs 5] [--only <이름,…>] [--explain <이름>]
//   - 측정 환경: 로컬 Docker PostgreSQL 17, 수도권 전체 적재(약 514만 건) 후 VACUUM FULL · ANALYZE
//   - 쿼리 SQL은 src/server/queries/*의 것을 그대로 옮겼다. 쿼리를 바꾸면 여기도 함께 바꾼다.
//   - 대표 값: 송파구(11710, 거래 최다권) · 헬리오시티(11710-8865, 단지 최다 거래) 84㎡
// 결과 기록: docs/performance/db-baseline.md

import "./lib/env";
import { parseArgs } from "node:util";
import pg from "pg";
import { requireEnv } from "./lib/env";

const SGG = "11710";
const DONG = "잠실동";
const APT = "11710-8865";
const LABEL = "84";
const PER_PYEONG = "price / area * 3.305785";

type Bench = { name: string; screen: string; sql: string; params: unknown[] };

const BENCHES: Bench[] = [
  {
    name: "home.heatmap",
    screen: "진입 · 히트맵",
    sql: `SELECT sgg_code, to_char(date_trunc('month', deal_date), 'YYYY-MM') AS ym, count(*)
      FROM transactions WHERE NOT cancelled GROUP BY 1, 2`,
    params: [],
  },
  {
    name: "apt.areaTypes",
    screen: "단지 상세",
    sql: `SELECT a.label, a.min_area, a.max_area, coalesce(c.trade_count, 0) AS trade_count
      FROM area_types a
      LEFT JOIN (SELECT area_type_label, count(*) AS trade_count FROM transactions
        WHERE apt_seq = $1 AND NOT cancelled GROUP BY area_type_label) c ON c.area_type_label = a.label
      WHERE a.apt_seq = $1 ORDER BY a.min_area`,
    params: [APT],
  },
  {
    name: "apt.monthlyStats(5y)",
    screen: "단지 상세",
    sql: `WITH months AS (
        SELECT generate_series(date_trunc('month', $3::date), date_trunc('month', current_date), interval '1 month')::date AS m
      ), t AS (
        SELECT deal_date, price FROM transactions
        WHERE apt_seq = $1 AND area_type_label = $2 AND NOT cancelled
          AND deal_date >= $3::date - make_interval(months => 2)
      )
      SELECT to_char(m, 'YYYY-MM') AS month,
        (SELECT count(*) FROM t WHERE deal_date >= m AND deal_date < m + interval '1 month') AS count,
        w.*
      FROM months, LATERAL (
        SELECT count(*) AS window_count,
          percentile_cont(0.5) WITHIN GROUP (ORDER BY price) AS median
        FROM t WHERE deal_date >= m - make_interval(months => 2) AND deal_date < m + interval '1 month'
      ) w ORDER BY m`,
    params: [APT, LABEL, "2021-10-01"],
  },
  {
    name: "apt.trades(window)",
    screen: "단지 상세",
    sql: `WITH t AS (
        SELECT id, deal_date, price,
          max(price) FILTER (WHERE NOT cancelled) OVER before_day AS prev_high,
          count(*)   FILTER (WHERE NOT cancelled) OVER before_day AS prior_count,
          max(price) FILTER (WHERE NOT cancelled) OVER through_day AS high_after
        FROM transactions WHERE apt_seq = $1 AND area_type_label = $2
        WINDOW
          before_day  AS (ORDER BY deal_date RANGE BETWEEN UNBOUNDED PRECEDING AND INTERVAL '1 day' PRECEDING),
          through_day AS (ORDER BY deal_date RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
      )
      SELECT * FROM t WHERE deal_date >= $3 ORDER BY deal_date DESC, id DESC`,
    params: [APT, LABEL, "2021-10-01"],
  },
  {
    name: "region.complexes",
    screen: "지역 · 단지 목록",
    // 단지마다 apt_seq 인덱스로 거래를 찾는다 (LATERAL). IN (...) + GROUP BY는 순차 스캔이 된다
    sql: `SELECT c.apt_seq, t.* FROM complexes c LEFT JOIN LATERAL (
        SELECT (array_agg(price ORDER BY deal_date DESC, id DESC))[1] AS last_price,
          count(*) FILTER (WHERE deal_date >= current_date - make_interval(years => 3)) AS recent_count,
          mode() WITHIN GROUP (ORDER BY area_type_label) FILTER (WHERE deal_date >= current_date - make_interval(years => 3)) AS main_type,
          percentile_cont(0.5) WITHIN GROUP (ORDER BY ${PER_PYEONG}) FILTER (WHERE deal_date >= current_date - make_interval(years => 1)) AS per_pyeong
        FROM transactions WHERE apt_seq = c.apt_seq AND NOT cancelled
      ) t ON true WHERE c.sgg_code = $1`,
    params: [SGG],
  },
  {
    name: "region.monthlyStats",
    screen: "지역 · 통계",
    sql: `SELECT to_char(date_trunc('month', deal_date), 'YYYY-MM') AS month, count(*),
        percentile_cont(ARRAY[0.25, 0.5, 0.75]) WITHIN GROUP (ORDER BY ${PER_PYEONG})
      FROM transactions WHERE sgg_code = $1 AND NOT cancelled GROUP BY 1 ORDER BY 1`,
    params: [SGG],
  },
  {
    name: "region.summary",
    screen: "지역 · 통계",
    sql: `SELECT count(*) FILTER (WHERE deal_date >= current_date - interval '1 year'),
        percentile_cont(0.5) WITHIN GROUP (ORDER BY ${PER_PYEONG}) FILTER (WHERE deal_date >= current_date - interval '1 year')
      FROM transactions WHERE sgg_code = $1 AND NOT cancelled AND deal_date >= current_date - interval '2 years'`,
    params: [SGG],
  },
  {
    name: "region.trades(p1)",
    screen: "지역 · 거래 탐색",
    sql: `SELECT id, deal_date, apt_seq, apt_name, umd_name, area, floor, price, cancelled, deal_type
      FROM transactions WHERE sgg_code = $1 AND deal_date >= $2 AND NOT cancelled
      ORDER BY deal_date DESC NULLS LAST, id DESC LIMIT 101 OFFSET 0`,
    params: [SGG, "2023-10-18"],
  },
  {
    name: "region.trades(offset 5000)",
    screen: "지역 · 거래 탐색",
    sql: `SELECT id, deal_date, apt_seq, apt_name, umd_name, area, floor, price, cancelled, deal_type
      FROM transactions WHERE sgg_code = $1 AND deal_date >= $2 AND NOT cancelled
      ORDER BY deal_date DESC NULLS LAST, id DESC LIMIT 101 OFFSET 5000`,
    params: [SGG, "2023-10-18"],
  },
  {
    name: "region.trades(price sort, dong)",
    screen: "지역 · 거래 탐색",
    sql: `SELECT id, deal_date, apt_seq, apt_name, umd_name, area, floor, price
      FROM transactions WHERE sgg_code = $1 AND umd_name = $2 AND NOT cancelled
      ORDER BY price DESC NULLS LAST, id DESC LIMIT 101 OFFSET 0`,
    params: [SGG, DONG],
  },
  {
    name: "region.trades(count)",
    screen: "지역 · 거래 탐색",
    sql: `SELECT count(*) FROM transactions WHERE sgg_code = $1 AND deal_date >= $2 AND NOT cancelled`,
    params: [SGG, "2023-10-18"],
  },
  {
    name: "import.deletePartition",
    screen: "적재 / 정기 갱신",
    // 트랜잭션 안에서 실행하고 되돌린다 (runBench 참고)
    sql: `DELETE FROM transactions WHERE sgg_code = $1 AND deal_date >= $2 AND deal_date < $3`,
    params: [SGG, "2026-09-01", "2026-10-01"],
  },
];

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

async function runOnce(client: pg.PoolClient, b: Bench) {
  const isDelete = b.sql.trimStart().startsWith("DELETE");
  if (isDelete) await client.query("BEGIN");
  const t0 = performance.now();
  await client.query(b.sql, b.params);
  const ms = performance.now() - t0;
  if (isDelete) await client.query("ROLLBACK");
  return ms;
}

async function main() {
  const { values } = parseArgs({
    options: {
      runs: { type: "string", default: "5" },
      explain: { type: "string" },
      // 쉼표로 구분한 이름만 측정 (예: --only home.heatmap)
      only: { type: "string" },
    },
  });
  const pool = new pg.Pool({ connectionString: requireEnv("DATABASE_URL") });
  const client = await pool.connect();
  try {
    if (values.explain) {
      const b = BENCHES.find((x) => x.name === values.explain);
      if (!b) throw new Error(`unknown bench: ${values.explain}`);
      if (b.sql.trimStart().startsWith("DELETE")) await client.query("BEGIN");
      const r = await client.query(
        `EXPLAIN (ANALYZE, BUFFERS) ${b.sql}`,
        b.params,
      );
      console.log(r.rows.map((row) => row["QUERY PLAN"]).join("\n"));
      await client.query("ROLLBACK").catch(() => {});
      return;
    }

    const runs = Number(values.runs);
    const { rows } = await client.query<{ n: string; size: string }>(
      `SELECT (SELECT count(*) FROM transactions)::text AS n,
        pg_size_pretty(pg_total_relation_size('transactions')) AS size`,
    );
    console.log(
      `transactions ${Number(rows[0].n).toLocaleString()} rows, ${rows[0].size} (indexes 포함), runs=${runs}\n`,
    );
    console.log("| 쿼리 | 화면 | 중앙값 ms | 최소 | 최대 |");
    console.log("|---|---|---:|---:|---:|");
    const only = values.only?.split(",");
    for (const b of BENCHES.filter((x) => !only || only.includes(x.name))) {
      await runOnce(client, b); // 캐시 예열
      const times: number[] = [];
      for (let i = 0; i < runs; i++) times.push(await runOnce(client, b));
      const f = (x: number) => x.toFixed(1);
      console.log(
        `| ${b.name} | ${b.screen} | ${f(median(times))} | ${f(Math.min(...times))} | ${f(Math.max(...times))} |`,
      );
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
