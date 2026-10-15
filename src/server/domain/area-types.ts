// 면적 타입 그룹핑 규칙. 근거: docs/05-data-structure.md §1
// 단지 하나의 전용면적 값들을 정렬해 인접 값 차이가 GAP 미만이면 같은 타입으로 묶는다.

export const AREA_TYPE_GAP = 0.5;

export type AreaCount = { area: number; count: number };

export type AreaType = {
  /** URL과 화면에 쓰는 라벨. 최빈 면적의 정수부, 겹치면 A/B/C 접미사 (예: "84", "59A") */
  label: string;
  minArea: number;
  maxArea: number;
  areas: number[];
};

export function groupAreaTypes(
  input: AreaCount[],
  gap = AREA_TYPE_GAP,
): AreaType[] {
  const sorted = [...input].sort((a, b) => a.area - b.area);
  const groups: AreaCount[][] = [];
  for (const item of sorted) {
    const current = groups.at(-1);
    const last = current?.at(-1);
    if (current && last && item.area - last.area < gap) current.push(item);
    else groups.push([item]);
  }

  const baseLabels = groups.map((group) => {
    const mostFrequent = group.reduce((best, item) =>
      item.count > best.count ? item : best,
    );
    return String(Math.floor(mostFrequent.area));
  });
  const labelTotals = new Map<string, number>();
  for (const label of baseLabels)
    labelTotals.set(label, (labelTotals.get(label) ?? 0) + 1);

  const seen = new Map<string, number>();
  return groups.map((group, i) => {
    const base = baseLabels[i];
    let label = base;
    if (labelTotals.get(base)! > 1) {
      const n = seen.get(base) ?? 0;
      seen.set(base, n + 1);
      label = base + String.fromCharCode(65 + n);
    }
    return {
      label,
      minArea: group[0].area,
      maxArea: group.at(-1)!.area,
      areas: group.map((g) => g.area),
    };
  });
}
