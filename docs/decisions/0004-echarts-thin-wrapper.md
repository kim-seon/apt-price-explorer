# 0004. ECharts 통합 — 직접 만든 얇은 래퍼 + 모듈 단위 import

- Status: Accepted
- Date: 2026-10-15

## Problem

단지 상세의 coordinated views(기간 brush → 요약·테이블, 테이블 hover → 차트 하이라이트)는 차트 인스턴스를 직접 제어해야 한다. ECharts 전체 번들은 크다.

## Options

- `echarts-for-react` 등 래퍼 라이브러리
- 직접 만든 래퍼 (`echarts/core` + 필요한 차트·컴포넌트만 등록)

## Decision

직접 만든 얇은 래퍼. 사용하는 차트 / 컴포넌트만 `echarts.use()`로 등록한다.

## Reason

- `dispatchAction`(하이라이트), `datazoom` 이벤트를 의존성 없이 직접 다룬다.
- 필요한 모듈만 번들에 포함 → 전체 import 대비 번들 크기 차이를 측정해 Frontend 성능 사례로 남길 수 있다.
- 래퍼 코드가 수십 줄 수준이라 유지 부담이 작다.

## Result

(모듈 import vs 전체 import 번들 크기 측정 결과 기록)
