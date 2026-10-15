import "server-only";
import { connection } from "next/server";
import { createDb } from "./client";

// 앱 전용 DB 진입점. Client Component에서 import하면 빌드 단계에서 막힌다.
//
// connection(): DB 조회를 항상 요청 시점에 실행한다(빌드 시 prerender 제외).
// 요청별 정보(params 등)를 쓰지 않는 컴포넌트가 DB를 조회하면 Next가 빌드 때 실행하려 해서
// (1) DB 없는 CI 빌드가 실패하고 (2) 빌드 시점 데이터로 굳은 정적 페이지가 된다.
// 캐시가 필요한 조회는 측정 후 `use cache`로 명시적으로 켠다.
// dev의 HMR로 모듈이 다시 평가될 때 Pool이 늘어나지 않도록 globalThis에 보관한다.
const globalForDb = globalThis as unknown as {
  appDb?: ReturnType<typeof createDb>;
};

export async function getDb() {
  await connection();
  if (!globalForDb.appDb) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    globalForDb.appDb = createDb(url);
  }
  return globalForDb.appDb.db;
}
