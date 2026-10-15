// seed/regions-capital-area.csv → regions 테이블 (전체 교체)
import "./lib/env";
import { readFile } from "node:fs/promises";
import { createDb } from "../src/server/db/client";
import { regions } from "../src/server/db/schema";
import { requireEnv } from "./lib/env";

async function main() {
  const lines = (await readFile("seed/regions-capital-area.csv", "utf8"))
    .trim()
    .split("\n");
  const rows = lines.slice(1).map((line) => {
    const [code, sggCode, level, sidoName, sggName, umdName] = line.split(",");
    return {
      code,
      sggCode,
      level: level as "sgg" | "umd",
      sidoName,
      sggName,
      umdName: umdName || null,
    };
  });

  const { db, pool } = createDb(requireEnv("DATABASE_URL"));
  try {
    await db.transaction(async (tx) => {
      await tx.delete(regions);
      for (let i = 0; i < rows.length; i += 1000) {
        await tx.insert(regions).values(rows.slice(i, i + 1000));
      }
    });
    console.log(`regions: ${rows.length} rows`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
