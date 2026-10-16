"use client";

import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { ariaSort, SortButton, tableClass } from "@/components/ui/data-table";
import {
  formatPercent,
  formatPrice,
  formatShortDate,
  pricePerPyeong,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Trade } from "@/server/queries/apartment-detail";

// 거래 내역 테이블. 행 hover / focus → 차트 포인트 하이라이트 (키보드로도 같은 연동)
// virtualization 없이 시작한다 — 단지 하나·타입 하나 규모에서 렌더링 시간을 측정한 뒤 판단 (CLAUDE.md 11).

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { basic: sortFn_basic, alphanumeric: sortFn_alphanumeric },
});
const helper = createColumnHelper<typeof features, Trade>();

const columns = helper.columns([
  helper.accessor("dealDate", {
    header: "계약일",
    cell: (info) => formatShortDate(info.getValue()),
    sortFn: "alphanumeric",
  }),
  helper.accessor("price", {
    header: "거래가",
    cell: (info) => formatPrice(info.getValue()),
    sortFn: "basic",
  }),
  helper.accessor("area", {
    header: "전용(㎡)",
    cell: (info) => info.getValue().toFixed(2),
    sortFn: "basic",
  }),
  helper.accessor("floor", {
    header: "층",
    cell: (info) => info.getValue() ?? "-",
    sortFn: "basic",
  }),
  helper.accessor((t) => pricePerPyeong(t.price, t.area), {
    id: "perPyeong",
    header: "3.3㎡당 (전용)",
    cell: (info) => formatPrice(info.getValue()),
    sortFn: "basic",
  }),
  helper.accessor("dealType", {
    header: "유형",
    cell: (info) =>
      info.getValue() === "직거래" ? "직거래" : info.getValue() ? "중개" : "-",
    enableSorting: false,
  }),
  helper.display({
    id: "note",
    header: "비고",
    cell: ({ row }) => {
      const t = row.original;
      if (t.cancelled)
        return <span className="text-muted-foreground">✕ 해제</span>;
      if (t.recordHighRatio !== null)
        return (
          <span className="font-medium text-[#c4501f]">
            ▲ 신고가 {formatPercent(t.recordHighRatio)}
          </span>
        );
      return null;
    },
  }),
]);

const numeric = new Set(["price", "area", "floor", "perPyeong"]);
/** 모바일(<640px)에서 숨기는 열 */
const desktopOnly = new Set(["area", "dealType"]);

export function TradeTable({
  trades,
  onHover,
}: {
  trades: Trade[];
  onHover: (id: number | null) => void;
}) {
  const table = useTable({ features, columns, data: trades });

  if (trades.length === 0) {
    return (
      <p className="mt-3 rounded-lg border border-dashed border-input p-6 text-center text-sm text-muted-foreground">
        선택한 기간에 거래가 없습니다.
      </p>
    );
  }

  return (
    <div
      className={cn(tableClass.wrapper, "mt-3 max-h-[480px] overflow-y-auto")}
    >
      <table className={tableClass.table}>
        <thead className={cn(tableClass.thead, "sticky top-0 z-[1]")}>
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
        <tbody onMouseLeave={() => onHover(null)}>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              tabIndex={0}
              onMouseEnter={() => onHover(row.original.id)}
              onFocus={() => onHover(row.original.id)}
              onBlur={() => onHover(null)}
              className={cn(
                tableClass.row,
                // 행 hover / focus = 차트 강조 대상. 차트의 거래가 파랑과 같은 계열로 표시한다
                "outline-none hover:bg-brand-soft focus-visible:bg-brand-soft",
                row.original.cancelled &&
                  "text-muted-foreground line-through decoration-muted-foreground/40",
              )}
            >
              {row.getAllCells().map((cell) => (
                <td
                  key={cell.id}
                  className={cn(
                    tableClass.td,
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
  );
}
