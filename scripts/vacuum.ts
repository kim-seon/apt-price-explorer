// 정기 갱신 뒤 VACUUM (ANALYZE). 갱신은 매일 파티션을 지우고 다시 넣어 dead tuple을 만든다.
// autovacuum 기본 기준(테이블의 20%, 거래 약 100만 행)에 닿기 전 며칠 동안 그 공간을 재사용하지 못해
// 운영 DB(Neon Free 1GB)가 하루 수십 MB씩 늘었다 → 갱신마다 바로 정리해 다음 갱신이 공간을 재사용하게 한다.
// (VACUUM FULL과 달리 잠금 없이 동작하고 파일 크기를 줄이지는 않는다.) docs/performance/cases/05-refresh-churn.md
// 사용: pnpm db:vacuum

import "./lib/env";
import pg from "pg";
import { requireEnv } from "./lib/env";

async function main() {
  const client = new pg.Client({
    connectionString: requireEnv("DATABASE_URL"),
  });
  await client.connect();
  try {
    const t0 = performance.now();
    await client.query(
      "VACUUM (ANALYZE) transactions, complexes, area_types, import_partitions",
    );
    console.log(
      `VACUUM (ANALYZE) ${((performance.now() - t0) / 1000).toFixed(1)}s`,
    );
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
