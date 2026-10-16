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
import { Card, CardHeader } from "@/components/ui/card";
import { ariaSort, SortButton, tableClass } from "@/components/ui/data-table";
import { formatPrice, formatShortDate } from "@/lib/format";
import {
  serializeComplexSort,
  type ComplexSort,
  type ComplexSortKey,
} from "@/lib/region-params";
import { cn } from "@/lib/utils";
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
      <>
        <Link
          href={`/apartments/${encodeURIComponent(info.row.original.aptSeq)}`}
          className="font-medium hover:text-brand-foreground hover:underline"
        >
          {info.getValue()}
        </Link>
        <span className="block text-xs text-muted-foreground sm:hidden">
          {[
            info.row.original.dong,
            info.row.original.buildYear && `${info.row.original.buildYear}년`,
            info.row.original.mainType &&
              `주력 ${info.row.original.mainType}㎡`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </>
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
          <span className="block text-xs text-muted-foreground sm:ml-1.5 sm:inline">
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
    header: "3.3㎡당 (1년)",
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
/** 모바일(<640px)에서는 단지 · 최근 거래 · 거래 수만 두고 나머지는 단지 아래 줄로 옮긴다 */
const desktopOnly = new Set(["dong", "buildYear", "mainType", "perPyeong"]);

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
    <Card aria-labelledby="complex-count" className="mt-5">
      <CardHeader
        id="complex-count"
        title={
          <>
            단지 목록{" "}
            <span className="font-normal text-muted-foreground">
              {complexes.length.toLocaleString("ko-KR")}개
            </span>
          </>
        }
        description="해제 거래 제외 · 3.3㎡당은 최근 1년 전용면적 기준 · 헤더를 눌러 정렬"
      />
      <div className={cn(tableClass.wrapper, "mt-3")}>
        <table className={tableClass.table}>
          <thead className={tableClass.thead}>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => {
                  const id = header.column.id;
                  const direction = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={ariaSort(direction)}
                      className={cn(
                        tableClass.th,
                        numeric.has(id) && tableClass.numeric,
                        desktopOnly.has(id) && "hidden sm:table-cell",
                      )}
                    >
                      {header.column.getCanSort() ? (
                        <SortButton
                          label={<table.FlexRender header={header} />}
                          direction={direction}
                          numeric={numeric.has(id)}
                          onClick={header.column.getToggleSortingHandler()!}
                        />
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
              <tr key={row.original.aptSeq} className={tableClass.row}>
                {row.getAllCells().map((cell) => (
                  <td
                    key={cell.id}
                    className={cn(
                      tableClass.td,
                      "py-1.5",
                      // 모바일에서는 단지명 줄바꿈을 허용해 숫자 열이 화면 안에 들어오게 한다
                      cell.column.id === "name" &&
                        "whitespace-normal sm:whitespace-nowrap",
                      numeric.has(cell.column.id) && tableClass.numeric,
                      desktopOnly.has(cell.column.id) && "hidden sm:table-cell",
                    )}
                  >
                    <table.FlexRender cell={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
