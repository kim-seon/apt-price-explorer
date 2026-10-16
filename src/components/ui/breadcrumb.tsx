import { ChevronRight } from "lucide-react";
import Link from "next/link";

export type Crumb = { label: string; href?: string };

/** 홈 > 서울특별시 > 송파구 > 가락동 > 헬리오시티 — 마지막 항목이 현재 페이지 */
export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="현재 위치">
      <ol className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="flex items-center gap-1">
              {item.href && !last ? (
                <Link
                  href={item.href}
                  className="underline-offset-2 hover:text-foreground hover:underline"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={last ? "page" : undefined}
                  className={last ? "font-medium text-foreground" : undefined}
                >
                  {item.label}
                </span>
              )}
              {!last && <ChevronRight aria-hidden className="size-3" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
