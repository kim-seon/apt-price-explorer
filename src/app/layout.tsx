import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "아파트 실거래가 탐색기",
  description: "수도권 아파트 실거래가를 단지 중심으로 탐색합니다.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
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
