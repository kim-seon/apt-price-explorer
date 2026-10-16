"use client";

import type { ReactNode } from "react";
import { FilterChip, ToggleChip } from "@/components/ui/filter-chip";
import { Segmented } from "@/components/ui/segmented";
import { formatPrice } from "@/lib/format";
import {
  AREA_BANDS,
  DEFAULT_TRADE_FILTERS,
  TRADE_PERIODS,
  type AreaBand,
  type TradeFilters,
} from "@/lib/region-params";

// 필터 적용 시점 (docs/03 Decisions 2): 기간 · 면적 · 해제 토글은 고르는 즉시, 가격 직접 입력은 Enter / blur.
// "적용" 버튼은 없다. 칩은 항상 현재 값을 보여주고, 기본값이 아니면 ✕로 바로 해제한다.

const ALL = "all";

export function FilterBar({
  filters,
  onChange,
  summary,
}: {
  filters: TradeFilters;
  onChange: (next: TradeFilters) => void;
  summary: ReactNode;
}) {
  const period = TRADE_PERIODS.find((p) => p.value === filters.period)!;
  const area = AREA_BANDS.find((a) => a.value === filters.area);
  const priceActive =
    filters.priceMin !== undefined || filters.priceMax !== undefined;

  return (
    <div className="sticky top-0 z-10 -mx-4 border-b border-border bg-background/95 px-4 py-2.5 backdrop-blur sm:-mx-6 sm:px-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {/* 모바일에서는 한 줄로 두고 가로로 넘긴다 */}
        <div
          role="group"
          aria-label="거래 필터"
          className="-mx-4 flex min-w-0 flex-1 gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
        >
          <FilterChip
            label="기간"
            value={period.label}
            active={filters.period !== DEFAULT_TRADE_FILTERS.period}
            onClear={() =>
              onChange({ ...filters, period: DEFAULT_TRADE_FILTERS.period })
            }
          >
            {(close, mobile) => (
              <Segmented
                size={mobile ? "lg" : "default"}
                label="기간"
                value={filters.period}
                options={TRADE_PERIODS}
                onChange={(value) => {
                  onChange({ ...filters, period: value });
                  close();
                }}
              />
            )}
          </FilterChip>

          <FilterChip
            label="전용"
            value={area?.label ?? "전체"}
            active={area !== undefined}
            onClear={() => onChange({ ...filters, area: undefined })}
          >
            {(close, mobile) => (
              <Segmented
                size={mobile ? "lg" : "default"}
                label="전용면적"
                value={filters.area ?? ALL}
                options={[
                  { value: ALL, label: "전체" },
                  ...AREA_BANDS.map((a) => ({
                    value: a.value,
                    label: a.label,
                  })),
                ]}
                onChange={(value) => {
                  onChange({
                    ...filters,
                    area: value === ALL ? undefined : (value as AreaBand),
                  });
                  close();
                }}
                className={mobile ? "grid grid-cols-3" : "flex-wrap"}
              />
            )}
          </FilterChip>

          <FilterChip
            label="거래가"
            value={priceActive ? priceLabel(filters) : "전체"}
            active={priceActive}
            onClear={() =>
              onChange({ ...filters, priceMin: undefined, priceMax: undefined })
            }
          >
            {(close) => (
              <PriceRange
                filters={filters}
                onChange={onChange}
                onDone={close}
              />
            )}
          </FilterChip>

          <ToggleChip
            label="해제 거래 포함"
            pressed={filters.cancelled}
            onChange={(cancelled) => onChange({ ...filters, cancelled })}
          />
        </div>
        {/* 모바일에서는 칩 아래 줄 오른쪽 */}
        <div className="basis-full text-right sm:ml-auto sm:basis-auto">
          {summary}
        </div>
      </div>
    </div>
  );
}

function priceLabel(f: TradeFilters) {
  const min = f.priceMin !== undefined ? formatPrice(f.priceMin) : "";
  const max = f.priceMax !== undefined ? formatPrice(f.priceMax) : "";
  if (min && max) return `${min} ~ ${max}`;
  return min ? `${min} 이상` : `${max} 이하`;
}

/** 억 단위로 입력받아 만원으로 저장한다. 입력 중에는 요청하지 않고 Enter / blur에 반영 */
function PriceRange({
  filters,
  onChange,
  onDone,
}: {
  filters: TradeFilters;
  onChange: (next: TradeFilters) => void;
  onDone: () => void;
}) {
  const toEok = (manwon: number | undefined) =>
    manwon === undefined ? "" : String(manwon / 10000);
  const parse = (raw: string) => {
    const eok = raw.trim() === "" ? undefined : Number(raw);
    return eok === undefined || !Number.isFinite(eok) || eok < 0
      ? undefined
      : Math.round(eok * 10000);
  };
  const commit = (form: HTMLFormElement) => {
    const data = new FormData(form);
    const priceMin = parse(String(data.get("priceMin") ?? ""));
    const priceMax = parse(String(data.get("priceMax") ?? ""));
    if (priceMin !== filters.priceMin || priceMax !== filters.priceMax) {
      onChange({ ...filters, priceMin, priceMax });
    }
  };
  const inputClass =
    "h-9 w-24 rounded-md border border-input bg-card px-2 text-right text-sm outline-none [appearance:textfield] focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-inner-spin-button]:appearance-none";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        commit(e.currentTarget);
        onDone();
      }}
      onBlur={(e) => {
        // 패널 안에서 입력칸 사이를 옮길 때는 반영하지 않는다
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          commit(e.currentTarget);
        }
      }}
    >
      <div className="flex items-center gap-2">
        <input
          name="priceMin"
          type="number"
          inputMode="decimal"
          min={0}
          step={0.5}
          defaultValue={toEok(filters.priceMin)}
          aria-label="최소 거래가 (억 원)"
          placeholder="최소"
          className={inputClass}
          autoFocus
        />
        <span className="text-muted-foreground">~</span>
        <input
          name="priceMax"
          type="number"
          inputMode="decimal"
          min={0}
          step={0.5}
          defaultValue={toEok(filters.priceMax)}
          aria-label="최대 거래가 (억 원)"
          placeholder="최대"
          className={inputClass}
        />
        <span className="text-sm text-muted-foreground">억</span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Enter로 적용 · 비우면 제한 없음
      </p>
      {/* Enter 제출용. 화면에는 보이지 않는다 */}
      <button type="submit" className="sr-only">
        적용
      </button>
    </form>
  );
}
