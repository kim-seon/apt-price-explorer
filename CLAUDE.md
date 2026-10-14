# CLAUDE.md

@AGENTS.md

## 1. Project Overview

이 프로젝트는 국토교통부 아파트 실거래 데이터를 기반으로 한 **부동산 실거래 데이터 탐색 및 분석 서비스**다.

주 사용자는 부동산 실수요자이며, 지역 또는 아파트 단지를 탐색한 뒤 특정 단지의 실거래 내역과 가격 변화를 이해하는 것을 핵심 사용자 흐름으로 한다.

### Primary User Flow

지역/단지 검색
→ 단지 선택
→ 단지 상세
→ 실거래 내역 확인
→ 가격 추이 및 거래량 분석
→ 면적/기간 등의 조건 변경 및 비교

### Secondary Flow

지역 단위 통계는 보조적인 탐색 기능으로 제공한다.

- 지역별 월별 거래량 / 중위가 추이
- **지역 거래 탐색 테이블** — 지역 전체 기간 거래(수만 건 규모)를 복합 필터로 탐색. 단지 하나의 거래는 수백~수천 건 수준이라 대량 테이블 / 가상화 / 복합 필터 경험은 주로 이 화면에서 다룬다.

### MVP Screens

1. 검색 / 진입 (`/`) — 단지명 검색, 시도 → 시군구 → 법정동 선택, 수도권 시군구 × 월 거래량 히트맵 (MVP 마지막 작업)
2. 지역 페이지 (`/regions/[code]`) — 탭: 단지 목록 | 통계 | 거래 탐색
3. 단지 상세 (`/apartments/[id]`) — 핵심 화면

흐름별 상세와 UX 결정은 `docs/02-user-flows.md`, 화면 설계와 차트 / 복잡한 UI 보강안(coordinated views, 가격 분포 밴드, 히트맵)은 `docs/03-ux-design.md`를 따른다.

### MVP Data Scope

- 아파트 **매매** 실거래
- 서울 / 경기 / 인천
- 가능한 전체 실거래 기간

전국 데이터, 전월세 데이터는 MVP 이후 확장한다.

지도 기반 탐색은 MVP 범위에서 제외한다.

### Known Data Characteristics

- 단지 식별은 `aptSeq`(단지 일련번호)를 사용한다. 마포구 실측에서 채움률 100%, 이름 / 지번 충돌 0건. 다른 시군구에서 재확인 전까지 이상 케이스를 감지할 수 있게 한다.
- **거래 고유 키가 없다.** 모든 필드가 같은 행이 실제 별개 거래일 수 있으므로 내용 기반 dedupe를 하지 않는다.
- 해제 정보는 2020-02 이후, 중개/직거래는 2021-11 이후, 등기일·동은 2023-01 이후 거래에만 있다.
- 상세는 `docs/04-data-research.md`. 면적 타입 그룹핑 / 신고가 정의 / 적재 방식 / 스키마 초안은 `docs/05-data-structure.md`를 따른다.
- 해제(취소) 거래가 포함되어 있다. 집계 시 포함/제외 기준을 명시한다.
- 좌표 정보가 없다.
- 공공 API는 `시군구 코드 × 계약년월` 단위로 조회되며 일일 호출 제한이 있다.

---

# 2. Project Goals

이 프로젝트의 목적은 단순히 기능이 동작하는 서비스를 빠르게 만드는 것이 아니다.

다음 역량을 실제 문제를 통해 경험하고 검증하는 것이 핵심이다.

- Product Frontend 개발
- 복잡한 데이터 기반 UI 설계
- 데이터 시각화
- 대용량 데이터 처리
- Frontend 성능 최적화
- Server-side API 설계
- DB query / index 최적화
- caching 전략
- CI/CD 개선
- Client와 Server 사이의 데이터 경계 설계

특히 다음 사이클을 중요하게 생각한다.

**Implement → Measure → Find Bottleneck → Improve → Measure Again**

최적화 기술은 실제 문제가 확인된 후 도입한다.

### Primary Focus: Product Frontend

이 프로젝트의 주인공은 **Product Frontend**다. Server / DB / CI는 Frontend 경험을 받쳐주는 역할이다.

