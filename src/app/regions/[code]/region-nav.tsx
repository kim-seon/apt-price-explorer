"use client";

import Link from "next/link";
import {
  useParams,
  usePathname,
  useRouter,
  useSearchParams,
  useSelectedLayoutSegment,
} from "next/navigation";
import { useTransition } from "react";
import { SHARED_REGION_PARAMS } from "@/lib/region-params";
import type { DongOption } from "@/server/queries/regions";

const TABS = [
  { segment: null, path: "", label: "단지 목록" },
  { segment: "stats", path: "/stats", label: "통계" },
  { segment: "trades", path: "/trades", label: "거래 탐색" },
] as const;

/** 탭 이동 시 법정동처럼 탭 사이에 공유되는 값만 넘긴다 (정렬·필터는 탭마다 다르다) */
export function RegionTabs() {
  const { code } = useParams<{ code: string }>();
  const segment = useSelectedLayoutSegment();
  const searchParams = useSearchParams();

  const shared = new URLSearchParams();
  for (const key of SHARED_REGION_PARAMS) {
    const value = searchParams.get(key);
    if (value) shared.set(key, value);
  }
  const qs = shared.toString();

  return (
    <nav
      aria-label="지역 보기"
      className="mt-4 flex gap-1 border-b border-neutral-200"
    >
      {TABS.map((tab) => (
        <Link
          key={tab.label}
          href={`/regions/${code}${tab.path}${qs ? `?${qs}` : ""}`}
          aria-current={tab.segment === segment ? "page" : undefined}
          className="-mb-px border-b-2 border-transparent px-3 py-2.5 text-sm text-neutral-600 hover:text-neutral-900 aria-[current=page]:border-neutral-900 aria-[current=page]:font-semibold aria-[current=page]:text-neutral-900"
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

/** 법정동 선택. 모든 탭에 적용되고, 다른 search params(정렬·필터)는 유지한다 */
export function DongSelect({ dongs }: { dongs: DongOption[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const current = searchParams.get("dong") ?? "";

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-neutral-500">법정동</span>
      <select
        value={current}
        onChange={(e) => {
          const next = new URLSearchParams(searchParams);
          if (e.target.value) next.set("dong", e.target.value);
          else next.delete("dong");
          const qs = next.toString();
          startTransition(() => {
            router.push(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
          });
        }}
        aria-busy={pending}
        className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 aria-busy:opacity-60"
      >
        <option value="">전체</option>
        {dongs.map((d) => (
          <option key={d.name} value={d.name}>
            {d.name} ({d.complexCount})
          </option>
        ))}
      </select>
    </label>
  );
}
