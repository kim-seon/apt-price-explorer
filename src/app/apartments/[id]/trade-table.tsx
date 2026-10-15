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
import {
  formatPercent,
  formatPrice,
  formatShortDate,
  pricePerPyeong,
} from "@/lib/format";
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
      if (t.cancelled) return <span className="text-neutral-500">✕ 해제</span>;
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
      <p className="mt-3 rounded-lg border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500">
        선택한 기간에 거래가 없습니다.
      </p>
    );
  }

  return (
    <div className="mt-3 max-h-[480px] overflow-auto rounded-lg border border-neutral-200">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-neutral-50 text-neutral-600">
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
        <tbody onMouseLeave={() => onHover(null)}>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              tabIndex={0}
              onMouseEnter={() => onHover(row.original.id)}
              onFocus={() => onHover(row.original.id)}
              onBlur={() => onHover(null)}
              className={`border-t border-neutral-100 outline-none hover:bg-blue-50 focus-visible:bg-blue-50 ${
                row.original.cancelled
                  ? "text-neutral-400 line-through decoration-neutral-300"
                  : ""
              }`}
            >
              {row.getAllCells().map((cell) => (
                <td
                  key={cell.id}
                  className={`px-3 py-1.5 whitespace-nowrap tabular-nums ${
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
  );
}
