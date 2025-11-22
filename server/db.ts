import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

// Load environment variables
const DATABASE_URL = process.env.DATABASE_URL;
const PGUSER = process.env.PGUSER;
const PGHOST = process.env.PGHOST;
const PGPASSWORD = process.env.PGPASSWORD;
const PGDATABASE = process.env.PGDATABASE;
const PGPORT = process.env.PGPORT;

neonConfig.webSocketConstructor = ws;

// Check for database configuration
if (!DATABASE_URL) {
  if (!PGUSER || !PGHOST || !PGPASSWORD || !PGDATABASE) {
    throw new Error(
      "Database configuration missing. Please set DATABASE_URL or individual PG* environment variables."
    );
  }
}

// Use DATABASE_URL if available, otherwise construct from individual variables
const connectionString = DATABASE_URL || 
  `postgresql://${PGUSER}:${PGPASSWORD}@${PGHOST}:${PGPORT || 5432}/${PGDATABASE}`;

export const pool = new Pool({ connectionString });
export const db = drizzle({ client: pool, schema });