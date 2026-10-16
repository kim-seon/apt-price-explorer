"use client";

import Link from "next/link";
import { ariaSort, SortButton, tableClass } from "@/components/ui/data-table";
import { formatPrice, formatShortDate, pricePerPyeong } from "@/lib/format";
import type { TradeSort, TradeSortKey } from "@/lib/region-params";
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
  cell: (t: RegionTrade) => React.ReactNode;
};

const COLUMNS: Column[] = [
  {
    id: "dealDate",
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
  { id: "dong", header: "법정동", desktopOnly: true, cell: (t) => t.dong },
  {
    id: "area",
    header: "전용㎡",
    sortKey: "area",
    numeric: true,
    desktopOnly: true,
    cell: (t) => t.area.toFixed(2),
  },
  {
    id: "floor",
    header: "층",
    sortKey: "floor",
    numeric: true,
    desktopOnly: true,
    cell: (t) => t.floor ?? "-",
  },
  {
    id: "price",
    header: "거래가",
    sortKey: "price",
    numeric: true,
    cell: (t) => <span className="font-medium">{formatPrice(t.price)}</span>,
  },
  {
    id: "perPyeong",
    header: "3.3㎡당",
    sortKey: "perPyeong",
    numeric: true,
    desktopOnly: true,
    cell: (t) => formatPrice(pricePerPyeong(t.price, t.area)),
  },
  {
    id: "note",
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
  return (
    <div
      className={cn(
        tableClass.wrapper,
        "mt-3 transition-opacity",
        stale && "opacity-50",
      )}
      aria-busy={stale}
    >
      <table className={tableClass.table}>
        <caption className="sr-only">
          지역 거래 목록. 3.3㎡당 가격은 전용면적 기준
        </caption>
        <thead className={tableClass.thead}>
          <tr>
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
        <tbody>
          {rows.map((t) => (
            <tr
              key={t.id}
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
          ))}
        </tbody>
      </table>
    </div>
  );
}
