// 공통 UI class. Server Component에서도 쓰므로 "use client" 모듈과 분리한다.

// 페이지 탭(링크). 현재 탭은 aria-current="page"
export const tabListClass = "flex gap-1 border-b border-border";
export const tabItemClass =
  "-mb-px inline-flex h-10 items-center border-b-2 border-transparent px-3 text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring aria-[current=page]:border-foreground aria-[current=page]:font-semibold aria-[current=page]:text-foreground";

// 선택 가능한 둥근 칩(지역 칩, 면적 타입)
export const pillClass =
  "inline-flex h-8 items-center gap-1 rounded-full border border-border bg-card px-3 text-sm whitespace-nowrap outline-none transition-colors hover:border-foreground/40 focus-visible:ring-2 focus-visible:ring-ring aria-[current=page]:border-foreground aria-[current=page]:bg-foreground aria-[current=page]:text-background";

// 세그먼트 컨트롤 (Segmented 컴포넌트 · 링크 세그먼트 공용)
export const segmentRootClass =
  "inline-flex items-center gap-0.5 rounded-lg bg-muted p-0.5";
export const segmentItemClass =
  "inline-flex h-7 items-center rounded-md px-2.5 text-[13px] whitespace-nowrap text-muted-foreground outline-none transition-colors select-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-pressed:bg-card data-pressed:font-medium data-pressed:text-foreground data-pressed:shadow-xs aria-[current=page]:bg-card aria-[current=page]:font-medium aria-[current=page]:text-foreground aria-[current=page]:shadow-xs";
