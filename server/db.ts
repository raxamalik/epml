// Set DNS to prefer IPv4 before any imports
import dns from 'dns';
try {
  dns.setDefaultResultOrder('ipv4first');
} catch (e) {
  // Fallback for older Node.js versions
  console.warn('Could not set DNS order, IPv6 may be preferred');
}

import dotenv from "dotenv";
// Load environment variables - try .env.local first, then fallback to process.env (for Vercel)
if (process.env.VERCEL !== "1") {
  dotenv.config({ path: ".env.local" });
}

import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";
import { promisify } from 'util';

const lookup = promisify(dns.lookup);

// Load environment variables
const DATABASE_URL = process.env.DATABASE_URL;
const PGUSER = process.env.PGUSER;
const PGHOST = process.env.PGHOST;
const PGPASSWORD = process.env.PGPASSWORD;
const PGDATABASE = process.env.PGDATABASE;
const PGPORT = process.env.PGPORT;

// Check for database configuration
if (!DATABASE_URL) {
  if (!PGUSER || !PGHOST || !PGPASSWORD || !PGDATABASE) {
    throw new Error(
      "Database configuration missing. Please set DATABASE_URL or individual PG* environment variables."
    );
  }
}

// Use DATABASE_URL if available, otherwise construct from individual variables
let connectionString = DATABASE_URL || 
  `postgresql://${PGUSER}:${PGPASSWORD}@${PGHOST}:${PGPORT || 5432}/${PGDATABASE}`;

// For Supabase, use direct connection (port 5432) instead of pooler to avoid IPv6 issues
if (connectionString.includes('supabase.co')) {
  // Replace pooler port (6543) with direct connection port (5432)
  connectionString = connectionString.replace(':6543/', ':5432/');
  // Remove pgbouncer query parameter
  connectionString = connectionString.replace(/\?pgbouncer=true/, '');
}

// Create pool configuration - use explicit config for Supabase to avoid IPv6 issues
let poolConfig: any;

if (connectionString.includes('supabase.co')) {
  // Parse connection string for Supabase
  const url = new URL(connectionString.replace('postgresql://', 'http://'));
  
  // Force IPv4 resolution for Supabase
  let hostname = url.hostname;
  
  // Try to resolve to IPv4 (async, but we'll handle it in the connection)
  lookup(hostname, { family: 4 })
    .then((result) => {
      if (result && typeof result === 'object' && 'address' in result) {
        console.log(`✅ Resolved ${url.hostname} to IPv4: ${result.address}`);
      }
    })
    .catch((resolveError: any) => {
      console.warn(`⚠️  Could not resolve ${hostname} to IPv4:`, resolveError.message);
      console.warn(`⚠️  Using hostname directly. If connection fails, get IPv4 connection string from Supabase Dashboard.`);
    });
  
  poolConfig = {
    host: hostname,
    port: parseInt(url.port) || 5432,
    database: url.pathname.replace('/', ''),
    user: url.username,
    password: decodeURIComponent(url.password),
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  };
  
  console.log(`Configured Supabase connection: ${hostname}:${poolConfig.port}`);
} else {
  // Use connection string for other databases
  poolConfig = {
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  };
}

// Create pool with error handling for Supabase/standard PostgreSQL
export const pool = new Pool(poolConfig);

// Test connection on startup
pool.query('SELECT 1').then(() => {
  console.log('Database connection successful');
}).catch((err) => {
  console.error('Database connection test failed:', err.message);
  console.error('Connection string format:', connectionString.replace(/:[^:@]+@/, ':****@'));
});

export const db = drizzle(pool, { schema });