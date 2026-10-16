"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

// 예상하지 못한 서버 / 렌더링 오류 (CLAUDE.md 14). 공통 헤더는 root layout에 있어 그대로 남는다.

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto w-full max-w-md px-4 py-20 text-center">
      <h1 className="text-lg font-semibold">데이터를 불러오지 못했습니다</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        일시적인 문제일 수 있습니다. 다시 시도해도 같다면 잠시 후 접속해 주세요.
        {error.digest && (
          <span className="mt-1 block text-xs">오류 코드 {error.digest}</span>
        )}
      </p>
      <div className="mt-6 flex justify-center gap-2">
        <Button onClick={() => retry()}>다시 시도</Button>
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href="/" />}
        >
          처음으로
        </Button>
      </div>
    </main>
  );
}
