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

/** 모든 탭이 공유하는 값 */
export function parseSharedRegionParams(raw: RawSearch) {
  return { dong: dong.parse(first(raw.dong)) };
}

export function parseComplexListParams(raw: RawSearch) {
  return {
    ...parseSharedRegionParams(raw),
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

// ── 거래 탐색 탭 ──
// 필터는 URL이 원본이다. 서버(첫 페이지 렌더, Route Handler)와 클라이언트(쿼리 키)가 같은 파서를 쓴다.

export const TRADE_PERIODS = [
  { value: "1y", label: "1년", years: 1 },
  { value: "3y", label: "3년", years: 3 },
  { value: "5y", label: "5년", years: 5 },
  { value: "10y", label: "10년", years: 10 },
  { value: "all", label: "전체", years: null },
] as const;
export type TradePeriod = (typeof TRADE_PERIODS)[number]["value"];

/** 국민주택규모 기준 면적 구간 (전용 ㎡). max는 미포함 */
export const AREA_BANDS = [
  { value: "lt60", label: "60㎡ 미만", min: null, max: 60 },
  { value: "60-85", label: "60~85㎡", min: 60, max: 85 },
  { value: "85-135", label: "85~135㎡", min: 85, max: 135 },
  { value: "gt135", label: "135㎡ 이상", min: 135, max: null },
] as const;
export type AreaBand = (typeof AREA_BANDS)[number]["value"];

export const TRADE_SORT_KEYS = [
  "dealDate",
  "price",
  "perPyeong",
  "area",
  "floor",
] as const;
export type TradeSortKey = (typeof TRADE_SORT_KEYS)[number];
export type TradeSort = { key: TradeSortKey; desc: boolean };

export const DEFAULT_TRADE_FILTERS = {
  period: "3y" as TradePeriod,
  sort: { key: "dealDate", desc: true } as TradeSort,
};

const manwon = z.coerce.number().int().min(0).max(10_000_000);

const tradeSchema = z.object({
  period: z
    .enum(TRADE_PERIODS.map((p) => p.value) as [TradePeriod, ...TradePeriod[]])
    .catch(DEFAULT_TRADE_FILTERS.period),
  area: z
    .enum(AREA_BANDS.map((a) => a.value) as [AreaBand, ...AreaBand[]])
    .optional()
    .catch(undefined),
  priceMin: manwon.optional().catch(undefined),
  priceMax: manwon.optional().catch(undefined),
  cancelled: z
    .literal("1")
    .optional()
    .catch(undefined)
    .transform((v) => v === "1"),
  sort: z
    .string()
    .transform((v, ctx): TradeSort => {
      const [key, dir] = v.split(".");
      if (
        !TRADE_SORT_KEYS.includes(key as TradeSortKey) ||
        (dir !== "asc" && dir !== "desc")
      ) {
        ctx.addIssue({ code: "custom", message: "invalid sort" });
        return z.NEVER;
      }
      return { key: key as TradeSortKey, desc: dir === "desc" };
    })
    .catch(DEFAULT_TRADE_FILTERS.sort),
});

export type TradeFilters = z.infer<typeof tradeSchema> & { dong?: string };

type SearchLike = RawSearch | URLSearchParams;

export function parseTradeFilters(raw: SearchLike): TradeFilters {
  const get = (key: string) =>
    raw instanceof URLSearchParams
      ? (raw.get(key) ?? undefined)
      : first(raw[key]);
  const parsed = tradeSchema.parse({
    period: get("period") ?? DEFAULT_TRADE_FILTERS.period,
    area: get("area"),
    priceMin: get("priceMin") || undefined,
    priceMax: get("priceMax") || undefined,
    cancelled: get("cancelled"),
    sort: get("sort") ?? "",
  });
  // 최소 > 최대면 두 값을 바꿔서 해석한다 (입력 실수를 빈 결과로 만들지 않는다)
  if (
    parsed.priceMin !== undefined &&
    parsed.priceMax !== undefined &&
    parsed.priceMin > parsed.priceMax
  ) {
    [parsed.priceMin, parsed.priceMax] = [parsed.priceMax, parsed.priceMin];
  }
  return { ...parsed, dong: dong.parse(get("dong")) };
}

/** 기본값은 생략해 URL을 짧게 유지한다. 키 순서가 고정이라 쿼리 키로도 쓴다 */
export function serializeTradeFilters(f: TradeFilters): URLSearchParams {
  const out = new URLSearchParams();
  if (f.dong) out.set("dong", f.dong);
  if (f.period !== DEFAULT_TRADE_FILTERS.period) out.set("period", f.period);
  if (f.area) out.set("area", f.area);
  if (f.priceMin !== undefined) out.set("priceMin", String(f.priceMin));
  if (f.priceMax !== undefined) out.set("priceMax", String(f.priceMax));
  if (f.cancelled) out.set("cancelled", "1");
  const d = DEFAULT_TRADE_FILTERS.sort;
  if (f.sort.key !== d.key || f.sort.desc !== d.desc) {
    out.set("sort", `${f.sort.key}.${f.sort.desc ? "desc" : "asc"}`);
  }
  return out;
}

/** 기간 프리셋의 시작일 (YYYY-MM-DD). 전체면 null */
export function tradePeriodStart(
  period: TradePeriod,
  today: Date,
): string | null {
  const preset = TRADE_PERIODS.find((p) => p.value === period)!;
  if (preset.years === null) return null;
  const d = new Date(today);
  d.setFullYear(d.getFullYear() - preset.years);
  return d.toISOString().slice(0, 10);
}
