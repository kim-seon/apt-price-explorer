"use client";

import { useWindowVirtualizer } from "@tanstack/react-virtual";
import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";
import { ariaSort, SortButton, tableClass } from "@/components/ui/data-table";
import { formatPrice, formatShortDate, pricePerPyeong } from "@/lib/format";
import type { TradeSort, TradeSortKey } from "@/lib/region-params";
import { useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";
import type { RegionTrade } from "@/server/queries/region-trades";

// 정렬은 서버가 한다 (전체 결과 기준 정렬이어야 하므로 불러온 페이지만 정렬하면 안 된다).
// 헤더는 정렬 상태를 URL로 올려 보내기만 한다.
// 모바일(<640px)에서는 계약일 · 단지 · 거래가만 두고, 법정동 · 전용 · 층은 단지 아래 줄로 옮긴다 (docs/03 #3).

type Column = {
  id: string;
  header: string;
  sortKey?: TradeSortKey;
  numeric?: boolean;
  /** 모바일에서 숨김 */
  desktopOnly?: boolean;
  /** table-layout: fixed용 열 너비 (없으면 남은 폭). 가상화로 보이는 행이 바뀌어도 열이 흔들리지 않게 한다 */
  width?: string;
  cell: (t: RegionTrade) => React.ReactNode;
};

const COLUMNS: Column[] = [
  {
    id: "dealDate",
    width: "w-[84px] sm:w-[92px]",
    header: "계약일",
    sortKey: "dealDate",
    cell: (t) => formatShortDate(t.dealDate),
  },
  {
    id: "apt",
    header: "단지",
    cell: (t) => (
      <>
        <Link
          href={`/apartments/${encodeURIComponent(t.aptSeq)}`}
          className="font-medium hover:text-brand-foreground hover:underline"
        >
          {t.aptName}
        </Link>
        <span className="block text-xs text-muted-foreground sm:hidden">
          {t.dong} · {Math.round(t.area)}㎡
          {t.floor !== null && ` · ${t.floor}층`}
          {t.cancelled && " · 해제"}
        </span>
      </>
    ),
  },
  {
    id: "dong",
    width: "w-[88px]",
    header: "법정동",
    desktopOnly: true,
    cell: (t) => t.dong,
  },
  {
    id: "area",
    width: "w-[84px]",
    header: "전용㎡",
    sortKey: "area",
    numeric: true,
    desktopOnly: true,
    cell: (t) => t.area.toFixed(2),
  },
  {
    id: "floor",
    width: "w-[60px]",
    header: "층",
    sortKey: "floor",
    numeric: true,
    desktopOnly: true,
    cell: (t) => t.floor ?? "-",
  },
  {
    id: "price",
    width: "w-[96px] sm:w-[112px]",
    header: "거래가",
    sortKey: "price",
    numeric: true,
    cell: (t) => <span className="font-medium">{formatPrice(t.price)}</span>,
  },
  {
    id: "perPyeong",
    width: "w-[100px]",
    header: "3.3㎡당",
    sortKey: "perPyeong",
    numeric: true,
    desktopOnly: true,
    cell: (t) => formatPrice(pricePerPyeong(t.price, t.area)),
  },
  {
    id: "note",
    width: "w-[72px]",
    header: "비고",
    desktopOnly: true,
    cell: (t) =>
      t.cancelled ? (
        <span className="text-muted-foreground no-underline">해제</span>
      ) : t.dealType === "직거래" ? (
        <span className="text-muted-foreground">직거래</span>
      ) : null,
  },
];

/** 행 높이 추정값(px). 실제 높이는 measureElement로 잰다 (모바일은 단지 아래 줄이 있어 더 높다) */
const ROW_ESTIMATE = { desktop: 37, mobile: 53 };

export function RegionTradeTable({
  rows,
  sort,
  onSort,
  stale,
}: {
  rows: RegionTrade[];
  sort: TradeSort;
  onSort: (sort: TradeSort) => void;
  stale: boolean;
}) {
  // 가상화 (docs/performance/cases/04-trade-table-virtualization.md):
  // 창 스크롤 기준으로 보이는 행 ± overscan만 DOM에 둔다. 위아래는 높이만 가진 빈 행으로 채운다.
  const tbodyRef = useRef<HTMLTableSectionElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);
  const mobile = useMediaQuery("(max-width: 639px)");

  // 표 본문이 문서에서 시작하는 위치. 위쪽 레이아웃(필터 바 줄바꿈 등)이 바뀌면 다시 잰다
  useLayoutEffect(() => {
    const el = tbodyRef.current!;
    const update = () =>
      setScrollMargin(el.getBoundingClientRect().top + window.scrollY);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(document.body);
    return () => observer.disconnect();
  }, []);

  const virtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: () => (mobile ? ROW_ESTIMATE.mobile : ROW_ESTIMATE.desktop),
    overscan: 12,
    scrollMargin,
    getItemKey: (i) => rows[i].id,
  });
  const items = virtualizer.getVirtualItems();
  const padTop = items.length ? items[0].start - scrollMargin : 0;
  const padBottom = items.length
    ? virtualizer.getTotalSize() - (items[items.length - 1].end - scrollMargin)
    : 0;
  const visibleColumns = COLUMNS.filter((c) => !(mobile && c.desktopOnly));

  return (
    <div
      className={cn(
        tableClass.wrapper,
        "mt-3 transition-opacity",
        stale && "opacity-50",
      )}
      aria-busy={stale}
    >
      <table
        className={cn(tableClass.table, "table-fixed")}
        aria-rowcount={rows.length + 1}
      >
        <caption className="sr-only">
          지역 거래 목록. 3.3㎡당 가격은 전용면적 기준. 스크롤하면 이어서
          불러옵니다
        </caption>
        <thead className={tableClass.thead}>
          <tr aria-rowindex={1}>
            {COLUMNS.map((col) => {
              const direction =
                col.sortKey === sort.key ? (sort.desc ? "desc" : "asc") : false;
              return (
                <th
                  key={col.id}
                  scope="col"
                  aria-sort={ariaSort(direction)}
                  className={cn(
                    tableClass.th,
                    col.width,
                    col.numeric && tableClass.numeric,
                    col.desktopOnly && "hidden sm:table-cell",
                  )}
                >
                  {col.sortKey ? (
                    <SortButton
                      label={col.header}
                      direction={direction}
                      numeric={col.numeric}
                      // 새 열은 내림차순(최신 · 비싼 · 넓은 · 높은)부터, 같은 열은 방향을 뒤집는다
                      onClick={() =>
                        onSort({
                          key: col.sortKey!,
                          desc: direction ? !sort.desc : true,
                        })
                      }
                    />
                  ) : (
                    col.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody ref={tbodyRef}>
          {padTop > 0 && (
            <tr aria-hidden style={{ height: padTop }}>
              <td colSpan={visibleColumns.length} className="p-0" />
            </tr>
          )}
          {items.map((item) => {
            const t = rows[item.index];
            return (
              <tr
                key={item.key}
                data-index={item.index}
                ref={virtualizer.measureElement}
                aria-rowindex={item.index + 2}
                className={cn(
                  tableClass.row,
                  t.cancelled &&
                    "text-muted-foreground line-through decoration-muted-foreground/40",
                )}
              >
                {COLUMNS.map((col) => (
                  <td
                    key={col.id}
                    className={cn(
                      tableClass.td,
                      "overflow-hidden text-ellipsis",
                      col.numeric && tableClass.numeric,
                      col.desktopOnly && "hidden sm:table-cell",
                      col.id === "apt" &&
                        "py-1.5 whitespace-normal sm:whitespace-nowrap",
                    )}
                  >
                    {col.cell(t)}
                  </td>
                ))}
              </tr>
            );
          })}
          {padBottom > 0 && (
            <tr aria-hidden style={{ height: padBottom }}>
              <td colSpan={visibleColumns.length} className="p-0" />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
