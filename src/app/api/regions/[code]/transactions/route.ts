import type { NextRequest } from "next/server";
import { z } from "zod";
import { parseTradeFilters, SGG_CODE } from "@/lib/region-params";
import { getRegionTrades } from "@/server/queries/region-trades";

// GET /api/regions/11710/transactions?period=3y&area=60-85&sort=price.desc&offset=200
// 거래 탐색 탭의 무한 스크롤 / 필터 변경용 (CLAUDE.md 9). 첫 페이지는 Server Component가 직접 렌더한다.

/** offset이 이보다 크면 거절한다 — 아주 깊은 offset은 그만큼 행을 읽고 버리는 비용이 든다 */
const MAX_OFFSET = 100_000;
const offsetSchema = z.coerce.number().int().min(0).max(MAX_OFFSET);

export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/regions/[code]/transactions">,
) {
  const { code } = await ctx.params;
  if (!SGG_CODE.test(code)) {
    return Response.json({ error: "invalid region code" }, { status: 400 });
  }
  const search = request.nextUrl.searchParams;
  const offset = offsetSchema.safeParse(search.get("offset") ?? 0);
  if (!offset.success) {
    return Response.json({ error: "invalid offset" }, { status: 400 });
  }

  const started = performance.now();
  const page = await getRegionTrades(
    code,
    parseTradeFilters(search),
    offset.data,
  );
  return Response.json(page, {
    headers: {
      // 측정용: DB 시간 (깊은 스크롤 baseline)
      "Server-Timing": `db;dur=${(performance.now() - started).toFixed(1)}`,
    },
  });
}