- 시간과 범위가 충돌하면 UX 완성도(interaction 품질, loading / empty / error 상태, 접근성, 차트 가독성)를 우선한다.
- 성능 개선 사례는 DB / API뿐 아니라 Frontend 쪽(렌더링, 번들, interaction latency, Web Vitals)에서도 반드시 확보한다.
- 포트폴리오에서 설명하는 의사결정의 중심은 Frontend 설계다.

## 2.1 Phases

| Phase | 목표 | 범위 | 하지 않는 것 |
|---|---|---|---|
| 1. MVP | 핵심 흐름 + baseline | 수도권 매매 전체 기간, MVP 화면 3개, 측정 인프라, 배포 | 지도, 단지 비교, 전월세, Redis, 로그인 |
| 2. 확장·최적화 | 성능 개선 사례 | 전국 확장, 병목 분석, index / 집계 / pagination 개선, (필요 시) caching, 전월세 검토 | **새 기능 추가** |
| 3. 기능 확장 | 필요성이 확인된 것만 | 단지 비교, CSV export, 지도 탐색, 관심 단지 | — |

- Phase 2에서는 기능을 추가하지 않는다. 기능을 고정하고 데이터와 부하만 바꿔야 개선 효과를 깨끗하게 측정할 수 있다.
- 수도권 → 전국 확장은 행 수 기준 약 2배 수준일 수 있다. 데이터 규모만으로 병목이 드러나지 않을 수 있으므로 조회 패턴(넓은 기간·지역 집계, 깊은 pagination, 정렬 조합), 전월세 추가, 합성 데이터 증폭도 성능 실험 수단으로 고려한다.
- 현재 Phase의 범위를 벗어나는 작업은 구현하지 않고 다음 Phase 후보로 제안만 한다.

## 2.2 MVP Definition of Done

1. 검색 → 단지 상세 → 차트·테이블 탐색 흐름이 수도권 실데이터로 동작한다
2. 지역 통계와 지역 거래 탐색 테이블이 동작한다
3. Frontend / API / DB 각 레이어의 **baseline 측정값**이 문서로 남아 있다
4. 배포된 URL이 있다

Phase 2 완료 기준: 최소 2~3개의 "병목 발견 → 개선 → 재측정" 사례가 문서로 남아 있다.

---

# 3. Engineering Principles

## 3.1 Do Not Overengineer

현재 문제를 해결하지 않는 기술이나 추상화를 미리 추가하지 않는다.

예:

- 실제 병목이 확인되기 전 Redis 도입 금지
- 별도 Backend 서버(NestJS 등) / microservice 분리 금지 — `docs/decisions/0001-nextjs-fullstack-without-nestjs.md` 참고
- 사용 사례가 하나뿐인 과도한 abstraction 지양
- 미래 요구사항을 추측한 복잡한 architecture 지양

단순한 구조로 시작하고 실제 요구사항과 측정 결과를 기반으로 확장한다.

---

## 3.2 Explain Before Major Decisions

중요한 기술적 선택을 Claude가 임의로 확정하지 않는다.

다음에 해당하는 변경은 구현 전에 선택지를 제시한다.

- 새로운 주요 dependency 도입
- DB schema의 중요한 변경
- caching 전략 변경
- API 구조 변경
- state management 방식 변경
- authentication 도입
- infrastructure 변경
- architecture 변경

가능하면 다음 형식으로 설명한다.

1. 해결하려는 문제
2. 선택 가능한 방법
3. 각 방법의 trade-off
4. 이 프로젝트에서 추천하는 방법
5. 선택에 따른 향후 영향

사용자가 결정한 후 구현한다.

Infrastructure(DB 호스팅, 배포 환경)는 **예상 데이터 건수와 저장 용량(index 포함)을 먼저 추정**하고, 무료 티어와 소액 유료 인프라의 장단점·예상 비용을 비교한 뒤 결정한다. 무료 티어 용량에 맞추기 위해 데이터 규모를 과도하게 축소하지 않는다. 배포 데모의 **첫 접속 응답 시간(DB auto-suspend 등 cold start)**도 비교 기준에 포함한다.

