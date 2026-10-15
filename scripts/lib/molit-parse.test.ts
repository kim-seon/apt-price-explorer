import { describe, expect, it } from "vitest";
import {
  MolitApiError,
  MolitQuotaError,
  normalizeItems,
  parsePage,
} from "./molit-parse";

// 실제 응답 형식(docs/04-data-research.md)을 축약한 픽스처
const item = (overrides: Record<string, string> = {}) => {
  const fields: Record<string, string> = {
    aptDong: " ",
    aptNm: "우성",
    aptSeq: "11440-17",
    bonbun: "0082",
    buildYear: "1991",
    cdealDay: " ",
    cdealType: " ",
    dealAmount: "157,000",
    dealDay: "30",
    dealMonth: "9",
    dealYear: "2024",
    dealingGbn: "중개거래",
    excluUseAr: "128.315",
    floor: "10",
    jibun: "82",
    rgstDate: "25.01.31",
    sggCd: "11440",
    umdCd: "10300",
    umdNm: "신공덕동",
    ...overrides,
  };
  return `<item>${Object.entries(fields)
    .map(([k, v]) => `<${k}>${v}</${k}>`)
    .join("")}</item>`;
};

const page = (items: string[], totalCount = items.length) =>
  `<?xml version="1.0" encoding="utf-8" standalone="yes"?><response><header><resultCode>000</resultCode><resultMsg>OK</resultMsg></header><body><items>${items.join("")}</items><numOfRows>1000</numOfRows><pageNo>1</pageNo><totalCount>${totalCount}</totalCount></body></response>`;

const partition = { sggCode: "11440", dealYm: "202409" };

describe("parsePage", () => {
  it("item이 1건이어도 배열로 받고, 값을 문자열로 유지한다", () => {
    const { totalCount, items } = parsePage(page([item()]));
    expect(totalCount).toBe(1);
    expect(items).toHaveLength(1);
    expect(items[0].bonbun).toBe("0082");
    expect(items[0].aptSeq).toBe("11440-17");
  });

  it("거래가 없는 월은 빈 배열", () => {
    const empty = `<response><header><resultCode>000</resultCode><resultMsg>OK</resultMsg></header><body><items></items><totalCount>0</totalCount></body></response>`;
    expect(parsePage(empty)).toEqual({ totalCount: 0, items: [] });
  });

  it("게이트웨이 오류와 결과 코드 오류를 구분해 던진다", () => {
    const gateway = `<OpenAPI_ServiceResponse><cmmMsgHeader><errMsg>SERVICE ERROR</errMsg><returnAuthMsg>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</returnAuthMsg><returnReasonCode>30</returnReasonCode></cmmMsgHeader></OpenAPI_ServiceResponse>`;
    expect(() => parsePage(gateway)).toThrow(MolitApiError);
    const bad = `<response><header><resultCode>03</resultCode><resultMsg>NO_DATA</resultMsg></header></response>`;
    expect(() => parsePage(bad)).toThrow(/03/);
  });

  it("호출 한도 초과는 별도 오류로 던진다", () => {
    const quota = `<OpenAPI_ServiceResponse><cmmMsgHeader><returnAuthMsg>LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR</returnAuthMsg><returnReasonCode>22</returnReasonCode></cmmMsgHeader></OpenAPI_ServiceResponse>`;
    expect(() => parsePage(quota)).toThrow(MolitQuotaError);
  });
});

describe("normalizeItems", () => {
  it("금액 콤마, 월/일 자리수, 공백 빈 값, YY.MM.DD 날짜를 정규화한다", () => {
    const { items } = parsePage(page([item()]));
    const { rows, invalid } = normalizeItems(items, partition);
    expect(invalid).toEqual([]);
    expect(rows[0]).toEqual({
      sggCode: "11440",
      umdCode: "10300",
      umdName: "신공덕동",
      aptSeq: "11440-17",
      aptName: "우성",
      jibun: "82",
      buildYear: 1991,
      dealDate: "2024-09-30",
      price: 157000,
      area: 128.315,
      floor: 10,
      cancelled: false,
      cancelDate: null,
      dealType: "중개거래",
      registeredDate: "2025-01-31",
      aptDong: null,
    });
  });

  it("해제 거래와 지하층을 처리한다", () => {
    const { items } = parsePage(
      page([
        item({
          cdealType: "O",
          cdealDay: "24.10.05",
          floor: "-1",
          dealDay: "2",
        }),
      ]),
    );
    const [row] = normalizeItems(items, partition).rows;
    expect(row).toMatchObject({
      cancelled: true,
      cancelDate: "2024-10-05",
      floor: -1,
      dealDate: "2024-09-02",
    });
  });

  it("형식이 잘못된 행과 다른 파티션의 행은 invalid로 분리한다", () => {
    const { items } = parsePage(
      page([item(), item({ dealAmount: "abc" }), item({ dealMonth: "8" })]),
    );
    const { rows, invalid } = normalizeItems(items, partition);
    expect(rows).toHaveLength(1);
    expect(invalid.map((i) => i.index)).toEqual([1, 2]);
    expect(invalid[1].reason).toMatch(/partition mismatch/);
  });
});
