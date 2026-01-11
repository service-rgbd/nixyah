import "dotenv/config";
import { defineConfig } from "drizzle-kit";
import { getEnv } from "./server/env";

// Support common env var naming used in some .env files
if (!process.env.DATABASE_URL && process.env.database_url) {
  process.env.DATABASE_URL = process.env.database_url;
}

getEnv();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
