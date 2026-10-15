import { describe, expect, it } from "vitest";
import { escapeLike, normalizeSearchQuery } from "./search-query";

describe("normalizeSearchQuery", () => {
  it("띄어쓰기를 무시한다", () => {
    expect(normalizeSearchQuery(" 마포 래미안 ")).toBe("마포래미안");
  });

  it("IME 조합 중 끝에 남은 미완성 자모를 뗀다", () => {
    expect(normalizeSearchQuery("래미ㅇ")).toBe("래미");
    expect(normalizeSearchQuery("ㄹ")).toBe("");
    expect(normalizeSearchQuery("헬리오ㅅㅣ")).toBe("헬리오");
  });

  it("완성된 글자 사이의 자모는 남긴다 (끝만 처리)", () => {
    expect(normalizeSearchQuery("ㅎ래미안")).toBe("ㅎ래미안");
  });

  it("최대 길이로 자른다", () => {
    expect(normalizeSearchQuery("가".repeat(40))).toHaveLength(30);
  });
});

describe("escapeLike", () => {
  it("LIKE 특수문자를 이스케이프한다", () => {
    expect(escapeLike("100%_a\\b")).toBe("100\\%\\_a\\\\b");
  });
});
