import type { Metadata } from "next";
import { Suspense } from "react";
import { SiteHeader } from "@/components/site-header";
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
        <Suspense
          fallback={<div className="h-14 border-b border-border bg-card" />}
        >
          <SiteHeader />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
