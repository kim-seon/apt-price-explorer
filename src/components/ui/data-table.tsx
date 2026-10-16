import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

// 데이터 테이블 공통 스타일. 세 테이블(단지 거래 · 지역 단지 · 지역 거래)이 같은 밀도와 정렬 표시를 쓴다.
// 숫자 열은 오른쪽 정렬 + tabular-nums (body에 기본 적용).

export const tableClass = {
  wrapper: "overflow-x-auto rounded-lg border border-border bg-card",
  table: "w-full border-collapse text-sm",
  thead: "bg-muted/70 text-xs text-muted-foreground",
  th: "h-9 px-2 text-left font-medium whitespace-nowrap first:pl-3 last:pr-3 sm:px-3",
  row: "border-t border-border/70 transition-colors hover:bg-muted/50",
  td: "h-9 px-2 whitespace-nowrap first:pl-3 last:pr-3 sm:px-3",
  numeric: "text-right",
} as const;

export type SortDirection = "asc" | "desc" | false;

export function ariaSort(direction: SortDirection) {
  return direction === "asc"
    ? "ascending"
    : direction === "desc"
      ? "descending"
      : undefined;
}

/** 정렬 가능한 헤더 버튼. 정렬 안 된 열은 흐린 양방향 아이콘으로 "정렬할 수 있음"을 알린다 */
export function SortButton({
  label,
  direction,
  onClick,
  numeric,
}: {
  label: React.ReactNode;
  direction: SortDirection;
  onClick: (e: React.MouseEvent) => void;
  numeric?: boolean;
}) {
  const Icon =
    direction === "asc"
      ? ArrowUp
      : direction === "desc"
        ? ArrowDown
        : ChevronsUpDown;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "-mx-1 inline-flex items-center gap-1 rounded px-1 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
        numeric && "flex-row-reverse",
        direction && "text-foreground",
      )}
    >
      {label}
      <Icon
        aria-hidden
        className={cn("size-3.5", !direction && "opacity-40")}
      />
    </button>
  );
}
