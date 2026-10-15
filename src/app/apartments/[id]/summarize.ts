import { pricePerPyeong } from "@/lib/format";
import type { Trade } from "@/server/queries/apartment-detail";

// brush 범위 필터링과 요약 카드 계산. 단지 하나·타입 하나의 거래(수천 건 이하)만 다룬다 (docs/decisions/0005).

export type MonthRange = { from: string; to: string };

export function filterByRange(
  trades: Trade[],
  range: MonthRange | null,
): Trade[] {
  if (!range) return trades;
  return trades.filter((t) => {
    const month = t.dealDate.slice(0, 7);
    return month >= range.from && month <= range.to;
  });
}

export type Summary = {
  count: number;
  latest: Trade | null;
  highest: Trade | null;
  /** 전용 3.3㎡당 가격의 중위값 (만원) */
  medianPerPyeong: number | null;
};

/** 해제 거래는 요약에서 제외한다. trades는 계약일 내림차순. */
export function summarize(trades: Trade[]): Summary {
  const valid = trades.filter((t) => !t.cancelled);
  if (valid.length === 0) {
    return { count: 0, latest: null, highest: null, medianPerPyeong: null };
  }
  const highest = valid.reduce((best, t) => (t.price > best.price ? t : best));
  const perPyeong = valid
    .map((t) => pricePerPyeong(t.price, t.area))
    .sort((a, b) => a - b);
  const mid = Math.floor(perPyeong.length / 2);
  const median =
    perPyeong.length % 2
      ? perPyeong[mid]
      : Math.round((perPyeong[mid - 1] + perPyeong[mid]) / 2);
  return {
    count: valid.length,
    latest: valid[0],
    highest,
    medianPerPyeong: median,
  };
}

/** ECharts dataZoom 값(ms) → 월 범위. 전체 구간이면 null(선택 없음). */
export function zoomToRange(
  startMs: number,
  endMs: number,
  bounds: MonthRange,
): MonthRange | null {
  const toMonth = (ms: number) => {
    const d = new Date(ms);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };
  const from = toMonth(startMs) < bounds.from ? bounds.from : toMonth(startMs);
  const to = toMonth(endMs) > bounds.to ? bounds.to : toMonth(endMs);
  if (from <= bounds.from && to >= bounds.to) return null;
  return { from, to };
}
