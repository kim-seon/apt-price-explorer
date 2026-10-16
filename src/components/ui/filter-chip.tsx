"use client";

import { Drawer } from "@base-ui/react/drawer";
import { Popover } from "@base-ui/react/popover";
import { ChevronDown, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";

// 필터 칩 (docs/03 ②: 적용된 필터는 제거 가능한 칩, 조정은 popover, 모바일은 bottom sheet).
// - 칩에는 항상 현재 값을 보여준다 ("기간 3년"). 기본값이 아니면 강조하고 ✕로 바로 해제한다.
// - 패널 내용은 데스크톱 popover와 모바일 bottom sheet가 공유한다.
// - 즉시 적용 필터는 고르면 패널을 닫는다 (children에 close를 넘긴다).

const chipClass =
  "inline-flex h-8 items-center gap-1 rounded-full border px-3 text-[13px] whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring";

export function FilterChip({
  label,
  value,
  active,
  onClear,
  children,
}: {
  label: string;
  value: string;
  /** 기본값이 아닌 필터가 적용됨 */
  active: boolean;
  onClear?: () => void;
  /** mobile: bottom sheet 안 (터치 대상을 키운다) */
  children: (close: () => void, mobile: boolean) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const mobile = useMediaQuery("(max-width: 639px)");
  const close = () => setOpen(false);

  const trigger = (
    <>
      <span
        className={
          active ? "text-brand-foreground/80" : "text-muted-foreground"
        }
      >
        {label}
      </span>
      <span className="font-medium">{value}</span>
      {!active && <ChevronDown aria-hidden className="size-3.5 opacity-50" />}
    </>
  );
  const triggerClass = cn(
    chipClass,
    active
      ? "rounded-r-none border-r-0 border-brand/30 bg-brand-soft pr-2 text-brand-foreground"
      : "border-border bg-card hover:border-foreground/40",
  );

  return (
    <span className="inline-flex">
      {mobile ? (
        <Drawer.Root open={open} onOpenChange={setOpen}>
          <Drawer.Trigger className={triggerClass}>{trigger}</Drawer.Trigger>
          <Drawer.Portal>
            <Drawer.Backdrop className="fixed inset-0 z-40 bg-black/25 transition-opacity duration-300 data-ending-style:opacity-0 data-starting-style:opacity-0" />
            <Drawer.Viewport className="fixed inset-0 z-50 flex items-end">
              <Drawer.Popup className="w-full rounded-t-xl bg-popover px-4 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] shadow-lg outline-none [transform:translateY(var(--drawer-swipe-movement-y))] transition-transform duration-300 ease-out data-ending-style:[transform:translateY(100%)] data-starting-style:[transform:translateY(100%)]">
                <div
                  aria-hidden
                  className="mx-auto mb-3 h-1 w-10 rounded-full bg-border"
                />
                <Drawer.Content>
                  <Drawer.Title className="mb-3 text-base font-semibold">
                    {label}
                  </Drawer.Title>
                  {children(close, mobile)}
                </Drawer.Content>
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      ) : (
        <Popover.Root open={open} onOpenChange={setOpen}>
          <Popover.Trigger className={triggerClass}>{trigger}</Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner sideOffset={6} align="start" className="z-50">
              <Popover.Popup className="origin-(--transform-origin) rounded-lg border border-border bg-popover p-3 shadow-lg outline-none transition-[scale,opacity] duration-100 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
                <Popover.Title className="sr-only">{label}</Popover.Title>
                {children(close, mobile)}
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      )}
      {active && onClear && (
        <button
          type="button"
          onClick={onClear}
          aria-label={`${label} 필터 해제`}
          className={cn(
            chipClass,
            "rounded-l-none border-l-0 border-brand/30 bg-brand-soft px-2 text-brand-foreground hover:bg-brand/15",
          )}
        >
          <X aria-hidden className="size-3.5" />
        </button>
      )}
    </span>
  );
}

/** 해제 거래 포함처럼 켜고 끄는 필터 */
export function ToggleChip({
  label,
  pressed,
  onChange,
}: {
  label: string;
  pressed: boolean;
  onChange: (pressed: boolean) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={() => onChange(!pressed)}
      className={cn(
        chipClass,
        pressed
          ? "border-brand/30 bg-brand-soft font-medium text-brand-foreground"
          : "border-border bg-card text-muted-foreground hover:border-foreground/40",
      )}
    >
      {label}
    </button>
  );
}
