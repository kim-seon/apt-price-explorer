import {
  bigint,
  index,
  boolean,
  char,
  date,
  integer,
  numeric,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

// 설계 근거: docs/05-data-structure.md
// index는 PK 외에 미리 만들지 않는다. 예상 쿼리 → baseline → EXPLAIN 후 추가한다 (CLAUDE.md 10).
// 측정과 근거: docs/performance/cases/03-transactions-indexes.md

/** 법정동 코드. 시군구(level = 'sgg')와 읍면동(level = 'umd') 행을 함께 둔다. */
export const regions = pgTable("regions", {
  code: char("code", { length: 10 }).primaryKey(),
  sggCode: char("sgg_code", { length: 5 }).notNull(),
  level: varchar("level", { length: 3 }).$type<"sgg" | "umd">().notNull(),
  sidoName: text("sido_name").notNull(),
  sggName: text("sgg_name").notNull(),
  umdName: text("umd_name"),
});

/**
 * 아파트 매매 실거래. 거래 고유 키가 원천에 없으므로 surrogate id를 쓰고,
 * 적재는 (sgg_code, 계약년월) 파티션 단위 교체로 멱등성을 보장한다.
 */
export const transactions = pgTable(
  "transactions",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    sggCode: char("sgg_code", { length: 5 }).notNull(),
    umdCode: char("umd_code", { length: 5 }).notNull(),
    umdName: text("umd_name").notNull(),
    aptSeq: text("apt_seq").notNull(),
    aptName: text("apt_name").notNull(),
    jibun: text("jibun"),
    buildYear: smallint("build_year"),
    dealDate: date("deal_date").notNull(),
    /** 만원 */
    price: integer("price").notNull(),
    /** 전용면적 ㎡ */
    area: numeric("area", { precision: 9, scale: 4, mode: "number" }).notNull(),
    /** 단지별 면적 타입 라벨 (예: "84", "59A"). 적재 후 파생 단계에서 채운다. */
    areaTypeLabel: text("area_type_label"),
    floor: smallint("floor"),
    /** 해제 여부. 원천 제공은 2020-02 이후 계약분부터. */
    cancelled: boolean("cancelled").notNull().default(false),
    cancelDate: date("cancel_date"),
    /** 중개거래 / 직거래. 2021-11 이후 */
    dealType: text("deal_type"),
    /** 2023-01 이후 */
    registeredDate: date("registered_date"),
    /** 2023-01 이후, 등기 완료 건만 */
    aptDong: text("apt_dong"),
  },
  (t) => [
    // 단지 상세 · 지역 단지 목록. (apt_seq, area_type_label, deal_date) 복합(170MB)과 속도가 같아
    // 단일 열(36MB, 중복 제거 효과)을 쓴다 — 단지 하나의 거래는 수천 건 이하라 나머지 조건은 heap에서 걸러도 충분하다
    index("transactions_apt_idx").on(t.aptSeq),
    // 지역 통계 · 거래 탐색(계약일 정렬) · 적재/갱신의 파티션 삭제
    index("transactions_sgg_date_idx").on(t.sggCode, t.dealDate),
  ],
);

/** 단지. 거래에서 파생한다. apt_seq는 행정구역 개편에도 바뀌지 않는다 (앞자리로 지역 판단 금지). */
export const complexes = pgTable("complexes", {
  aptSeq: text("apt_seq").primaryKey(),
  name: text("name").notNull(),
  buildYear: smallint("build_year"),
  /** 2개 시군구에 걸친 단지가 있어 최빈 시군구를 대표로 둔다. */
  sggCode: char("sgg_code", { length: 5 }).notNull(),
  umdName: text("umd_name").notNull(),
  jibun: text("jibun"),
  /** 해제 제외 전체 기간 거래 수. 검색 / 목록 정렬용 (파생 시 계산, 매 조회 집계 회피 — docs/08 M4) */
  tradeCount: integer("trade_count").notNull().default(0),
  /** 해제 제외 최근 계약일 */
  lastDealDate: date("last_deal_date"),
});

/** 단지별 면적 타입. 인접 전용면적 차이 0.5㎡ 미만을 같은 타입으로 묶는다. */
export const areaTypes = pgTable(
  "area_types",
  {
    aptSeq: text("apt_seq").notNull(),
    label: text("label").notNull(),
    minArea: numeric("min_area", {
      precision: 9,
      scale: 4,
      mode: "number",
    }).notNull(),
    maxArea: numeric("max_area", {
      precision: 9,
      scale: 4,
      mode: "number",
    }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.aptSeq, t.label] })],
);

/** 적재 이력. 파티션별 마지막 수집 시점 → "데이터 기준일"과 재수집 판단에 사용. */
export const importPartitions = pgTable(
  "import_partitions",
  {
    sggCode: char("sgg_code", { length: 5 }).notNull(),
    dealYm: char("deal_ym", { length: 6 }).notNull(),
    rowCount: integer("row_count").notNull(),
    invalidCount: integer("invalid_count").notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
    importedAt: timestamp("imported_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.sggCode, t.dealYm] })],
);