---

## 3.3 Measure Before Optimize

성능 최적화는 추측으로 하지 않는다.

가능하면 개선 전 baseline을 측정한다.

예:

- API response time
- p50 / p95 latency
- DB query execution time
- query plan
- transferred payload size
- client rendering time
- number of rendered rows
- bundle size
- Web Vitals (LCP / INP)
- CI execution time

측정 환경(데이터셋 크기, 기기·네트워크 조건, 벤치마크 스크립트)을 고정해서 Before / After를 재현 가능하게 한다.

벤치마크 스크립트는 repository에 포함하고, **단일 명령으로 다른 사람도 재현할 수 있게** 만든다.

성능 개선 작업에서는 가능하면 다음을 기록한다.

**Before → Change → After**

예:

`Apartment transaction API p95: 1.8s → composite index → 240ms`

단순히 "index를 추가해서 빨라졌다"에서 멈추지 않는다. 가능하면 **trade-off가 있는 결정**(집계 테이블의 갱신 비용과 데이터 신선도, offset → cursor 전환 시 잃는 기능, 서버 집계 vs 클라이언트 집계 등)을 함께 검토하고 기록한다.

---

## 3.4 Server Owns Data Aggregation

Client에 raw data를 대량 전달한 뒤 브라우저에서 불필요한 집계 작업을 수행하지 않는다.

다음과 같은 데이터 처리는 기본적으로 Server(Next.js server-side) / DB 책임으로 본다.

- aggregation
- filtering
- sorting
- pagination
- statistical calculation
- large dataset transformation

단, UI 표현에 종속적인 가벼운 transformation은 Client에서 수행할 수 있다.

경계가 애매한 경우 구현 전에 이유를 설명한다.

---

## 3.5 Prefer Server-State Tools for Server Data

API에서 가져온 데이터를 불필요하게 global client state에 복제하지 않는다.

Server state와 Client state를 명확히 구분한다.

Server state 예:

- apartment information
- transaction list
- statistics
- search results

Client state 예:

- selected filters (가능하면 URL search params로 관리 — 공유 / 새로고침 / 뒤로가기 지원)
- UI state
- modal state
- temporary user interaction state

---

# 4. Initial Architecture

MVP는 **Next.js Full-stack + PostgreSQL**로 시작한다. 별도 Backend 서버는 두지 않는다.
결정 배경과 NestJS 도입 검토 조건은 `docs/decisions/0001-nextjs-fullstack-without-nestjs.md`를 따른다.

```text
Public Data API
      ↓
Import Script (scripts/)
      ↓
Validation / Normalization
      ↓
PostgreSQL
      ↓
Next.js (Server Components / Route Handlers / Data Access Layer)
      ↓
User
```

대규모 원본 데이터를 매 사용자 요청마다 공공 API에서 직접 조회하지 않는다.

공공데이터는 별도의 수집 과정으로 저장하고 서비스는 자체 DB를 조회하는 구조를 기본으로 한다.

---

# 5. Initial Technology Stack

## Application

- Next.js (App Router)
- TypeScript

## Frontend

- Tailwind CSS
- shadcn/ui
- TanStack Table
- TanStack Virtual — 데이터 규모상 실제 필요할 때
- TanStack Query — 필요한 경우에만
- Apache ECharts

## Database

- PostgreSQL

## ORM / Query Layer

- **Drizzle** — 스키마 / 마이그레이션 / 동적 필터는 쿼리 빌더, 분석 쿼리는 `sql` 템플릿 (`docs/decisions/0003-orm-drizzle.md`)
- 초기 대량 적재는 드라이버의 `COPY`
- 운영 DB 드라이버(node-postgres vs Neon serverless driver)는 연결 지연 측정 후 결정

## Other Tools

pnpm, tsx(import script), fast-xml-parser, zod(외부 API 응답 + URL search params 검증), Vitest. 상세와 "구현 시 결정" 항목은 `docs/07-tech-stack.md`.

## Infrastructure

