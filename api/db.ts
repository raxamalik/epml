import "dotenv/config";
import dns from 'dns';
try {
  dns.setDefaultResultOrder('ipv4first');
} catch (e) {
  console.warn('Could not set DNS order, IPv6 may be preferred');
}

import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "./schema.js";
import { promisify } from 'util';

const lookup = promisify(dns.lookup);

const DATABASE_URL = process.env.DATABASE_URL;
const PGUSER = process.env.PGUSER;
const PGHOST = process.env.PGHOST;
const PGPASSWORD = process.env.PGPASSWORD;
const PGDATABASE = process.env.PGDATABASE;
const PGPORT = process.env.PGPORT;

if (!DATABASE_URL) {
  if (!PGUSER || !PGHOST || !PGPASSWORD || !PGDATABASE) {
    throw new Error(
      "Database configuration missing. Please set DATABASE_URL or individual PG* environment variables."
    );
  }
}

let connectionString = DATABASE_URL || 
  `postgresql://${PGUSER}:${PGPASSWORD}@${PGHOST}:${PGPORT || 5432}/${PGDATABASE}`;

if (connectionString.includes('neon.tech')) {
  connectionString = connectionString.replace(/[?&]channel_binding=[^&]*/g, '');
}

if (connectionString.includes('supabase.co')) {
  const url = new URL(connectionString.replace('postgresql://', 'http://'));
  const projectRef = url.hostname.split('.')[0];
  
  if (projectRef && !url.hostname.includes('pooler')) {
    const region = process.env.SUPABASE_REGION || 'eu-central-1';
    connectionString = connectionString.replace(
      url.hostname,
      `aws-0-${region}.pooler.supabase.com`
    );
  }
  
  connectionString = connectionString.replace(':6543/', ':5432/');
  connectionString = connectionString.replace(/\?pgbouncer=true/, '');
}

let poolConfig: any;

if (connectionString.includes('neon.tech')) {
  const url = new URL(connectionString.replace('postgresql://', 'http://'));
  poolConfig = {
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 30000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
  };
} else if (connectionString.includes('supabase.co')) {
  const url = new URL(connectionString.replace('postgresql://', 'http://'));
  let hostname = url.hostname;
  
  lookup(hostname, { family: 4 })
    .then((result) => {
      if (result && typeof result === 'object' && 'address' in result) {
        console.log(`Resolved ${url.hostname} to IPv4: ${result.address}`);
      }
    })
    .catch((resolveError: any) => {
      console.warn(`Could not resolve ${hostname} to IPv4:`, resolveError.message);
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
} else {
  poolConfig = {
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  };
}

export const pool = new Pool(poolConfig);

pool.query('SELECT 1').then(() => {
  console.log('Database connection successful (api/db.ts)');
}).catch((err) => {
  console.error('Database connection test failed:', err.message);
});

export const db = drizzle(pool, { schema });
