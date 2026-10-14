# 06. System Architecture & Infrastructure

- Status: Accepted (2026-10-14) — 결정 기록: decisions/0002
- Date: 2026-10-14
- 입력값: `docs/04-data-research.md` 실측 (수도권 약 330만 건, index 포함 약 1~2GB 추정)

---

## 1. 구성

```text
[로컬 개발 / 측정]
  Docker PostgreSQL (전체 데이터)  ← DB / query / index 실험은 여기서 고정 환경으로
  scripts/ (초기 적재, 원본 XML 로컬 캐시)

[운영]
  사용자 (한국)
     ↓
  Vercel (Next.js, Hobby) ── 같은 리전 ── 관리형 PostgreSQL
                                             ↑
  GitHub Actions cron ── scripts/ (최근 7개월 정기 갱신, 24개월 월간 보정)
```

### 결정 사항 (아키텍처)

- **초기 전체 적재(약 2.1만 회 호출, 3일)는 로컬에서 수행**하고 운영 DB로 `pg_dump` / `pg_restore`. 운영 환경에서 장시간 작업을 돌리지 않는다.
- **정기 갱신은 GitHub Actions cron**으로 import script를 실행한다. 별도 worker / 서버 없음 (0001 결정과 일치).
- **DB 성능 실험(baseline, EXPLAIN, index)은 로컬 Docker에서** 고정된 환경으로 측정한다. 관리형 DB의 cold start / 네트워크 변동이 측정을 오염시키지 않게 한다. 운영 환경 측정은 별도로 기록한다(실사용 latency).
- **Next.js 함수 리전과 DB 리전을 같은 곳에 둔다.** 요청 하나에 쿼리가 여러 번 나가므로 함수 ↔ DB 왕복 지연이 가장 크게 누적된다.

---

## 2. DB 호스팅 비교 (2026-10 조사)

| 옵션 | 월 비용 | 용량 | 리전 | cold start | 운영 부담 |
|---|---|---|---|---|---|
| **Neon Free** | $0 | **1GB / 프로젝트** (2026-10-01부터 0.5 → 1GB) | 서울 없음, 최근접 Singapore | 5분 유휴 후 정지, **끌 수 없음** | 없음 |
| **Neon Launch** | 사용량 과금. 저장 $0.35/GB-월, compute $0.106/CU-시간 | 제한 없음 | 위와 같음 | 끌 수 있음 | 없음 |
| Supabase Free | $0 | 500MB | (서울 리전 미확인) | 1주 비활성 시 프로젝트 일시정지 | 없음 |
| Supabase Pro | $25~ | 8GB 포함 | (서울 리전 미확인) | 없음 | 없음 |
| 서울 VPS + Docker Postgres (Vultr / Lightsail 등) | 약 $5~24 (사양·업체별, ⚠️ 가격 미확인) | 디스크만큼 | **서울** | 없음 | **백업 / 보안 / 업데이트 직접** |
| Oracle Cloud Always Free | $0 | 충분 | 서울·춘천 존재 | 없음 | 높음. 2026-06 무료 한도 절반 축소, 유휴 시 회수 정책, 용량 부족 이슈 |

### Neon 비용 계산 (추정)

- 저장: 1.5GB × $0.35 ≈ **$0.5 / 월**
- compute (scale-to-zero 유지): 데모 트래픽이면 하루 수십 분 수준 → **약 $1~3 / 월**
- compute (scale-to-zero 끔, 0.25 CU 상시): 0.25 × 730시간 × $0.106 ≈ **$19 / 월**
- 참고: Free의 compute 한도는 100 CU-시간 / 월이라, 0.25 CU 상시 가동(약 183 CU-시간)으로 cold start를 없애는 것은 Free에서 불가능

---

## 3. 추천

1. **운영: Vercel Hobby + Neon** (함수 리전과 DB 리전 모두 Singapore)
   - 운영 부담 0, Product Frontend 집중 원칙과 맞다
   - 한국 ↔ Singapore 왕복 지연은 감수 (정적 자산은 CDN이 한국 근처에서 응답)
2. **Free vs Launch는 로컬 전체 적재 후 실제 DB 크기(`pg_database_size`)를 보고 결정**
   - 1GB 이하 → Free로 시작
   - 초과 → Launch (scale-to-zero 유지 시 월 $1~4 추정)
3. **cold start는 숨기지 않고 측정 대상으로 삼는다**
   - 첫 접속 지연을 실측 → 데모 품질에 문제가 되면 그때 "scale-to-zero 끄기(약 $19/월)" vs 다른 대안 비교
   - "무료 티어의 cold start를 측정하고 비용 대비 판단했다"는 것 자체가 의사결정 기록
4. 서울 VPS는 **대안으로 보류**: 지연 시간 / 비용 예측성은 가장 좋지만 운영 부담이 Product Frontend 목표와 거리가 있다. Neon에서 실제 문제가 확인되면 재검토.

---

## Sources

- Neon plans: https://neon.com/docs/introduction/plans
- Neon regions: https://neon.com/docs/introduction/regions
- Neon Free 1GB 변경 (2026-10-01): https://github.com/robhunter/agentdeals/pull/2234
- Supabase pricing 정리 (3rd party): https://uibakery.io/blog/supabase-pricing
- Vercel Functions limits: https://vercel.com/docs/functions/limitations
- Vercel Fluid compute pricing (icn1 등 리전 단가): https://vercel.com/docs/functions/usage-and-pricing
- Oracle Always Free 리소스 / 회수 정책: https://docs.oracle.com/en-us/iaas/Content/FreeTier/resourceref.htm
- Oracle 무료 한도 축소 (2026-06): https://infoq.com/news/2026/07/oracle-cloud-free-tier-limits/
- Lightsail 가격: https://aws.amazon.com/ko/lightsail/pricing/
- Vultr 가격 정리 (3rd party): https://onedollarvps.com/pricing/vultr-pricing
