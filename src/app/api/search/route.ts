import type { NextRequest } from "next/server";
import { normalizeSearchQuery } from "@/lib/search-query";
import { searchComplexes } from "@/server/queries/search";

// GET /api/search?q=래미안 — 단지명 자동완성. 요청 URL을 읽으므로 요청 시점에 실행된다.

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("q") ?? "";
  const query = normalizeSearchQuery(raw);
  if (!query) return Response.json({ query, results: [] });

  const started = performance.now();
  const results = await searchComplexes(query);
  return Response.json(
    { query, results },
    {
      headers: {
        // 측정용: 브라우저 DevTools에서 DB 시간을 확인할 수 있게 한다
        "Server-Timing": `db;dur=${(performance.now() - started).toFixed(1)}`,
      },
    },
  );
}
