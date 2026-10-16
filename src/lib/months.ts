/** 시작~끝 월을 빠짐없이 나열한다. 차트에서 거래가 없는 달을 null로 채워 선을 끊는 데 쓴다. */
export function monthSequence(from: string, to: string): string[] {
  const out: string[] = [];
  let [y, m] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    if (++m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}
