// 공공데이터 API 호출: 원본 캐시, pagination, retry, 키 마스킹, 호출 예산.
// 원본 응답을 파일로 보관해 파싱 규칙이 바뀌어도 API 재호출 없이 재처리한다 (docs/05 §3).

import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { MolitApiError, MolitQuotaError, parsePage } from "./molit-parse";

const ENDPOINT =
  "http://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev";
const ROWS_PER_PAGE = 1000;
const MAX_ATTEMPTS = 3;
const TIMEOUT_MS = 30_000;

/** 호출 예산 소진. 일일 한도에 닿기 전에 스스로 멈추기 위한 장치. */
export class CallBudgetExhausted extends Error {}

export type FetchedPartition = {
  items: Record<string, string>[];
  /** 원본을 받은 시점 (캐시면 파일 수정 시각) */
  fetchedAt: Date;
  apiCalls: number;
  fetchMs: number;
};

export function createMolitClient(opts: {
  serviceKey: string;
  cacheDir: string;
  maxCalls: number;
  refresh?: boolean;
}) {
  // 포털에서 받은 Encoding 키는 이미 URL 인코딩되어 있으므로 다시 인코딩하지 않는다.
  const encodedKey = opts.serviceKey.includes("%")
    ? opts.serviceKey
    : encodeURIComponent(opts.serviceKey);
  const secrets = [opts.serviceKey, encodedKey, decodeURIComponent(encodedKey)];
  const mask = (text: string) =>
    secrets.reduce((acc, secret) => acc.replaceAll(secret, "<KEY>"), text);

  let callsUsed = 0;

  async function request(
    sggCode: string,
    dealYm: string,
    page: number,
  ): Promise<string> {
    if (callsUsed >= opts.maxCalls)
      throw new CallBudgetExhausted(`budget ${opts.maxCalls} used`);
    const url = `${ENDPOINT}?serviceKey=${encodedKey}&LAWD_CD=${sggCode}&DEAL_YMD=${dealYm}&pageNo=${page}&numOfRows=${ROWS_PER_PAGE}`;

    for (let attempt = 1; ; attempt++) {
      callsUsed++;
      try {
        const res = await fetch(url, {
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        const body = await res.text();
        if (res.status === 429)
          throw new MolitQuotaError("429", "rate limited");
        if (res.status >= 500) throw new Error(`HTTP ${res.status}`);
        parsePage(body); // 성공 응답만 캐시하도록 먼저 검증
        return body;
      } catch (error) {
        // 한도 초과 / 인증 등 API가 명시적으로 거절한 경우는 재시도하지 않는다.
        if (error instanceof MolitApiError || attempt >= MAX_ATTEMPTS) {
          const message = mask(
            error instanceof Error ? error.message : String(error),
          );
          if (error instanceof MolitQuotaError) throw error;
          throw new Error(`${sggCode} ${dealYm} p${page}: ${message}`);
        }
        await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1)));
      }
    }
  }

  async function getPage(sggCode: string, dealYm: string, page: number) {
    const file = path.join(opts.cacheDir, `${sggCode}_${dealYm}_p${page}.xml`);
    if (!opts.refresh) {
      try {
        const [xml, info] = await Promise.all([
          readFile(file, "utf8"),
          stat(file),
        ]);
        return { xml, fetchedAt: info.mtime, fromCache: true };
      } catch {}
    }
    const xml = await request(sggCode, dealYm, page);
    await mkdir(opts.cacheDir, { recursive: true });
    await writeFile(file, xml);
    return { xml, fetchedAt: new Date(), fromCache: false };
  }

  async function fetchPartition(
    sggCode: string,
    dealYm: string,
  ): Promise<FetchedPartition> {
    const started = performance.now();
    const before = callsUsed;
    const first = await getPage(sggCode, dealYm, 1);
    const { totalCount, items } = parsePage(first.xml);
    let fetchedAt = first.fetchedAt;
    const pages = Math.ceil(totalCount / ROWS_PER_PAGE);
    for (let page = 2; page <= pages; page++) {
      const next = await getPage(sggCode, dealYm, page);
      items.push(...parsePage(next.xml).items);
      if (next.fetchedAt < fetchedAt) fetchedAt = next.fetchedAt;
    }
    if (items.length !== totalCount) {
      throw new Error(
        `${sggCode} ${dealYm}: expected ${totalCount} items, got ${items.length} (stale cache?)`,
      );
    }
    return {
      items,
      fetchedAt,
      apiCalls: callsUsed - before,
      fetchMs: performance.now() - started,
    };
  }

  return { fetchPartition, callsUsed: () => callsUsed, mask };
}