- Docker (로컬 PostgreSQL 등 개발 환경)
- GitHub Actions
- 운영: Vercel Hobby + Neon PostgreSQL (둘 다 Singapore). Neon Free / Launch는 로컬 전체 적재 후 실제 DB 크기로 결정 — `docs/decisions/0002-infra-vercel-neon.md`
- DB 성능 실험(baseline, EXPLAIN, index)은 로컬 Docker PostgreSQL에서 고정 환경으로 측정한다
- 정기 데이터 갱신: GitHub Actions cron으로 import script 실행

## Cache

초기에는 Redis를 사용하지 않는다.

DB/API 성능을 측정하고 caching이 실제 문제를 해결할 수 있다고 판단될 때 도입을 검토한다.

---

# 6. Repository Structure

MVP는 단일 Next.js application으로 시작한다. 별도 Backend가 없으므로 monorepo(`apps/`, `packages/`)는 아직 사용하지 않는다.

예상 구조:

```text
/
├── src/
│   ├── app/          # routes, pages, route handlers
│   ├── components/
│   └── server/       # data access layer, queries, server-only logic
│
├── scripts/          # 공공데이터 수집 / import
│
├── docs/
│   ├── decisions/    # 기술적 의사결정 기록
│   └── performance/  # 측정 / 성능 개선 기록
│
├── docker/
│
├── CLAUDE.md
└── README.md
```

세부 구조는 구현 시작 시점에 확정한다.

NestJS 도입 등으로 독립 application이 생기면 그때 monorepo 전환과 tooling을 검토한다.

---

# 7. Frontend Conventions

## TypeScript

가능한 strict typing을 유지한다.

다음을 지양한다.

```ts
any
```

`any`가 반드시 필요한 경우 이유를 명확히 남긴다.

외부 API 응답을 신뢰하지 않고 필요한 경우 runtime validation을 고려한다.

---

## Component Design

컴포넌트는 역할을 명확하게 유지한다.

다음 기준으로 분리를 고려한다.

- 독립적인 UI 책임이 있는가?
- 반복해서 사용되는가?
- 별도의 상태/interaction을 가지는가?
- 분리했을 때 코드 이해도가 실제로 좋아지는가?

단순히 파일 크기를 줄이기 위한 과도한 컴포넌트 분리는 하지 않는다.

---

## Server / Client Components

Next.js App Router에서는 Server Component를 기본으로 고려한다.

다음과 같은 경우 Client Component를 사용한다.

- browser API 필요
- local interaction state 필요
- event handler 필요
- client-only library 필요

불필요하게 상위 컴포넌트 전체를 `"use client"`로 만들지 않는다.

Client boundary는 가능한 필요한 범위에 둔다.

---

## Data Fetching

데이터 요청의 목적에 따라 Server Component fetching과 TanStack Query 사용 여부를 판단한다.

모든 API 요청을 기계적으로 TanStack Query로 처리하지 않는다.

SEO/초기 렌더링에 필요한 데이터와 사용자 interaction 이후 변경되는 데이터를 구분한다.

---

## Interaction Quality

복잡한 필터 UI에서는 기능 동작 여부뿐 아니라 다음을 설계하고 구현한다.

- **stale response / race condition**: 필터를 빠르게 바꿀 때 늦게 도착한 이전 응답이 최신 결과를 덮어쓰지 않게 한다 (이전 요청 취소 또는 무시).
- **transition state**: 새 결과를 기다리는 동안 이전 결과 유지 / skeleton / 진행 표시 중 무엇을 보여줄지 의도적으로 결정한다.
- **keyboard accessibility**: 필터, 테이블, 차트 주요 조작을 키보드만으로 할 수 있게 한다.

이런 문제를 해결한 과정은 `docs/`에 기록할 가치가 있다.

---

## Styling

기본적으로 Tailwind CSS를 사용한다.

공통 UI primitive는 shadcn/ui를 활용할 수 있다.

복잡한 조건부 class는 가독성을 우선한다.

UI 구현에서는 디자인 재현뿐 아니라 다음도 고려한다.

- accessibility
- responsive layout
- loading state
- empty state
- error state
- large dataset state

---

# 8. Server-side Conventions

별도 Backend 서버가 없더라도 server-side logic의 계층과 책임은 명확히 나눈다.

