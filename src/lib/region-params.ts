import { z } from "zod";

// 지역 페이지 URL 상태 (docs/02 F0). 탭은 경로(/regions/[code], /stats, /trades)로 구분하고,
// 탭 사이에 유지되는 값(법정동)과 탭별 값(정렬 등)은 search params로 둔다.
// 잘못된 값은 오류 대신 기본값으로 대체한다.

export const SGG_CODE = /^\d{5}$/;

/** 탭 사이에 유지되는 search params */
export const SHARED_REGION_PARAMS = ["dong"] as const;

// ── 단지 목록 탭 ──

export const COMPLEX_SORT_KEYS = [
  "name",
  "dong",
  "buildYear",
  "lastDealDate",
  "perPyeong",
  "recentCount",
] as const;
export type ComplexSortKey = (typeof COMPLEX_SORT_KEYS)[number];
export type ComplexSort = { key: ComplexSortKey; desc: boolean };
export const DEFAULT_COMPLEX_SORT: ComplexSort = {
  key: "recentCount",
  desc: true,
};

const dong = z.string().trim().min(1).max(30).optional().catch(undefined);

const complexSort = z
  .string()
  .transform((v, ctx): ComplexSort => {
    const [key, dir] = v.split(".");
    if (
      !COMPLEX_SORT_KEYS.includes(key as ComplexSortKey) ||
      (dir !== "asc" && dir !== "desc")
    ) {
      ctx.addIssue({ code: "custom", message: "invalid sort" });
      return z.NEVER;
    }
    return { key: key as ComplexSortKey, desc: dir === "desc" };
  })
  .catch(DEFAULT_COMPLEX_SORT);

type RawSearch = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : v;

export function parseComplexListParams(raw: RawSearch) {
  return {
    dong: dong.parse(first(raw.dong)),
    sort: complexSort.parse(first(raw.sort) ?? ""),
  };
}

export function serializeComplexSort(sort: ComplexSort): string | null {
  if (
    sort.key === DEFAULT_COMPLEX_SORT.key &&
    sort.desc === DEFAULT_COMPLEX_SORT.desc
  ) {
    return null;
  }
  return `${sort.key}.${sort.desc ? "desc" : "asc"}`;
}
