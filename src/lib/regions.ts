export type SggRow = { sggCode: string; sggName: string };

/**
 * 실거래 API 조회 대상 시군구 코드.
 * 일반구가 있는 시(예: 41110 수원시)는 상위 코드로 조회하면 0건이므로 제외하고 일반구 코드만 쓴다.
 * 판별: 끝자리가 0이고, 앞 4자리가 같은 다른 시군구 코드가 존재하면 상위 시 코드다.
 */
export function querySggCodes(rows: SggRow[]): string[] {
  const codes = rows.map((r) => r.sggCode);
  return codes
    .filter(
      (code) =>
        !(
          code.endsWith("0") &&
          codes.some((c) => c !== code && c.startsWith(code.slice(0, 4)))
        ),
    )
    .sort();
}

/** "수원시장안구" → "수원시 장안구" (일반구는 시 이름과 붙어서 저장되어 있다) */
export function displaySggName(sggName: string): string {
  return sggName.replace(/^(.+시)(.+구)$/, "$1 $2");
}
