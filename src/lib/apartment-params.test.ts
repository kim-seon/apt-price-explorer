import { describe, expect, it } from "vitest";
import { parseApartmentParams, periodStartDate } from "./apartment-params";

describe("parseApartmentParams", () => {
  it("기본값: 기간 5년, 해제 거래 숨김", () => {
    expect(parseApartmentParams({})).toEqual({
      type: undefined,
      period: "5y",
      from: undefined,
      to: undefined,
      cancelled: false,
    });
  });

  it("정상 값을 그대로 받는다", () => {
    expect(
      parseApartmentParams({
        type: "59A",
        period: "10y",
        from: "2021-03",
        to: "2024-05",
        cancelled: "1",
      }),
    ).toEqual({
      type: "59A",
      period: "10y",
      from: "2021-03",
      to: "2024-05",
      cancelled: true,
    });
  });

  it("잘못된 값은 오류 없이 기본값으로 대체한다", () => {
    expect(
      parseApartmentParams({
        type: "<script>",
        period: "99y",
        from: "2021-13",
        cancelled: "yes",
      }),
    ).toEqual({
      type: undefined,
      period: "5y",
      from: undefined,
      to: undefined,
      cancelled: false,
    });
  });

  it("뒤집힌 brush 범위는 무시하고, 배열 값은 첫 번째만 쓴다", () => {
    const parsed = parseApartmentParams({
      from: "2024-05",
      to: "2021-03",
      period: ["3y", "1y"],
    });
    expect(parsed).toMatchObject({
      from: undefined,
      to: undefined,
      period: "3y",
    });
  });
});

describe("periodStartDate", () => {
  const today = new Date(2026, 9, 15); // 2026-10-15
  it("프리셋 연수만큼 이전 달의 1일", () => {
    expect(periodStartDate("5y", today)).toBe("2021-10-01");
    expect(periodStartDate("1y", today)).toBe("2025-10-01");
  });
  it("전체는 데이터 시작 이전", () => {
    expect(periodStartDate("all", today)).toBe("2000-01-01");
  });
});
