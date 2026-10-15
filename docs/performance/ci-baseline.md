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

## M1~M2 — 2026-10-15

| run | commit | Node | 전체 | install | typecheck | lint | test | build | 비고 |
|---|---|---|---|---|---|---|---|---|---|
| 38732849386 | `399005d` | 22 | 37s | 4s | 5s | 3s | 2s | 9s | pnpm 캐시 적중, 테스트 15개 |
| 38734338468 | `79830c8` | **24** | 42s | 5s | 3s | 3s | 1s | 10s | lockfile 변경(@types/node)으로 캐시 미스 → 캐시 저장 5s |

- 테스트 0 → 15개, 앱 페이지 1개 추가에도 전체 시간은 M0(46s)와 비슷하다. 아직 병목 없음.
- **Node 22 → 24 전환은 이 시점에 했다.** 이후 CI / 성능 비교는 모두 Node 24 기준이다.
- Vercel: Git 연결 후 첫 자동 배포 빌드 35s (`79830c8`).
