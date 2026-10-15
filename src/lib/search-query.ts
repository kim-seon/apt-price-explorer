// 단지명 검색어 정규화 (docs/08 M4)
//
// - 띄어쓰기 무시: "마포 래미안" = "마포래미안" (DB 쪽도 공백을 제거하고 비교한다)
// - 한글 IME 조합 중 끝에 남는 미완성 자모 제거: "래미ㅇ" → "래미"
//   조합 중에도 결과를 갱신하되, 자모 한 글자로 의미 없는 요청을 보내지 않기 위해서다.

export const SEARCH_MAX_LENGTH = 30;

/** 한글 호환 자모(ㄱ~ㅣ) 범위 */
const TRAILING_JAMO = /[ㄱ-ㆎ]+$/;

export function normalizeSearchQuery(input: string): string {
  return input
    .normalize("NFC")
    .replace(/\s+/g, "")
    .replace(TRAILING_JAMO, "")
    .slice(0, SEARCH_MAX_LENGTH);
}

/** LIKE 패턴의 특수문자(%, _, \)를 이스케이프한다 */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}
