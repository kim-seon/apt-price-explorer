import type { Metadata } from "next";
import Link from "next/link";
// Pretendard dynamic subset: 한글을 92개 unicode-range 묶음으로 나눠, 페이지에 나온 글자의 묶음만 받는다
// (전체 variable 폰트 약 2MB 대신). 파일은 빌드 산출물로 자체 호스팅된다. font-display: swap
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "아파트 실거래가 탐색기",
  description: "수도권 아파트 실거래가를 단지 중심으로 탐색합니다.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <header className="border-b border-border bg-card">
          <div className="mx-auto flex h-12 w-full max-w-5xl items-center px-4 sm:px-6">
            <Link
              href="/"
              className="flex items-center gap-2 text-sm font-semibold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span
                aria-hidden
                className="grid size-6 place-items-center rounded-md bg-foreground text-[11px] font-bold text-background"
              >
                실
              </span>
              아파트 실거래가 탐색기
            </Link>
            <span className="ml-auto text-xs text-muted-foreground">
              서울 · 경기 · 인천 매매
            </span>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
