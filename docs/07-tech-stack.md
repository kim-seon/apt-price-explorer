# 07. Tech Stack — Final

- Status: Accepted (2026-10-14) — ORM 결정 기록: decisions/0003
- Date: 2026-10-14

---

## 1. ORM / Query Layer (핵심 결정)

### 이 프로젝트의 DB 사용 패턴 (05 기준)

| 패턴 | 예 |
|---|---|
| 분석 쿼리 | 월별 중위가 / p25~p75 (`percentile_cont`), 역대 최고가 (window function), 시군구 × 월 집계 (히트맵) |
| 동적 필터 | 기간 / 면적 / 층 / 가격 / 해제 포함 등 선택적 조건 조합 |
| pagination | offset → (측정 후) keyset |
| 쓰기 | **사용자 쓰기 없음.** 쓰기는 import script의 파티션 교체(DELETE + bulk INSERT)뿐 |
| 대량 적재 | 초기 약 330만 건 → `COPY`가 가장 빠름 |
| 튜닝 | 생성된 SQL을 그대로 `EXPLAIN ANALYZE` 해야 함 |

→ **CRUD가 거의 없고 분석 SQL이 중심인 read-heavy 앱.**

### 비교

| | Prisma (7) | Drizzle | Raw SQL (pg 드라이버 + 수동 타입) |
|---|---|---|---|
| 강점 | 스키마 DSL, CRUD / 관계 조회 DX, 성숙한 생태계 | SQL과 거의 1:1인 TS 쿼리 빌더, `sql` 템플릿으로 복잡한 SQL 혼용, 마이그레이션 도구 | 완전한 통제, 의존성 최소 |
| 분석 쿼리 | 결국 raw / TypedSQL로 작성 → ORM 이점이 사라짐 | 빌더 + `sql` 조합으로 타입 유지 | 직접 작성 |
| 생성 SQL 예측성 | 낮음 (추상화 계층) | 높음 | 완전 |
| serverless | Prisma 7에서 Rust 엔진 제거, 번들 크게 감소 (2차 자료) — 격차 축소 | 가벼움 | 가벼움 |
| 타입 안정성 | 높음 | 높음 | 직접 관리 (실수 위험) |

### 제안

- **Drizzle** — 스키마 / 마이그레이션 / 동적 필터는 Drizzle 빌더, 분석 쿼리는 `sql` 템플릿.
- 초기 대량 적재는 ORM과 무관하게 **드라이버의 `COPY`** 사용.
- 이유: Prisma의 강점(CRUD, 관계)이 이 앱에는 거의 없고, 분석 쿼리와 EXPLAIN 기반 튜닝에는 SQL이 그대로 보이는 쪽이 유리하다. Raw SQL만 쓰면 동적 필터 조합과 결과 타입을 손으로 관리해야 한다.
- 결정 기록: `docs/decisions/0003-orm-drizzle.md` (확정 시 작성)

---

## 2. 나머지 스택

| 영역 | 제안 | 비고 |
|---|---|---|
| Framework | Next.js 최신 안정 버전 (App Router), TypeScript strict | |
| Package manager | pnpm | |
| DB 드라이버 | 로컬: node-postgres / 운영: Neon serverless driver 후보 | **구현 시 연결 지연 측정 후 결정** → 성능 사례 후보 |
| Import script | TypeScript (tsx로 실행), XML 파서 fast-xml-parser | |
| Runtime validation | zod | 외부 API 응답 검증 + **URL search params(필터 상태) 검증**에 함께 사용 |
| UI | Tailwind CSS, shadcn/ui | |
| Chart | Apache ECharts | 히트맵도 ECharts로 먼저 (03 결정) |
| Table | TanStack Table | |
| Virtualization | TanStack Virtual | 거래 탐색 탭에서 필요성 확인 후 |
| Server state | TanStack Query | 무한 스크롤 구현 시점에 필요성 판단 (Server Component만으로 부족할 때) |
| URL 상태 | 직접 구현(useSearchParams + zod) vs nuqs | 구현 시 결정 |
| Test | Vitest (면적 그룹핑, 신고가, 파싱 등 로직) | E2E(Playwright)는 MVP 후반에 판단 |
| Lint / Format | ESLint (Next 기본) + Prettier | |
| CI | GitHub Actions | |
| 로컬 DB | Docker Compose PostgreSQL | 운영 Neon과 같은 메이저 버전 |

"구현 시 결정" 항목은 실제 문제가 생기는 시점에 선택지를 다시 제시한다 (CLAUDE.md 3.2).

## Sources

- Drizzle vs Prisma 2026 비교 (3rd party): https://makerkit.dev/blog/tutorials/drizzle-vs-prisma
- Prisma 7 변경점 정리 (3rd party): https://techsy.io/blog/prisma-vs-drizzle-orm
