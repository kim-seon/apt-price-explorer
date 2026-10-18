# 0002. 운영 인프라 — Vercel Hobby + Neon (Singapore)

- Status: Accepted
- Date: 2026-10-14
- 상세 비교: `docs/06-architecture.md`

## Problem

수도권 전체 기간 약 330만 건(index 포함 약 1~2GB 추정)을 서비스할 운영 DB와 앱 호스팅이 필요하다. 무료 / 저비용을 우선하되, 데이터 규모를 무료 티어에 맞춰 줄이지 않는다. 데모의 첫 접속 응답 시간도 기준에 포함한다.

## Options

- Neon (Free / Launch) — 서버리스 PostgreSQL, 서울 리전 없음, scale-to-zero
- Supabase (Free 500MB / Pro $25)
- 서울 VPS + Docker PostgreSQL
- Oracle Cloud Always Free

## Decision

- 앱: Vercel Hobby, 함수 리전 Singapore
- DB: Neon, Singapore (`aws-ap-southeast-1`)
- Free vs Launch: **로컬 전체 적재 후 실제 DB 크기로 결정** (1GB 이하 Free, 초과 Launch)
- cold start: scale-to-zero를 유지한 채 실측. 데모 품질 문제가 확인되면 상시 가동(약 $19/월) 등 대안을 비교한다.

## Reason

- 운영 부담 0 → Product Frontend 집중 원칙과 일치
- 비용: Free $0, Launch 추정 월 $1~4 (scale-to-zero 유지 시)
- 함수와 DB를 같은 리전에 둬 요청당 다중 쿼리의 왕복 지연 누적을 줄인다
- DB 성능 실험은 로컬 Docker에서 하므로 관리형 DB의 변동이 측정을 오염시키지 않는다

## Trade-offs

- 한국 사용자 ↔ Singapore 왕복 지연 (정적 자산은 CDN)
- Free는 scale-to-zero를 끌 수 없어 띄엄띄엄 방문하는 리뷰어는 대부분 cold start를 겪는다
- 서울 VPS 대비 지연 시간은 불리, 운영 부담은 유리

## Result

2026-10-18

- **데이터**: 수도권 2006-01 ~ 2026-10, 거래 5,144,081건 (추정 330만 건보다 많음 — 전체 기간 적재). 행당 135바이트
- **크기**: 로컬 `VACUUM FULL` 후 790MB (PK만) → 인덱스 2개(+87MB) 877MB. Neon 915MB (복원 시 PK 인덱스가 커짐)
- **Free 유지 (사용자 결정)**. Neon Free는 프로젝트당 1GB(공식 요금 페이지 확인). 인덱스 추가 전 Neon이 매일 갱신의 삭제분으로 930MB까지 늘어 재복원으로 정리했다
  - 감시: 정기 갱신 마지막에 `pnpm db:size` — 900MB 경고, **950MB 이상이면 워크플로 실패(GitHub 알림) → 그때 Launch 전환 검토**
  - Launch 예상 비용: 저장 약 1.1GB × $0.35 + 갱신 · 방문 컴퓨트 ≈ 월 $1~2, 최소 요금 없음
- **복원**: 데이터만 `pg_dump -Fc`(75MB) → `pg_restore -j 4` 54~63초
- **정기 갱신**: 인덱스 전 Neon 파티션 삭제 0.9초, 매일 갱신 28.7분(매월 24개월은 제한 60분 초과 예상) → 인덱스 후 로컬 2.0분
- **cold start**: 측정 중 측정 기기 절전으로 무효 → 재측정 예정