일반적으로:

```text
Server Component / Route Handler
    ↓
Service (domain logic)
    ↓
Data Access Layer (query)
    ↓
Database
```

- Route Handler와 Server Component에는 business logic을 두지 않는다.
- DB 접근 코드는 Data Access Layer에 모으고, Client Component에서 import되지 않도록 server 전용 모듈로 유지한다.
- Service가 지나치게 커지는 경우 domain 책임(apartment, transaction, region, statistics 등)을 기준으로 분리한다.
- 불필요한 계층은 만들지 않는다. 단순 조회에 Service 계층이 의미 없으면 생략할 수 있다.

---

# 9. API Design Principles

API는 Frontend 화면 구조를 그대로 복사해서 설계하지 않는다.

데이터 domain과 실제 조회 패턴을 기준으로 설계한다.

Server Component는 Data Access Layer를 직접 호출할 수 있다. Route Handler는 client-side interaction(필터 변경, 무한 스크롤 등)에서 필요한 조회를 위해 둔다.

예:

```text
GET /api/apartments
GET /api/apartments/:id

GET /api/apartments/:id/transactions
GET /api/apartments/:id/statistics

GET /api/regions/:code/statistics
GET /api/regions/:code/transactions
```

목록 API에서는 기본적으로 pagination을 고려한다.

대량 데이터에 offset pagination이 실제 성능 문제가 되는 경우 cursor/keyset pagination을 검토한다.

응답 payload에는 화면에서 사용하지 않는 대량의 데이터를 습관적으로 포함하지 않는다.

---

# 10. Database Principles

Schema 설계 시 실제 조회 패턴을 먼저 고려한다.

Index는 많이 만드는 것이 목표가 아니다.

다음 과정을 따른다.

1. 예상 query 작성
2. baseline 측정
3. query plan 확인 (`EXPLAIN ANALYZE`)
4. index 후보 결정
5. 적용
6. 다시 측정

복합 index에서는 column order를 명시적으로 검토한다.

대규모 데이터를 다룰 때 다음 문제를 관찰한다.

- full table scan
- sorting cost
- aggregation cost
- pagination cost
- index size
- duplicated data
- ingestion performance

---

# 11. Large Dataset UI

대량 데이터를 브라우저에 한 번에 전달하지 않는다.

Transaction table 등에서는 필요에 따라 다음을 검토한다.

- server-side pagination
- virtualization
- incremental fetching
- query caching
- debounced filters

Virtualization 역시 데이터 규모상 실제 필요성이 있을 때 사용한다.

---

# 12. Data Visualization

차트는 단순 장식이 아니라 사용자가 데이터를 이해하는 수단이다.

차트를 추가할 때 다음 질문을 먼저 한다.

- 사용자가 이 차트로 어떤 질문에 답할 수 있는가?
- 다른 표현보다 이 chart type이 적합한가?
- 데이터가 많아졌을 때 읽을 수 있는가?
- tooltip / legend / axis가 이해 가능한가?
- 모바일에서도 의미가 유지되는가?

초기 후보 library는 Apache ECharts다.

---

# 13. Testing

테스트 개수 자체를 목표로 하지 않는다.

우선순위:

1. 중요한 business logic
2. 데이터 transformation (특히 단지 식별·정규화)
3. 통계/계산 로직
4. API contract
5. 주요 사용자 interaction

단순 implementation detail을 검증하는 테스트는 지양한다.

단지 식별·정규화는 단위 테스트와 별개로 **정확도를 측정**한다. 표본을 직접 검수해 오매칭률 등을 수치로 남기고, 규칙을 개선할 때마다 다시 측정한다.

---

# 14. Error Handling

Happy path만 구현하지 않는다.

최소한 다음 상태를 고려한다.

- loading
- empty
- error
- timeout
- invalid input
- partial data

외부 공공 API 수집 과정에서는 특히 다음을 고려한다.

- rate limit
- temporary failure
- malformed response
- duplicate records
- retry
- idempotency
- incremental update

---

# 15. CI/CD Principles

CI 속도도 프로젝트의 성능 개선 대상이다.

