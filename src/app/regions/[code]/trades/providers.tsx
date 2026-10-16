"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

// TanStack Query는 거래 탐색 탭에서만 쓴다 (docs/decisions/0006). 다른 화면 번들에 포함되지 않도록
// 이 탭의 layout에서만 provider를 둔다.
// 서버 렌더마다 새 client, 브라우저에서는 하나를 재사용해 탭을 오가도 캐시(불러온 페이지)가 남게 한다.

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  const create = () =>
    new QueryClient({
      defaultOptions: {
        queries: {
          // 거래 데이터는 하루 한 번 갱신된다. 같은 필터로 돌아왔을 때 다시 요청하지 않는다
          staleTime: 5 * 60_000,
          refetchOnWindowFocus: false,
        },
      },
    });
  if (typeof window === "undefined") return create();
  browserQueryClient ??= create();
  return browserQueryClient;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={getQueryClient()}>
      {children}
    </QueryClientProvider>
  );
}
