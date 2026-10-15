// 숫자 표기 규칙 (docs/03-ux-design.md Decisions #4)

const PYEONG_M2 = 3.305785;

/** 만원 단위 가격 → "17억 5,000" / "17억" / "9,500만" */
export function formatPrice(manwon: number): string {
  const eok = Math.floor(manwon / 10000);
  const rest = manwon % 10000;
  if (eok === 0) return `${rest.toLocaleString("ko-KR")}만`;
  if (rest === 0) return `${eok}억`;
  return `${eok}억 ${rest.toLocaleString("ko-KR")}`;
}

/** 전용면적 ㎡ → 평 (소수 1자리) */
export function toPyeong(m2: number): number {
  return Math.round((m2 / PYEONG_M2) * 10) / 10;
}

/** 전용 3.3㎡당 가격 (만원, 정수) */
export function pricePerPyeong(manwon: number, m2: number): number {
  return Math.round(manwon / (m2 / PYEONG_M2));
}

/** "2025-09-14" → "25.09.14" (테이블) */
export function formatShortDate(isoDate: string): string {
  return `${isoDate.slice(2, 4)}.${isoDate.slice(5, 7)}.${isoDate.slice(8, 10)}`;
}

/** "2025-09" → "2025.09" (차트 축) */
export function formatYearMonth(ym: string): string {
  return ym.replace("-", ".");
}

/** 상승률 → "+3.2%" */
export function formatPercent(ratio: number): string {
  const pct = Math.round(ratio * 1000) / 10;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
}
