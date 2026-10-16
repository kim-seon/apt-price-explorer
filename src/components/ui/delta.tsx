import { formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * 증감률. 상승 ▲ / 하락 ▼ — 색만으로 구분하지 않도록 기호를 함께 쓴다
 * (국내 관례: 상승 붉은색, 하락 파란색).
 */
export function Delta({
  ratio,
  label,
  className,
}: {
  ratio: number | null;
  /** 비교 기준 (예: "전년 대비") */
  label?: string;
  className?: string;
}) {
  if (ratio === null)
    return <span className={cn("text-muted-foreground", className)}>-</span>;
  const flat = Math.abs(ratio) < 0.0005;
  const up = ratio > 0;
  return (
    <span className={cn("inline-flex items-baseline gap-1", className)}>
      <span
        className={cn(
          "font-semibold",
          flat
            ? "text-muted-foreground"
            : up
              ? "text-destructive"
              : "text-brand-foreground",
        )}
      >
        <span aria-hidden>{flat ? "" : up ? "▲ " : "▼ "}</span>
        <span className="sr-only">
          {flat ? "변동 없음" : up ? "상승" : "하락"}
        </span>
        {formatPercent(ratio)}
      </span>
      {label && (
        <span className="text-xs font-normal text-muted-foreground">
          {label}
        </span>
      )}
    </span>
  );
}
