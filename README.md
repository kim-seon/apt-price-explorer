# Real Estate Data Explorer

수도권 아파트 실거래 데이터를 단지 중심으로 탐색하는 서비스. (작성 중 — MVP 완료 시 정리)

## 로컬 실행

```bash
pnpm install
cp .env.example .env.local   # 값 채우기
pnpm db:up                   # Docker PostgreSQL
pnpm dev
```

## 문서

- 프로젝트 규칙: `CLAUDE.md`
- 요구사항 · 설계 · 결정 기록: `docs/`
