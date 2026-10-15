import "server-only";
import { createDb } from "./client";

// 앱 전용 DB 진입점. Client Component에서 import하면 빌드 단계에서 막힌다.
// 빌드 시점에는 DATABASE_URL이 없을 수 있으므로 첫 조회 때 생성한다.
// dev의 HMR로 모듈이 다시 평가될 때 Pool이 늘어나지 않도록 globalThis에 보관한다.
const globalForDb = globalThis as unknown as {
  appDb?: ReturnType<typeof createDb>;
};

export function getDb() {
  if (!globalForDb.appDb) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    globalForDb.appDb = createDb(url);
  }
  return globalForDb.appDb.db;
}
