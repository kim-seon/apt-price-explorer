import { describe, expect, it } from "vitest";
import type { Trade } from "@/server/queries/apartment-detail";
import { filterByRange, summarize, zoomToRange } from "./summarize";

const trade = (dealDate: string, price: number, cancelled = false): Trade => ({
  id: Number(dealDate.replaceAll("-", "")),
  dealDate,
  price,
  area: 84.97,
  floor: 10,
  cancelled,
  dealType: null,
  prevHigh: null,
  highAfter: null,
  recordHighRatio: null,
});

// 계약일 내림차순
const trades = [
  trade("2024-06-10", 180000, true),
  trade("2024-05-02", 175000),
  trade("2023-11-20", 160000),
  trade("2022-01-15", 190000),
];

describe("filterByRange", () => {
  it("월 단위 범위 양 끝을 포함한다", () => {
    const result = filterByRange(trades, { from: "2023-11", to: "2024-05" });
    expect(result.map((t) => t.dealDate)).toEqual(["2024-05-02", "2023-11-20"]);
  });
  it("범위가 없으면 전체", () => {
    expect(filterByRange(trades, null)).toHaveLength(4);
  });
});

describe("summarize", () => {
  it("해제 거래를 제외하고 최근 / 최고 / 건수를 계산한다", () => {
    const s = summarize(trades);
    expect(s.count).toBe(3);
    expect(s.latest?.dealDate).toBe("2024-05-02");
    expect(s.highest?.price).toBe(190000);
    expect(s.medianPerPyeong).toBe(6808); // 17억 5,000 / 84.97㎡
  });
  it("유효 거래가 없으면 비어 있는 요약", () => {
    expect(summarize([trades[0]])).toEqual({
      count: 0,
      latest: null,
      highest: null,
      medianPerPyeong: null,
    });
  });
});

describe("zoomToRange", () => {
  const bounds = { from: "2021-10", to: "2026-10" };
  it("전체 구간이면 선택 없음(null)", () => {
    expect(
      zoomToRange(
        new Date(2021, 9, 1).getTime(),
        new Date(2026, 9, 28).getTime(),
        bounds,
      ),
    ).toBeNull();
  });
  it("부분 구간은 월 범위로 변환한다", () => {
    expect(
      zoomToRange(
        new Date(2023, 2, 10).getTime(),
        new Date(2024, 4, 20).getTime(),
        bounds,
      ),
    ).toEqual({
      from: "2023-03",
      to: "2024-05",
    });
  });
});
