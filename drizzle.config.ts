import { defineConfig } from "drizzle-kit";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

// For Supabase, use direct connection (port 5432) instead of pooler to avoid IPv6 issues
let databaseUrl = process.env.DATABASE_URL;
if (databaseUrl.includes('supabase.co')) {
  // Replace pooler port (6543) with direct connection port (5432)
  databaseUrl = databaseUrl.replace(':6543/', ':5432/');
  // Remove pgbouncer query parameter
  databaseUrl = databaseUrl.replace(/\?pgbouncer=true/, '');
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
    ssl: databaseUrl.includes('supabase.co') ? { rejectUnauthorized: false } : false,
  },
});