초기 baseline을 기록하고 프로젝트가 커지면서 다음을 관찰한다.

- install time
- lint time
- test time
- build time
- duplicated jobs

필요성이 확인되면 다음을 검토한다.

- dependency caching
- parallel jobs
- affected project execution
- Docker layer caching

Frontend baseline이 측정된 이후에는 **performance budget**(번들 크기, Lighthouse 지표 등)을 CI에 걸어 성능 회귀를 PR 단계에서 막는다. 구체적인 도구와 기준값은 baseline 측정 후 결정한다.

---

# 16. Documentation

문서를 위한 문서를 만들지 않는다.

다만 중요한 기술적 의사결정과 성능 개선은 기록한다.

- 의사결정: `docs/decisions/NNNN-short-title.md`
- 성능 측정 / 개선: `docs/performance/`
- 차트 설계 결정 (스케일, 이상치, 색상 접근성 등): `docs/charts/`

의사결정 문서는 다음 내용을 짧게 남긴다.

```text
Problem
Options
Decision
Reason
Result
```

특히 포트폴리오에서 설명할 가치가 있는 결정은 반드시 기록한다.

문서는 프로젝트 마지막에 몰아서 쓰지 않는다. **결정하거나 측정한 시점에 바로 기록한다.** 나중에는 개선 전 수치와 당시 맥락을 복원하기 어렵다.

## README

README는 리뷰어가 처음 2분 안에 프로젝트를 판단할 수 있게 구성한다.

1. 한 줄 소개
2. 배포 URL + 데모 GIF
3. 성능 개선 결과 표 (Before → After, 상세 문서 링크)
4. 주요 기술적 의사결정 요약 (decision 문서 링크)
5. 기술 스택 (나열은 마지막에)

---

# 17. Working With Claude

Claude는 이 프로젝트에서 단순 코드 생성기가 아니라 **engineering partner** 역할을 한다.

## Claude SHOULD

- 구현 전에 기존 코드를 먼저 확인한다.
- 현재 architecture와 convention을 따른다.
- 중요한 기술 선택에는 trade-off를 설명한다.
- 성능 문제를 추측하지 않고 측정 방법을 제안한다.
- 더 단순한 해결책이 있다면 알려준다.
- 요구사항이 architecture에 큰 영향을 미치면 구현 전에 질문한다.
- 작업 후 변경 사항과 이유를 간단히 설명한다.
- 가능한 경우 검증 방법을 제시하거나 직접 실행한다.
- 기록할 가치가 있는 결정이나 측정 결과가 생기면 문서화를 제안한다.

## Claude SHOULD NOT

- 요청하지 않은 대규모 refactoring을 수행한다.
- 편의를 위해 dependency를 무분별하게 추가한다.
- 새로운 infrastructure를 임의로 도입한다.
- 실제 측정 없이 성능이 개선됐다고 주장한다.
- 사용자의 기술적 판단 기회를 없애면서 모든 결정을 대신한다.
- 요구하지 않은 기능을 "있으면 좋을 것 같다"는 이유로 구현한다.
- 현재 Phase 범위를 벗어나는 기능을 구현한다.
- 기존 convention을 이유 없이 변경한다.

---

# 18. Task Completion

기능 구현 후 가능하면 다음을 확인한다.

- TypeScript type check
- lint
- relevant tests
- build
- 주요 사용자 흐름
- error / loading / empty state

성능 관련 작업이라면 추가로:

- baseline
- measurement method
- result

를 보고한다.

작업 완료 응답에서는 다음을 간단히 정리한다.

1. 무엇을 변경했는가
2. 왜 이렇게 구현했는가
3. 검증 결과
4. 남아 있는 trade-off 또는 후속 작업

---

# 19. Core Rule

이 프로젝트에서 가장 중요한 원칙:

> **기술을 사용했다는 사실보다 왜 사용했고 실제로 어떤 문제가 해결됐는지를 중요하게 생각한다.**

그리고:

> **Claude가 모든 문제를 대신 해결하는 것이 아니라, 사용자가 설계와 기술적 의사결정을 이해하고 직접 판단할 수 있도록 돕는다.**
