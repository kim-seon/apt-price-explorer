# 사례 01. 단지 상세 Suspense 경계 분리 — 그리고 측정 도구의 함정

- 날짜: 2026-10-15
- 대상: `/apartments/11710-6266` (파크리오 84㎡, 5년)
- 환경: 로컬 프로덕션 빌드, 로컬 PostgreSQL(263만 건, index 없음), Lighthouse 12 모바일, 3회 중앙값

## 문제

baseline에서 LCP가 3.5초(목표 2.5초)였다. LCP 요소는 차트가 아니라 **헤더의 "준공년도 · 데이터 기준" 문장**이었다.

헤더가 차트·테이블과 **같은 `<Suspense>`** 안에 있어서, 헤더에 필요한 쿼리는 2ms인데도 본문 쿼리(면적 타입 1,088ms, 거래 72ms, 통계 84ms)가 모두 끝나야 표시됐다.

| 쿼리 | 실행 시간 (EXPLAIN ANALYZE) |
|---|---|
| 단지 정보 (PK) | 0.3ms |
| 데이터 기준일 | 1.4ms |
| 면적 타입 목록 | **1,088ms** (→ 사례 02) |
| 거래 목록 (window) | 72ms |
| 3개월 이동 통계 | 84ms |

## 변경

Suspense 경계를 둘로 나눴다.

```text
before: <Suspense> 헤더 + 타입 탭 + 차트 + 테이블 </Suspense>
after:  <Suspense> 헤더 </Suspense>            ← PK 조회만 기다림
        <Suspense> 타입 탭 + 차트 + 테이블 </Suspense>
```

## 측정 — 첫 시도에서 "개선 없음"이 나왔다

Lighthouse 기본값(시뮬레이션 스로틀링)으로 재니 LCP 3,521ms → 3,522ms, 변화가 없었다.

같은 리포트의 **실제 관측값**은 357ms였다. 시뮬레이션 스로틀링(Lantern)은 빠르게 받은 결과로 느린 네트워크를 **추정**하는데, HTML이 청크 단위로 흘러오는 **스트리밍을 반영하지 못하고** 문서 전체가 도착해야 그려진다고 계산한다. 스트리밍 구조를 바꾸는 개선은 이 방식으로 평가할 수 없다.

→ **실제 스로틀링**(`--throttling-method=devtools`)으로 개선 전후를 다시 측정했다.

## 결과 (devtools 스로틀링)

| | before | after | 변화 |
|---|---|---|---|
| **LCP** | 1,890ms | **1,487ms** | **-403ms (-21%)** |
| FCP | 1,890ms | 1,487ms | |
| LCP 3회 편차 | 1,878 ~ 2,432ms | 1,484 ~ 1,492ms | 쿼리 시간 영향 제거 |
| TBT | 254ms | 278ms | 변화 없음 (테이블 렌더링 문제, 범위 밖) |

- before는 **FCP = LCP**: 스켈레톤에는 텍스트가 없어 contentful로 인정되지 않는다. 의미 있는 첫 화면이 모든 쿼리를 기다렸다.
- after는 헤더가 첫 화면에 포함되어 쿼리 시간과 무관해졌다.

## 배운 것

1. **스트리밍 / Suspense 개선은 시뮬레이션 스로틀링으로 평가하면 안 된다.** 이후 측정은 devtools 스로틀링을 함께 쓴다.
2. "LCP가 느리다"의 원인이 렌더링이 아니라 **데이터 대기 구조**일 수 있다. LCP 요소를 먼저 확인한다.
3. 측정에서 나온 1,088ms 쿼리는 이 개선과 별개의 병목 → 사례 02.

## 재현

```bash
pnpm build && DATABASE_URL=postgres://app:app@localhost:5432/real_estate pnpm start -p 3100
npx lighthouse@12 http://localhost:3100/apartments/11710-6266 --only-categories=performance --throttling-method=devtools
```
