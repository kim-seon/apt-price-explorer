import Link from "next/link";
import { Button } from "@/components/ui/button";

// 없는 단지 ID / 지역 코드 (docs/02 F0: 잘못된 파라미터 처리)

export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-md px-4 py-20 text-center">
      <p className="text-sm font-medium text-muted-foreground">404</p>
      <h1 className="mt-1 text-lg font-semibold">
        찾는 단지나 지역이 없습니다
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        주소가 바뀌었거나 수도권(서울 · 경기 · 인천) 밖의 지역일 수 있습니다.
      </p>
      <Button className="mt-6" nativeButton={false} render={<Link href="/" />}>
        단지 검색으로 가기
      </Button>
    </main>
  );
}
