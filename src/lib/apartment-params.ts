import { z } from "zod";

// 단지 상세 URL 상태 (docs/02 F0, docs/decisions/0005)
// - type, period: 서버 재렌더 대상
// - from, to, cancelled: 클라이언트에서만 반영 (history.replaceState)
// 잘못된 값은 오류 대신 기본값으로 대체한다.

export const PERIODS = [
  { value: "1y", label: "1년", years: 1 },
  { value: "3y", label: "3년", years: 3 },
  { value: "5y", label: "5년", years: 5 },
  { value: "10y", label: "10년", years: 10 },
  { value: "all", label: "전체", years: null },
] as const;

export type Period = (typeof PERIODS)[number]["value"];
export const DEFAULT_PERIOD: Period = "5y";

const yearMonth = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

const schema = z.object({
  type: z
    .string()
    .regex(/^\d{1,3}[A-Z]?$/)
    .optional()
    .catch(undefined),
  period: z
    .enum(PERIODS.map((p) => p.value) as [Period, ...Period[]])
    .catch(DEFAULT_PERIOD),
  from: yearMonth.optional().catch(undefined),
  to: yearMonth.optional().catch(undefined),
  cancelled: z
    .literal("1")
    .optional()
    .catch(undefined)
    .transform((v) => v === "1"),
});

export type ApartmentParams = z.infer<typeof schema>;

export function parseApartmentParams(
  raw: Record<string, string | string[] | undefined>,
): ApartmentParams {
  const first = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] : v;
  const parsed = schema.parse({
    type: first(raw.type),
    period: first(raw.period) ?? DEFAULT_PERIOD,
    from: first(raw.from),
    to: first(raw.to),
    cancelled: first(raw.cancelled),
  });
  // brush 범위가 뒤집혀 있으면 무시한다
  if (parsed.from && parsed.to && parsed.from > parsed.to) {
    return { ...parsed, from: undefined, to: undefined };
  }
  return parsed;
}

/** 기간 프리셋의 시작일 (YYYY-MM-01). "전체"는 데이터 시작 이전 날짜. */
export function periodStartDate(period: Period, today: Date): string {
  const preset = PERIODS.find((p) => p.value === period)!;
  if (preset.years === null) return "2000-01-01";
  const year = today.getFullYear() - preset.years;
  const month = String(today.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
}
