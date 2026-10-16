"use client";

import Link from "next/link";
import { formatPrice, formatShortDate, pricePerPyeong } from "@/lib/format";
import type { TradeSort, TradeSortKey } from "@/lib/region-params";
import type { RegionTrade } from "@/server/queries/region-trades";

// 정렬은 서버가 한다 (전체 결과 기준 정렬이어야 하므로 불러온 페이지만 정렬하면 안 된다).
// 헤더는 정렬 상태를 URL로 올려 보내기만 한다.

type Column = {
  id: string;
  header: string;
  sortKey?: TradeSortKey;
  numeric?: boolean;
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
      <Link
        href={`/apartments/${encodeURIComponent(t.aptSeq)}`}
        className="font-medium hover:underline"
      >
        {t.aptName}
      </Link>
    ),
  },
  { id: "dong", header: "법정동", cell: (t) => t.dong },
  {
    id: "area",
    header: "전용(㎡)",
    sortKey: "area",
    numeric: true,
    cell: (t) => t.area.toFixed(2),
  },
  {
    id: "floor",
    header: "층",
    sortKey: "floor",
    numeric: true,
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
    header: "3.3㎡당 (전용)",
    sortKey: "perPyeong",
    numeric: true,
    cell: (t) => formatPrice(pricePerPyeong(t.price, t.area)),
  },
  {
    id: "note",
    header: "비고",
    cell: (t) =>
      t.cancelled ? (
        <span className="text-neutral-500">✕ 해제</span>
      ) : t.dealType === "직거래" ? (
        "직거래"
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
      className={`mt-3 overflow-x-auto rounded-lg border border-neutral-200 transition-opacity ${stale ? "opacity-50" : ""}`}
      aria-busy={stale}
    >
      <table className="w-full text-sm">
        <thead className="bg-neutral-50 text-neutral-600">
          <tr>
            {COLUMNS.map((col) => {
              const active = col.sortKey === sort.key;
              const align = col.numeric ? "text-right" : "text-left";
              return (
                <th
                  key={col.id}
                  scope="col"
                  aria-sort={
                    active
                      ? sort.desc
                        ? "descending"
                        : "ascending"
                      : undefined
                  }
                  className={`px-3 py-2 font-medium whitespace-nowrap ${align}`}
                >
                  {col.sortKey ? (
                    <button
                      type="button"
                      // 새 열은 내림차순(최신 · 비싼 · 넓은 · 높은)부터, 같은 열은 방향을 뒤집는다
                      onClick={() =>
                        onSort({
                          key: col.sortKey!,
                          desc: active ? !sort.desc : true,
                        })
                      }
                      className="inline-flex items-center gap-1 hover:text-neutral-900"
                    >
                      {col.header}
                      <span aria-hidden className="w-3 text-xs">
                        {active ? (sort.desc ? "▼" : "▲") : ""}
                      </span>
                    </button>
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
              className={`border-t border-neutral-100 hover:bg-neutral-50 ${
                t.cancelled
                  ? "text-neutral-400 line-through decoration-neutral-300"
                  : ""
              }`}
            >
              {COLUMNS.map((col) => (
                <td
                  key={col.id}
                  className={`px-3 py-1.5 whitespace-nowrap tabular-nums ${col.numeric ? "text-right" : ""}`}
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
