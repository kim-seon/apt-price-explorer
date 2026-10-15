// 국토교통부 아파트 매매 실거래가 상세 자료 응답 파싱 / 검증.
// 응답 형식 실측: docs/04-data-research.md

import { XMLParser } from "fast-xml-parser";
import { z } from "zod";

const parser = new XMLParser({
  // "0172", "11440-17" 같은 값이 숫자로 바뀌지 않도록 모든 값을 문자열로 받는다.
  parseTagValue: false,
  trimValues: true,
  isArray: (name) => name === "item",
});

export class MolitApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(`MOLIT API error ${code}: ${message}`);
  }
}

/** 일일 호출 한도 초과. 재시도하지 않고 실행을 멈춘다. */
export class MolitQuotaError extends MolitApiError {}

type PageEnvelope = { totalCount: number; items: Record<string, string>[] };

export function parsePage(xml: string): PageEnvelope {
  if (/LIMITED_NUMBER_OF_SERVICE_REQUESTS|rate limit/i.test(xml)) {
    throw new MolitQuotaError("22", "daily request limit exceeded");
  }
  const doc = parser.parse(xml);

  // 게이트웨이 단 오류 (인증키 미등록 등)
  const gateway = doc?.OpenAPI_ServiceResponse?.cmmMsgHeader;
  if (gateway) {
    throw new MolitApiError(
      String(gateway.returnReasonCode ?? "?"),
      String(gateway.returnAuthMsg ?? gateway.errMsg ?? "unknown"),
    );
  }

  const header = doc?.response?.header;
  if (!header) throw new MolitApiError("?", "unexpected response shape");
  if (header.resultCode !== "000") {
    throw new MolitApiError(
      String(header.resultCode),
      String(header.resultMsg ?? ""),
    );
  }

  const body = doc.response.body ?? {};
  const totalCount = Number(body.totalCount ?? 0);
  if (!Number.isInteger(totalCount) || totalCount < 0) {
    throw new MolitApiError("?", `invalid totalCount: ${body.totalCount}`);
  }
  const items: Record<string, string>[] = body.items?.item ?? [];
  return { totalCount, items };
}

/** 빈 값은 " "(공백 한 칸)으로 오고 trim 후 ""가 된다 → null */
const optionalText = z
  .string()
  .optional()
  .transform((v) => (v ? v : null));

/** "24.12.20" → "2024-12-20" */
const shortDate = optionalText.refine(
  (v) => v === null || /^\d{2}\.\d{2}\.\d{2}$/.test(v),
  {
    message: "expected YY.MM.DD",
  },
);
function toIsoDate(short: string | null) {
  if (!short) return null;
  const [yy, mm, dd] = short.split(".");
  return `20${yy}-${mm}-${dd}`;
}

const rawItemSchema = z.object({
  sggCd: z.string().regex(/^\d{5}$/),
  umdCd: z.string().regex(/^\d{5}$/),
  umdNm: z.string().min(1),
  aptSeq: z.string().regex(/^\d{5}-\d+$/),
  aptNm: z.string().min(1),
  jibun: optionalText,
  buildYear: optionalText.refine((v) => v === null || /^\d{4}$/.test(v)),
  dealYear: z.string().regex(/^\d{4}$/),
  dealMonth: z.string().regex(/^\d{1,2}$/),
  dealDay: z.string().regex(/^\d{1,2}$/),
  dealAmount: z.string().regex(/^\d{1,3}(,\d{3})*$/),
  excluUseAr: z.string().regex(/^\d+(\.\d+)?$/),
  floor: optionalText.refine((v) => v === null || /^-?\d+$/.test(v)),
  cdealType: optionalText,
  cdealDay: shortDate,
  dealingGbn: optionalText,
  rgstDate: shortDate,
  aptDong: optionalText,
});

export type TransactionRow = {
  sggCode: string;
  umdCode: string;
  umdName: string;
  aptSeq: string;
  aptName: string;
  jibun: string | null;
  buildYear: number | null;
  dealDate: string;
  price: number;
  area: number;
  floor: number | null;
  cancelled: boolean;
  cancelDate: string | null;
  dealType: string | null;
  registeredDate: string | null;
  aptDong: string | null;
};

export type ParseResult = {
  rows: TransactionRow[];
  invalid: { index: number; reason: string }[];
};

/**
 * 파티션(시군구 × 계약년월)의 item들을 검증·정규화한다.
 * 요청한 파티션과 시군구/계약월이 다른 행은 invalid로 분류한다 — 파티션 교체 시 지워지지 않는 행이 생기는 것을 막기 위해.
 */
export function normalizeItems(
  items: Record<string, string>[],
  partition: { sggCode: string; dealYm: string },
): ParseResult {
  const rows: TransactionRow[] = [];
  const invalid: ParseResult["invalid"] = [];

  items.forEach((item, index) => {
    const parsed = rawItemSchema.safeParse(item);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      invalid.push({
        index,
        reason: `${issue.path.join(".")}: ${issue.message}`,
      });
      return;
    }
    const r = parsed.data;
    const month = r.dealMonth.padStart(2, "0");
    const day = r.dealDay.padStart(2, "0");
    if (
      r.sggCd !== partition.sggCode ||
      `${r.dealYear}${month}` !== partition.dealYm
    ) {
      invalid.push({
        index,
        reason: `partition mismatch: ${r.sggCd} ${r.dealYear}${month}`,
      });
      return;
    }
    rows.push({
      sggCode: r.sggCd,
      umdCode: r.umdCd,
      umdName: r.umdNm,
      aptSeq: r.aptSeq,
      aptName: r.aptNm,
      jibun: r.jibun,
      buildYear: r.buildYear === null ? null : Number(r.buildYear),
      dealDate: `${r.dealYear}-${month}-${day}`,
      price: Number(r.dealAmount.replaceAll(",", "")),
      area: Number(r.excluUseAr),
      floor: r.floor === null ? null : Number(r.floor),
      cancelled: r.cdealType === "O",
      cancelDate: toIsoDate(r.cdealDay),
      dealType: r.dealingGbn,
      registeredDate: toIsoDate(r.rgstDate),
      aptDong: r.aptDong,
    });
  });

  return { rows, invalid };
}
