import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";
import { requireDatabaseUrl } from "./env";

const connectionString = requireDatabaseUrl();

// Neon works fine with sslmode=require in DATABASE_URL. If you don't have it,
// you can add `?sslmode=require` to the URL.
export const pool = new pg.Pool({
  connectionString,
  max: 10,
});

export const db = drizzle(pool, { schema });



