import { cn } from "@/lib/utils";

// 시안의 KPI 카드: 라벨 + 기준(작게) + 큰 숫자 + 증감/보조 정보

export function StatCard({
  label,
  basis,
  value,
  footer,
  className,
}: {
  label: string;
  /** 계산 기준 (예: "최근 1년 · 전용 84㎡") */
  basis?: string;
  value: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card px-4 py-3.5",
        className,
      )}
    >
      <dt className="text-sm font-medium">
        {label}
        {basis && (
          <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
            {basis}
          </span>
        )}
      </dt>
      <dd className="mt-2 text-xl font-bold tracking-tight sm:text-2xl">
        {value}
      </dd>
      {footer && <dd className="mt-1 text-sm">{footer}</dd>}
    </div>
  );
}
