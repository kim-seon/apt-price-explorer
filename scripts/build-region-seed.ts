// 법정동 원본 CSV → 수도권 시드(seed/regions-capital-area.csv)
//
// 원본: 공공데이터포털 "국토교통부_전국 법정동" (https://www.data.go.kr/data/15063424/fileData.do)
//   매월 갱신되며 다운로드 URL이 바뀌므로, 원본을 받아 이 스크립트로 시드를 다시 만든다.
// 사용: pnpm seed:regions <원본 CSV 경로>

import { readFile, writeFile } from "node:fs/promises";

const CAPITAL_AREA = ["11", "28", "41"]; // 서울, 인천, 경기
const OUT = "seed/regions-capital-area.csv";

function parseCsvLine(line: string) {
  // 원본은 따옴표 없는 단순 CSV
  return line.split(",").map((v) => v.trim());
}

async function main() {
  const src = process.argv[2];
  if (!src) throw new Error("usage: pnpm seed:regions <법정동 CSV 경로>");

  const lines = (await readFile(src, "utf8"))
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .filter(Boolean);
  const header = parseCsvLine(lines[0]);
  const expected = [
    "법정동코드",
    "시도명",
    "시군구명",
    "읍면동명",
    "리명",
    "순번",
    "생성일자",
  ];
  if (expected.some((col, i) => header[i] !== col)) {
    throw new Error(`unexpected header: ${header.join(",")}`);
  }

  const out = ["code,sgg_code,level,sido_name,sgg_name,umd_name"];
  let sgg = 0;
  let umd = 0;
  for (const line of lines.slice(1)) {
    const [code, sido, sggName, umdName, riName] = parseCsvLine(line);
    if (!CAPITAL_AREA.includes(code.slice(0, 2)) || !sggName || riName)
      continue;
    if (code.endsWith("00000") && !umdName) {
      out.push([code, code.slice(0, 5), "sgg", sido, sggName, ""].join(","));
      sgg++;
    } else if (code.endsWith("00") && umdName) {
      out.push(
        [code, code.slice(0, 5), "umd", sido, sggName, umdName].join(","),
      );
      umd++;
    }
  }

  await writeFile(OUT, out.join("\n") + "\n");
  console.log(`wrote ${OUT}: ${sgg} sgg, ${umd} umd`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
