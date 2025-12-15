import { defineConfig } from "drizzle-kit";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

// Handle different database providers
let databaseUrl = process.env.DATABASE_URL;
let sslConfig = false;

if (databaseUrl.includes('supabase.co')) {
  // For Supabase, use direct connection (port 5432) instead of pooler to avoid IPv6 issues
  databaseUrl = databaseUrl.replace(':6543/', ':5432/');
  databaseUrl = databaseUrl.replace(/\?pgbouncer=true/, '');
  sslConfig = { rejectUnauthorized: false };
} else if (databaseUrl.includes('neon.tech')) {
  // For Neon, SSL is required
  sslConfig = { rejectUnauthorized: false };
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
    ssl: sslConfig,
  },
});
