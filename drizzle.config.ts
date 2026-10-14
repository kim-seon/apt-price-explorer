import { defineConfig } from "drizzle-kit";

// 로컬에서는 .env.local을 읽고, CI 등에서는 환경 변수를 그대로 쓴다.
try {
  process.loadEnvFile(".env.local");
} catch {}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
