import { describe, expect, it } from "vitest";
import {
  colorFor,
  computeLayout,
  EMPTY_COLOR,
  HEATMAP_PIECES,
  heatmapHeight,
  hitTest,
  lastMonths,
  monthLabel,
} from "./heatmap-layout";

describe("colorFor", () => {
  it("구간 경계에서 위 구간 색으로 바뀐다", () => {
    expect(colorFor(0)).toBe(EMPTY_COLOR);
    expect(colorFor(1)).toBe(HEATMAP_PIECES[0].color);
    expect(colorFor(49)).toBe(HEATMAP_PIECES[0].color);
    expect(colorFor(50)).toBe(HEATMAP_PIECES[1].color);
    expect(colorFor(3141)).toBe(HEATMAP_PIECES[6].color);
  });
});

describe("hitTest", () => {
  // 서울 2행, 인천 1행 → 인천 행 위에 6px 간격
  const sidos = ["서울특별시", "서울특별시", "인천광역시"];
  const l = computeLayout(96 + 250 * 4, 250, sidos, false);

  it("칸 좌표를 행 · 월로 바꾼다 (시도 간격 포함)", () => {
    expect(hitTest(96, 0, l)).toEqual({ row: 0, month: 0 });
    expect(hitTest(96 + 4 * 10 + 1, 10 + 2, l)).toEqual({ row: 1, month: 10 });
    expect(hitTest(l.width - 1, 26 + 3, l)).toEqual({ row: 2, month: 249 });
  });

  it("이름 열은 행 전체, 시도 사이 간격 · 바깥은 null", () => {
    expect(hitTest(10, 12, l)).toEqual({ row: 1, month: null });
    expect(hitTest(200, 22, l)).toBeNull(); // 20~26px: 간격
    expect(hitTest(200, 36, l)).toBeNull();
    expect(hitTest(-1, 0, l)).toBeNull();
  });

  it("높이: 행 + 간격 + 축", () => {
    expect(l.height).toBe(3 * 10 + 6 + 20);
    expect(heatmapHeight(83, 3)).toBe(83 * 10 + 2 * 6 + 20);
  });
});

describe("lastMonths / monthLabel", () => {
  it("최근 n개월만 남긴다", () => {
    const data = {
      months: ["2026-08", "2026-09", "2026-10"],
      regions: [{ code: "11710", name: "송파구", sido: "서울특별시" }],
      counts: [[1, 2, 3]],
    };
    expect(lastMonths(data, 2)).toMatchObject({
      months: ["2026-09", "2026-10"],
      counts: [[2, 3]],
    });
  });

  it("라벨 간격", () => {
    expect(monthLabel("2024-01", false)).toBe("2024");
    expect(monthLabel("2025-01", false)).toBeNull();
    expect(monthLabel("2026-07", true)).toBe("26.07");
    expect(monthLabel("2026-08", true)).toBeNull();
  });
});
