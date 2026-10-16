# 0005. 단지 상세의 Server / Client 데이터 경계

- Status: Accepted
- Date: 2026-10-15

## Problem

기간 brush를 드래그할 때마다 서버에 요청하면 한국 ↔ Singapore 왕복 지연 때문에 interaction이 끊긴다. 반면 CLAUDE.md 3.4는 집계 / 필터링을 서버 책임으로 둔다.

## Options

1. brush 변경마다 서버 조회 (Route Handler + TanStack Query)
2. 선택한 (단지, 면적 타입, 기간)의 개별 거래를 한 번 받아 brush 필터링과 요약 카드만 클라이언트에서 계산
3. 모든 계산을 클라이언트에서 (원본 대량 전달)

## Decision

2번.

| 데이터 | 위치 |
|---|---|
| 월별 p25 / 중위가 / p75, 거래량, 신고가 판정과 직전 최고가(window function) | 서버 SQL |
| 선택 타입·기간의 개별 거래 (수백~수천 건) | 서버 → 클라이언트 1회 전달 |
| brush 범위 필터링, 요약 카드(건수, 최고가, 3.3㎡당 중위값) | 클라이언트 |

- 면적 타입 / 기간 프리셋 변경: URL search params → 서버 재렌더
- brush 범위 / 해제 거래 표시: URL에 기록하되 서버 왕복 없이 클라이언트 반영
- TanStack Query는 사용하지 않는다 (필요해지면 재검토) → 지역 거래 탐색에서만 도입: 0006

## Reason

- CLAUDE.md 3.4가 허용하는 "UI 표현에 종속된 가벼운 transformation"의 범위: 단지 하나·타입 하나의 수천 건 이하, 통계 계산은 여전히 서버.
- brush는 즉각 반응이 핵심 UX.

## Trade-offs

- 거래가 매우 많은 단지에서는 payload가 커질 수 있다 → 전체 적재 후 최대 단지의 응답 크기를 측정한다.

## Result

2026-10-15, 파크리오 84㎡ 전체 기간(1,707건):

- 전송 크기는 gzip 52KB로 문제 없음 (원본 HTML 1.46MB, RSC payload 388KB)
- 비용은 전송이 아니라 **렌더링**: 테이블 DOM 13,798 노드, TBT 279ms (5년 586건일 때 99ms)
- 결론: 클라이언트에 한 번 전달하는 경계 자체는 유지. 테이블 렌더링 방식(가상화 등)을 개선한다.
- brush interaction 지연은 아직 미측정 (브라우저 계측 필요)
