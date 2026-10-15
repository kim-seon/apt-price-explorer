import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

/** import script와 앱이 함께 쓰는 DB 클라이언트 생성기. 앱 쪽 진입점은 M2에서 server-only로 감싼다. */
export function createDb(connectionString: string) {
  const pool = new Pool({ connectionString });
  return { db: drizzle(pool, { schema }), pool };
}

export type Db = ReturnType<typeof createDb>["db"];
