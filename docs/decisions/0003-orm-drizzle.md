# 0003. ORM / Query Layer — Drizzle

- Status: Accepted
- Date: 2026-10-14
- 상세 비교: `docs/07-tech-stack.md`

## Problem

DB 접근 계층을 정해야 한다. 이 앱은 사용자 쓰기가 없고, 분석 쿼리(percentile, window function, 시군구 × 월 집계)와 선택적 조건이 많은 동적 필터가 중심이다. 성능 튜닝은 실제 실행 SQL을 EXPLAIN ANALYZE 하는 방식으로 한다.

## Options

- Prisma
- Drizzle
- Raw SQL (드라이버 + 수동 타입)

## Decision

Drizzle. 스키마 / 마이그레이션 / 동적 필터는 쿼리 빌더, 분석 쿼리는 `sql` 템플릿. 초기 대량 적재는 ORM과 무관하게 드라이버의 `COPY`.

## Reason

- Prisma의 강점(CRUD, 관계 조회)을 쓸 일이 거의 없고, 분석 쿼리는 어차피 raw SQL이 된다.
- 생성 SQL이 예측 가능해 EXPLAIN 기반 튜닝 흐름과 맞다.
- Raw SQL만 쓰면 동적 필터 조합과 결과 타입을 수동으로 관리해야 한다.
- serverless 번들 크기는 Prisma 7 이후 결정 요인이 아니다.

## Trade-offs

- 관계 조회 / CRUD 편의성은 Prisma보다 낮다 (이 앱에서는 영향 작음).
- 복잡한 `sql` 템플릿 구간은 결과 타입을 직접 선언해야 한다.

## Result

(구현 후 분석 쿼리 작성 경험, 생성 SQL과 EXPLAIN 흐름이 실제로 편했는지 기록)
