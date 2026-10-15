// 로컬에서는 .env.local을 읽고, CI 등에서는 이미 설정된 환경 변수를 그대로 쓴다.
try {
  process.loadEnvFile(".env.local");
} catch {}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}
