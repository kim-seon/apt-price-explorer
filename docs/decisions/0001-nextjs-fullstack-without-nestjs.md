# 0001. Backend Architecture Decision — MVP는 Next.js Full-stack으로 시작

- Status: Accepted
- Date: 2026-10-12

## 현재 결정

MVP에서는 **별도의 NestJS Backend를 사용하지 않는다.**

초기 구조는 **Next.js Full-stack + PostgreSQL**로 시작한다.

```text
Next.js
├── UI
├── Server Components
├── Route Handlers / Server-side logic
├── Data Access Layer
└── PostgreSQL
```

공공데이터 수집은 서비스 API와 분리된 script 또는 batch 형태로 시작한다.

```text
scripts/
└── import-transactions.ts
```

---

## 왜 처음부터 NestJS를 사용하지 않는가

NestJS 자체가 프로젝트에 부적합해서 제외하는 것은 아니다.

이 프로젝트에서는 다음과 같은 Backend 역할이 예상된다.

- 공공데이터 수집
- 데이터 정제
- PostgreSQL 저장
- 실거래 검색 및 필터링
- pagination
- 통계/aggregation
- 데이터 시각화를 위한 API
- 향후 caching
- 대용량 데이터 처리

따라서 프로젝트 규모가 커지면 독립적인 Backend가 필요해질 가능성은 있다.

하지만 MVP 단계에서는 별도의 NestJS 서버를 운영해야 할 명확한 이유가 아직 없다.

처음부터 다음 구조를 선택하면:

```text
Next.js
    ↓
NestJS
    ↓
PostgreSQL
```

Frontend와 Backend의 배포 및 개발 환경이 분리되고 관리해야 할 코드와 인프라가 증가한다.

현재 요구사항은 Next.js의 서버 기능만으로도 충분히 구현 가능하므로, 실제 문제가 발생하기 전에 Backend를 분리하는 것은 프로젝트의 `Do Not Overengineer` 원칙과 맞지 않는다.

---

## Initial Stack

### Application

- Next.js
- TypeScript

### Database

- PostgreSQL

### Database Access

아직 확정하지 않는다.

후보:

- Drizzle
- Prisma
- 필요한 경우 raw SQL

실제 조회 패턴과 대용량 데이터 처리 요구사항을 확인한 후 결정한다.

### Frontend

- Tailwind CSS
- shadcn/ui
- Apache ECharts
- TanStack Table
- TanStack Virtual
- TanStack Query — 필요한 경우에만 사용

---

## Backend Responsibility

별도의 Backend 서버가 없더라도 Frontend와 Server-side logic의 책임은 명확하게 분리한다.

대규모 raw data를 Client Component에 전달해서 브라우저에서 처리하지 않는다.

다음 작업은 기본적으로 Server / Database 영역에서 처리한다.

- filtering
- sorting
- pagination
- aggregation
- statistical calculation
- large dataset transformation

Client는 UI 표현과 사용자 interaction에 필요한 최소한의 데이터를 받는다.

예:

```text
PostgreSQL
    ↓
Server-side query / aggregation
    ↓
Next.js
    ↓
Client
```

잘못된 방향:

```text
PostgreSQL
    ↓
100,000 raw transactions
    ↓
Browser
    ↓
filter / sort / aggregation
```

---

## Data Collection

국토교통부 등의 외부 공공 API를 사용자 요청 시 직접 호출하는 구조를 기본으로 하지 않는다.

초기에는 별도의 데이터 수집 script를 사용한다.

```text
Public Data API
       ↓
Import Script
       ↓
Validation / Normalization
       ↓
PostgreSQL
```

예:

```text
scripts/
├── import-transactions.ts
└── import-apartments.ts
```

수집 과정에서는 다음 문제를 고려한다.

- API rate limit
- pagination
- retry
- duplicate data
- malformed response
- idempotency
- incremental update

---

## When to Consider NestJS

