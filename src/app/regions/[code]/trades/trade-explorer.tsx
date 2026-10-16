"use client";

import {
  keepPreviousData,
  useInfiniteQuery,
  type InfiniteData,
} from "@tanstack/react-query";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";
import {
  parseTradeFilters,
  serializeTradeFilters,
  type TradeFilters,
} from "@/lib/region-params";
import type { RegionTradePage } from "@/server/queries/region-trades";
import { FilterBar } from "./filter-bar";
import { RegionTradeTable } from "./region-trade-table";

// 거래 탐색: 필터(URL) → 서버 정렬 · offset 무한 스크롤.
//
// Interaction (CLAUDE.md 7):
// - 필터는 URL이 원본. 변경은 history.replaceState → useSearchParams가 따라오고 → 쿼리 키가 바뀐다 (서버 재렌더 없음)
// - stale response: 쿼리 키가 바뀌면 TanStack Query가 이전 요청을 abort(signal)하고 늦은 응답을 버린다
// - transition: 새 결과를 기다리는 동안 이전 결과를 흐리게 유지한다 (keepPreviousData)
// - virtualization 없이 시작 — 깊은 스크롤에서 DOM 수 · 렌더 시간을 측정한 뒤 판단 (docs/03 Decisions 1)

async function fetchTrades(
  code: string,
  filterQs: string,
  offset: number,
  signal: AbortSignal,
): Promise<RegionTradePage> {
  const qs = new URLSearchParams(filterQs);
  if (offset > 0) qs.set("offset", String(offset));
  const res = await fetch(`/api/regions/${code}/transactions?${qs}`, {
    signal,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export function TradeExplorer({
  code,
  initialKey,
  initialPage,
}: {
  code: string;
  initialKey: string;
  initialPage: RegionTradePage;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filters = useMemo(
    () => parseTradeFilters(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );
  const filterKey = serializeTradeFilters(filters).toString();

  const query = useInfiniteQuery({
    queryKey: ["region-trades", code, filterKey],
    queryFn: ({ pageParam, signal }) =>
      fetchTrades(code, filterKey, pageParam, signal),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextOffset,
    // 서버가 렌더한 첫 페이지는 그 필터에만 쓴다
    initialData:
      filterKey === initialKey
        ? ({
            pages: [initialPage],
            pageParams: [0],
          } satisfies InfiniteData<RegionTradePage, number>)
        : undefined,
    placeholderData: keepPreviousData,
  });

  const setFilters = (next: TradeFilters) => {
    const qs = serializeTradeFilters(next).toString();
    window.history.replaceState(null, "", `${pathname}${qs ? `?${qs}` : ""}`);
  };

  const pages = query.data?.pages;
  const rows = useMemo(() => pages?.flatMap((p) => p.rows) ?? [], [pages]);
  const total = pages?.[0]?.total ?? null;
  // 이전 필터의 결과를 보여주는 중 (새 결과 대기)
  const stale = query.isPlaceholderData;

  return (
    <div className="mt-4">
      <FilterBar
        filters={filters}
        onChange={setFilters}
        summary={
          <p
            role="status"
            aria-live="polite"
            className="text-sm whitespace-nowrap text-muted-foreground tabular-nums"
          >
            {stale ? (
              "불러오는 중…"
            ) : total === null ? (
              ""
            ) : (
              <>
                총 <b>{total.toLocaleString("ko-KR")}</b>건
                {total > rows.length && (
                  <span className="text-muted-foreground/70">
                    {" "}
                    · {rows.length.toLocaleString("ko-KR")}건 표시
                  </span>
                )}
              </>
            )}
          </p>
        }
      />

      {query.isError && rows.length === 0 ? (
        <ErrorBox onRetry={() => query.refetch()} />
      ) : rows.length === 0 && !query.isFetching ? (
        <p className="mt-10 text-center text-muted-foreground">
          조건에 맞는 거래가 없습니다. 필터를 줄여 보세요.
        </p>
      ) : (
        <>
          <RegionTradeTable
            rows={rows}
            sort={filters.sort}
            onSort={(sort) => setFilters({ ...filters, sort })}
            stale={stale}
          />
          <LoadMore
            hasNextPage={query.hasNextPage && !stale}
            isFetching={query.isFetchingNextPage}
            isError={query.isFetchNextPageError}
            onLoad={() => query.fetchNextPage()}
          />
        </>
      )}
    </div>
  );
}

/** 화면 아래 600px 안에 들어오면 다음 페이지를 부른다. 버튼은 키보드 / 실패 시 재시도용 */
function LoadMore({
  hasNextPage,
  isFetching,
  isError,
  onLoad,
}: {
  hasNextPage: boolean;
  isFetching: boolean;
  isError: boolean;
  onLoad: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onLoadRef = useRef(onLoad);
  useEffect(() => {
    onLoadRef.current = onLoad;
  }, [onLoad]);

  const auto = hasNextPage && !isFetching && !isError;
  useEffect(() => {
    if (!auto) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) onLoadRef.current();
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(ref.current!);
    return () => observer.disconnect();
  }, [auto]);

  if (!hasNextPage) return null;
  return (
    <div ref={ref} className="py-6 text-center text-sm text-muted-foreground">
      {isError ? (
        <button
          type="button"
          onClick={onLoad}
          className="rounded-lg border border-input px-4 py-2 hover:border-foreground/40"
        >
          불러오지 못했습니다. 다시 시도
        </button>
      ) : isFetching ? (
        <span role="status">더 불러오는 중…</span>
      ) : (
        <button
          type="button"
          onClick={onLoad}
          className="rounded-lg border border-input px-4 py-2 hover:border-foreground/40"
        >
          더 보기
        </button>
      )}
    </div>
  );
}

function ErrorBox({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="mt-10 text-center text-muted-foreground">
      <p>거래를 불러오지 못했습니다.</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 rounded-lg border border-input px-4 py-2 text-sm hover:border-foreground/40"
      >
        다시 시도
      </button>
    </div>
  );
}
