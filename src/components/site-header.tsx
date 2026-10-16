"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SearchBox } from "@/app/search-box";
import { cn } from "@/lib/utils";

// 공통 상단 바 (시안 01~03): 로고 · 메뉴 · 검색. 진입 화면은 본문에 큰 검색창이 있어 상단 검색을 숨긴다.

const NAV = [
  {
    href: "/",
    label: "단지 검색",
    match: (p: string) => p === "/" || p.startsWith("/apartments"),
  },
  {
    href: "/#regions",
    label: "지역 통계",
    match: (p: string) => p.startsWith("/regions"),
  },
];

export function SiteHeader() {
  const pathname = usePathname();
  const home = pathname === "/";
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link
          href="/"
          className="shrink-0 text-[15px] font-extrabold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          아파트 실거래가
        </Link>
        <nav aria-label="주 메뉴" className="hidden gap-5 sm:flex">
          {NAV.map((item) => {
            const active = item.match(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative py-4 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
                  "aria-[current=page]:font-semibold aria-[current=page]:text-foreground",
                  "aria-[current=page]:after:absolute aria-[current=page]:after:inset-x-0 aria-[current=page]:after:bottom-0 aria-[current=page]:after:h-0.5 aria-[current=page]:after:bg-foreground",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto w-full max-w-64">
          {!home && <SearchBox variant="compact" />}
        </div>
      </div>
    </header>
  );
}
