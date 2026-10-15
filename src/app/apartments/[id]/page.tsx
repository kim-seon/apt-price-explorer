import { notFound } from "next/navigation";
import { Suspense } from "react";
import {
  getComplex,
  getDataFreshness,
  getRecentTransactions,
} from "@/server/queries/complexes";

// M2 walking skeleton: 배포 / DB 연결 / cold start 측정용 최소 화면. 화면 설계(03)는 M3에서 구현한다.
// 캐시하지 않는다 — 측정값에 캐시 효과가 섞이지 않게.

export default function ApartmentPage({
  params,
}: PageProps<"/apartments/[id]">) {
  return (
    <main className="mx-auto w-full max-w-3xl p-6">
      <Suspense fallback={<p>불러오는 중…</p>}>
        <ApartmentDetail params={params} />
      </Suspense>
    </main>
  );
}

async function ApartmentDetail({
  params,
}: {
  params: PageProps<"/apartments/[id]">["params"];
}) {
  const { id } = await params;
  const aptSeq = decodeURIComponent(id);
  const [complex, trades, freshness] = await Promise.all([
    getComplex(aptSeq),
    getRecentTransactions(aptSeq),
    getDataFreshness(),
  ]);
  if (!complex) notFound();

  return (
    <>
      <p className="text-sm text-gray-500">
        {complex.sidoName} {complex.sggName} {complex.umdName}
      </p>
      <h1 className="text-2xl font-bold">{complex.name}</h1>
      <p className="text-sm text-gray-500">
        {complex.buildYear}년 준공 · 데이터 기준{" "}
        {freshness ? new Date(freshness).toLocaleDateString("ko-KR") : "-"}
      </p>
      <h2 className="mt-6 font-semibold">최근 거래</h2>
      <ul className="mt-2 text-sm">
        {trades.map((t) => (
          <li key={t.id}>
            {t.dealDate} · 전용 {t.area}㎡ ({t.areaTypeLabel ?? "-"}) ·{" "}
            {t.floor}층 · {t.price.toLocaleString("ko-KR")}만원
            {t.cancelled ? " · 해제" : ""}
          </li>
        ))}
      </ul>
    </>
  );
}
