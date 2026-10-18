-- 짧은 조회 쿼리에서 JIT 컴파일(약 140ms)이 실행 시간(약 40ms)보다 크다 (docs/performance/cases/03-transactions-indexes.md).
-- 데이터베이스 이름이 환경마다 달라(real_estate / neondb) current_database()로 지정한다. 새 연결부터 적용된다.
DO $$
BEGIN
  EXECUTE format('ALTER DATABASE %I SET jit = off', current_database());
END
$$;
