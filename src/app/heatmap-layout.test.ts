import { describe, expect, it } from "vitest";
import {
  computeLayout,
  heatmapHeight,
  hitTest,
  monthLabel,
  NEUTRAL_COLOR,
  NO_BASELINE_COLOR,
  ratioColor,
  ratioOf,
  RATIO_PIECES,
  selectView,
  trailingBaseline,
} from "./heatmap-layout";

describe("trailingBaseline", () => {
  it("직전 개월 평균(그달 제외), 이력 12개월 미만이면 null", () => {
    const counts = Array.from({ length: 14 }, (_, i) => i + 1); // 1..14
    const b = trailingBaseline(counts);
    expect(b.slice(0, 12)).toEqual(Array(12).fill(null));
    expect(b[12]).toBeCloseTo((1 + 12) / 2); // 1..12 평균
    expect(b[13]).toBeCloseTo((1 + 13) / 2); // 1..13 평균
  });

  it("60개월을 넘으면 창이 밀린다", () => {
    const counts = [...Array(60).fill(10), ...Array(60).fill(20), 0];
    const b = trailingBaseline(counts);
    expect(b[60]).toBeCloseTo(10);
    expect(b[120]).toBeCloseTo(20);
  });
});

describe("ratioColor", () => {
  it("평소 ±10%는 회색, 배율이 대칭인 경계에서 단계가 바뀐다", () => {
    expect(ratioColor(null)).toBe(NO_BASELINE_COLOR);
    expect(ratioColor(1)).toBe(NEUTRAL_COLOR);
    expect(ratioColor(0.9)).toBe(NEUTRAL_COLOR);
    expect(ratioColor(0.89)).toBe(RATIO_PIECES[2].color);
    expect(ratioColor(0.49)).toBe(RATIO_PIECES[0].color);
    expect(ratioColor(1.1)).toBe(RATIO_PIECES[4].color);
    expect(ratioColor(2)).toBe(RATIO_PIECES[6].color);
  });

  it("평소가 0이면 비교하지 않는다", () => {
    expect(ratioOf(5, 0)).toBeNull();
    expect(ratioOf(15, 10)).toBe(1.5);
  });
});

describe("hitTest", () => {
  const l = computeLayout(104 + 36 * 20, 36, 25, false);

  it("칸 좌표를 행 · 월로 바꾼다", () => {
    expect(hitTest(104, 0, l)).toEqual({ row: 0, month: 0 });
    expect(hitTest(104 + 20 * 10 + 1, 18 * 3 + 2, l)).toEqual({
      row: 3,
      month: 10,
    });
    expect(hitTest(l.width - 1, 18 * 24 + 1, l)).toEqual({
      row: 24,
      month: 35,
    });
  });

  it("이름 열은 행 전체, 바깥은 null", () => {
    expect(hitTest(10, 18 * 5, l)).toEqual({ row: 5, month: null });
    expect(hitTest(200, 18 * 25, l)).toBeNull();
    expect(hitTest(-1, 0, l)).toBeNull();
    expect(l.height).toBe(heatmapHeight(25));
  });
});

describe("selectView / monthLabel", () => {
  const data = {
    months: ["2026-07", "2026-08", "2026-09", "2026-10"],
    regions: [
      { code: "11710", name: "송파구", sido: "서울특별시" },
      { code: "28110", name: "중구", sido: "인천광역시" },
    ],
    counts: [
      [1, 2, 3, 4],
      [5, 6, 7, 8],
    ],
  };
  const baselines = [
    [null, 1, 1.5, 2],
    [null, 5, 5.5, 6],
  ];

  it("시도로 행을, 기간으로 열을 자르고 최근 2개월을 집계 중으로 표시한다", () => {
    const view = selectView(data, baselines, "인천광역시", "3y");
    expect(view.regions.map((r) => r.name)).toEqual(["중구"]);
    expect(view.counts).toEqual([[5, 6, 7, 8]]);
    expect(view.baselines).toEqual([[null, 5, 5.5, 6]]);
    expect(view.provisionalFrom).toBe(2);
  });

  it("기간별 라벨 간격", () => {
    expect(monthLabel("2026-07", "3y")).toBe("26.07");
    expect(monthLabel("2026-08", "3y")).toBeNull();
    expect(monthLabel("2025-01", "10y")).toBe("2025");
    expect(monthLabel("2025-01", "all")).toBeNull();
    expect(monthLabel("2024-01", "all")).toBe("2024");
  });
});
