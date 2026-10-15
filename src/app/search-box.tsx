"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { normalizeSearchQuery } from "@/lib/search-query";
import type { ComplexSearchResult } from "@/server/queries/search";

// 단지명 자동완성 (ARIA 1.2 combobox 패턴). docs/08 M4, CLAUDE.md 7 Interaction Quality
//
// - 한글 IME: 조합 중에도 결과를 갱신하되 끝의 미완성 자모는 뗀다(normalizeSearchQuery).
//   조합 중 Enter(keydown isComposing)는 무시한다 — 조합 확정 Enter가 항목 선택으로 이어지는 문제 방지.
// - 150ms debounce, 이전 요청 abort + 늦게 도착한 응답 무시(stale response)
// - 새 결과를 기다리는 동안 이전 결과를 흐리게 유지한다 (목록이 사라졌다 나타나는 깜빡임 방지)

const DEBOUNCE_MS = 150;

type Status = "idle" | "loading" | "error";

export function SearchBox() {
  const router = useRouter();
  const listboxId = useId();
  const [value, setValue] = useState("");
  const [results, setResults] = useState<ComplexSearchResult[]>([]);
  const [resultQuery, setResultQuery] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const requestRef = useRef<{
    query: string;
    controller: AbortController;
  } | null>(null);

  const query = normalizeSearchQuery(value);

  useEffect(() => {
    if (!query) {
      requestRef.current?.controller.abort();
      requestRef.current = null;
      return;
    }
    if (query === resultQuery) return;

    const timer = setTimeout(async () => {
      requestRef.current?.controller.abort();
      const controller = new AbortController();
      requestRef.current = { query, controller };
      setStatus("loading");
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body: { query: string; results: ComplexSearchResult[] } =
          await res.json();
        // 그 사이 다른 요청이 시작됐다면 이 응답은 버린다
        if (requestRef.current?.controller !== controller) return;
        setResults(body.results);
        setResultQuery(body.query);
        setActive(-1);
        setStatus("idle");
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("[search]", error);
        setStatus("error");
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, resultQuery]);

  const visibleResults = query ? results : [];
  const showList = open && query.length > 0;
  const go = (item: ComplexSearchResult) => {
    setOpen(false);
    router.push(`/apartments/${encodeURIComponent(item.aptSeq)}`);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // 한글 조합 확정용 Enter / 방향키는 처리하지 않는다
    if (e.nativeEvent.isComposing) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (visibleResults.length === 0) return;
      e.preventDefault();
      setOpen(true);
      const delta = e.key === "ArrowDown" ? 1 : -1;
      setActive(
        (i) => (i + delta + visibleResults.length) % visibleResults.length,
      );
    } else if (e.key === "Enter") {
      const target =
        visibleResults[active] ??
        (visibleResults.length === 1 ? visibleResults[0] : undefined);
      if (target) {
        e.preventDefault();
        go(target);
      }
    } else if (e.key === "Escape") {
      if (open) setOpen(false);
      else setValue("");
    }
  };

  const optionId = (i: number) => `${listboxId}-option-${i}`;
  const stale = status === "loading" && resultQuery !== query;

  return (
    <div className="relative">
      <label htmlFor={`${listboxId}-input`} className="sr-only">
        단지명 검색
      </label>
      <input
        id={`${listboxId}-input`}
        type="search"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={
          showList && active >= 0 ? optionId(active) : undefined
        }
        autoComplete="off"
        placeholder="단지명으로 검색 (예: 래미안, 헬리오시티)"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-base shadow-sm outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10"
      />

      {showList && (
        <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg">
          <ul
            id={listboxId}
            role="listbox"
            aria-label="단지 검색 결과"
            aria-busy={status === "loading"}
            className={`max-h-96 overflow-auto transition-opacity ${stale ? "opacity-50" : ""}`}
          >
            {visibleResults.map((item, i) => (
              <li
                key={item.aptSeq}
                id={optionId(i)}
                role="option"
                aria-selected={i === active}
                // blur보다 먼저 처리해 목록이 닫히기 전에 선택되게 한다
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => go(item)}
                onMouseEnter={() => setActive(i)}
                className="flex cursor-pointer items-baseline justify-between gap-3 px-4 py-2.5 aria-selected:bg-neutral-100"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">
                    {item.name}
                  </span>
                  <span className="block truncate text-sm text-neutral-500">
                    {item.sidoName} {item.sggName} {item.umdName}
                    {item.buildYear ? ` · ${item.buildYear}년` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-neutral-500 tabular-nums">
                  거래 {item.tradeCount.toLocaleString("ko-KR")}건
                </span>
              </li>
            ))}
          </ul>
          <p
            role="status"
            aria-live="polite"
            className="px-4 py-2 text-sm text-neutral-500 empty:hidden"
          >
            {status === "error"
              ? "검색 중 문제가 생겼습니다. 잠시 후 다시 시도해 주세요."
              : status === "idle" &&
                  resultQuery === query &&
                  visibleResults.length === 0
                ? `'${value.trim()}'에 해당하는 단지가 없습니다.`
                : ""}
          </p>
        </div>
      )}
    </div>
  );
}
