import { describe, expect, it } from "vitest";
import {
  formatPercent,
  formatPrice,
  formatShortDate,
  formatYearMonth,
  pricePerPyeong,
  toPyeong,
} from "./format";

describe("formatPrice", () => {
  it("억과 만원 단위로 표기한다", () => {
    expect(formatPrice(175000)).toBe("17억 5,000");
    expect(formatPrice(170000)).toBe("17억");
    expect(formatPrice(100500)).toBe("10억 500");
  });

  it("1억 미만은 만원만 표기한다", () => {
    expect(formatPrice(9500)).toBe("9,500만");
  });
});

describe("면적 / 단가", () => {
  it("전용 84.97㎡ ≈ 25.7평", () => {
    expect(toPyeong(84.97)).toBe(25.7);
  });

  it("전용 3.3㎡당 가격", () => {
    // 17억 5,000 / (84.97 / 3.305785) ≈ 6,808만
    expect(pricePerPyeong(175000, 84.97)).toBe(6808);
  });
});

describe("날짜 / 비율", () => {
  it("테이블과 차트 축 형식", () => {
    expect(formatShortDate("2025-09-14")).toBe("25.09.14");
    expect(formatYearMonth("2025-09")).toBe("2025.09");
  });

  it("상승률은 부호와 소수 1자리", () => {
    expect(formatPercent(0.0321)).toBe("+3.2%");
    expect(formatPercent(-0.05)).toBe("-5.0%");
  });
});
