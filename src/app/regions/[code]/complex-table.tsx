"use client";

import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  tableFeatures,
  useTable,
  type SortingState,
} from "@tanstack/react-table";
import Link from "next/link";
import { useState } from "react";
import { formatPrice, formatShortDate } from "@/lib/format";
import {
  serializeComplexSort,
  type ComplexSort,
  type ComplexSortKey,
} from "@/lib/region-params";
import type { RegionComplex } from "@/server/queries/region-complexes";

// 지역 단지 목록. 수백 행이라 한 번에 받아 클라이언트에서 정렬하고, 정렬은 URL에 남긴다
// (history.replaceState — 서버 왕복 없음, 공유·새로고침 시 재현).
// 테이블 내부 스크롤 대신 페이지 스크롤을 써서 뒤로가기 시 브라우저가 스크롤 위치를 복원하게 한다.
// virtualization 없이 시작 — 최대 단지 수 지역에서 렌더링 시간을 측정한 뒤 판단 (CLAUDE.md 11).

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { basic: sortFn_basic, alphanumeric: sortFn_alphanumeric },
});
const helper = createColumnHelper<typeof features, RegionComplex>();

// null은 정렬 방향과 관계없이 맨 뒤로 보낸다 (거래 없는 단지가 "가장 싼 단지"로 보이지 않게)
const orUndefined = <T,>(v: T | null) => v ?? undefined;

const columns = helper.columns([
  helper.accessor("name", {
    id: "name",
    header: "단지명",
    cell: (info) => (
      <Link
        href={`/apartments/${encodeURIComponent(info.row.original.aptSeq)}`}
        className="font-medium hover:underline"
      >
        {info.getValue()}
      </Link>
    ),
    sortFn: "alphanumeric",
  }),
  helper.accessor("dong", {
    id: "dong",
    header: "법정동",
    sortFn: "alphanumeric",
  }),
  helper.accessor((c) => orUndefined(c.buildYear), {
    id: "buildYear",
    header: "준공",
    cell: (info) => info.getValue() ?? "-",
    sortFn: "basic",
    sortUndefined: "last",
  }),
  helper.accessor("mainType", {
    id: "mainType",
    header: "주력 면적",
    cell: (info) => (info.getValue() ? `${info.getValue()}㎡` : "-"),
    enableSorting: false,
  }),
  helper.accessor((c) => orUndefined(c.lastDealDate), {
    id: "lastDealDate",
    header: "최근 거래",
    cell: ({ row }) => {
      const c = row.original;
      if (!c.lastDealDate || c.lastPrice === null) return "-";
      return (
        <>
          <span className="font-medium">{formatPrice(c.lastPrice)}</span>
          <span className="ml-1.5 text-xs text-neutral-500">
            {c.lastArea !== null ? `${Math.round(c.lastArea)}㎡ · ` : ""}
            {formatShortDate(c.lastDealDate)}
          </span>
        </>
      );
    },
    sortFn: "alphanumeric",
    sortUndefined: "last",
  }),
  helper.accessor((c) => orUndefined(c.perPyeong), {
    id: "perPyeong",
    header: "3.3㎡당 (전용, 1년)",
    cell: (info) => {
      const v = info.getValue();
      return v === undefined ? "-" : formatPrice(v);
    },
    sortFn: "basic",
    sortUndefined: "last",
  }),
  helper.accessor("recentCount", {
    id: "recentCount",
    header: "거래 (3년)",
    cell: (info) => info.getValue().toLocaleString("ko-KR"),
    sortFn: "basic",
  }),
]);

const numeric = new Set(["buildYear", "perPyeong", "recentCount"]);

export function ComplexTable({
  complexes,
  initialSort,
}: {
  complexes: RegionComplex[];
  initialSort: ComplexSort;
}) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: initialSort.key, desc: initialSort.desc },
  ]);

  const table = useTable({
    features,
    columns,
    data: complexes,
    state: { sorting },
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      setSorting(next);
      const [first] = next;
      if (!first) return;
      const url = new URL(window.location.href);
      const value = serializeComplexSort({
        key: first.id as ComplexSortKey,
        desc: first.desc,
      });
      if (value) url.searchParams.set("sort", value);
      else url.searchParams.delete("sort");
      window.history.replaceState(null, "", url);
    },
    // 항상 한 열로 정렬된 상태를 유지한다 (세 번째 클릭에서 정렬 해제 안 함)
    enableSortingRemoval: false,
  });

  return (
    <section aria-labelledby="complex-count" className="mt-4">
      <p id="complex-count" className="text-sm text-neutral-500">
        단지 {complexes.length.toLocaleString("ko-KR")}개 · 해제 거래 제외
      </p>
      <div className="mt-2 overflow-x-auto rounded-lg border border-neutral-200">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-600">
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  const align = numeric.has(header.column.id)
                    ? "text-right"
                    : "text-left";
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={
                        sorted === "asc"
                          ? "ascending"
                          : sorted === "desc"
                            ? "descending"
                            : undefined
                      }
                      className={`px-3 py-2 font-medium whitespace-nowrap ${align}`}
                    >
                      {header.column.getCanSort() ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="inline-flex items-center gap-1 hover:text-neutral-900"
                        >
                          <table.FlexRender header={header} />
                          <span aria-hidden className="w-3 text-xs">
                            {sorted === "asc"
                              ? "▲"
                              : sorted === "desc"
                                ? "▼"
                                : ""}
                          </span>
                        </button>
                      ) : (
                        <table.FlexRender header={header} />
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.original.aptSeq}
                className="border-t border-neutral-100 hover:bg-neutral-50"
              >
                {row.getAllCells().map((cell) => (
                  <td
                    key={cell.id}
                    className={`px-3 py-2 whitespace-nowrap tabular-nums ${
                      numeric.has(cell.column.id) ? "text-right" : ""
                    }`}
                  >
                    <table.FlexRender cell={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
