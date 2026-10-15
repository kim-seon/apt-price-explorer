import { describe, expect, it } from "vitest";
import { querySggCodes } from "./regions";

const rows = (...codes: string[]) =>
  codes.map((sggCode) => ({ sggCode, sggName: sggCode }));

describe("querySggCodes", () => {
  it("일반구가 있는 시의 상위 코드는 제외하고 일반구를 남긴다", () => {
    expect(querySggCodes(rows("41110", "41111", "41113", "41150"))).toEqual([
      "41111",
      "41113",
      "41150",
    ]);
  });

  it("앞 3자리만 같은 서울 구들은 서로 영향을 주지 않는다", () => {
    expect(querySggCodes(rows("11110", "11140", "11170"))).toEqual([
      "11110",
      "11140",
      "11170",
    ]);
  });
});
