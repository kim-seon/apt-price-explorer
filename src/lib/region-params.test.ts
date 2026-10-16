import { describe, expect, it } from "vitest";
import {
  DEFAULT_COMPLEX_SORT,
  parseComplexListParams,
  parseTradeFilters,
  serializeComplexSort,
  serializeTradeFilters,
  tradePeriodStart,
} from "./region-params";

describe("parseComplexListParams", () => {
  it("법정동과 정렬을 읽는다", () => {
    expect(
      parseComplexListParams({ dong: "잠실동", sort: "perPyeong.asc" }),
    ).toEqual({ dong: "잠실동", sort: { key: "perPyeong", desc: false } });
  });

  it("잘못된 정렬은 기본값으로 대체한다", () => {
    for (const sort of ["price.desc", "name", "name.up", ""]) {
      expect(parseComplexListParams({ sort }).sort).toEqual(
        DEFAULT_COMPLEX_SORT,
      );
    }
  });

  it("빈 법정동은 전체로 본다", () => {
    expect(parseComplexListParams({ dong: "  " }).dong).toBeUndefined();
  });
});

describe("serializeComplexSort", () => {
  it("기본 정렬은 URL에 남기지 않는다", () => {
    expect(serializeComplexSort(DEFAULT_COMPLEX_SORT)).toBeNull();
    expect(serializeComplexSort({ key: "name", desc: false })).toBe("name.asc");
  });
});

describe("parseTradeFilters", () => {
  it("기본값", () => {
    expect(parseTradeFilters({})).toEqual({
      period: "3y",
      area: undefined,
      priceMin: undefined,
      priceMax: undefined,
      cancelled: false,
      sort: { key: "dealDate", desc: true },
      dong: undefined,
    });
  });

  it("URLSearchParams와 객체를 같은 결과로 읽는다", () => {
    const qs =
      "dong=잠실동&period=all&area=60-85&priceMin=50000&cancelled=1&sort=price.asc";
    const fromQs = parseTradeFilters(new URLSearchParams(qs));
    expect(fromQs).toEqual(
      parseTradeFilters(Object.fromEntries(new URLSearchParams(qs))),
    );
    expect(fromQs).toMatchObject({
      dong: "잠실동",
      period: "all",
      area: "60-85",
      priceMin: 50000,
      cancelled: true,
      sort: { key: "price", desc: false },
    });
  });

  it("잘못된 값은 기본값으로, 뒤집힌 가격 범위는 바꿔서 읽는다", () => {
    const f = parseTradeFilters({
      period: "2y",
      area: "84",
      priceMin: "90000",
      priceMax: "30000",
      sort: "id.desc",
    });
    expect(f).toMatchObject({
      period: "3y",
      area: undefined,
      priceMin: 30000,
      priceMax: 90000,
      sort: { key: "dealDate", desc: true },
    });
    expect(parseTradeFilters({ priceMin: "-1" }).priceMin).toBeUndefined();
  });

  it("직렬화 → 파싱이 같은 필터를 돌려준다 (기본값은 URL에서 생략)", () => {
    const f = parseTradeFilters({ area: "gt135", sort: "perPyeong.desc" });
    const qs = serializeTradeFilters(f);
    expect(qs.toString()).toBe("area=gt135&sort=perPyeong.desc");
    expect(parseTradeFilters(qs)).toEqual(f);
    expect(serializeTradeFilters(parseTradeFilters({})).toString()).toBe("");
  });
});

describe("tradePeriodStart", () => {
  it("프리셋 연수만큼 이전 날짜, 전체는 null", () => {
    const today = new Date("2026-10-17T00:00:00Z");
    expect(tradePeriodStart("3y", today)).toBe("2023-10-17");
    expect(tradePeriodStart("all", today)).toBeNull();
  });
});
