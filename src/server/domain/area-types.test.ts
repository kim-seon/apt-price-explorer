import { describe, expect, it } from "vitest";
import { groupAreaTypes } from "./area-types";

const counts = (...pairs: [number, number][]) =>
  pairs.map(([area, count]) => ({ area, count }));

describe("groupAreaTypes", () => {
  it("인접 값 차이가 0.5㎡ 미만이면 같은 타입으로 묶는다 (실데이터 예: 84.86 / 84.87 / 84.95 / 84.96)", () => {
    const types = groupAreaTypes(
      counts([84.95, 30], [84.86, 135], [84.96, 4], [84.87, 14]),
    );
    expect(types).toHaveLength(1);
    expect(types[0]).toMatchObject({
      label: "84",
      minArea: 84.86,
      maxArea: 84.96,
    });
  });

  it("정수 경계를 넘어도 가까우면 묶는다 (floor 규칙이 쪼개던 84.99 / 85.24)", () => {
    const types = groupAreaTypes(counts([84.99, 10], [85.24, 3]));
    expect(types).toHaveLength(1);
    expect(types[0].label).toBe("84");
  });

  it("0.5㎡ 이상 떨어지면 다른 타입이다 (57.88 / 58.71)", () => {
    const types = groupAreaTypes(counts([57.88, 126], [58.71, 387]));
    expect(types.map((t) => t.label)).toEqual(["57", "58"]);
  });

  it("라벨은 최빈 면적의 정수부를 쓴다", () => {
    const types = groupAreaTypes(
      counts([59.52, 163], [59.76, 146], [59.85, 21], [60.1, 300]),
    );
    expect(types).toHaveLength(1);
    expect(types[0].label).toBe("60");
  });

  it("라벨이 겹치면 면적 순서대로 A, B를 붙인다", () => {
    // 59.0과 59.9는 0.5㎡ 이상 떨어져 다른 그룹이지만 정수부가 같다
    const types = groupAreaTypes(counts([59.0, 5], [59.9, 5], [84.9, 5]));
    expect(types.map((t) => t.label)).toEqual(["59A", "59B", "84"]);
  });

  it("단일 면적과 빈 입력을 처리한다", () => {
    expect(groupAreaTypes(counts([50.03, 1190]))).toEqual([
      { label: "50", minArea: 50.03, maxArea: 50.03, areas: [50.03] },
    ]);
    expect(groupAreaTypes([])).toEqual([]);
  });
});
