"use client";

import type { ReactNode } from "react";
import { formatPrice } from "@/lib/format";
import {
  AREA_BANDS,
  TRADE_PERIODS,
  type TradeFilters,
} from "@/lib/region-params";

// 필터 적용 시점 (docs/03 Decisions 2): 기간 · 면적 · 해제 토글은 즉시, 가격 직접 입력은 Enter / blur.
// "적용" 버튼은 없다.

export function FilterBar({
  filters,
  onChange,
  summary,
}: {
  filters: TradeFilters;
  onChange: (next: TradeFilters) => void;
  summary: ReactNode;
}) {
  return (
    <div className="sticky top-0 z-10 -mx-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
      <Segmented
        label="기간"
        options={TRADE_PERIODS.map((p) => ({ value: p.value, label: p.label }))}
        value={filters.period}
        onChange={(period) => onChange({ ...filters, period })}
      />
      <Segmented
        label="전용면적"
        options={[
          { value: undefined, label: "전체" },
          ...AREA_BANDS.map((a) => ({ value: a.value, label: a.label })),
        ]}
        value={filters.area}
        onChange={(area) => onChange({ ...filters, area })}
      />
      <PriceRange filters={filters} onChange={onChange} />
      <label className="flex items-center gap-1.5 text-sm text-neutral-600">
        <input
          type="checkbox"
          checked={filters.cancelled}
          onChange={(e) =>
            onChange({ ...filters, cancelled: e.target.checked })
          }
          className="size-4 accent-neutral-900"
        />
        해제 거래 포함
      </label>
      <div className="ml-auto">{summary}</div>
    </div>
  );
}

function Segmented<T extends string | undefined>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex items-center gap-1">
      <span className="mr-1 text-sm text-neutral-500">{label}</span>
      {options.map((o) => (
        <button
          key={o.label}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className="rounded px-2 py-1 text-sm text-neutral-600 hover:text-neutral-900 aria-pressed:bg-neutral-900 aria-pressed:text-white"
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** 억 단위로 입력받아 만원으로 저장한다. 입력 중에는 요청하지 않고 Enter / blur에 반영 */
function PriceRange({
  filters,
  onChange,
}: {
  filters: TradeFilters;
  onChange: (next: TradeFilters) => void;
}) {
  const toEok = (manwon: number | undefined) =>
    manwon === undefined ? "" : String(manwon / 10000);
  const commit = (field: "priceMin" | "priceMax", raw: string) => {
    const eok = raw.trim() === "" ? undefined : Number(raw);
    const next =
      eok === undefined || !Number.isFinite(eok) || eok < 0
        ? undefined
        : Math.round(eok * 10000);
    if (next !== filters[field]) onChange({ ...filters, [field]: next });
  };
  const input = (field: "priceMin" | "priceMax", label: string) => (
    <input
      // 외부(URL)에서 값이 바뀌면 입력 중이던 내용을 버리고 다시 그린다
      key={`${field}-${filters[field] ?? ""}`}
      type="number"
      inputMode="decimal"
      min={0}
      step={0.5}
      defaultValue={toEok(filters[field])}
      aria-label={`${label} (억 원)`}
      placeholder={label}
      onBlur={(e) => commit(field, e.currentTarget.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit(field, e.currentTarget.value);
      }}
      className="w-16 rounded border border-neutral-300 px-2 py-1 text-right text-sm tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
    />
  );

  const active =
    filters.priceMin !== undefined || filters.priceMax !== undefined;
  return (
    <div role="group" aria-label="거래가" className="flex items-center gap-1">
      <span className="mr-1 text-sm text-neutral-500">거래가</span>
      {input("priceMin", "최소")}
      <span className="text-neutral-400">~</span>
      {input("priceMax", "최대")}
      <span className="text-sm text-neutral-500">억</span>
      {active && (
        <button
          type="button"
          onClick={() =>
            onChange({ ...filters, priceMin: undefined, priceMax: undefined })
          }
          aria-label={`거래가 필터 해제 (${[filters.priceMin, filters.priceMax]
            .map((v) => (v === undefined ? "제한 없음" : formatPrice(v)))
            .join(" ~ ")})`}
          className="ml-0.5 rounded px-1 text-neutral-400 hover:text-neutral-900"
        >
          ✕
        </button>
      )}
    </div>
  );
}
