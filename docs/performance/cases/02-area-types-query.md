# 사례 02. 면적 타입 쿼리 — 상관 서브쿼리를 한 번의 집계로

- 날짜: 2026-10-15
- 대상: `/apartments/11710-6266` (파크리오, 면적 타입 5개), `getAreaTypes`
- 환경: 로컬 프로덕션 빌드, 로컬 PostgreSQL(263만 건, **index 없음**)

## 문제

사례 01에서 쿼리별 시간을 재다가 발견했다. 면적 타입 탭의 "N건"을 구하는 쿼리가 1,088ms였다.

```sql
-- before: 타입마다 상관 서브쿼리
SELECT a.label,
  (SELECT count(*) FROM transactions t
    WHERE t.apt_seq = a.apt_seq AND t.area_type_label = a.label AND NOT t.cancelled)
FROM area_types a WHERE a.apt_seq = $1
```

index가 없어 서브쿼리 한 번이 거래 테이블 전체(263만 건) 스캔이고, **타입 수만큼 반복**된다. 파크리오는 5회.

## 변경

거래 테이블을 한 번만 훑으며 타입별로 묶고, 결과를 면적 타입에 붙인다. **index는 추가하지 않았다** — 쿼리 구조만의 효과를 분리해서 보기 위해.

```sql
-- after
SELECT a.label, coalesce(c.trade_count, 0)
FROM area_types a
LEFT JOIN (
  SELECT area_type_label, count(*) AS trade_count
  FROM transactions WHERE apt_seq = $1 AND NOT cancelled
  GROUP BY area_type_label
) c ON c.area_type_label = a.label
WHERE a.apt_seq = $1
```

## 결과

| 지표 | before | after | 변화 |
|---|---|---|---|
| 쿼리 실행 (EXPLAIN ANALYZE) | 1,088ms | 약 195ms (186~220) | **-82%** |
| 본문 스트리밍 완료 (curl, 7회 중앙값) | 1,288ms | **315ms** | **-76%** |
| TTFB (헤더 셸) | 3ms | 2ms | 사례 01 덕분에 원래 즉시 |

정확성: 단지 32곳 · 면적 타입 94개에서 before / after 결과 불일치 **0건**.

## 남은 것 / trade-off

- 여전히 **쿼리 하나당 거래 테이블 전체 스캔 1회**다 (면적 타입, 거래 목록, 통계 각각). 본문 315ms의 대부분이 이 스캔들이다.
- `transactions(apt_seq, ...)` index를 두면 단지 상세 쿼리 전체가 수 ms 수준이 될 것으로 예상하지만, index는 적재(파티션 삭제)와 지역 조회(M5)에도 영향을 주므로 **전체 적재 후 조회 패턴을 모아 한 번에 설계**한다 (CLAUDE.md 10).
- 이번 개선의 의미: index 없이도 "같은 테이블을 N번 훑는" 쿼리 구조가 비용의 대부분이었다. index는 이 구조 문제를 가렸을 것이다.