다음 문제가 실제로 발생하면 별도의 Backend 도입을 검토한다.

### 1. Backend Domain이 커지는 경우

Server-side 코드가 커져 Next.js application 내부에서 관리하기 어려워지는 경우.

예:

```text
transaction
apartment
region
statistics
data-ingestion
batch
cache
```

등의 독립적인 domain이 커지는 상황.

### 2. Data Ingestion이 복잡해지는 경우

단순 import script 수준을 넘어 다음이 필요해지는 경우.

- scheduled batch
- queue
- retry management
- job status
- worker
- large-scale ingestion pipeline

### 3. API 규모가 커지는 경우

다수의 Client가 동일 Backend를 사용하거나 API 자체가 하나의 독립적인 application 역할을 하기 시작하는 경우.

```text
Web
   ↘
     API
   ↗
Mobile
```

### 4. 독립적인 배포가 필요한 경우

Frontend와 Backend의 배포 주기나 scaling 요구사항이 달라지는 경우.

```text
Next.js
2 instances

API
10 instances

Workers
5 instances
```

처럼 각 영역을 독립적으로 운영할 필요가 생긴 경우.

### 5. Backend 기술을 별도로 검증할 가치가 생기는 경우

프로젝트를 진행하면서 Backend architecture 자체를 깊게 경험하는 것이 프로젝트 목표에 도움이 된다고 판단되는 경우.

---

## Migration Possibility

필요성이 확인되면 다음과 같이 단계적으로 분리한다.

### Phase 1

```text
Next.js
    ↓
PostgreSQL
```

### Phase 2

```text
Next.js
    ↓
NestJS
    ↓
PostgreSQL
```

필요하면 데이터 수집도 별도 Worker로 분리한다.

### Phase 3

```text
                ┌─ Next.js
                │
User ───────────┤
                │
                └─ NestJS API
                       ↓
                  PostgreSQL

Public Data API
       ↓
    Worker
       ↓
 PostgreSQL
```

단, Phase 2와 Phase 3는 목표가 아니다.

실제 문제를 해결할 필요가 있을 때만 진행한다.

---

## Architecture Principle

이 프로젝트에서는 기술을 많이 사용하는 것을 목표로 하지 않는다.

특히 Backend architecture에서는 다음 원칙을 따른다.

> **Separate when there is a reason to separate.**

처음에는 가능한 단순한 구조로 시작한다.

그리고:

> **Implement → Measure → Find Bottleneck → Improve**

과정을 통해 architecture를 발전시킨다.

NestJS를 사용하지 않는 것도 하나의 기술적 결정이며, 향후 NestJS를 도입하는 것 역시 실제 문제와 trade-off를 근거로 결정한다.

---

## Portfolio Perspective

최종 프로젝트에서는 단순히 사용 기술을 나열하지 않는다.

```text
Next.js
NestJS
PostgreSQL
Redis
Docker
```

보다 다음과 같은 의사결정 과정을 설명할 수 있는 것을 목표로 한다.

> 초기 MVP에서는 별도의 Backend 서버가 필요하지 않다고 판단하여 Next.js Full-stack 구조로 시작했다.
>
> 이후 데이터와 기능이 증가하면서 실제 발생한 문제를 측정하고, Backend 분리가 문제를 해결할 수 있는 시점에 architecture 변경 여부를 검토했다.

또는 별도의 Backend가 끝까지 필요하지 않았다면:

> 프로젝트 규모와 운영 요구사항을 분석한 결과 별도 API 서버가 가져오는 복잡도 대비 실익이 크지 않아 Next.js Full-stack architecture를 유지했다.

어떤 결과가 되든 **왜 해당 architecture를 선택했는지 설명할 수 있는 것**을 가장 중요하게 생각한다.

---

## Result

(NestJS 도입 여부를 다시 검토하게 되면 그 시점의 측정 결과와 판단을 여기에 추가한다.)
