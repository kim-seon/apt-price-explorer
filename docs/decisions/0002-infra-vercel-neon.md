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

(로컬 전체 적재 후 DB 크기, 운영 cold start 실측값, Free / Launch 최종 선택을 기록한다.)
