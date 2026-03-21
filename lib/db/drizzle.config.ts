import { defineConfig } from "drizzle-kit";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

const workspaceRoot = path.resolve(__dirname, "../..");
const envPath = path.join(workspaceRoot, ".env");
const localEnvPath = path.join(workspaceRoot, ".env.local");

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

if (fs.existsSync(localEnvPath)) {
  dotenv.config({ path: localEnvPath, override: false });
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
