"use client";

import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import { cn } from "@/lib/utils";
import { segmentItemClass, segmentRootClass } from "./styles";

// 세그먼트 컨트롤: 하나만 고르는 짧은 선택지(기간 프리셋, 면적 구간).
// 링크로 구현하는 곳(서버 재렌더가 필요한 단지 상세 기간)은 styles.ts의 같은 class를 aria-current와 함께 쓴다.

export type SegmentOption<T extends string> = { value: T; label: string };

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
  size = "default",
}: {
  label: string;
  /** 빈 문자열이면 선택 없음 (예: 사용자가 차트 범위를 직접 바꾼 경우) */
  value: T | "";
  options: readonly SegmentOption<T>[];
  onChange: (value: T) => void;
  className?: string;
  /** lg: 터치용 (bottom sheet) — 높이 40px, 너비를 나눠 쓴다 */
  size?: "default" | "lg";
}) {
  return (
    <ToggleGroup
      aria-label={label}
      value={value ? [value] : []}
      // 눌린 항목을 다시 눌러도 선택 해제하지 않는다 (항상 하나 선택)
      onValueChange={(next) => {
        if (next[0]) onChange(next[0] as T);
      }}
      className={cn(
        segmentRootClass,
        size === "lg" && "flex w-full",
        className,
      )}
    >
      {options.map((o) => (
        <Toggle
          key={o.value}
          value={o.value}
          className={cn(
            segmentItemClass,
            size === "lg" && "h-10 flex-1 justify-center text-sm",
          )}
        >
          {o.label}
        </Toggle>
      ))}
    </ToggleGroup>
  );
}
