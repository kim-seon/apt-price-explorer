import { describe, expect, it } from "vitest";
import {
  DEFAULT_COMPLEX_SORT,
  parseComplexListParams,
  serializeComplexSort,
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
