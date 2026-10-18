# 0006. 지역 거래 탐색의 데이터 요청: TanStack Query + Route Handler

- Status: Accepted
- Date: 2026-10-17

## Problem

지역 거래 탐색 탭(docs/02 F4)은 지역 전체 기간 거래(수만~십만 건)를 복합 필터 · 서버 정렬 · 무한 스크롤로 탐색한다. 단지 상세(0005)처럼 한 번에 내려보낼 수 없어서, 필터 변경과 스크롤마다 서버에 요청해야 한다. 이때 필요한 것:

- 필터를 빠르게 바꿀 때 이전 요청 취소 / 늦은 응답 무시 (CLAUDE.md 7)
- 새 결과를 기다리는 동안 이전 결과 유지
- 필터별로 불러온 페이지 누적, 같은 필터로 돌아오면 다시 요청하지 않기

0005에서는 "TanStack Query를 사용하지 않는다(필요해지면 재검토)"로 정했다.

## Options

1. **TanStack Query** `useInfiniteQuery` + Route Handler
2. 직접 구현: Route Handler + AbortController (M4 SearchBox와 같은 방식)

## Decision

1번. 범위는 **거래 탐색 탭으로 한정**한다.

- provider는 `/regions/[code]/trades` layout에만 둔다 → 다른 화면 번들에 포함되지 않는다
- 브라우저에서는 QueryClient 하나를 재사용한다 (탭을 오가도 불러온 페이지가 남는다)
- 첫 페이지는 Server Component가 렌더해서 `initialData`로 넘긴다 → 초기 화면이 API 왕복을 기다리지 않는다
- 필터는 URL이 원본. 변경은 `history.replaceState` → `useSearchParams` → 쿼리 키. 서버 재렌더는 없다
- 단지 상세(0005)와 검색(M4)은 그대로 둔다 — 요구사항이 다르고, 바꿀 이유가 없다

## Reason

- 직접 구현하면 "필터 키별 페이지 누적 캐시 + 취소 + 이전 결과 유지 + 다음 페이지 실패 재시도"를 만들어야 한다. SearchBox(단일 요청, 캐시 없음)보다 상태 조합이 많아 버그 표면이 커진다.
- 이 문제들은 라이브러리가 해결한 영역이고, 포트폴리오에서 보여줄 판단은 그 위의 설계(데이터 경계, pagination 방식, 가상화 여부)다.

## Trade-offs

- 의존성 추가 (`@tanstack/react-query@5.104.0`, 배포 2주 이상 지난 버전으로 고정). 거래 탐색 탭 JS에만 포함된다 — 크기는 탭별 번들 측정 시 기록한다.
- 서버 데이터가 두 경로로 온다 (첫 페이지는 RSC, 이후는 Route Handler JSON). 같은 DAL 함수(`getRegionTrades`)와 같은 필터 파서(`parseTradeFilters`)를 써서 결과가 어긋나지 않게 한다.

## Result

2026-10-19 (docs/performance/cases/04-trade-table-virtualization.md)

- **offset 유지, keyset 전환 안 함**: 송파구 전체 기간(91,464건)에서 offset 3만까지 DB 37~42ms(로컬) · 운영 40~66ms(왕복 지연이 대부분)로 깊이에 따른 저하가 없다.
- **가상화 도입**: 병목은 서버가 아니라 클라이언트였다. 5,000행에서 DOM 6만 · 페이지당 1.2초 · 필터 변경 첫 반응 1.16초 → TanStack Virtual로 DOM 736 · 페이지당 0.13초 · 첫 반응 33ms.
- TanStack Query의 캐시(필터별 페이지 누적)와 이전 결과 유지(keepPreviousData)는 그대로 쓰인다. 가상화 후 필터 변경 시 흐리게 표시하는 대상이 보이는 행뿐이라 즉시 반응한다.
