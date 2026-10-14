# CI Baseline

## M0 — 2026-10-14 (run 38586393359, commit `chore: rename project to apt-price-explorer`)

- 조건: 앱 코드 거의 없음(Next.js 기본 페이지), 테스트 0개, **첫 실행 → pnpm store 캐시 없음**
- 러너: `ubuntu-latest`, 단일 job 순차 실행
- 전체: **46초** (run 생성 → 완료), job 실행 약 37초

| Step | 시간 |
|---|---|
| checkout | 1s |
| pnpm setup | 2s |
| setup-node (캐시 복원 시도) | 5s |
| `pnpm install --frozen-lockfile` | 5s |
| `pnpm typecheck` (next typegen + tsc) | 3s |
| `pnpm lint` | 3s |
| `pnpm format:check` | 1s |
| `pnpm test` | 1s |
| `pnpm build` | 9s |
| post setup-node (캐시 저장) | 6s |

### 관찰

- 지금은 개선할 것이 없다. 코드가 늘어나며 build / typecheck / test가 어떻게 증가하는지 마일스톤마다 이 표에 추가한다.
- 캐시 저장(6s)은 첫 실행 비용. 두 번째 실행부터 install / setup-node 시간이 줄어드는지 확인한다.
