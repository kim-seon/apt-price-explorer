# Frontend Baseline — 단지 상세 (M3)

- 측정일: 2026-10-15, 커밋 `0538dd2`
- 대상: 파크리오(송파구) 전용 84㎡ — 수도권에서 거래가 가장 많은 단지 중 하나 (최대 부하 케이스)
- 환경: 로컬 프로덕션 빌드(`next build && next start`), 로컬 Docker PostgreSQL 17 (263만 건, index 없음), Node 24
- 도구: Lighthouse 12, 모바일 기본 프리셋(시뮬레이션 스로틀링), **3회 측정 중앙값**
  - 첫 회는 서버 재시작 직후라 편차가 크다(TBT 453ms → 이후 99~110ms). 서버 워밍업 후 측정한다.

## 재현

```bash
pnpm build && DATABASE_URL=postgres://app:app@localhost:5432/real_estate pnpm start -p 3100
npx lighthouse@12 "http://localhost:3100/apartments/11710-6266" --only-categories=performance --output=json
```

## 결과

| 지표 | 5년 (거래 586건) | 전체 기간 (1,707건) |
|---|---|---|
| Lighthouse 성능 점수 | 88 | 82 |
| FCP | 911ms | 1,064ms |
| **LCP** | **3,521ms** | **3,675ms** |
| **TBT** | 99ms | **279ms** |
| DOM 노드 | 4,787 | 13,798 |
| 메인 스레드 작업 | 949ms | 1,504ms |
| HTML 원본 / gzip | 526KB / 23KB | 1,461KB / 52KB |
| RSC payload (HTML 내) | 145KB | 388KB |

### JS 번들 (gzip)

| 항목 | 크기 |
|---|---|
| 페이지 JS 전체 (9 파일) | 393KB |
| ECharts 청크 (모듈 import) | 227KB (전체의 56%) |
| ECharts 청크 (전체 import, 비교용) | 404KB |

## 관찰된 병목 (개선 후보)

1. **LCP는 데이터 대기**: LCP 요소가 헤더 문장(`header > p`)이다. 헤더가 차트·테이블과 같은 `<Suspense>` 안에 있어 무거운 쿼리(window function, 분위수)가 끝나야 표시된다. → Suspense 경계 분리, 쿼리 / 캐시 개선 후보
2. **TBT는 테이블 행 수에 비례**: 행 3배(586 → 1,707) → TBT 2.8배(99 → 279ms), DOM 2.9배. → 가상화 / 점진 렌더링 후보 (가상화 도입의 첫 측정 근거)
3. **ECharts가 JS의 절반 이상**: 모듈 import로 44% 줄였지만 227KB. → 차트 지연 로딩 후보
4. 전송 크기는 문제 아님: 반복 많은 HTML이라 gzip 후 최대 52KB.
