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
import { useVirtualizer } from "@tanstack/react-virtual";
import { useLayoutEffect, useRef, useState } from "react";
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
// 가상화: 1,707행에서 TBT 279ms가 측정되어 도입 (docs/performance/cases/04-trade-table-virtualization.md)

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

/** table-layout: fixed용 열 너비. 가상화로 보이는 행이 바뀌어도 열이 흔들리지 않게 한다 */
const widths: Record<string, string> = {
  dealDate: "w-[84px] sm:w-[92px]",
  price: "w-[96px] sm:w-[112px]",
  area: "w-[88px]",
  floor: "w-[56px]",
  perPyeong: "w-[104px] sm:w-[120px]",
  dealType: "w-[64px]",
};
const ROW_ESTIMATE = 37;

export function TradeTable({
  trades,
  onHover,
}: {
  trades: Trade[];
  onHover: (id: number | null) => void;
}) {
  const table = useTable({ features, columns, data: trades });
  const rows = table.getRowModel().rows;

  // 가상화 (docs/performance/cases/04-trade-table-virtualization.md): 표 자체 스크롤 영역 안에서
  // 보이는 행 ± overscan만 그린다. thead 높이만큼 scrollMargin을 둔다.
  const scrollRef = useRef<HTMLDivElement>(null);
  const theadRef = useRef<HTMLTableSectionElement>(null);
  const [theadHeight, setTheadHeight] = useState(0);
  useLayoutEffect(() => {
    if (theadRef.current) setTheadHeight(theadRef.current.offsetHeight);
  }, [trades.length]);

  // React Compiler는 쓰지 않는다(next.config). 켜게 되면 이 컴포넌트는 자동 memo 대상에서 빠진다
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_ESTIMATE,
    overscan: 10,
    scrollMargin: theadHeight,
    getItemKey: (i) => rows[i].id,
  });
  const items = virtualizer.getVirtualItems();
  const padTop = items.length ? items[0].start - theadHeight : 0;
  const padBottom = items.length
    ? virtualizer.getTotalSize() - (items[items.length - 1].end - theadHeight)
    : 0;

  // 화면 밖 행은 DOM에 없어 Tab으로 이어 갈 수 없다 → ↑ / ↓로 행 사이를 이동한다
  const moveFocus = (from: number, delta: number) => {
    const target = Math.min(rows.length - 1, Math.max(0, from + delta));
    if (target === from) return;
    virtualizer.scrollToIndex(target, { align: "auto" });
    requestAnimationFrame(() =>
      scrollRef.current
        ?.querySelector<HTMLElement>(`tr[data-index="${target}"]`)
        ?.focus(),
    );
  };

  if (trades.length === 0) {
    return (
      <p className="mt-3 rounded-lg border border-dashed border-input p-6 text-center text-sm text-muted-foreground">
        선택한 기간에 거래가 없습니다.
      </p>
    );
  }

  const visibleCount = table.getHeaderGroups()[0].headers.length;

  return (
    <div
      ref={scrollRef}
      className={cn(tableClass.wrapper, "mt-3 max-h-[480px] overflow-y-auto")}
    >
      <table
        className={cn(tableClass.table, "table-fixed")}
        aria-rowcount={rows.length + 1}
      >
        <caption className="sr-only">
          거래 내역. 행에서 위 · 아래 화살표로 이동하면 차트에 해당 거래가
          표시됩니다
        </caption>
        <thead
          ref={theadRef}
          className={cn(tableClass.thead, "sticky top-0 z-[1]")}
        >
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id} aria-rowindex={1}>
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
                      widths[id],
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
          {padTop > 0 && (
            <tr aria-hidden style={{ height: padTop }}>
              <td colSpan={visibleCount} className="p-0" />
            </tr>
          )}
          {items.map((item) => {
            const row = rows[item.index];
            return (
              <tr
                key={item.key}
                data-index={item.index}
                ref={virtualizer.measureElement}
                aria-rowindex={item.index + 2}
                tabIndex={0}
                onMouseEnter={() => onHover(row.original.id)}
                onFocus={() => onHover(row.original.id)}
                onBlur={() => onHover(null)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                    e.preventDefault();
                    moveFocus(item.index, e.key === "ArrowDown" ? 1 : -1);
                  }
                }}
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
                      "overflow-hidden text-ellipsis",
                      numeric.has(cell.column.id) && tableClass.numeric,
                      desktopOnly.has(cell.column.id) && "hidden sm:table-cell",
                    )}
                  >
                    <table.FlexRender cell={cell} />
                  </td>
                ))}
              </tr>
            );
          })}
          {padBottom > 0 && (
            <tr aria-hidden style={{ height: padBottom }}>
              <td colSpan={visibleCount} className="p-0" />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
