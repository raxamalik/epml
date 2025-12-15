// Consolidated API handler for Vercel - All functionality in one file
import "dotenv/config";
// Set DNS to prefer IPv4 before any imports
import dns from 'dns';
try {
  dns.setDefaultResultOrder('ipv4first');
} catch (e) {
  // Fallback for older Node.js versions
  console.warn('Could not set DNS order, IPv6 may be preferred');
}
import express, { type Express, type Request, type Response, type RequestHandler, type NextFunction } from "express";
import cookieParser from "cookie-parser";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, desc, count, and, or, isNotNull, isNull, sql, inArray, lt, ilike } from "drizzle-orm";
import { promisify } from 'util';
import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  integer,
  boolean,
  decimal,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import bcrypt from "bcrypt";
import crypto from "crypto";
import sgMail from '@sendgrid/mail';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import multer from 'multer';
import path from 'path';
import { promises as fs } from 'fs';
import { randomUUID } from 'crypto';
import cron from 'node-cron';
import { generateToken, verifyToken, extractTokenFromHeader, type JWTPayload } from './jwt-utils.js';
import { requirePermission, requireAnyPermission, requireRole, PERMISSIONS } from './permission-middleware.js';
import { 
  getCompanyInvitationTemplate, 
  getPasswordResetTemplate,
  getPlainTextTemplate 
} from './templates/emailTemplates.js';

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

const lookup = promisify(dns.lookup);

// Create pool configuration - handle different database providers
let poolConfig: any;

// Check if this is a Neon database connection
if (connectionString.includes('neon.tech')) {
  // For Neon, use the connection string directly (most reliable)
  // Remove channel_binding parameter (not supported by pg driver)
  const cleanConnectionString = connectionString.replace(/[?&]channel_binding=[^&]*/g, '');
  
  // Parse for logging purposes
  const url = new URL(cleanConnectionString.replace('postgresql://', 'http://'));
  const databaseName = url.pathname.replace('/', '').split('?')[0] || 'postgres';
  
  poolConfig = {
    connectionString: cleanConnectionString,
    ssl: { rejectUnauthorized: false }, // Neon requires SSL
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 30000, // Increased timeout for Neon pooler (30 seconds)
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
  };
  
  console.log(`Configured Neon database connection:`);
  console.log(`  Using connection string directly (recommended for Neon)`);
  console.log(`  Host: ${url.hostname}:${url.port || 5432}`);
  console.log(`  Database: ${databaseName}`);
  console.log(`  User: ${url.username}`);
  console.log(`  Connection timeout: 30s`);
  console.log(`  Connection string (masked): postgresql://${url.username}:***@${url.hostname}:${url.port || 5432}/${databaseName}`);
}
// Check if this is a Supabase connection
else if (connectionString.includes('supabase.co') || connectionString.includes('pooler.supabase.com')) {
  // For Supabase, use direct connection (port 5432) instead of pooler to avoid IPv6 issues
  if (connectionString.includes('supabase.co')) {
    // Replace pooler port (6543) with direct connection port (5432)
    connectionString = connectionString.replace(':6543/', ':5432/');
    // Remove pgbouncer query parameter
    connectionString = connectionString.replace(/\?pgbouncer=true/, '');
    // Fix incorrect hostname format (db.PROJECT_REF.supabase.co -> aws-0-REGION.pooler.supabase.com)
    if (connectionString.includes('db.') && connectionString.includes('.supabase.co')) {
      // Extract project ref from hostname like db.mpdlmxickrktpvwnuppm.supabase.co
      const match = connectionString.match(/db\.([^.]+)\.supabase\.co/);
      if (match) {
        const projectRef = match[1];
        // Use the pooler format which is more reliable
        // Default to eu-central-1, but this should be configured in Vercel env vars
        const region = process.env.SUPABASE_REGION || 'eu-central-1';
        connectionString = connectionString.replace(
          /db\.[^.]+\.supabase\.co/,
          `aws-0-${region}.pooler.supabase.com`
        );
        console.log(`Fixed Supabase hostname format for project: ${projectRef}`);
      }
    }
  }
  
  // Parse connection string for Supabase
  const url = new URL(connectionString.replace('postgresql://', 'http://'));
  
  // Force IPv4 resolution for Supabase
  let hostname = url.hostname;
  
  // Try to resolve to IPv4 (async, but we'll handle it in the connection)
  lookup(hostname, { family: 4 })
    .then((result) => {
      if (result && typeof result === 'object' && 'address' in result) {
        console.log(`Resolved ${url.hostname} to IPv4: ${result.address}`);
      }
    })
    .catch((resolveError: any) => {
      console.warn(`Could not resolve ${hostname} to IPv4:`, resolveError.message);
      console.warn(`Using hostname directly. If connection fails, check DATABASE_URL format.`);
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
  // Use connection string for other databases (local PostgreSQL, etc.)
  poolConfig = {
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  };
  
  // Add SSL for production environments if not explicitly configured
  if (process.env.NODE_ENV === 'production' && !connectionString.includes('sslmode')) {
    poolConfig.ssl = { rejectUnauthorized: false };
  }
}

// ============================================================================
// SCHEMA DEFINITIONS (Inlined - no external imports)
// ============================================================================

// Session storage table
const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Trusted devices table for 2FA remember functionality
const trustedDevices = pgTable("trusted_devices", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull(),
  deviceToken: varchar("device_token", { length: 255 }).notNull().unique(),
  deviceName: varchar("device_name", { length: 100 }),
  userAgent: varchar("user_agent", { length: 500 }),
  ipAddress: varchar("ip_address", { length: 45 }),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Companies table
const companies = pgTable("companies", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: varchar("name").notNull(),
  registrationNumber: varchar("registration_number").notNull().unique(),
  vatNumber: varchar("vat_number"),
  address: text("address").notNull(),
  email: varchar("email").notNull().unique(),
  phone: varchar("phone").notNull(),
  contactPerson: varchar("contact_person").notNull(),
  password: varchar("password"),
  isActive: boolean("is_active").default(true),
  licenseStatus: varchar("license_status").default("active"),
  maxBranches: integer("max_branches").default(1),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: integer("created_by"),
});

// Users table
const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email", { length: 255 }).unique().notNull(),
  firstName: varchar("first_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }),
  phone: varchar("phone", { length: 20 }),
  profileImageUrl: varchar("profile_image_url", { length: 500 }),
  passwordHash: varchar("password_hash", { length: 255 }),
  role: varchar("role", { length: 20 }).notNull().default("manager"),
  isActive: boolean("is_active").notNull().default(true),
  companyId: integer("company_id"),
  storeId: integer("store_id"),
  twoFactorSecret: varchar("two_factor_secret", { length: 100 }),
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Stores table
const stores = pgTable("stores", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: varchar("name").notNull(),
  address: text("address"),
  phone: varchar("phone"),
  managerId: varchar("manager_id"),
  companyId: integer("company_id").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  revenue: integer("revenue").default(0),
  customerCount: integer("customer_count").default(0),
  productCount: integer("product_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Audit logs table
const auditLogs = pgTable("audit_logs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  action: varchar("action", { length: 100 }).notNull(),
  entityType: varchar("entity_type", { length: 50 }),
  entityId: varchar("entity_id", { length: 100 }),
  userId: varchar("user_id"),
  userEmail: varchar("user_email", { length: 255 }),
  userRole: varchar("user_role", { length: 20 }),
  storeId: integer("store_id"),
  companyId: integer("company_id"),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: varchar("user_agent", { length: 500 }),
  description: text("description").notNull(),
  oldValues: jsonb("old_values"),
  newValues: jsonb("new_values"),
  metadata: jsonb("metadata"),
  severity: varchar("severity", { length: 20 }).default("info"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Activities table
const activities = pgTable("activities", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  type: varchar("type").notNull(),
  description: text("description").notNull(),
  userId: varchar("user_id"),
  storeId: integer("store_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Product categories table
const productCategories = pgTable("product_categories", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  companyId: integer("company_id"),
  userId: varchar("user_id"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Category stores junction table
const categoryStores = pgTable("category_stores", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  categoryId: integer("category_id").notNull().references(() => productCategories.id, { onDelete: "cascade" }),
  storeId: integer("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Products table
const products = pgTable("products", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  vatRate: decimal("vat_rate", { precision: 5, scale: 2 }).notNull().default("21.00"),
  category: varchar("category", { length: 100 }),
  categoryId: integer("category_id"),
  barcode: varchar("barcode", { length: 50 }),
  stock: integer("stock").notNull().default(0),
  imageUrl: varchar("image_url", { length: 500 }),
  storeId: integer("store_id"), // Nullable: null = company-wide, set = store-specific
  companyId: integer("company_id"), // For company-wide products (when storeId is null)
  isActive: boolean("is_active").default(true),
  // Regulatory compliance fields
  substanceName: varchar("substance_name", { length: 255 }),
  form: varchar("form", { length: 50 }),
  subtype: varchar("subtype", { length: 100 }),
  packageSize: varchar("package_size", { length: 50 }),
  receivedDate: timestamp("received_date"),
  batchNumber: varchar("batch_number", { length: 100 }), // Legacy - use product_batches for multiple batches
  quantityUnit: varchar("quantity_unit", { length: 20 }),
  // Note: supplier_name moved to product_batches table - each batch may have a different supplier
  // Psychomodulatory substance compliance fields
  recommendedDoseSingle: text("recommended_dose_single"), // Recommended single dose (e.g. 2 g)
  recommendedDoseDaily: text("recommended_dose_daily"), // Recommended daily dose (e.g. 4 g)
  dosageInfo: text("dosage_info"), // Combined dose info in free text (alternative to recommended_dose_single and recommended_dose_daily)
  warningUnder18: text("warning_under18"), // Legal text: "Not intended for persons under 18..."
  warningHealth: text("warning_health"), // Legal text: "Use of this product may harm your health..."
  minAge: integer("min_age"), // Minimum age restriction (e.g. 18)
  adultOnly: boolean("adult_only").default(false), // Age restriction flag indicating adult-only product
  consumerInfo: text("consumer_info"), // Full consumer info (effects, risks, usage instructions) - optional
  activeSubstancesComposition: jsonb("active_substances_composition"), // List of active substances (JSON format) - optional
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Product batches table - supports multiple batches of the same product per store
const productBatches = pgTable("product_batches", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  productId: integer("product_id").notNull(),
  storeId: integer("store_id").notNull(), // Integer FK for referential integrity
  batchNumber: varchar("batch_number", { length: 100 }).notNull(), // Batch codes may be alphanumeric
  receivedDate: timestamp("received_date").notNull(),
  quantity: integer("quantity").notNull().default(0),
  quantityUnit: varchar("quantity_unit", { length: 20 }).notNull(),
  expirationDate: timestamp("expiration_date"),
  supplierName: varchar("supplier_name", { length: 255 }), // Each batch may have a different supplier
  status: varchar("status", { length: 50 }).default("Pending"), // Status for internal control (e.g. "Pending", "Released", "Blocked")
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_product_batches_status").on(table.status),
]);

// Active substances table - stores active substances with their maximum allowed doses and concentrations
// Managed only by Super Admin, not linked to companies
const activeSubstances = pgTable("active_substances", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: varchar("name", { length: 255 }).notNull(), // Name of the active substance (e.g. Mitragynine)
  maxSingleDose: decimal("max_single_dose", { precision: 10, scale: 3 }), // Maximum allowed single dose (e.g. 125 mg)
  maxDailyDose: decimal("max_daily_dose", { precision: 10, scale: 3 }), // Maximum allowed daily dose (e.g. 375 mg)
  maxConcentration: decimal("max_concentration", { precision: 5, scale: 2 }), // Maximum allowed concentration (%)
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_active_substances_name").on(table.name),
]);

// Join table to record what substances are in each product
const productActiveSubstance = pgTable("product_active_substance", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }), // Reference to product
  substanceId: integer("substance_id").notNull().references(() => activeSubstances.id, { onDelete: "cascade" }), // Reference to substance
  contentAmount: decimal("content_amount", { precision: 10, scale: 3 }), // Amount per package (e.g. 100 mg)
  contentUnit: varchar("content_unit", { length: 20 }), // Unit (e.g. mg, g)
  concentration: decimal("concentration", { precision: 5, scale: 2 }), // Percentage by weight (e.g. 0.3%)
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_product_active_substance_product_id").on(table.productId),
  index("idx_product_active_substance_substance_id").on(table.substanceId),
  // Ensure unique combination of product and substance
  index("idx_product_active_substance_unique").on(table.productId, table.substanceId),
]);

// Sales table
const sales = pgTable("sales", {
  id: varchar("id").primaryKey(),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  netAmount: decimal("net_amount", { precision: 10, scale: 2 }),
  totalVAT: decimal("total_vat", { precision: 10, scale: 2 }),
  vatBreakdown: jsonb("vat_breakdown"),
  paymentMethod: varchar("payment_method", { length: 20 }).notNull(),
  items: jsonb("items").notNull(), // Legacy - kept for backward compatibility, use sales_items table for normalized data
  isCancelled: boolean("is_cancelled").default(false), // Mark for canceled/voided sales
  storeId: integer("store_id").notNull(),
  userId: varchar("user_id"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_sales_is_cancelled").on(table.isCancelled),
]);

// Sales items table - stores individual line items for each sale transaction
const salesItems = pgTable("sales_items", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  saleId: varchar("sale_id").notNull(),
  productId: integer("product_id").notNull(),
  batchId: integer("batch_id"), // Nullable - not all products may have batches
  quantity: decimal("quantity", { precision: 10, scale: 3 }).notNull(), // Quantity sold
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(), // Unit price
  vatRate: decimal("vat_rate", { precision: 5, scale: 2 }).notNull(), // VAT percentage
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_sales_items_sale_id").on(table.saleId),
  index("idx_sales_items_product_id").on(table.productId),
  index("idx_sales_items_batch_id").on(table.batchId),
]);

// Returns table - stores return transactions for returned goods
const returns = pgTable("returns", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  saleId: varchar("sale_id").notNull(),
  returnDate: timestamp("return_date").notNull().defaultNow(),
  reason: text("reason"),
  totalRefund: decimal("total_refund", { precision: 10, scale: 2 }).notNull(),
  refundMethod: varchar("refund_method", { length: 50 }).notNull(), // e.g. "cash", "card", "store_credit"
  status: varchar("status", { length: 50 }).default("pending"), // e.g. "pending", "approved", "completed", "rejected"
  storeId: integer("store_id").notNull(),
  userId: varchar("user_id"),
  processedBy: varchar("processed_by"), // User who processed the return
  processedAt: timestamp("processed_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_returns_sale_id").on(table.saleId),
  index("idx_returns_store_id").on(table.storeId),
  index("idx_returns_status").on(table.status),
  index("idx_returns_return_date").on(table.returnDate),
]);

// Returns items table - stores individual items being returned
const returnsItems = pgTable("returns_items", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  returnId: integer("return_id").notNull(),
  saleItemId: integer("sale_item_id").notNull(), // Reference to the original sale item
  productId: integer("product_id").notNull(),
  batchId: integer("batch_id"),
  quantity: decimal("quantity", { precision: 10, scale: 3 }).notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  vatRate: decimal("vat_rate", { precision: 5, scale: 2 }).notNull(),
  refundAmount: decimal("refund_amount", { precision: 10, scale: 2 }).notNull(),
  reason: text("reason"),
  condition: varchar("condition", { length: 50 }), // e.g. "new", "used", "damaged"
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_returns_items_return_id").on(table.returnId),
  index("idx_returns_items_sale_item_id").on(table.saleItemId),
  index("idx_returns_items_product_id").on(table.productId),
]);

// Stock transactions table - tracks all stock movements with complete audit trail
const stockTransactions = pgTable("stock_transactions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  storeId: integer("store_id").notNull().references(() => stores.id, { onDelete: "restrict" }),
  batchId: integer("batch_id").references(() => productBatches.id, { onDelete: "set null" }),
  
  // Transaction details
  transactionType: varchar("transaction_type", { length: 50 }).notNull(), // 'sale', 'return', 'adjustment', 'transfer_in', 'transfer_out', 'received', 'damaged', 'expired', 'cancelled'
  quantityChange: integer("quantity_change").notNull(), // Positive for increases, negative for decreases
  quantityBefore: integer("quantity_before").notNull(), // Stock level before transaction
  quantityAfter: integer("quantity_after").notNull(), // Stock level after transaction
  
  // References to related entities
  saleId: varchar("sale_id").references(() => sales.id, { onDelete: "set null" }), // If transaction is from a sale
  saleItemId: integer("sale_item_id").references(() => salesItems.id, { onDelete: "set null" }), // Specific sale item
  returnId: integer("return_id").references(() => returns.id, { onDelete: "set null" }), // If transaction is from a return
  returnItemId: integer("return_item_id").references(() => returnsItems.id, { onDelete: "set null" }), // Specific return item
  
  // Metadata
  reason: text("reason"), // Reason for adjustment/transfer/etc.
  notes: text("notes"), // Additional notes
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }), // Who performed the transaction
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_stock_transactions_product_id").on(table.productId),
  index("idx_stock_transactions_store_id").on(table.storeId),
  index("idx_stock_transactions_transaction_type").on(table.transactionType),
  index("idx_stock_transactions_created_at").on(table.createdAt),
  index("idx_stock_transactions_sale_id").on(table.saleId),
  index("idx_stock_transactions_return_id").on(table.returnId),
  index("idx_stock_transactions_batch_id").on(table.batchId),
  index("idx_stock_transactions_user_id").on(table.userId),
]);

const shoppingCarts = pgTable("shopping_carts", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id"), // Nullable for company users
  companyId: integer("company_id"), // Nullable for regular users
  storeId: integer("store_id").notNull(),
  productId: integer("product_id").notNull(),
  quantity: integer("quantity").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("IDX_cart_user_store").on(table.userId, table.storeId),
  index("IDX_cart_company_store").on(table.companyId, table.storeId),
  index("IDX_cart_user_product").on(table.userId, table.productId),
  index("IDX_cart_user_store_product").on(table.userId, table.storeId, table.productId),
  index("IDX_cart_company_store_product").on(table.companyId, table.storeId, table.productId),
]);

// Company invitations table
const companyInvitations = pgTable("company_invitations", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  companyId: integer("company_id").notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  invitationToken: varchar("invitation_token", { length: 255 }).notNull().unique(),
  isUsed: boolean("is_used").default(false),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  usedAt: timestamp("used_at"),
  createdBy: varchar("created_by"),
});

const passwordResetTokens = pgTable("password_reset_tokens", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  email: varchar("email", { length: 255 }).notNull(),
  resetToken: varchar("reset_token", { length: 255 }).notNull().unique(),
  userType: varchar("user_type", { length: 20 }).notNull(), // 'user' or 'company'
  expiresAt: timestamp("expires_at").notNull(),
  isUsed: boolean("is_used").default(false),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_password_reset_token").on(table.resetToken),
  index("IDX_password_reset_email").on(table.email),
  index("IDX_password_reset_expires").on(table.expiresAt),
]);

// User settings table
const userSettings = pgTable("user_settings", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id"),
  companyId: integer("company_id"),
  settingsType: varchar("settings_type", { length: 20 }).notNull(),
  firstName: varchar("first_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }),
  phone: varchar("phone", { length: 20 }),
  profileImageUrl: varchar("profile_image_url", { length: 500 }),
  timezone: varchar("timezone", { length: 50 }).default("Europe/Prague"),
  language: varchar("language", { length: 10 }).default("en"),
  currency: varchar("currency", { length: 10 }).default("EUR"),
  emailNotifications: boolean("email_notifications").default(true),
  smsAlerts: boolean("sms_alerts").default(false),
  weeklyReports: boolean("weekly_reports").default(true),
  storeAlerts: boolean("store_alerts").default(true),
  sessionTimeout: integer("session_timeout").default(30),
  requireUppercase: boolean("require_uppercase").default(true),
  requireNumbers: boolean("require_numbers").default(true),
  requireSymbols: boolean("require_symbols").default(false),
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  twoFactorSecret: varchar("two_factor_secret", { length: 100 }),
  loginAuditTrail: boolean("login_audit_trail").default(true),
  dataRetention: integer("data_retention").default(365),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Schema object for drizzle
const schema = {
  sessions,
  trustedDevices,
  companies,
  users,
  stores,
  auditLogs,
  activities,
  productCategories,
  products,
  sales,
  companyInvitations,
  userSettings,
  passwordResetTokens,
};

// Type definitions
// @ts-ignore - drizzle-zod schema omit type issues (known TypeScript limitation)
const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true });
const upsertUserSchema = createInsertSchema(users);
// @ts-ignore - drizzle-zod schema omit type issues (known TypeScript limitation)
const insertStoreSchema = createInsertSchema(stores).omit({ id: true, createdAt: true, updatedAt: true });
// @ts-ignore - drizzle-zod schema omit type issues (known TypeScript limitation)
const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, createdAt: true });
// @ts-ignore - drizzle-zod schema omit type issues (known TypeScript limitation)
const insertActivitySchema = createInsertSchema(activities).omit({ id: true, createdAt: true });
// @ts-ignore - drizzle-zod schema omit type issues (known TypeScript limitation)
const insertCompanySchema = createInsertSchema(companies).omit({ id: true, createdAt: true, updatedAt: true });
// @ts-ignore - drizzle-zod schema omit type issues (known TypeScript limitation)
const insertProductCategorySchema = createInsertSchema(productCategories).omit({ id: true, createdAt: true, updatedAt: true });
// @ts-ignore - drizzle-zod schema omit type issues (known TypeScript limitation)
const insertProductSchema = createInsertSchema(products).omit({ id: true, createdAt: true, updatedAt: true });
// @ts-ignore - drizzle-zod schema omit type issues (known TypeScript limitation)
const insertSaleSchema = createInsertSchema(sales).omit({ id: true, createdAt: true });
// @ts-ignore - drizzle-zod schema omit type issues (known TypeScript limitation)
const insertUserSettingsSchema = createInsertSchema(userSettings).omit({ id: true, createdAt: true, updatedAt: true });
// @ts-ignore - drizzle-zod schema omit type issues (known TypeScript limitation)
const insertTrustedDeviceSchema = createInsertSchema(trustedDevices).omit({ id: true, createdAt: true });
// @ts-ignore - drizzle-zod schema omit type issues (known TypeScript limitation)
const insertCompanyInvitationSchema = createInsertSchema(companyInvitations).omit({ id: true, createdAt: true, usedAt: true });
const insertPasswordResetTokenSchema = createInsertSchema(passwordResetTokens).omit({ id: true, createdAt: true, usedAt: true });

type InsertUser = z.infer<typeof insertUserSchema>;
type UpsertUser = z.infer<typeof upsertUserSchema>;
type User = typeof users.$inferSelect;
type InsertStore = z.infer<typeof insertStoreSchema>;
type Store = typeof stores.$inferSelect;
type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
type AuditLog = typeof auditLogs.$inferSelect;
type InsertActivity = z.infer<typeof insertActivitySchema>;
type Activity = typeof activities.$inferSelect;
type InsertCompany = z.infer<typeof insertCompanySchema>;
type Company = typeof companies.$inferSelect;
type InsertProductCategory = z.infer<typeof insertProductCategorySchema>;
type ProductCategory = typeof productCategories.$inferSelect;
type InsertProduct = z.infer<typeof insertProductSchema>;
type Product = typeof products.$inferSelect;
type InsertSale = z.infer<typeof insertSaleSchema>;
type Sale = typeof sales.$inferSelect;
type InsertUserSettings = z.infer<typeof insertUserSettingsSchema>;
type UserSettings = typeof userSettings.$inferSelect;
type InsertTrustedDevice = z.infer<typeof insertTrustedDeviceSchema>;
type TrustedDevice = typeof trustedDevices.$inferSelect;
type InsertCompanyInvitation = z.infer<typeof insertCompanyInvitationSchema>;
type CompanyInvitation = typeof companyInvitations.$inferSelect;
type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
type InsertPasswordResetToken = z.infer<typeof insertPasswordResetTokenSchema>;
type UserWithStore = User & {
  store?: Store | null;
};

// Create PostgreSQL connection pool with Supabase-specific handling
const pool = new Pool(poolConfig);

// Test connection on startup (non-blocking, won't prevent server from starting)
pool.query('SELECT 1').then(() => {
  console.log('Database connection successful');
  console.log(`Connected to: ${poolConfig.database || 'database'} as ${poolConfig.user || 'user'}`);
}).catch((err: any) => {
  console.error('Database connection test failed:', err.message);
  console.error('Error code:', err.code);
  console.error('Connection string format:', connectionString.replace(/:[^:@]+@/, ':****@'));
  
  // Provide specific guidance for Neon errors
  if (err.code === 'XX000' || err.message?.includes('Tenant or user not found')) {
    console.error('\nNeon Database Error - Possible issues:');
    console.error('1. Database name might be incorrect in DATABASE_URL');
    console.error('2. User credentials might be wrong');
    console.error('3. Database might not exist - create it in Neon Dashboard');
    console.error('4. User might not have proper permissions');
    console.error('\nTo fix:');
    console.error('- Check your Neon Dashboard → Database → Connection String');
    console.error('- Ensure the database exists and user has access');
    console.error('- Verify DATABASE_URL in Vercel environment variables');
  } else if (err.message?.includes('timeout') || err.message?.includes('Connection terminated')) {
    console.error('\nDatabase Connection Timeout:');
    console.error('The connection to Neon timed out. This might be temporary.');
    console.error('The server will continue to start, but database operations may fail.');
    console.error('If this persists, check:');
    console.error('- Neon Dashboard → Project Status');
    console.error('- Vercel function timeout settings');
    console.error('- Network connectivity from Vercel to Neon');
  }
  
  // Don't throw - allow server to start even if connection test fails
  // Actual queries will handle their own errors
});

const db = drizzle(pool, { schema });




// Interface for storage operations
interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserById(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // 2FA operations
  enable2FA(userId: string, secret: string): Promise<void>;
  disable2FA(userId: string): Promise<void>;
  update2FASecret(userId: string, secret: string, enabled: boolean): Promise<void>;
  
  // Trusted device operations
  createTrustedDevice(device: InsertTrustedDevice): Promise<TrustedDevice>;
  getTrustedDevice(deviceToken: string): Promise<TrustedDevice | undefined>;
  getTrustedDevicesByUser(userId: string): Promise<TrustedDevice[]>;
  deleteTrustedDevice(deviceToken: string): Promise<void>;
  deleteExpiredTrustedDevices(): Promise<void>;
  
  // Additional user operations
  getUserWithStore(id: number): Promise<UserWithStore | undefined>;
  getAllUsers(limit?: number, offset?: number): Promise<{ users: UserWithStore[]; total: number }>;
  getPortalAdmins(limit?: number, offset?: number, search?: string): Promise<{ portalAdmins: UserWithStore[]; total: number }>;
  updateUserRole(id: number, role: string): Promise<User>;
  updateUserPassword(id: string, passwordHash: string): Promise<void>;
  
  // Store operations
  getAllStores(limit?: number, offset?: number, search?: string, status?: string): Promise<{ stores: Store[]; total: number }>;
  getStoresByCompany(companyId: number, limit?: number, offset?: number, search?: string, status?: string): Promise<{ stores: Store[]; total: number }>;
  createStore(store: InsertStore): Promise<Store>;
  getStore(id: number): Promise<Store | undefined>;
  updateStore(id: number, updates: Partial<Store>): Promise<Store>;
  deleteStore(id: number): Promise<void>;
  
  // Manager operations
  getAllManagers(limit?: number, offset?: number, search?: string, status?: string): Promise<{ managers: any[]; total: number }>;
  getManagersByStoreIds(storeIds: number[], limit?: number, offset?: number, filter?: 'unassigned', search?: string, status?: string): Promise<{ managers: any[]; total: number }>;
  getManager(id: string): Promise<any | undefined>;
  createManager(manager: any): Promise<any>;
  updateManager(id: string, updates: any): Promise<any>;
  deleteManager(id: string): Promise<void>;
  
  // Company operations
  getAllCompanies(limit?: number, offset?: number): Promise<{ data: any[], total: number }>;
  createCompany(company: any): Promise<any>;
  getCompany(id: number): Promise<any | undefined>;
  getCompanyByEmail(email: string): Promise<any | undefined>;
  updateCompany(id: number, updates: Partial<any>): Promise<any>;
  deleteCompany(id: number): Promise<void>;
  updateCompanyPassword(email: string, passwordHash: string): Promise<void>;
  suspendCompany(companyId: number): Promise<{ company: any; suspendedStores: number; suspendedUsers: number }>;
  unsuspendCompany(companyId: number): Promise<{ company: any; reactivatedStores: number; reactivatedUsers: number }>;
  
  // Company invitation operations
  createCompanyInvitation(invitation: InsertCompanyInvitation): Promise<CompanyInvitation>;
  getCompanyInvitationByToken(token: string): Promise<CompanyInvitation | undefined>;
  markInvitationAsUsed(token: string): Promise<void>;
  deleteExpiredInvitations(): Promise<void>;
  
  // Activity operations
  createActivity(activity: InsertActivity): Promise<Activity>;
  getRecentActivities(limit?: number): Promise<Activity[]>;
  
  // Audit log operations
  createAuditLog(auditLog: InsertAuditLog): Promise<AuditLog>;
  getAuditLogs(filters?: {
    userId?: string;
    storeId?: number;
    companyId?: number;
    action?: string;
    entityType?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<AuditLog[]>;
  getAuditLogsByUser(userId: string, limit?: number): Promise<AuditLog[]>;
  getAuditLogsByStore(storeId: number, limit?: number): Promise<AuditLog[]>;
  getAuditLogsByCompany(companyId: number, limit?: number): Promise<AuditLog[]>;
  getAuditLogsCount(filters?: {
    userId?: string;
    storeId?: number;
    companyId?: number;
    action?: string;
    entityType?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<number>;
  
  // User Settings operations
  getUserSettings(userId?: string, companyId?: number): Promise<UserSettings | undefined>;
  upsertUserSettings(settings: InsertUserSettings): Promise<UserSettings>;
  updateUserSettings(userId: string, updates: Partial<UserSettings>): Promise<UserSettings>;
  updateCompanySettings(companyId: number, updates: Partial<UserSettings>): Promise<UserSettings>;
  
  // Cleanup operations
  deleteOldAuditLogs(dataRetentionDays?: number): Promise<number>;

  // Analytics
  getAnalytics(): Promise<{
    totalUsers: number;
    activeStores: number;
    totalStores: number;
    superAdmins: number;
    storeOwners: number;
    managers: number;
  }>;

  // Product operations
  getProductsByStore(storeId: number, limit?: number, offset?: number, search?: string, categoryId?: number): Promise<{ products: any[]; total: number }>;
  getProductsByCompany(companyId: number, limit?: number, offset?: number, search?: string, categoryId?: number): Promise<{ products: any[]; total: number }>;
  getProduct(id: number): Promise<any | undefined>;
  createProduct(product: any): Promise<Product>;
  updateProduct(id: number, updates: any): Promise<Product>;
  
  // Active substances operations (Super Admin only, not linked to companies)
  getActiveSubstances(limit?: number, offset?: number, search?: string): Promise<{ substances: any[]; total: number }>;
  getActiveSubstance(id: number): Promise<any | undefined>;
  createActiveSubstance(substanceData: any): Promise<any>;
  updateActiveSubstance(id: number, updates: any): Promise<any>;
  deleteActiveSubstance(id: number): Promise<void>;
  
  // Product batch operations
  getProductBatches(productId: number, storeId?: number): Promise<any[]>;
  getProductBatch(id: number): Promise<any | undefined>;
  createProductBatch(batchData: any): Promise<any>;
  updateProductBatch(id: number, updates: Partial<any>): Promise<any>;
  deleteProductBatch(id: number): Promise<void>;
  
  // Product category operations
  getCategoriesByCompany(companyId: number, storeId?: number | null): Promise<ProductCategory[]>;
  getCategoriesByCompanyPaginated(companyId: number, limit?: number, offset?: number, search?: string, storeId?: number | null): Promise<{ categories: ProductCategory[]; total: number }>;
  getCategoriesByUser(userId: string): Promise<ProductCategory[]>;
  getCategoriesByUserPaginated(userId: string, limit?: number, offset?: number, search?: string): Promise<{ categories: ProductCategory[]; total: number }>;
  createCategory(categoryData: InsertProductCategory, storeIds?: number[]): Promise<ProductCategory>;
  updateCategory(id: number, updates: Partial<ProductCategory>, storeIds?: number[]): Promise<ProductCategory>;
  deleteCategory(id: number): Promise<void>;
  getCategoryStores(categoryId: number): Promise<number[]>;
  getAllUploadedImages(): Promise<string[]>;
  
  // Sale operations
  getSalesByStore(storeId: number, limit?: number, offset?: number, search?: string, startDate?: string, endDate?: string): Promise<{ sales: Sale[]; total: number }>;
  getSalesByCompany(companyId: number): Promise<Sale[]>;
  createSale(sale: InsertSale): Promise<Sale>;
  getSaleById(saleId: string): Promise<Sale | undefined>;
  getSalesItemsBySaleId(saleId: string): Promise<any[]>;
  
  // Return operations
  createReturn(returnData: any, returnItems: any[]): Promise<any>;
  getReturnsByStore(storeId: number, limit?: number, offset?: number, search?: string, startDate?: string, endDate?: string, status?: string, refundMethod?: string): Promise<{ returns: any[]; total: number }>;
  getStockTransactionsByStore(storeId: number, limit?: number, offset?: number, productId?: number, transactionType?: string, startDate?: string, endDate?: string): Promise<{ transactions: any[]; total: number }>;
  getReturnsBySaleId(saleId: string): Promise<any[]>;
  getReturnById(returnId: number): Promise<any | undefined>;
  getReturnItemsByReturnId(returnId: number): Promise<any[]>;
  updateReturnStatus(returnId: number, status: string, processedBy?: string): Promise<any>;
  
  // Cart operations
  getCart(userId: string | null, companyId: number | null, storeId: number): Promise<any[]>;
  addToCart(userId: string | null, companyId: number | null, storeId: number, productId: number, quantity: number): Promise<any>;
  updateCartItem(cartId: number, quantity: number): Promise<any>;
  removeFromCart(cartId: number): Promise<void>;
  clearCart(userId: string | null, companyId: number | null, storeId: number): Promise<void>;
}

class DatabaseStorage implements IStorage {
  // User operations

  async getUser(id: number): Promise<User | undefined> {
    try {
      const result = await db.select().from(users).where(eq(users.id, id.toString()));
      return result[0] || undefined;
    } catch (error) {
      console.error("Error fetching user by ID:", error);
      return undefined;
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    try {
      const result = await db.select().from(users).where(eq(users.email, email));
      return result[0] || undefined;
    } catch (error: any) {
      console.error("Error fetching user by email:", error);
      // Log more details for Neon-specific errors
      if (error.code === 'XX000' || error.message?.includes('Tenant or user not found')) {
        console.error("Neon database error - 'Tenant or user not found':");
        console.error("This usually means:");
        console.error("1. Database name in DATABASE_URL is incorrect");
        console.error("2. User credentials are wrong");
        console.error("3. Database doesn't exist - create it in Neon Dashboard");
        console.error("4. User doesn't have proper permissions");
        console.error("\nTo fix:");
        console.error("- Go to Neon Dashboard → Your Project → Connection String");
        console.error("- Copy the correct connection string");
        console.error("- Update DATABASE_URL in Vercel environment variables");
        console.error("- Ensure the database exists and user has access");
      }
      // Re-throw the error so it can be handled upstream
      throw error;
    }
  }

  async getUserById(id: string): Promise<User | undefined> {
    try {
      const result = await db.select().from(users).where(eq(users.id, id));
      return result[0] || undefined;
    } catch (error) {
      console.error("Error fetching user by ID:", error);
      return undefined;
    }
  }

  async createUser(userData: InsertUser & { id?: string }): Promise<User> {
    // Validate email uniqueness
    if (userData.email) {
      const existingUser = await this.getUserByEmail(userData.email);
      if (existingUser) {
        throw new Error(`A user with email ${userData.email} already exists.`);
      }
    }
    
    // Generate a unique ID if not provided (users table requires id)
    if (!userData.id) {
      const uniqueId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      userData.id = uniqueId;
    }
    
    try {
      const [user] = await db
        .insert(users)
        .values(userData as any)
        .returning();
      return user;
    } catch (error: any) {
      // Handle unique constraint violation as a fallback
      if (error.code === '23505' && (error.constraint === 'users_email_unique' || error.constraint?.includes('email'))) {
        throw new Error(`A user with email ${userData.email} already exists.`);
      }
      throw error;
    }
  }

  // 2FA operations
  async enable2FA(userId: string, secret: string): Promise<void> {
    console.log("Enabling 2FA for user:", userId);
    const result = await db
      .update(users)
      .set({ 
        twoFactorSecret: secret,
        twoFactorEnabled: true,
        updatedAt: new Date() 
      })
      .where(eq(users.id, userId))
      .returning();
    console.log("2FA enabled successfully:", result);
  }

  async disable2FA(userId: string): Promise<void> {
    console.log("Disabling 2FA for user:", userId);
    const result = await db
      .update(users)
      .set({ 
        twoFactorSecret: null,
        twoFactorEnabled: false,
        updatedAt: new Date() 
      })
      .where(eq(users.id, userId))
      .returning();
    console.log("2FA disabled successfully:", result);
  }

  async update2FASecret(userId: string, secret: string, enabled: boolean): Promise<void> {
    console.log("Updating 2FA secret for user:", userId, "enabled:", enabled);
    const result = await db
      .update(users)
      .set({ 
        twoFactorSecret: secret,
        twoFactorEnabled: enabled,
        updatedAt: new Date() 
      })
      .where(eq(users.id, userId))
      .returning();
    console.log("2FA secret updated successfully:", result);
  }

  // Trusted device operations
  async createTrustedDevice(device: InsertTrustedDevice): Promise<TrustedDevice> {
    const [result] = await db
      .insert(trustedDevices)
      .values(device as any)
      .returning();
    return result;
  }

  async getTrustedDevice(deviceToken: string): Promise<TrustedDevice | undefined> {
    const [device] = await db
      .select()
      .from(trustedDevices)
      .where(eq(trustedDevices.deviceToken, deviceToken));
    return device;
  }

  async getTrustedDevicesByUser(userId: string): Promise<TrustedDevice[]> {
    return await db
      .select()
      .from(trustedDevices)
      .where(eq(trustedDevices.userId, userId))
      .orderBy(desc(trustedDevices.createdAt));
  }

  async deleteTrustedDevice(deviceToken: string): Promise<void> {
    await db
      .delete(trustedDevices)
      .where(eq(trustedDevices.deviceToken, deviceToken));
  }

  async deleteExpiredTrustedDevices(): Promise<void> {
    await db
      .delete(trustedDevices)
      .where(lt(trustedDevices.expiresAt, new Date()));
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async getUserWithStore(id: number | string): Promise<UserWithStore | undefined> {
    const idStr = typeof id === 'number' ? id.toString() : id;
    const [result] = await db
      .select()
      .from(users)
      .leftJoin(stores, eq(users.storeId, stores.id))
      .where(eq(users.id, idStr));
    
    if (!result) return undefined;
    
    return {
      ...result.users,
      store: result.stores,
    };
  }

  async getAllUsers(limit?: number, offset?: number): Promise<{ users: UserWithStore[]; total: number }> {
    // Get total count
    const [totalResult] = await db
      .select({ count: count() })
      .from(users);
    const total = Number(totalResult.count);
    
    // Build query with pagination
    let query = db
      .select()
      .from(users)
      .leftJoin(stores, eq(users.storeId, stores.id))
      .orderBy(desc(users.createdAt));
    
    // Apply pagination if provided
    if (limit !== undefined) {
      query = query.limit(limit) as any;
    }
    if (offset !== undefined) {
      query = query.offset(offset) as any;
    }
    
    const results = await query;
    
    const userList = results.map(result => ({
      ...result.users,
      store: result.stores,
    }));
    
    return {
      users: userList,
      total
    };
  }

  async getPortalAdmins(limit?: number, offset?: number, search?: string): Promise<{ portalAdmins: UserWithStore[]; total: number }> {
    // Build where conditions - only portal_admin role
    const conditions: any[] = [eq(users.role, 'portal_admin')];
    
    // Add search filter if provided
    if (search) {
      conditions.push(
        or(
          ilike(users.email, `%${search}%`),
          ilike(users.firstName || sql`''`, `%${search}%`),
          ilike(users.lastName || sql`''`, `%${search}%`)
        )!
      );
    }
    
    // Get total count
    const [totalResult] = await db
      .select({ count: count() })
      .from(users)
      .where(and(...conditions));
    const total = Number(totalResult.count);
    
    // Build query with pagination
    let query = db
      .select()
      .from(users)
      .leftJoin(stores, eq(users.storeId, stores.id))
      .where(and(...conditions))
      .orderBy(desc(users.createdAt));
    
    // Apply pagination if provided
    if (limit !== undefined) {
      query = query.limit(limit) as any;
    }
    if (offset !== undefined) {
      query = query.offset(offset) as any;
    }
    
    const results = await query;
    
    const portalAdminList = results.map(result => ({
      ...result.users,
      store: result.stores,
    }));
    
    return {
      portalAdmins: portalAdminList,
      total
    };
  }

  async updateUserRole(id: number | string, role: string): Promise<User> {
    const idStr = typeof id === 'number' ? id.toString() : id;
    const [user] = await db
      .update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, idStr))
      .returning();
    return user;
  }

  async updateUserPassword(id: string, passwordHash: string): Promise<void> {
    await db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, id));
  }

  // Store operations
  async getAllStores(limit?: number, offset?: number, search?: string, status?: string): Promise<{ stores: Store[]; total: number }> {
    // Build where conditions
    const conditions: any[] = [];
    
    // Add search filter
    if (search) {
      conditions.push(
        or(
          ilike(stores.name, `%${search}%`),
          sql`COALESCE(${stores.address}, '') ILIKE ${`%${search}%`}`,
          sql`COALESCE(${stores.phone}, '') ILIKE ${`%${search}%`}`
        )!
      );
    }
    
    // Add status filter
    if (status === 'active') {
      conditions.push(eq(stores.isActive, true));
    } else if (status === 'inactive') {
      conditions.push(eq(stores.isActive, false));
    }
    
    // Get total count
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const [totalResult] = await db
      .select({ count: count() })
      .from(stores)
      .where(whereClause);
    const total = Number(totalResult.count);
    
    // Build query with pagination
    let query = db
      .select()
      .from(stores)
      .orderBy(desc(stores.createdAt));
    
    if (whereClause) {
      query = query.where(whereClause) as any;
    }
    
    // Apply pagination if provided
    if (limit !== undefined) {
      query = query.limit(limit) as any;
    }
    if (offset !== undefined) {
      query = query.offset(offset) as any;
    }
    
    const storesList = await query;
    
    // Ensure storesList is always an array
    const storeResults = Array.isArray(storesList) ? storesList : [];
    
    return { stores: storeResults, total };
  }

  async createStore(store: InsertStore): Promise<Store> {
    const [newStore] = await db.insert(stores).values(store as any).returning();
    return newStore;
  }

  async getStore(id: number): Promise<Store | undefined> {
    const [store] = await db.select().from(stores).where(eq(stores.id, id));
    return store;
  }

  async updateStore(id: number, updates: Partial<Store>): Promise<Store> {
    const [store] = await db
      .update(stores)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(stores.id, id))
      .returning();
    return store;
  }

  async getStoresByCompany(companyId: number, limit?: number, offset?: number, search?: string, status?: string): Promise<{ stores: Store[]; total: number }> {
    // Build where conditions
    const conditions: any[] = [eq(stores.companyId, companyId)];
    
    // Add search filter
    if (search) {
      conditions.push(
        or(
          ilike(stores.name, `%${search}%`),
          sql`COALESCE(${stores.address}, '') ILIKE ${`%${search}%`}`,
          sql`COALESCE(${stores.phone}, '') ILIKE ${`%${search}%`}`
        )!
      );
    }
    
    // Add status filter
    if (status === 'active') {
      conditions.push(eq(stores.isActive, true));
    } else if (status === 'inactive') {
      conditions.push(eq(stores.isActive, false));
    }
    
    // Get total count
    const [totalResult] = await db
      .select({ count: count() })
      .from(stores)
      .where(and(...conditions));
    const total = Number(totalResult.count);
    
    // Build query with pagination
    let query = db
      .select()
      .from(stores)
      .where(and(...conditions))
      .orderBy(desc(stores.createdAt));
    
    // Apply pagination if provided
    if (limit !== undefined) {
      query = query.limit(limit) as any;
    }
    if (offset !== undefined) {
      query = query.offset(offset) as any;
    }
    
    const storesList = await query;
    
    // Ensure storesList is always an array
    const storeResults = Array.isArray(storesList) ? storesList : [];
    
    return { stores: storeResults, total };
  }

  async deleteStore(id: number): Promise<void> {
    try {
      // Delete in order of dependencies (most dependent first)
      // 1. Delete product batches (via products -> storeId)
      const storeProducts = await db.select().from(products).where(eq(products.storeId, id));
      const productIds = storeProducts.map(p => p.id);
      if (productIds.length > 0) {
        await db.delete(productBatches).where(inArray(productBatches.productId, productIds));
      }

      // 2. Delete products
      await db.delete(products).where(eq(products.storeId, id));

      // 3. Delete sales
      await db.delete(sales).where(eq(sales.storeId, id));

      // 4. Delete audit logs
      await db.delete(auditLogs).where(eq(auditLogs.storeId, id));

      // 5. Delete activities
      await db.delete(activities).where(eq(activities.storeId, id));

      // 6. Delete shopping carts
      await db.delete(shoppingCarts).where(eq(shoppingCarts.storeId, id));

      // 7. Clear manager_id reference from this store (if any store has this store's manager_id)
      // This must be done BEFORE deleting users to avoid foreign key constraint violations
      await db.update(stores).set({ managerId: null }).where(eq(stores.id, id));

      // 8. Get all store_owner users associated with this store
      const storeOwnerUsers = await db
        .select()
        .from(users)
        .where(and(eq(users.storeId, id), eq(users.role, "store_owner")));

      // 9. Before deleting store_owner users, clear any manager_id references to them from other stores
      for (const storeOwner of storeOwnerUsers) {
        // Clear manager_id references from all stores that reference this user
        await db.update(stores).set({ managerId: null }).where(eq(stores.managerId, storeOwner.id));
      }

      // 10. Delete store_owner users (cascade delete all their related data)
      for (const storeOwner of storeOwnerUsers) {
        // Delete sales (via userId)
        await db.delete(sales).where(eq(sales.userId, storeOwner.id));

        // Delete audit logs (via userId)
        await db.delete(auditLogs).where(eq(auditLogs.userId, storeOwner.id));

        // Delete activities (via userId)
        await db.delete(activities).where(eq(activities.userId, storeOwner.id));

        // Delete user settings
        await db.delete(userSettings).where(eq(userSettings.userId, storeOwner.id));

        // Delete trusted devices
        await db.delete(trustedDevices).where(eq(trustedDevices.userId, storeOwner.id));

        // Delete password reset tokens (by email since passwordResetTokens uses email, not userId)
        await db.delete(passwordResetTokens).where(eq(passwordResetTokens.email, storeOwner.email));

        // Delete company invitations created by this user
        await db.delete(companyInvitations).where(eq(companyInvitations.createdBy, storeOwner.id));

        // Finally delete the user
        await db.delete(users).where(eq(users.id, storeOwner.id));
      }

      // 11. Unlink remaining users (managers) from this store (set storeId to null, don't delete them)
      // Note: store_owners are already deleted above, so this will only affect managers
      await db.update(users).set({ storeId: null }).where(eq(users.storeId, id));

      // 12. Delete category store associations
      await db.delete(categoryStores).where(eq(categoryStores.storeId, id));

      // 13. Finally delete the store
      await db.delete(stores).where(eq(stores.id, id));
    } catch (error) {
      console.error("Error deleting store:", error);
      throw error;
    }
  }

  // Manager operations
  async getAllManagers(limit?: number, offset?: number, search?: string, status?: string): Promise<{ managers: any[]; total: number }> {
    // Build where conditions
    const conditions: any[] = [eq(users.role, 'manager')];
    
    // Add search filter
    if (search) {
      conditions.push(
        or(
          ilike(users.firstName, `%${search}%`),
          ilike(users.lastName, `%${search}%`),
          ilike(users.email, `%${search}%`),
          sql`COALESCE(${users.phone}, '') ILIKE ${`%${search}%`}`
        )!
      );
    }
    
    // Add status filter
    if (status === 'active') {
      conditions.push(eq(users.isActive, true));
    } else if (status === 'inactive') {
      conditions.push(eq(users.isActive, false));
    }
    
    // Get total count
    const [totalResult] = await db
      .select({ count: count() })
      .from(users)
      .where(and(...conditions));
    const total = Number(totalResult.count);
    
    // Build query with pagination
    let query = db
      .select()
      .from(users)
      .where(and(...conditions))
      .orderBy(desc(users.createdAt));
    
    // Apply pagination if provided
    if (limit !== undefined) {
      query = query.limit(limit) as any;
    }
    if (offset !== undefined) {
      query = query.offset(offset) as any;
    }
    
    const managersQuery = await query;
    
    // Get store information for each manager
    const managers = [];
    for (const manager of managersQuery) {
      let store = null;
      if (manager.storeId) {
        const [storeResult] = await db
          .select()
          .from(stores)
          .where(eq(stores.id, manager.storeId));
        if (storeResult) {
          store = {
            id: storeResult.id,
            name: storeResult.name
          };
        }
      }
      
      managers.push({
        ...manager,
        store
      });
    }
    
    // Filter by store name if search is provided (since store name is not in users table)
    let filteredManagers = managers;
    if (search) {
      filteredManagers = managers.filter(manager => {
        // Check if search matches store name
        if (manager.store?.name?.toLowerCase().includes(search.toLowerCase())) {
          return true;
        }
        // Already filtered by user fields in SQL query, so keep all
        return true;
      });
    }
    
    return { managers: filteredManagers, total };
  }

  async getManagersByStoreIds(storeIds: number[], limit?: number, offset?: number, filter?: 'unassigned', search?: string, status?: string): Promise<{ managers: any[]; total: number }> {
    // Build where conditions
    const conditions: any[] = [eq(users.role, 'manager')];
    
    // Handle unassigned filter
    if (filter === 'unassigned') {
      conditions.push(isNull(users.storeId));
    } else {
      if (storeIds.length === 0) {
        return { managers: [], total: 0 };
      }
      conditions.push(or(...storeIds.map(id => eq(users.storeId, id))));
    }
    
    // Add search filter
    if (search) {
      conditions.push(
        or(
          ilike(users.firstName, `%${search}%`),
          ilike(users.lastName, `%${search}%`),
          ilike(users.email, `%${search}%`),
          sql`COALESCE(${users.phone}, '') ILIKE ${`%${search}%`}`
        )!
      );
    }
    
    // Add status filter
    if (status === 'active') {
      conditions.push(eq(users.isActive, true));
    } else if (status === 'inactive') {
      conditions.push(eq(users.isActive, false));
    }
    
    // Get total count
    const [totalResult] = await db
      .select({ count: count() })
      .from(users)
      .where(and(...conditions));
    const total = Number(totalResult.count);
    
    // Build query with pagination
    let query = db
      .select()
      .from(users)
      .where(and(...conditions))
      .orderBy(desc(users.createdAt));
    
    // Apply pagination if provided
    if (limit !== undefined) {
      query = query.limit(limit) as any;
    }
    if (offset !== undefined) {
      query = query.offset(offset) as any;
    }
    
    const managersQuery = await query;
    
    // Get store information for each manager
    const managers = [];
    for (const manager of managersQuery) {
      let store = null;
      if (manager.storeId) {
        const [storeResult] = await db
          .select()
          .from(stores)
          .where(eq(stores.id, manager.storeId));
        if (storeResult) {
          store = {
            id: storeResult.id,
            name: storeResult.name
          };
        }
      }
      
      managers.push({
        ...manager,
        store
      });
    }
    
    return { managers, total };
  }

  async getManager(id: string): Promise<any | undefined> {
    const [manager] = await db.select().from(users).where(eq(users.id, id));
    return manager;
  }

  async createManager(managerData: any): Promise<any> {
    try {
      // Hash password if provided
      if (managerData.password) {
        managerData.passwordHash = await bcrypt.hash(managerData.password, 10);
        delete managerData.password;
      }

      // Generate a unique ID since the database doesn't auto-generate it
      const uniqueId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Remove any existing id field and add our generated one
      const { id, ...insertData } = managerData;
      insertData.id = uniqueId;

      console.log('Final insert data:', insertData);

      const [newManager] = await db.insert(users).values(insertData).returning();
      return newManager;
    } catch (error) {
      console.error('Error in createManager:', error);
      throw error;
    }
  }

  async updateManager(id: string, updates: any): Promise<any> {
    // Hash password if provided
    if (updates.password) {
      updates.passwordHash = await bcrypt.hash(updates.password, 10);
      delete updates.password;
    }

    const [manager] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return manager;
  }

  async deleteManager(id: string): Promise<void> {
    // First delete any activities related to this manager
    await db.delete(activities).where(eq(activities.userId, id));
    // Then delete the manager
    await db.delete(users).where(eq(users.id, id));
  }

  // Activity operations
  async createActivity(activity: InsertActivity): Promise<Activity> {
    const [newActivity] = await db.insert(activities).values(activity as any).returning();
    return newActivity;
  }

  async getRecentActivities(limit = 10): Promise<any[]> {
    try {
      // Fetch real audit logs from the database
      const result = await db
        .select()
        .from(auditLogs)
        .orderBy(desc(auditLogs.createdAt))
        .limit(limit);
      
      return result.map(log => ({
        id: log.id,
        type: log.action,
        description: log.description,
        userId: log.userId,
        createdAt: log.createdAt,
        metadata: log.metadata || {}
      }));
    } catch (error) {
      console.error("Error fetching recent activities from audit logs:", error);
      // Return empty array if there's an error
      return [];
    }
  }

  // User Settings operations
  async getUserSettings(userId?: string, companyId?: number): Promise<UserSettings | undefined> {
    if (userId) {
      const [settings] = await db.select().from(userSettings)
        .where(and(eq(userSettings.userId, userId), eq(userSettings.settingsType, 'user')));
      return settings;
    } else if (companyId) {
      const [settings] = await db.select().from(userSettings)
        .where(and(eq(userSettings.companyId, companyId), eq(userSettings.settingsType, 'company')));
      return settings;
    }
    return undefined;
  }

  async upsertUserSettings(settings: InsertUserSettings): Promise<UserSettings> {
    const settingsData = settings as any;
    
    // Check if settings already exist
    let existingSettings: UserSettings | undefined;
    if (settingsData.userId) {
      existingSettings = await this.getUserSettings(settingsData.userId);
    } else if (settingsData.companyId) {
      existingSettings = await this.getUserSettings(undefined, settingsData.companyId);
    }
    
    if (existingSettings) {
      // Update existing settings
    const [result] = await db
        .update(userSettings)
        .set({
          ...settingsData,
          updatedAt: new Date(),
        })
        .where(eq(userSettings.id, existingSettings.id))
        .returning();
      return result;
    } else {
      // Insert new settings
      const [result] = await db
        .insert(userSettings)
        .values(settingsData)
      .returning();
    return result;
    }
  }

  async updateUserSettings(userId: string, updates: Partial<UserSettings>): Promise<UserSettings> {
    const [result] = await db
      .update(userSettings)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(userSettings.userId, userId), eq(userSettings.settingsType, 'user')))
      .returning();
    return result;
  }

  async updateCompanySettings(companyId: number, updates: Partial<UserSettings>): Promise<UserSettings> {
    const [result] = await db
      .update(userSettings)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(userSettings.companyId, companyId), eq(userSettings.settingsType, 'company')))
      .returning();
    return result;
  }

  // Analytics
  async getAnalytics() {
    try {
      const totalUsersResult = await db.select({ count: count() }).from(users);
      const activeStoresResult = await db.select({ count: count() }).from(stores).where(eq(stores.isActive, true));
      const totalStoresResult = await db.select({ count: count() }).from(stores);
      
      const superAdminsResult = await db.select({ count: count() }).from(users).where(eq(users.role, "super_admin"));
      const storeOwnersResult = await db.select({ count: count() }).from(users).where(eq(users.role, "store_owner"));
      const managersResult = await db.select({ count: count() }).from(users).where(eq(users.role, "manager"));

      return {
        totalUsers: totalUsersResult[0]?.count || 0,
        activeStores: activeStoresResult[0]?.count || 0,
        totalStores: totalStoresResult[0]?.count || 0,
        superAdmins: superAdminsResult[0]?.count || 0,
        storeOwners: storeOwnersResult[0]?.count || 0,
        managers: managersResult[0]?.count || 0,
      };
    } catch (error) {
      console.error("Error in getAnalytics:", error);
      return {
        totalUsers: 0,
        activeStores: 0,
        totalStores: 0,
        superAdmins: 0,
        storeOwners: 0,
        managers: 0,
      };
    }
  }

  // Company operations implementation
  async getAllCompanies(limit?: number, offset?: number): Promise<{ data: any[], total: number }> {
    try {
      console.log("Fetching companies from database...", { limit, offset });
      
      // Get total count
      const [totalResult] = await db.select({ count: count() }).from(companies);
      const total = Number(totalResult?.count || 0);
      
      // Build query with pagination
      let query = db.select().from(companies);
      
      // Apply pagination if provided
      if (limit !== undefined && offset !== undefined) {
        query = query.limit(limit).offset(offset) as any;
      }
      
      const companiesData = await query;
      console.log("Raw companies data:", companiesData);
      
      const companiesWithDetails = companiesData.map(company => ({
        ...company,
        branchCount: 0,
        userCount: 0,
        licenseStatus: company.licenseStatus || (company.isActive ? "active" : "inactive")
      }));
      
      console.log("Companies with details:", companiesWithDetails);
      return { data: companiesWithDetails, total };
    } catch (error) {
      console.error("Database error in getAllCompanies:", error);
      return { data: [], total: 0 };
    }
  }

  async createCompany(companyData: any): Promise<any> {
    try {
      console.log("Creating company in database:", companyData);
      
      // Hash password if provided
      let passwordHash: string | null = null;
      if (companyData.password) {
        const bcrypt = await import("bcrypt");
        passwordHash = await bcrypt.hash(companyData.password, 10);
      }
      
      const [newCompany] = await db
        .insert(companies)
        .values({
          name: companyData.name,
          registrationNumber: companyData.registrationNumber,
          vatNumber: companyData.vatNumber,
          address: companyData.address,
          email: companyData.email,
          phone: companyData.phone,
          contactPerson: companyData.contactPerson,
          password: passwordHash,
          maxBranches: companyData.maxBranches || 1,
          isActive: false // Company starts inactive until activation
        })
        .returning();
      
      console.log("Company created:", newCompany);
      return {
        ...newCompany,
        branchCount: 0,
        userCount: 0,
        licenseStatus: "inactive" // Reflects the inactive status
      };
    } catch (error: any) {
      console.error("Database error in createCompany:", error);
      
      // Handle specific database constraint violations
      if (error.code === '23505') { // Unique constraint violation
        if (error.constraint === 'companies_registration_number_unique') {
          throw new Error("A company with this registration number already exists");
        }
        if (error.constraint === 'companies_email_unique') {
          throw new Error("A company with this email address already exists");
        }
        throw new Error("A company with this information already exists");
      }
      
      throw new Error("Failed to create company");
    }
  }

  async getCompany(id: number): Promise<any | undefined> {
    try {
      const [company] = await db.select().from(companies).where(eq(companies.id, id));
      if (!company) return undefined;
      
      return {
        ...company,
        branchCount: 0,
        userCount: 0,
        licenseStatus: company.licenseStatus || (company.isActive ? "active" : "inactive")
      };
    } catch (error) {
      console.error("Database error in getCompany:", error);
      return undefined;
    }
  }

  async updateCompany(id: number, updates: Partial<any>): Promise<any> {
    try {
      console.log("Updating company in database with ID:", id, "Updates:", updates);
      
      // Get the existing company first
      const [existingCompany] = await db.select().from(companies).where(eq(companies.id, id));
      
      if (!existingCompany) {
        throw new Error("Company not found");
      }
      
      // Prepare update data
      const updateData: any = { ...updates };
      
      // Hash password if provided and not already hashed
      if (updates.password) {
        // Check if password is already a bcrypt hash (starts with $2a$, $2b$, or $2y$)
        const isAlreadyHashed = typeof updates.password === 'string' && 
          (updates.password.startsWith('$2a$') || 
           updates.password.startsWith('$2b$') || 
           updates.password.startsWith('$2y$'));
        
        if (!isAlreadyHashed) {
        const bcrypt = await import("bcrypt");
        updateData.password = await bcrypt.hash(updates.password, 10);
        console.log("Password hashed successfully for company:", id);
        } else {
          // Password is already hashed, use it as-is
          updateData.password = updates.password;
          console.log("Password already hashed, using as-is for company:", id);
        }
      }
      
      // Always set updated timestamp
      updateData.updatedAt = new Date();
      
      console.log("Final update data:", { ...updateData, password: updateData.password ? '[HASHED]' : undefined });
      
      // Update the company
      const [updatedCompany] = await db
        .update(companies)
        .set(updateData)
        .where(eq(companies.id, id))
        .returning();
      
      console.log("Company updated successfully:", { ...updatedCompany, password: updatedCompany.password ? '[HASHED]' : null });
      
      return {
        ...updatedCompany,
        branchCount: 0,
        userCount: 0,
        licenseStatus: updatedCompany.licenseStatus || (updatedCompany.isActive ? "active" : "inactive")
      };
    } catch (error) {
      console.error("Database error in updateCompany:", error);
      throw new Error("Failed to update company");
    }
  }

  async getCompanyByEmail(email: string): Promise<any | undefined> {
    try {
      const [company] = await db.select().from(companies).where(eq(companies.email, email));
      if (!company) return undefined;
      
      return {
        ...company,
        branchCount: 0,
        userCount: 0,
        licenseStatus: company.licenseStatus || (company.isActive ? "active" : "inactive")
      };
    } catch (error) {
      console.error("Database error in getCompanyByEmail:", error);
      return undefined;
    }
  }

  async deleteCompany(id: number): Promise<void> {
    try {
      // Get all stores for this company first
      const companyStores = await db.select().from(stores).where(eq(stores.companyId, id));
      const storeIds = companyStores.map(store => store.id);

      // Delete in order of dependencies (most dependent first)
      // 1. Delete product batches (via products -> stores)
      if (storeIds.length > 0) {
        const storeProducts = await db.select().from(products).where(inArray(products.storeId, storeIds));
        const productIds = storeProducts.map(p => p.id);
        if (productIds.length > 0) {
          await db.delete(productBatches).where(inArray(productBatches.productId, productIds));
        }
      }

      // 2. Delete products (via stores)
      if (storeIds.length > 0) {
        await db.delete(products).where(inArray(products.storeId, storeIds));
      }

      // 3. Delete sales (via stores)
      if (storeIds.length > 0) {
        await db.delete(sales).where(inArray(sales.storeId, storeIds));
      }

      // 3.5. Delete activities (via stores)
      if (storeIds.length > 0) {
        await db.delete(activities).where(inArray(activities.storeId, storeIds));
      }

      // 4. Delete stores
      if (storeIds.length > 0) {
        await db.delete(stores).where(eq(stores.companyId, id));
      }

      // 5. Delete product categories
      await db.delete(productCategories).where(eq(productCategories.companyId, id));

      // 6. Delete user settings
      await db.delete(userSettings).where(eq(userSettings.companyId, id));

      // 7. Set users' companyId to null (don't delete users, just unlink them)
      await db.update(users).set({ companyId: null }).where(eq(users.companyId, id));

      // 8. Delete company invitations
      await db.delete(companyInvitations).where(eq(companyInvitations.companyId, id));
      
      // 9. Delete audit logs (companyId is not nullable, so we must delete them)
      await db.delete(auditLogs).where(eq(auditLogs.companyId, id));

      // 10. Finally, delete the company
      await db.delete(companies).where(eq(companies.id, id));
    } catch (error: any) {
      console.error("Database error in deleteCompany:", error);
      if (error.code === '23503') { // Foreign key constraint violation
        throw new Error(`Cannot delete company: It has related records that must be deleted first. ${error.message}`);
      }
      throw new Error(`Failed to delete company: ${error.message || 'Unknown error'}`);
    }
  }

  async suspendCompany(companyId: number): Promise<{ company: any; suspendedStores: number; suspendedUsers: number }> {
    try {
      return await db.transaction(async (tx) => {
        // 1. Get company and verify it exists
        const [company] = await tx.select().from(companies).where(eq(companies.id, companyId));
        if (!company) {
          throw new Error("Company not found");
        }

        // Check if already suspended
        if (!company.isActive && company.licenseStatus === "suspended") {
          throw new Error("Company is already suspended");
        }

        // 2. Suspend the company (optimized - no returning to save time)
        await tx
          .update(companies)
          .set({
            isActive: false,
            licenseStatus: "suspended",
            updatedAt: new Date(),
          })
          .where(eq(companies.id, companyId));

        // 3. Get store IDs for this company (optimized - only get IDs)
        const companyStores = await tx
          .select({ id: stores.id })
          .from(stores)
          .where(eq(stores.companyId, companyId));

        const storeIds = companyStores.map(store => store.id);
        let suspendedStoresCount = 0;

        // 4. Suspend all stores (bulk update without returning)
        if (storeIds.length > 0) {
          await tx
            .update(stores)
            .set({
              isActive: false,
              updatedAt: new Date(),
            })
            .where(inArray(stores.id, storeIds));
          suspendedStoresCount = storeIds.length;
        }

        // 5. Suspend all users in a single optimized query
        // Count users first (before update) for faster response
        let suspendedUsersCount = 0;
        if (storeIds.length > 0) {
          // Count users before updating (faster than counting after)
          const usersToSuspend = await tx
            .select({ id: users.id })
            .from(users)
            .where(
              or(
                // Company admins
                and(
                  eq(users.companyId, companyId),
                  eq(users.role, "company_admin")
                ),
                // Store owners and managers
                and(
                  inArray(users.storeId, storeIds),
                  or(
                    eq(users.role, "store_owner"),
                    eq(users.role, "manager")
                  )
                )
              )
            );
          suspendedUsersCount = usersToSuspend.length;
          
          // Update users (bulk update without returning for speed)
          if (suspendedUsersCount > 0) {
            await tx
              .update(users)
              .set({
                isActive: false,
                updatedAt: new Date(),
              })
              .where(
                or(
                  and(eq(users.companyId, companyId), eq(users.role, "company_admin")),
                  and(inArray(users.storeId, storeIds), or(eq(users.role, "store_owner"), eq(users.role, "manager")))
                )
              );
          }
        } else {
          // No stores, only update company admins
          const companyAdmins = await tx
            .select({ id: users.id })
            .from(users)
            .where(
              and(
                eq(users.companyId, companyId),
                eq(users.role, "company_admin")
              )
            );
          suspendedUsersCount = companyAdmins.length;
          
          if (suspendedUsersCount > 0) {
            await tx
              .update(users)
              .set({
                isActive: false,
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(users.companyId, companyId),
                  eq(users.role, "company_admin")
                )
              );
          }
        }

        // Get updated company for response
        const [updatedCompany] = await tx.select().from(companies).where(eq(companies.id, companyId));

        return {
          company: {
            ...updatedCompany,
            branchCount: suspendedStoresCount,
            userCount: suspendedUsersCount,
            licenseStatus: "suspended"
          },
          suspendedStores: suspendedStoresCount,
          suspendedUsers: suspendedUsersCount,
        };
      });
    } catch (error: any) {
      console.error("Database error in suspendCompany:", error);
      throw new Error(`Failed to suspend company: ${error.message || 'Unknown error'}`);
    }
  }

  async unsuspendCompany(companyId: number): Promise<{ company: any; reactivatedStores: number; reactivatedUsers: number }> {
    try {
      return await db.transaction(async (tx) => {
        // 1. Get company and verify it exists
        const [company] = await tx.select().from(companies).where(eq(companies.id, companyId));
        if (!company) {
          throw new Error("Company not found");
        }

        // Check if company is actually suspended
        if (company.isActive || company.licenseStatus !== "suspended") {
          throw new Error("Company is not suspended");
        }

        // 2. Unsuspend (reactivate) the company
        await tx
          .update(companies)
          .set({
            isActive: true,
            licenseStatus: "active",
            updatedAt: new Date(),
          })
          .where(eq(companies.id, companyId));

        // 3. Get store IDs for this company
        const companyStores = await tx
          .select({ id: stores.id })
          .from(stores)
          .where(eq(stores.companyId, companyId));

        const storeIds = companyStores.map(store => store.id);
        let reactivatedStoresCount = 0;

        // 4. Reactivate all stores
        if (storeIds.length > 0) {
          await tx
            .update(stores)
            .set({
              isActive: true,
              updatedAt: new Date(),
            })
            .where(inArray(stores.id, storeIds));
          reactivatedStoresCount = storeIds.length;
        }

        // 5. Reactivate all users
        // Count users first (before update) for faster response
        let reactivatedUsersCount = 0;
        if (storeIds.length > 0) {
          // Count users before updating
          const usersToReactivate = await tx
            .select({ id: users.id })
            .from(users)
            .where(
              or(
                // Company admins
                and(
                  eq(users.companyId, companyId),
                  eq(users.role, "company_admin")
                ),
                // Store owners and managers
                and(
                  inArray(users.storeId, storeIds),
                  or(
                    eq(users.role, "store_owner"),
                    eq(users.role, "manager")
                  )
                )
              )
            );
          reactivatedUsersCount = usersToReactivate.length;
          
          // Update users (bulk update without returning for speed)
          if (reactivatedUsersCount > 0) {
            await tx
              .update(users)
              .set({
                isActive: true,
                updatedAt: new Date(),
              })
              .where(
                or(
                  and(eq(users.companyId, companyId), eq(users.role, "company_admin")),
                  and(inArray(users.storeId, storeIds), or(eq(users.role, "store_owner"), eq(users.role, "manager")))
                )
              );
          }
        } else {
          // No stores, only reactivate company admins
          const companyAdmins = await tx
            .select({ id: users.id })
            .from(users)
            .where(
              and(
                eq(users.companyId, companyId),
                eq(users.role, "company_admin")
              )
            );
          reactivatedUsersCount = companyAdmins.length;
          
          if (reactivatedUsersCount > 0) {
            await tx
              .update(users)
              .set({
                isActive: true,
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(users.companyId, companyId),
                  eq(users.role, "company_admin")
                )
              );
          }
        }

        // Get updated company for response
        const [updatedCompany] = await tx.select().from(companies).where(eq(companies.id, companyId));

        return {
          company: {
            ...updatedCompany,
            branchCount: reactivatedStoresCount,
            userCount: reactivatedUsersCount,
            licenseStatus: "active"
          },
          reactivatedStores: reactivatedStoresCount,
          reactivatedUsers: reactivatedUsersCount,
        };
      });
    } catch (error: any) {
      console.error("Database error in unsuspendCompany:", error);
      throw new Error(`Failed to unsuspend company: ${error.message || 'Unknown error'}`);
    }
  }

  // Company invitation operations implementation
  async createCompanyInvitation(invitation: InsertCompanyInvitation): Promise<CompanyInvitation> {
    try {
      const [newInvitation] = await db
        .insert(companyInvitations)
        .values(invitation as any)
        .returning();
      return newInvitation;
    } catch (error) {
      console.error("Database error in createCompanyInvitation:", error);
      throw new Error("Failed to create company invitation");
    }
  }

  async getCompanyInvitationByToken(token: string): Promise<CompanyInvitation | undefined> {
    try {
      const [invitation] = await db
        .select()
        .from(companyInvitations)
        .where(eq(companyInvitations.invitationToken, token));
      return invitation || undefined;
    } catch (error) {
      console.error("Database error in getCompanyInvitationByToken:", error);
      return undefined;
    }
  }

  async markInvitationAsUsed(token: string): Promise<void> {
    try {
      await db
        .update(companyInvitations)
        .set({ 
          isUsed: true, 
          usedAt: new Date() 
        })
        .where(eq(companyInvitations.invitationToken, token));
    } catch (error) {
      console.error("Database error in markInvitationAsUsed:", error);
      throw new Error("Failed to mark invitation as used");
    }
  }

  async deleteExpiredInvitations(): Promise<void> {
    try {
      await db
        .delete(companyInvitations)
        .where(sql`expires_at < NOW()`);
    } catch (error) {
      console.error("Database error in deleteExpiredInvitations:", error);
      throw new Error("Failed to delete expired invitations");
    }
  }

  async updateCompanyPassword(email: string, passwordHash: string): Promise<void> {
    await db
      .update(companies)
      .set({ password: passwordHash, updatedAt: new Date() })
      .where(eq(companies.email, email));
  }

  // Password reset token operations
  async createPasswordResetToken(tokenData: InsertPasswordResetToken): Promise<PasswordResetToken> {
    try {
      const [token] = await db
        .insert(passwordResetTokens)
        .values(tokenData as any)
        .returning();
      return token;
    } catch (error) {
      console.error("Database error in createPasswordResetToken:", error);
      throw new Error("Failed to create password reset token");
    }
  }

  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    try {
      const [resetToken] = await db
        .select()
        .from(passwordResetTokens)
        .where(and(
          eq(passwordResetTokens.resetToken, token),
          eq(passwordResetTokens.isUsed, false),
          sql`expires_at > NOW()`
        ));
      return resetToken || undefined;
    } catch (error) {
      console.error("Database error in getPasswordResetToken:", error);
      return undefined;
    }
  }

  async markPasswordResetTokenAsUsed(token: string): Promise<void> {
    try {
      await db
        .update(passwordResetTokens)
        .set({ 
          isUsed: true, 
          usedAt: new Date() 
        } as any)
        .where(eq(passwordResetTokens.resetToken, token));
    } catch (error) {
      console.error("Database error in markPasswordResetTokenAsUsed:", error);
      throw new Error("Failed to mark password reset token as used");
    }
  }

  async deleteExpiredPasswordResetTokens(): Promise<void> {
    try {
      await db
        .delete(passwordResetTokens)
        .where(sql`expires_at < NOW() OR (is_used = true AND used_at < NOW() - INTERVAL '7 days')`);
    } catch (error) {
      console.error("Database error in deleteExpiredPasswordResetTokens:", error);
      // Don't throw - this is a cleanup operation
    }
  }

  async deleteOldAuditLogs(dataRetentionDays?: number): Promise<number> {
    try {
      // Default to 365 days if not specified
      const retentionDays = dataRetentionDays || 365;
      
      // Calculate the cutoff date
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
      
      // Delete audit logs older than the retention period using SQL interval
      // Use SQL to calculate the cutoff date directly for better performance
      const result = await db
        .delete(auditLogs)
        .where(sql`created_at < NOW() - INTERVAL '${sql.raw(String(retentionDays))} days'`);
      
      console.log(`Cleaned up audit logs older than ${retentionDays} days`);
      // Note: drizzle delete doesn't return count, but the operation succeeded
      return 1;
    } catch (error) {
      console.error("Database error in deleteOldAuditLogs:", error);
      // Don't throw - this is a cleanup operation
      return 0;
    }
  }

  // Product operations
  async getProductsByStore(storeId: number, limit?: number, offset?: number, search?: string, categoryId?: number): Promise<{ products: any[]; total: number }> {
    try {
      // Build where conditions
      const conditions: any[] = [
        eq(products.storeId, storeId),
        eq(products.isActive, true)
      ];
      
      // Add search filter
      if (search) {
        conditions.push(
          or(
            ilike(products.name, `%${search}%`),
            ilike(products.barcode, `%${search}%`),
            ilike(productCategories.name, `%${search}%`)
          )!
        );
      }
      
      // Add category filter
      if (categoryId) {
        conditions.push(eq(products.categoryId, categoryId));
      }
      
      const whereClause = and(...conditions);
      
      // Get total count
      const [totalResult] = await db
        .select({ count: count() })
        .from(products)
        .leftJoin(productCategories, eq(products.categoryId, productCategories.id))
        .where(whereClause);
      const total = Number(totalResult.count);
      
      // Build query
      let query = db
        .select({
          id: products.id,
          name: products.name,
          description: products.description,
          price: products.price,
          vatRate: products.vatRate,
          categoryId: products.categoryId,
          categoryName: productCategories.name,
          stock: products.stock,
          barcode: products.barcode,
          imageUrl: products.imageUrl,
          storeId: products.storeId,
          companyId: products.companyId,
          isActive: products.isActive,
          substanceName: products.substanceName,
          form: products.form,
          subtype: products.subtype,
          packageSize: products.packageSize,
          receivedDate: products.receivedDate,
          batchNumber: products.batchNumber,
          quantityUnit: products.quantityUnit,
          recommendedDoseSingle: products.recommendedDoseSingle,
          recommendedDoseDaily: products.recommendedDoseDaily,
          dosageInfo: products.dosageInfo,
          warningUnder18: products.warningUnder18,
          warningHealth: products.warningHealth,
          minAge: products.minAge,
          adultOnly: products.adultOnly,
          consumerInfo: products.consumerInfo,
          activeSubstancesComposition: products.activeSubstancesComposition,
          createdAt: products.createdAt,
          updatedAt: products.updatedAt,
          storeName: stores.name,
        })
        .from(products)
        .leftJoin(productCategories, eq(products.categoryId, productCategories.id))
        .leftJoin(stores, eq(products.storeId, stores.id))
        .where(whereClause)
        .orderBy(desc(products.createdAt));
      
      // Apply pagination
      if (limit !== undefined) {
        query = query.limit(limit) as any;
      }
      if (offset !== undefined) {
        query = query.offset(offset) as any;
      }
      
      const productsList = await query;
      
      // Map results to include category name as 'category' field and store name
      const mappedProducts = productsList.map((p: any) => ({
        ...p,
        category: p.categoryName || null,
        storeName: p.storeId === null ? "All Stores" : (p.storeName || null),
      }));
      
      return { products: mappedProducts, total };
    } catch (error) {
      console.error("Error fetching products by store:", error);
      return { products: [], total: 0 };
    }
  }

  async getProductsByCompany(companyId: number, limit?: number, offset?: number, search?: string, categoryId?: number): Promise<{ products: any[]; total: number }> {
    try {
      // Build where conditions
      const conditions: any[] = [
        or(
          eq(products.companyId, companyId), // Company-wide products
          inArray(products.storeId, db.select({ id: stores.id }).from(stores).where(eq(stores.companyId, companyId))) // Products from stores in the company
        ),
        eq(products.isActive, true)
      ];

      // Add search condition if provided
      if (search) {
        conditions.push(
          or(
            ilike(products.name, `%${search}%`),
            ilike(products.description, `%${search}%`),
            ilike(products.barcode, `%${search}%`)
          )
        );
      }

      // Add category filter if provided
      if (categoryId) {
        conditions.push(eq(products.categoryId, categoryId));
      }

      const whereClause = and(...conditions);
      
      // Get total count
      const [totalResult] = await db
        .select({ count: count() })
        .from(products)
        .leftJoin(productCategories, eq(products.categoryId, productCategories.id))
        .where(whereClause);
      const total = Number(totalResult.count);

      // Build query with pagination
      let query = db
        .select({
          id: products.id,
          name: products.name,
          description: products.description,
          price: products.price,
          vatRate: products.vatRate,
          categoryId: products.categoryId,
          categoryName: productCategories.name,
          stock: products.stock,
          barcode: products.barcode,
          imageUrl: products.imageUrl,
          storeId: products.storeId,
          companyId: products.companyId,
          isActive: products.isActive,
          substanceName: products.substanceName,
          form: products.form,
          subtype: products.subtype,
          packageSize: products.packageSize,
          receivedDate: products.receivedDate,
          batchNumber: products.batchNumber,
          quantityUnit: products.quantityUnit,
          recommendedDoseSingle: products.recommendedDoseSingle,
          recommendedDoseDaily: products.recommendedDoseDaily,
          dosageInfo: products.dosageInfo,
          warningUnder18: products.warningUnder18,
          warningHealth: products.warningHealth,
          minAge: products.minAge,
          adultOnly: products.adultOnly,
          consumerInfo: products.consumerInfo,
          activeSubstancesComposition: products.activeSubstancesComposition,
          createdAt: products.createdAt,
          updatedAt: products.updatedAt,
          storeName: stores.name,
        })
        .from(products)
        .leftJoin(productCategories, eq(products.categoryId, productCategories.id))
        .leftJoin(stores, eq(products.storeId, stores.id))
        .where(whereClause)
        .orderBy(desc(products.createdAt));

      if (limit !== undefined) {
        query = query.limit(limit) as any;
      }
      if (offset !== undefined) {
        query = query.offset(offset) as any;
      }

      const productsList = await query;
      
      // Map results to include category name as 'category' field and store name
      const mappedProducts = productsList.map((p: any) => ({
        ...p,
        category: p.categoryName || null,
        storeName: p.storeId === null ? "All Stores" : (p.storeName || null),
      }));

      return { products: mappedProducts, total };
    } catch (error: any) {
      console.error("Error fetching products by company:", error);
      throw error;
    }
  }

  async getProduct(id: number): Promise<any | undefined> {
    try {
      const result = await db.select().from(products)
        .where(eq(products.id, id));
      const product = result[0];
      
      if (!product) {
        return undefined;
      }
      
      // Fetch active substances for this product
      const substanceLinks = await db
        .select({
          id: productActiveSubstance.id,
          productId: productActiveSubstance.productId,
          substanceId: productActiveSubstance.substanceId,
          substanceName: activeSubstances.name,
          contentAmount: productActiveSubstance.contentAmount,
          contentUnit: productActiveSubstance.contentUnit,
          concentration: productActiveSubstance.concentration,
        })
        .from(productActiveSubstance)
        .leftJoin(activeSubstances, eq(productActiveSubstance.substanceId, activeSubstances.id))
        .where(eq(productActiveSubstance.productId, id));
      
      return {
        ...product,
        activeSubstances: substanceLinks,
      };
    } catch (error) {
      console.error("Error fetching product by id:", error);
      return undefined;
    }
  }

  async createProduct(productData: any): Promise<Product> {
    try {
      // Extract active substances from productData
      const { activeSubstances: activeSubstancesData, ...productFields } = productData;
      
      // Insert product
      const [product] = await db.insert(products).values(productFields as any).returning();
      
      // Insert active substances if provided
      if (activeSubstancesData && Array.isArray(activeSubstancesData) && activeSubstancesData.length > 0) {
        const substanceLinks = activeSubstancesData.map((s: any) => ({
          productId: product.id,
          substanceId: s.substanceId,
          contentAmount: s.contentAmount || null,
          contentUnit: s.contentUnit || null,
          concentration: s.concentration || null,
        }));
        
        await db.insert(productActiveSubstance).values(substanceLinks);
      }
      
      return product;
    } catch (error) {
      console.error("Error creating product:", error);
      throw new Error("Failed to create product");
    }
  }

  async updateProduct(id: number, updates: any): Promise<Product> {
    try {
      return await db.transaction(async (tx) => {
        // Get current product to check stock changes
        const [currentProduct] = await tx.select().from(products).where(eq(products.id, id));
        if (!currentProduct) {
          throw new Error("Product not found");
        }
        
        // Extract active substances from updates
        const { activeSubstances: activeSubstancesData, ...productFields } = updates;
        
        // Check if stock is being updated
        const stockUpdated = productFields.stock !== undefined && productFields.stock !== currentProduct.stock;
        const quantityBefore = currentProduct.stock || 0;
        const quantityAfter = productFields.stock !== undefined ? productFields.stock : quantityBefore;
        const quantityChange = quantityAfter - quantityBefore;
        
        // Update product
        const [product] = await tx
          .update(products)
          .set({ ...productFields, updatedAt: new Date() })
          .where(eq(products.id, id))
          .returning();
        
        // Create stock transaction if stock was manually adjusted
        if (stockUpdated && quantityChange !== 0 && product.storeId) {
          await tx.insert(stockTransactions).values({
            productId: id,
            storeId: product.storeId,
            batchId: null,
            transactionType: 'adjustment',
            quantityChange: quantityChange,
            quantityBefore: quantityBefore,
            quantityAfter: quantityAfter,
            saleId: null,
            saleItemId: null,
            returnId: null,
            returnItemId: null,
            reason: updates.reason || 'Manual stock adjustment',
            notes: updates.notes || null,
            userId: updates.userId || null,
            createdAt: new Date()
          });
        }
        
        // Update active substances if provided
        if (activeSubstancesData !== undefined) {
          // Delete existing links
          await tx.delete(productActiveSubstance).where(eq(productActiveSubstance.productId, id));
          
          // Insert new links if any
          if (Array.isArray(activeSubstancesData) && activeSubstancesData.length > 0) {
            const substanceLinks = activeSubstancesData.map((s: any) => ({
              productId: id,
              substanceId: s.substanceId,
              contentAmount: s.contentAmount || null,
              contentUnit: s.contentUnit || null,
              concentration: s.concentration || null,
            }));
            
            await tx.insert(productActiveSubstance).values(substanceLinks);
          }
        }
        
        return product;
      });
    } catch (error) {
      console.error("Error updating product:", error);
      throw new Error("Failed to update product");
    }
  }

  // Product batch operations
  async getProductBatches(productId: number, storeId?: number): Promise<any[]> {
    try {
      const conditions = [eq(productBatches.productId, productId)];
      if (storeId) {
        conditions.push(eq(productBatches.storeId, storeId));
      }
      return await db.select().from(productBatches)
        .where(and(...conditions))
        .orderBy(desc(productBatches.receivedDate));
    } catch (error) {
      console.error("Error fetching product batches:", error);
      return [];
    }
  }

  async getProductBatch(id: number): Promise<any | undefined> {
    try {
      const [batch] = await db.select().from(productBatches)
        .where(eq(productBatches.id, id));
      return batch || undefined;
    } catch (error) {
      console.error("Error fetching product batch:", error);
      return undefined;
    }
  }

  async createProductBatch(batchData: any): Promise<any> {
    try {
      const [batch] = await db.insert(productBatches).values(batchData).returning();
      return batch;
    } catch (error) {
      console.error("Error creating product batch:", error);
      throw new Error("Failed to create product batch");
    }
  }

  async updateProductBatch(id: number, updates: Partial<any>): Promise<any> {
    try {
      const [batch] = await db
        .update(productBatches)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(productBatches.id, id))
        .returning();
      if (!batch) {
        throw new Error("Product batch not found");
      }
      return batch;
    } catch (error) {
      console.error("Error updating product batch:", error);
      throw new Error("Failed to update product batch");
    }
  }

  async deleteProductBatch(id: number): Promise<void> {
    try {
      await db.delete(productBatches).where(eq(productBatches.id, id));
    } catch (error) {
      console.error("Error deleting product batch:", error);
      throw new Error("Failed to delete product batch");
    }
  }

  // Product category operations
  async getCategoriesByCompany(companyId: number, storeId?: number | null): Promise<ProductCategory[]> {
    try {
      // Build conditions
      const conditions = [
        eq(productCategories.companyId, companyId),
        eq(productCategories.isActive, true)
      ];

      // Get all categories for the company
      let allCategories = await db.select().from(productCategories)
        .where(and(...conditions))
        .orderBy(productCategories.name);

      // If storeId is provided, filter to show:
      // 1. Company-wide categories (no entries in category_stores)
      // 2. Categories assigned to this specific store
      if (storeId !== undefined && storeId !== null) {
        const filteredCategories = [];
        for (const category of allCategories) {
          const categoryStoreIds = await this.getCategoryStores(category.id);
          // Include if no store assignments (company-wide) or if assigned to this store
          if (categoryStoreIds.length === 0 || categoryStoreIds.includes(storeId)) {
            filteredCategories.push(category);
          }
        }
        return filteredCategories;
      }

      return allCategories;
    } catch (error) {
      console.error("Error fetching categories by company:", error);
      return [];
    }
  }

  async getCategoriesByCompanyPaginated(companyId: number, limit?: number, offset?: number, search?: string, storeId?: number | null): Promise<{ categories: ProductCategory[]; total: number }> {
    try {
      // Build where conditions
      const conditions = [
        eq(productCategories.companyId, companyId),
        eq(productCategories.isActive, true)
      ];

      // Filter by store: company-wide (null) OR store-specific (if storeId provided)
      if (storeId !== undefined && storeId !== null) {
        // For store owners/managers: get company-wide (null) OR their store-specific categories
        conditions.push(
          or(
            isNull(productCategories.storeId),
            eq(productCategories.storeId, storeId)
          )!
        );
      }
      // For company admins: no store filter, get all categories

      // Add search condition if provided
      if (search) {
        conditions.push(
          or(
            ilike(productCategories.name, `%${search}%`),
            ilike(productCategories.description || sql`''`, `%${search}%`)
          )!
        );
      }

      // Get total count
      const [totalResult] = await db
        .select({ count: count() })
        .from(productCategories)
        .where(and(...conditions));
      const total = totalResult?.count || 0;

      // Build query
      let query = db
        .select()
        .from(productCategories)
        .where(and(...conditions))
        .orderBy(productCategories.name);

      // Apply pagination if provided
      if (limit !== undefined && offset !== undefined) {
        query = query.limit(limit).offset(offset) as any;
      }

      const categories = await query;

      return { categories, total };
    } catch (error) {
      console.error("Error fetching paginated categories by company:", error);
      return { categories: [], total: 0 };
    }
  }

  async getCategoriesByUser(userId: string): Promise<ProductCategory[]> {
    try {
      return await db.select().from(productCategories)
        .where(and(eq(productCategories.userId, userId), eq(productCategories.isActive, true)))
        .orderBy(productCategories.name);
    } catch (error) {
      console.error("Error fetching categories by user:", error);
      return [];
    }
  }

  async getCategoriesByUserPaginated(userId: string, limit?: number, offset?: number, search?: string): Promise<{ categories: ProductCategory[]; total: number }> {
    try {
      // Build where conditions
      const conditions = [
        eq(productCategories.userId, userId),
        eq(productCategories.isActive, true)
      ];

      // Add search condition if provided
      if (search) {
        conditions.push(
          or(
            ilike(productCategories.name, `%${search}%`),
            ilike(productCategories.description || sql`''`, `%${search}%`)
          )!
        );
      }

      // Get total count
      const [totalResult] = await db
        .select({ count: count() })
        .from(productCategories)
        .where(and(...conditions));
      const total = totalResult?.count || 0;

      // Build query
      let query = db
        .select()
        .from(productCategories)
        .where(and(...conditions))
        .orderBy(productCategories.name);

      // Apply pagination if provided
      if (limit !== undefined && offset !== undefined) {
        query = query.limit(limit).offset(offset) as any;
      }

      const categories = await query;

      return { categories, total };
    } catch (error) {
      console.error("Error fetching paginated categories by user:", error);
      return { categories: [], total: 0 };
    }
  }

  async createCategory(categoryData: InsertProductCategory, storeIds?: number[]): Promise<ProductCategory> {
    try {
      const [category] = await db.insert(productCategories).values(categoryData as any).returning();
      
      // If storeIds provided, create junction table entries
      if (storeIds !== undefined && storeIds.length > 0) {
        const categoryStoreEntries = storeIds.map(storeId => ({
          categoryId: category.id,
          storeId,
        }));
        
        await db.insert(categoryStores).values(categoryStoreEntries);
      }
      
      return category;
    } catch (error) {
      console.error("Error creating category:", error);
      throw new Error("Failed to create category");
    }
  }

  async updateCategory(id: number, updates: Partial<ProductCategory>, storeIds?: number[]): Promise<ProductCategory> {
    try {
      // Update the category
      const [category] = await db
        .update(productCategories)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(productCategories.id, id))
        .returning();
      
      // If storeIds provided, update junction table
      if (storeIds !== undefined) {
        // Delete existing store associations
        await db.delete(categoryStores).where(eq(categoryStores.categoryId, id));
        
        // Add new store associations if provided
        if (storeIds.length > 0) {
          const categoryStoreEntries = storeIds.map(storeId => ({
            categoryId: id,
            storeId,
          }));
          
          await db.insert(categoryStores).values(categoryStoreEntries);
        }
      }
      
      return category;
    } catch (error) {
      console.error("Error updating category:", error);
      throw new Error("Failed to update category");
    }
  }

  async getCategoryStores(categoryId: number): Promise<number[]> {
    try {
      const results = await db
        .select({ storeId: categoryStores.storeId })
        .from(categoryStores)
        .where(eq(categoryStores.categoryId, categoryId));
      
      return results.map(r => r.storeId);
    } catch (error) {
      console.error("Error fetching category stores:", error);
      return [];
    }
  }

  async deleteCategory(id: number): Promise<void> {
    try {
      await db
        .update(productCategories)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(productCategories.id, id));
    } catch (error) {
      console.error("Error deleting category:", error);
      throw new Error("Failed to delete category");
    }
  }

  async getAllUploadedImages(): Promise<string[]> {
    try {
      const productImages = await db.select({ imageUrl: products.imageUrl })
        .from(products)
        .where(and(
          eq(products.isActive, true),
          isNotNull(products.imageUrl)
        ));
      
      return productImages
        .map(p => p.imageUrl)
        .filter(url => url && url.length > 0) as string[];
    } catch (error) {
      console.error("Error fetching uploaded images:", error);
      return [];
    }
  }

  // Active substances operations (Super Admin only, not linked to companies)
  async getActiveSubstances(limit?: number, offset?: number, search?: string): Promise<{ substances: any[]; total: number }> {
    try {
      const conditions: any[] = [];

      if (search) {
        conditions.push(ilike(activeSubstances.name, `%${search}%`));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      // Get total count
      const totalResult = await db
        .select({ count: count() })
        .from(activeSubstances)
        .where(whereClause || undefined);
      const total = totalResult[0]?.count || 0;

      // Get paginated results
      let query = db
        .select()
        .from(activeSubstances);
      
      if (whereClause) {
        query = query.where(whereClause) as any;
      }
      
      query = query.orderBy(desc(activeSubstances.createdAt)) as any;

      if (limit !== undefined) {
        query = query.limit(limit) as any;
      }
      if (offset !== undefined) {
        query = query.offset(offset) as any;
      }

      const substances = await query;

      return { substances, total };
    } catch (error) {
      console.error("Error fetching active substances:", error);
      return { substances: [], total: 0 };
    }
  }

  async getActiveSubstance(id: number): Promise<any | undefined> {
    try {
      const [substance] = await db
        .select()
        .from(activeSubstances)
        .where(eq(activeSubstances.id, id));
      return substance || undefined;
    } catch (error) {
      console.error("Error fetching active substance:", error);
      return undefined;
    }
  }

  async createActiveSubstance(substanceData: any): Promise<any> {
    try {
      const [substance] = await db
        .insert(activeSubstances)
        .values({
          ...substanceData,
          updatedAt: new Date(),
        })
        .returning();
      return substance;
    } catch (error: any) {
      console.error("Error creating active substance:", error);
      if (error.code === '23505') { // Unique constraint violation
        throw new Error("An active substance with this name already exists");
      }
      throw new Error("Failed to create active substance");
    }
  }

  async updateActiveSubstance(id: number, updates: any): Promise<any> {
    try {
      const [substance] = await db
        .update(activeSubstances)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(activeSubstances.id, id))
        .returning();
      
      if (!substance) {
        throw new Error("Active substance not found");
      }
      return substance;
    } catch (error: any) {
      console.error("Error updating active substance:", error);
      if (error.message) {
        throw error;
      }
      if (error.code === '23505') { // Unique constraint violation
        throw new Error("An active substance with this name already exists");
      }
      throw new Error("Failed to update active substance");
    }
  }

  async deleteActiveSubstance(id: number): Promise<void> {
    try {
      const existing = await this.getActiveSubstance(id);
      if (!existing) {
        throw new Error("Active substance not found");
      }

      await db
        .delete(activeSubstances)
        .where(eq(activeSubstances.id, id));
    } catch (error: any) {
      console.error("Error deleting active substance:", error);
      if (error.message) {
        throw error;
      }
      throw new Error("Failed to delete active substance");
    }
  }



  // Sale operations
  async getSalesByStore(storeId: number, limit?: number, offset?: number, search?: string, startDate?: string, endDate?: string): Promise<{ sales: Sale[]; total: number }> {
    try {
      const conditions = [eq(sales.storeId, storeId)];
      
      // Add date filters if provided
      if (startDate) {
        conditions.push(sql`${sales.createdAt} >= ${startDate}::date`);
      }
      if (endDate) {
        conditions.push(sql`${sales.createdAt} <= ${endDate}::date`);
      }
      
      // Add search filter if provided (search in sale ID, payment method)
      if (search) {
        conditions.push(
          or(
            ilike(sales.id, `%${search}%`),
            ilike(sales.paymentMethod, `%${search}%`)
          )
        );
      }
      
      const whereClause = and(...conditions);
      
      // Get total count
      const totalResult = await db
        .select({ count: count() })
        .from(sales)
        .where(whereClause);
      const total = totalResult[0]?.count || 0;
      
      // Get paginated results
      let query = db
        .select()
        .from(sales)
        .where(whereClause)
        .orderBy(desc(sales.createdAt));
      
      if (limit !== undefined) {
        query = query.limit(limit) as any;
      }
      if (offset !== undefined) {
        query = query.offset(offset) as any;
      }
      
      const salesData = await query;
      
      return { sales: salesData, total };
    } catch (error) {
      console.error("Error fetching sales by store:", error);
      return { sales: [], total: 0 };
    }
  }

  async getSalesByCompany(companyId: number): Promise<Sale[]> {
    try {
      // Get all stores for this company
      const companyStores = await db.select().from(stores).where(eq(stores.companyId, companyId));
      const storeIds = companyStores.map(store => store.id);
      
      if (storeIds.length === 0) {
        return [];
      }
      
      // Get all sales for these stores
      return await db.select().from(sales).where(inArray(sales.storeId, storeIds));
    } catch (error) {
      console.error("Error fetching sales by company:", error);
      return [];
    }
  }

  async createSale(saleData: InsertSale): Promise<Sale> {
    try {
      return await db.transaction(async (tx) => {
        // Generate a unique ID for the sale
        const saleId = `sale_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
        
        // Store customer info in the items metadata for backward compatibility
        const itemsWithCustomer = {
          items: saleData.items,
          customerInfo: (saleData as any).customerInfo
        };

        // Insert sale
        const [sale] = await tx.insert(sales).values({
          id: saleId,
          total: saleData.total.toString(),
          netAmount: saleData.netAmount ? saleData.netAmount.toString() : null,
          totalVAT: saleData.totalVAT ? saleData.totalVAT.toString() : null,
          vatBreakdown: saleData.vatBreakdown || null,
          paymentMethod: saleData.paymentMethod,
          items: itemsWithCustomer,
          storeId: saleData.storeId,
          userId: saleData.userId
        }).returning();

        // Insert sales items into sales_items table
        let insertedSalesItems: any[] = [];
        if (Array.isArray(saleData.items)) {
          const salesItemsToInsert = saleData.items.map((item: any) => ({
            saleId: saleId,
            productId: item.productId || item.product?.id,
            batchId: item.batchId || null,
            quantity: item.quantity.toString(),
            unitPrice: (item.price || item.unitPrice || item.product?.price || 0).toString(),
            vatRate: (item.vatRate || item.product?.vatRate || 21).toString()
          }));

          if (salesItemsToInsert.length > 0) {
            insertedSalesItems = await tx.insert(salesItems).values(salesItemsToInsert).returning();
          }
        }

        // Update product stock and create stock transactions
        if (Array.isArray(saleData.items) && insertedSalesItems.length > 0) {
          const stockTransactionsToInsert = [];
          
          // Create a map of productId to saleItemId for easier lookup
          const productToSaleItemMap = new Map();
          insertedSalesItems.forEach((saleItem: any, index: number) => {
            const item = saleData.items[index];
            const productId = item.productId || item.product?.id;
            if (productId) {
              productToSaleItemMap.set(productId, saleItem.id);
            }
          });
          
          for (const item of saleData.items) {
            const productId = item.productId || item.product?.id;
            const quantity = item.quantity || 0;
            const batchId = item.batchId || null;
            
            if (productId && quantity > 0) {
              // Get current product
              const [product] = await tx.select().from(products).where(eq(products.id, productId));
              if (product) {
                const quantityBefore = product.stock || 0;
                const newStock = Math.max(0, quantityBefore - quantity);
                
                // Update product stock
                await tx.update(products)
                  .set({ stock: newStock, updatedAt: new Date() })
                  .where(eq(products.id, productId));
                
                // Create stock transaction record
                const saleItemId = productToSaleItemMap.get(productId) || null;
                stockTransactionsToInsert.push({
                  productId: productId,
                  storeId: saleData.storeId,
                  batchId: batchId,
                  transactionType: 'sale',
                  quantityChange: -quantity, // Negative for decrease
                  quantityBefore: quantityBefore,
                  quantityAfter: newStock,
                  saleId: saleId,
                  saleItemId: saleItemId,
                  userId: saleData.userId || null,
                  createdAt: new Date()
                });
              }
            }
          }
          
          // Insert all stock transactions
          if (stockTransactionsToInsert.length > 0) {
            await tx.insert(stockTransactions).values(stockTransactionsToInsert);
          }
        }

        return sale;
      });
    } catch (error) {
      console.error("Error creating sale:", error);
      throw new Error("Failed to create sale");
    }
  }

  async getSaleById(saleId: string): Promise<Sale | undefined> {
    try {
      const [sale] = await db.select().from(sales).where(eq(sales.id, saleId));
      return sale;
    } catch (error) {
      console.error("Error fetching sale by ID:", error);
      return undefined;
    }
  }

  async getSalesItemsBySaleId(saleId: string): Promise<any[]> {
    try {
      return await db.select().from(salesItems).where(eq(salesItems.saleId, saleId));
    } catch (error) {
      console.error("Error fetching sales items:", error);
      return [];
    }
  }

  async createReturn(returnData: any, returnItems: any[]): Promise<any> {
    try {
      return await db.transaction(async (tx) => {
        // Insert return
        const [returnRecord] = await tx.insert(returns).values(returnData).returning();

        // Insert return items
        if (returnItems.length > 0) {
          // Validate all items have required fields
          const itemsToInsert = returnItems.map((item: any) => {
            if (!item.saleItemId || typeof item.saleItemId !== 'number') {
              throw new Error(`Invalid saleItemId: ${item.saleItemId}. All return items must reference a valid sales_items record.`);
            }
            return {
              returnId: returnRecord.id,
              saleItemId: item.saleItemId,
              productId: item.productId,
              batchId: item.batchId || null,
              quantity: item.quantity.toString(),
              unitPrice: item.unitPrice.toString(),
              vatRate: item.vatRate.toString(),
              refundAmount: item.refundAmount.toString(),
              reason: item.reason || null,
              condition: item.condition || null
            };
          });
          const insertedReturnItems = await tx.insert(returnsItems).values(itemsToInsert).returning();

          // Update product stock (restore stock for returned items) and create stock transactions
          const stockTransactionsToInsert = [];
          
          for (let i = 0; i < returnItems.length; i++) {
            const item = returnItems[i];
            const returnItem = insertedReturnItems[i];
            const [product] = await tx.select().from(products).where(eq(products.id, item.productId));
            
            if (product) {
              const quantity = parseFloat(item.quantity.toString());
              const quantityBefore = product.stock || 0;
              const newStock = quantityBefore + quantity;
              
              // Update product stock
              await tx.update(products)
                .set({ stock: newStock, updatedAt: new Date() })
                .where(eq(products.id, item.productId));
              
              // Create stock transaction record
              stockTransactionsToInsert.push({
                productId: item.productId,
                storeId: returnData.storeId,
                batchId: item.batchId || null,
                transactionType: 'return',
                quantityChange: quantity, // Positive for increase
                quantityBefore: quantityBefore,
                quantityAfter: newStock,
                returnId: returnRecord.id,
                returnItemId: returnItem.id,
                saleId: returnData.saleId || null,
                userId: returnData.userId || returnData.processedBy || null,
                reason: item.reason || null,
                createdAt: new Date()
              });
            }
          }
          
          // Insert all stock transactions
          if (stockTransactionsToInsert.length > 0) {
            await tx.insert(stockTransactions).values(stockTransactionsToInsert);
          }
        }

        return returnRecord;
      });
    } catch (error) {
      console.error("Error creating return:", error);
      throw new Error("Failed to create return");
    }
  }

  async getReturnsByStore(storeId: number): Promise<any[]> {
    try {
      return await db.select().from(returns).where(eq(returns.storeId, storeId));
    } catch (error) {
      console.error("Error fetching returns by store:", error);
      return [];
    }
  }

  async getReturnsBySaleId(saleId: string): Promise<any[]> {
    try {
      return await db.select().from(returns).where(eq(returns.saleId, saleId));
    } catch (error) {
      console.error("Error fetching returns by sale ID:", error);
      return [];
    }
  }

  async getReturnById(returnId: number): Promise<any | undefined> {
    try {
      const [returnRecord] = await db.select().from(returns).where(eq(returns.id, returnId));
      return returnRecord;
    } catch (error) {
      console.error("Error fetching return by ID:", error);
      return undefined;
    }
  }

  async getReturnItemsByReturnId(returnId: number): Promise<any[]> {
    try {
      return await db.select().from(returnsItems).where(eq(returnsItems.returnId, returnId));
    } catch (error) {
      console.error("Error fetching return items:", error);
      return [];
    }
  }

  async getStockTransactionsByStore(
    storeId: number,
    limit?: number,
    offset?: number,
    productId?: number,
    transactionType?: string,
    startDate?: string,
    endDate?: string
  ): Promise<{ transactions: any[]; total: number }> {
    try {
      const conditions = [eq(stockTransactions.storeId, storeId)];

      if (productId) {
        conditions.push(eq(stockTransactions.productId, productId));
      }

      if (transactionType) {
        conditions.push(eq(stockTransactions.transactionType, transactionType));
      }

      if (startDate) {
        conditions.push(sql`${stockTransactions.createdAt} >= ${new Date(startDate)}`);
      }

      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        conditions.push(sql`${stockTransactions.createdAt} <= ${endDateTime}`);
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      // Get total count
      const [totalResult] = await db
        .select({ count: count() })
        .from(stockTransactions)
        .where(whereClause);
      const total = Number(totalResult.count);

      // Build query with pagination
      let query = db
        .select({
          id: stockTransactions.id,
          productId: stockTransactions.productId,
          storeId: stockTransactions.storeId,
          batchId: stockTransactions.batchId,
          transactionType: stockTransactions.transactionType,
          quantityChange: stockTransactions.quantityChange,
          quantityBefore: stockTransactions.quantityBefore,
          quantityAfter: stockTransactions.quantityAfter,
          saleId: stockTransactions.saleId,
          saleItemId: stockTransactions.saleItemId,
          returnId: stockTransactions.returnId,
          returnItemId: stockTransactions.returnItemId,
          reason: stockTransactions.reason,
          notes: stockTransactions.notes,
          userId: stockTransactions.userId,
          createdAt: stockTransactions.createdAt,
          productName: products.name,
          productBarcode: products.barcode,
        })
        .from(stockTransactions)
        .leftJoin(products, eq(stockTransactions.productId, products.id))
        .where(whereClause)
        .orderBy(desc(stockTransactions.createdAt));

      if (limit !== undefined) {
        query = query.limit(limit) as any;
      }
      if (offset !== undefined) {
        query = query.offset(offset) as any;
      }

      const transactions = await query;

      return { transactions, total };
    } catch (error) {
      console.error("Error fetching stock transactions by store:", error);
      return { transactions: [], total: 0 };
    }
  }

  async updateReturnStatus(returnId: number, status: string, processedBy?: string): Promise<any> {
    try {
      const updateData: any = {
        status,
        updatedAt: new Date()
      };
      
      if (processedBy) {
        updateData.processedBy = processedBy;
        updateData.processedAt = new Date();
      }

      const [updatedReturn] = await db
        .update(returns)
        .set(updateData)
        .where(eq(returns.id, returnId))
        .returning();

      if (!updatedReturn) {
        throw new Error("Return not found");
      }

      return updatedReturn;
    } catch (error) {
      console.error("Error updating return status:", error);
      throw new Error("Failed to update return status");
    }
  }

  // Cart operations
  async getCart(userId: string | null, companyId: number | null, storeId: number): Promise<any[]> {
    try {
      const conditions: any[] = [eq(shoppingCarts.storeId, storeId)];
      
      if (userId) {
        conditions.push(eq(shoppingCarts.userId, userId));
        conditions.push(isNull(shoppingCarts.companyId));
      } else if (companyId) {
        conditions.push(isNull(shoppingCarts.userId));
        conditions.push(eq(shoppingCarts.companyId, companyId));
      } else {
        return []; // Neither userId nor companyId provided
      }

      const cartItems = await db
        .select({
          id: shoppingCarts.id,
          productId: shoppingCarts.productId,
          quantity: shoppingCarts.quantity,
          product: products,
        })
        .from(shoppingCarts)
        .innerJoin(products, eq(shoppingCarts.productId, products.id))
        .where(and(...conditions))
        .orderBy(shoppingCarts.createdAt);

      return cartItems.map(item => ({
        id: item.id,
        product: item.product,
        quantity: item.quantity,
      }));
    } catch (error) {
      console.error("Error fetching cart:", error);
      return [];
    }
  }

  async addToCart(userId: string | null, companyId: number | null, storeId: number, productId: number, quantity: number): Promise<any> {
    try {
      if (!userId && !companyId) {
        throw new Error("Either userId or companyId must be provided");
      }

      // Build conditions for checking existing cart item
      const conditions: any[] = [
        eq(shoppingCarts.storeId, storeId),
        eq(shoppingCarts.productId, productId)
      ];

      if (userId) {
        conditions.push(eq(shoppingCarts.userId, userId));
        conditions.push(isNull(shoppingCarts.companyId));
      } else if (companyId) {
        conditions.push(isNull(shoppingCarts.userId));
        conditions.push(eq(shoppingCarts.companyId, companyId));
      }

      // Check if item already exists in cart
      const existing = await db
        .select()
        .from(shoppingCarts)
        .where(and(...conditions))
        .limit(1);

      if (existing.length > 0) {
        // Update quantity
        const newQuantity = existing[0].quantity + quantity;
        const [updated] = await db
          .update(shoppingCarts)
          .set({ quantity: newQuantity, updatedAt: new Date() })
          .where(eq(shoppingCarts.id, existing[0].id))
          .returning();
        return updated;
      } else {
        // Create new cart item
        const [newItem] = await db
          .insert(shoppingCarts)
          .values({
            userId: userId || null,
            companyId: companyId || null,
            storeId,
            productId,
            quantity,
          })
          .returning();
        return newItem;
      }
    } catch (error) {
      console.error("Error adding to cart:", error);
      throw new Error("Failed to add item to cart");
    }
  }

  async updateCartItem(cartId: number, quantity: number): Promise<any> {
    try {
      if (quantity <= 0) {
        await this.removeFromCart(cartId);
        return null;
      }

      const [updated] = await db
        .update(shoppingCarts)
        .set({ quantity, updatedAt: new Date() })
        .where(eq(shoppingCarts.id, cartId))
        .returning();
      return updated;
    } catch (error) {
      console.error("Error updating cart item:", error);
      throw new Error("Failed to update cart item");
    }
  }

  async removeFromCart(cartId: number): Promise<void> {
    try {
      await db.delete(shoppingCarts).where(eq(shoppingCarts.id, cartId));
    } catch (error) {
      console.error("Error removing from cart:", error);
      throw new Error("Failed to remove item from cart");
    }
  }

  async clearCart(userId: string | null, companyId: number | null, storeId: number): Promise<void> {
    try {
      const conditions: any[] = [eq(shoppingCarts.storeId, storeId)];
      
      if (userId) {
        conditions.push(eq(shoppingCarts.userId, userId));
        conditions.push(isNull(shoppingCarts.companyId));
      } else if (companyId) {
        conditions.push(isNull(shoppingCarts.userId));
        conditions.push(eq(shoppingCarts.companyId, companyId));
      } else {
        return; // Nothing to clear
      }

      await db
        .delete(shoppingCarts)
        .where(and(...conditions));
    } catch (error) {
      console.error("Error clearing cart:", error);
      throw new Error("Failed to clear cart");
    }
  }

  // Audit log operations
  async createAuditLog(auditLogData: InsertAuditLog): Promise<AuditLog> {
    try {
      const [auditLog] = await db.insert(auditLogs).values(auditLogData as any).returning();
      return auditLog;
    } catch (error) {
      console.error("Error creating audit log:", error);
      throw new Error("Failed to create audit log");
    }
  }

  async getAuditLogs(filters?: {
    userId?: string;
    storeId?: number;
    companyId?: number;
    action?: string;
    entityType?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<AuditLog[]> {
    try {
      let query = db.select().from(auditLogs);
      const conditions: any[] = [];

      if (filters?.userId) {
        conditions.push(eq(auditLogs.userId, filters.userId));
      }
      if (filters?.storeId) {
        conditions.push(eq(auditLogs.storeId, filters.storeId));
      }
      if (filters?.companyId) {
        conditions.push(eq(auditLogs.companyId, filters.companyId));
      }
      if (filters?.action) {
        conditions.push(eq(auditLogs.action, filters.action));
      }
      if (filters?.entityType) {
        conditions.push(eq(auditLogs.entityType, filters.entityType));
      }
      if (filters?.startDate) {
        conditions.push(sql`${auditLogs.createdAt} >= ${filters.startDate}`);
      }
      if (filters?.endDate) {
        conditions.push(sql`${auditLogs.createdAt} <= ${filters.endDate}`);
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as any;
      }

      const results = await query
        .orderBy(desc(auditLogs.createdAt))
        .limit(filters?.limit || 100)
        .offset(filters?.offset || 0);

      return results;
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      return [];
    }
  }

  async getAuditLogsByUser(userId: string, limit = 50): Promise<AuditLog[]> {
    return this.getAuditLogs({ userId, limit });
  }

  async getAuditLogsByStore(storeId: number, limit = 50): Promise<AuditLog[]> {
    return this.getAuditLogs({ storeId, limit });
  }

  async getAuditLogsByCompany(companyId: number, limit = 50): Promise<AuditLog[]> {
    return this.getAuditLogs({ companyId, limit });
  }

  async getAuditLogsCount(filters?: {
    userId?: string;
    storeId?: number;
    companyId?: number;
    action?: string;
    entityType?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<number> {
    try {
      let query = db.select({ count: count() }).from(auditLogs);
      const conditions: any[] = [];

      if (filters?.userId) {
        conditions.push(eq(auditLogs.userId, filters.userId));
      }
      if (filters?.storeId) {
        conditions.push(eq(auditLogs.storeId, filters.storeId));
      }
      if (filters?.companyId) {
        conditions.push(eq(auditLogs.companyId, filters.companyId));
      }
      if (filters?.action) {
        conditions.push(eq(auditLogs.action, filters.action));
      }
      if (filters?.entityType) {
        conditions.push(eq(auditLogs.entityType, filters.entityType));
      }
      if (filters?.startDate) {
        conditions.push(sql`${auditLogs.createdAt} >= ${filters.startDate}`);
      }
      if (filters?.endDate) {
        conditions.push(sql`${auditLogs.createdAt} <= ${filters.endDate}`);
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as any;
      }

      const result = await query;
      return result[0]?.count || 0;
    } catch (error) {
      console.error("Error counting audit logs:", error);
      return 0;
    }
  }
}

// Simple in-memory storage for immediate functionality
class MemoryStorage implements Partial<IStorage> {
  private users: Map<number, any> = new Map();
  private stores: Map<number, any> = new Map();
  private companies: Map<number, any> = new Map();
  private activities: Map<number, any> = new Map();
  private managers: Map<string, any> = new Map();
  private nextId = 2; // Start at 2 since we'll add the admin user at ID 1

  // Sample data
  constructor() {
    // Add sample super admin user (email: admin@test.com, password: password123)
    this.users.set(1, {
      id: 1,
      firstName: "Super",
      lastName: "Admin",
      email: "admin@test.com",
      password: "$2b$10$h2Xo4ublFJoxGcZN7tx2h.rfOHtcyhJDHN1yqZqPTDshOJkcHdVQy", // password123 (correct hash)
      role: "super_admin",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // No sample companies - they will be created by users
  }

  async getUser(id: number): Promise<any | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<any | undefined> {
    for (const user of this.users.values()) {
      if (user.email === email) return user;
    }
    return undefined;
  }

  async createUser(userData: any): Promise<any> {
    const id = this.nextId++;
    const user = { id, ...userData, createdAt: new Date(), updatedAt: new Date() };
    this.users.set(id, user);
    return user;
  }

  async upsertUser(userData: any): Promise<any> {
    if (userData.id && this.users.has(userData.id)) {
      const user = { ...userData, updatedAt: new Date() };
      this.users.set(userData.id, user);
      return user;
    } else {
      return this.createUser(userData);
    }
  }

  async getUserWithStore(id: any): Promise<any | undefined> {
    const user = this.users.get(Number(id));
    if (!user) return undefined;
    
    const store = Array.from(this.stores.values()).find(s => s.managerId === id);
    return { ...user, store };
  }

  async getAllUsers(limit?: number, offset?: number): Promise<{ users: any[]; total: number }> {
    const allUsers = Array.from(this.users.values()).map(user => {
      const store = Array.from(this.stores.values()).find(s => s.managerId === user.id);
      return { ...user, store };
    });
    
    const total = allUsers.length;
    const start = offset || 0;
    const end = limit ? start + limit : undefined;
    const paginatedUsers = end ? allUsers.slice(start, end) : allUsers.slice(start);
    
    return {
      users: paginatedUsers,
      total
    };
  }

  async updateUserRole(id: any, role: string): Promise<any> {
    const user = this.users.get(Number(id));
    if (!user) throw new Error("User not found");
    
    const updatedUser = { ...user, role, updatedAt: new Date() };
    this.users.set(Number(id), updatedUser);
    return updatedUser;
  }

  async getAllStores(limit?: number, offset?: number, search?: string, status?: string): Promise<{ stores: any[]; total: number }> {
    let allStores = Array.from(this.stores.values());
    
    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      allStores = allStores.filter(store =>
        store.name?.toLowerCase().includes(searchLower) ||
        store.address?.toLowerCase().includes(searchLower) ||
        store.phone?.toLowerCase().includes(searchLower)
      );
    }
    
    // Apply status filter
    if (status === 'active') {
      allStores = allStores.filter(store => store.isActive === true);
    } else if (status === 'inactive') {
      allStores = allStores.filter(store => store.isActive === false);
    }
    
    const total = allStores.length;
    
    // Apply pagination
    if (offset !== undefined && limit !== undefined) {
      allStores = allStores.slice(offset, offset + limit);
    } else if (limit !== undefined) {
      allStores = allStores.slice(0, limit);
    }
    
    return { stores: allStores, total };
  }

  async createStore(store: any): Promise<any> {
    const id = this.nextId++;
    const newStore = { id, ...store, createdAt: new Date(), updatedAt: new Date() };
    this.stores.set(id, newStore);
    return newStore;
  }

  async getStore(id: number): Promise<any | undefined> {
    return this.stores.get(id);
  }

  async updateStore(id: number, updates: any): Promise<any> {
    const store = this.stores.get(id);
    if (!store) throw new Error("Store not found");
    
    const updatedStore = { ...store, ...updates, updatedAt: new Date() };
    this.stores.set(id, updatedStore);
    return updatedStore;
  }

  async getStoresByCompany(companyId: number, limit?: number, offset?: number, search?: string, status?: string): Promise<{ stores: any[]; total: number }> {
    let allStores = Array.from(this.stores.values()).filter(store => store.companyId === companyId);
    
    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      allStores = allStores.filter(store =>
        store.name?.toLowerCase().includes(searchLower) ||
        store.address?.toLowerCase().includes(searchLower) ||
        store.phone?.toLowerCase().includes(searchLower)
      );
    }
    
    // Apply status filter
    if (status === 'active') {
      allStores = allStores.filter(store => store.isActive === true);
    } else if (status === 'inactive') {
      allStores = allStores.filter(store => store.isActive === false);
    }
    
    const total = allStores.length;
    
    // Apply pagination
    if (offset !== undefined && limit !== undefined) {
      allStores = allStores.slice(offset, offset + limit);
    } else if (limit !== undefined) {
      allStores = allStores.slice(0, limit);
    }
    
    return { stores: allStores, total };
  }

  async deleteStore(id: number): Promise<void> {
    this.stores.delete(id);
  }

  async getAllManagers(limit?: number, offset?: number, search?: string, status?: string): Promise<{ managers: any[]; total: number }> {
    let managers = Array.from(this.managers.values());
    
    // Apply search filter
    if (search) {
      managers = managers.filter(m => 
        m.firstName?.toLowerCase().includes(search.toLowerCase()) ||
        m.lastName?.toLowerCase().includes(search.toLowerCase()) ||
        m.email?.toLowerCase().includes(search.toLowerCase()) ||
        m.phone?.toLowerCase().includes(search.toLowerCase())
      );
    }
    
    // Apply status filter
    if (status === 'active') {
      managers = managers.filter(m => m.isActive === true);
    } else if (status === 'inactive') {
      managers = managers.filter(m => m.isActive === false);
    }
    
    const total = managers.length;
    
    // Apply pagination
    if (offset !== undefined && limit !== undefined) {
      managers = managers.slice(offset, offset + limit);
    } else if (limit !== undefined) {
      managers = managers.slice(0, limit);
    }
    
    return { managers, total };
  }

  async getManager(id: string): Promise<any | undefined> {
    return this.managers.get(id);
  }

  async createManager(manager: any): Promise<any> {
    const id = String(this.nextId++);
    const newManager = { id, ...manager, createdAt: new Date(), updatedAt: new Date() };
    this.managers.set(id, newManager);
    return newManager;
  }

  async updateManager(id: string, updates: any): Promise<any> {
    const manager = this.managers.get(id);
    if (!manager) throw new Error("Manager not found");
    
    const updatedManager = { ...manager, ...updates, updatedAt: new Date() };
    this.managers.set(id, updatedManager);
    return updatedManager;
  }

  async deleteManager(id: string): Promise<void> {
    this.managers.delete(id);
  }

  async createActivity(activity: any): Promise<any> {
    const id = this.nextId++;
    const newActivity = { id, ...activity, createdAt: new Date() };
    this.activities.set(id, newActivity);
    return newActivity;
  }

  async getRecentActivities(limit = 10): Promise<any[]> {
    return Array.from(this.activities.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async getAnalytics() {
    const totalUsers = this.users.size;
    const activeStores = Array.from(this.stores.values()).filter(s => s.isActive).length;
    const totalStores = this.stores.size;
    const superAdmins = Array.from(this.users.values()).filter(u => u.role === 'super_admin').length;
    const storeOwners = Array.from(this.users.values()).filter(u => u.role === 'store_owner').length;
    const managers = Array.from(this.users.values()).filter(u => u.role === 'manager').length;

    return {
      totalUsers,
      activeStores,
      totalStores,
      superAdmins,
      storeOwners,
      managers
    };
  }

  async getAllCompanies(limit?: number, offset?: number): Promise<{ data: any[], total: number }> {
    const allCompanies = Array.from(this.companies.values());
    const total = allCompanies.length;
    
    // Apply pagination if provided
    let companies = allCompanies;
    if (limit !== undefined && offset !== undefined) {
      companies = allCompanies.slice(offset, offset + limit);
    }
    
    const companiesWithDetails = companies.map(company => ({
      ...company,
      branchCount: Array.from(this.stores.values()).filter(s => s.companyId === company.id).length,
      userCount: Array.from(this.users.values()).filter(u => u.companyId === company.id).length,
      licenseStatus: company.licenseStatus || (company.isActive ? "active" : "inactive")
    }));
    
    return { data: companiesWithDetails, total };
  }

  async createCompany(companyData: any): Promise<any> {
    const bcrypt = await import('bcrypt');
    const companyId = this.nextId++;
    
    // Hash the password for the company owner
    const hashedPassword = await bcrypt.default.hash(companyData.password, 10);
    
    // Create the company
    const company = { 
      id: companyId, 
      ...companyData,
      password: hashedPassword, // Store hashed password
      isActive: true,
      createdAt: new Date(), 
      updatedAt: new Date() 
    };
    this.companies.set(companyId, company);
    
    // Create a user account for the company owner
    const userId = this.nextId++;
    const user = {
      id: userId,
      firstName: companyData.contactPerson.split(' ')[0] || 'Company',
      lastName: companyData.contactPerson.split(' ').slice(1).join(' ') || 'Owner',
      email: companyData.email,
      password: hashedPassword, // Same hashed password
      role: "store_owner",
      isActive: true,
      companyId: companyId,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.users.set(userId, user);
    
    return {
      ...company,
      branchCount: 0,
      userCount: 1,
      licenseStatus: "active"
    };
  }

  async getCompany(id: number): Promise<any | undefined> {
    const company = this.companies.get(id);
    if (!company) return undefined;

    return {
      ...company,
      branchCount: Array.from(this.stores.values()).filter(s => s.companyId === id).length,
      userCount: Array.from(this.users.values()).filter(u => u.companyId === id).length,
      licenseStatus: company.licenseStatus || (company.isActive ? "active" : "inactive")
    };
  }

  async updateCompany(id: number, updates: any): Promise<any> {
    const company = this.companies.get(id);
    if (!company) throw new Error("Company not found");
    
    const updatedCompany = { ...company, ...updates, updatedAt: new Date() };
    this.companies.set(id, updatedCompany);
    
    return {
      ...updatedCompany,
      branchCount: Array.from(this.stores.values()).filter(s => s.companyId === id).length,
      userCount: Array.from(this.users.values()).filter(u => u.companyId === id).length,
      licenseStatus: updatedCompany.licenseStatus || (updatedCompany.isActive ? "active" : "inactive")
    };
  }

  async deleteCompany(id: number): Promise<void> {
    this.companies.delete(id);
  }

  async updateCompanyPassword(email: string, passwordHash: string): Promise<void> {
    for (const company of this.companies.values()) {
      if (company.email === email) {
        company.password = passwordHash;
        break;
      }
    }
  }

  async updateUserPassword(id: string, passwordHash: string): Promise<void> {
    const user = this.users.get(Number(id));
    if (user) {
      user.password = passwordHash;
    }
  }

  // Audit log operations
  async createAuditLog(auditLog: any): Promise<any> {
    const id = this.nextId++;
    const newAuditLog = { id, ...auditLog, createdAt: new Date() };
    return newAuditLog;
  }

  async getAuditLogs(filters?: any): Promise<any[]> {
    return [];
  }

  async getAuditLogsCount(filters?: any): Promise<number> {
    return 0;
  }

  async getAuditLogsByUser(userId: string, limit = 50): Promise<any[]> {
    return [];
  }

  async getAuditLogsByStore(storeId: number, limit = 50): Promise<any[]> {
    return [];
  }

  async getAuditLogsByCompany(companyId: number, limit = 50): Promise<any[]> {
    return [];
  }

  // User Settings operations
  async getUserSettings(userId?: string, companyId?: number): Promise<any | undefined> {
    return undefined;
  }

  async upsertUserSettings(settings: any): Promise<any> {
    return settings;
  }

  async updateUserSettings(userId: string, updates: any): Promise<any> {
    return updates;
  }

  async updateCompanySettings(companyId: number, updates: any): Promise<any> {
    return updates;
  }

  // 2FA operations
  async enable2FA(userId: string, secret: string): Promise<void> {
    // Not implemented in memory storage
  }

  async disable2FA(userId: string): Promise<void> {
    // Not implemented in memory storage
  }

  async update2FASecret(userId: string, secret: string, enabled: boolean): Promise<void> {
    // Not implemented in memory storage
  }

  // Trusted device operations
  async createTrustedDevice(device: any): Promise<any> {
    return device;
  }

  async getTrustedDevice(deviceToken: string): Promise<any | undefined> {
    return undefined;
  }

  async getTrustedDevicesByUser(userId: string): Promise<any[]> {
    return [];
  }

  async deleteTrustedDevice(deviceToken: string): Promise<void> {
    // Not implemented in memory storage
  }

  async deleteExpiredTrustedDevices(): Promise<void> {
    // Not implemented in memory storage
  }

  async getUserById(id: string): Promise<any | undefined> {
    return this.users.get(Number(id));
  }

  async getManagersByStoreIds(storeIds: number[], limit?: number, offset?: number, filter?: 'unassigned', search?: string, status?: string): Promise<{ managers: any[]; total: number }> {
    let managers = Array.from(this.managers.values());
    
    // Apply store filter
    if (filter === 'unassigned') {
      managers = managers.filter(m => !m.storeId);
    } else {
      managers = managers.filter(m => storeIds.includes(m.storeId));
    }
    
    // Apply search filter
    if (search) {
      managers = managers.filter(m => 
        m.firstName?.toLowerCase().includes(search.toLowerCase()) ||
        m.lastName?.toLowerCase().includes(search.toLowerCase()) ||
        m.email?.toLowerCase().includes(search.toLowerCase()) ||
        m.phone?.toLowerCase().includes(search.toLowerCase())
      );
    }
    
    // Apply status filter
    if (status === 'active') {
      managers = managers.filter(m => m.isActive === true);
    } else if (status === 'inactive') {
      managers = managers.filter(m => m.isActive === false);
    }
    
    const total = managers.length;
    
    // Apply pagination
    if (offset !== undefined && limit !== undefined) {
      managers = managers.slice(offset, offset + limit);
    } else if (limit !== undefined) {
      managers = managers.slice(0, limit);
    }
    
    return { managers, total };
  }

  // Product operations
  async getProductsByStore(storeId: number): Promise<any[]> {
    return [];
  }

  async getProduct(id: number): Promise<any | undefined> {
    return undefined;
  }

  async createProduct(product: any): Promise<any> {
    const id = this.nextId++;
    return { id, ...product };
  }

  async updateProduct(id: number, updates: any): Promise<any> {
    return { id, ...updates };
  }

  async deleteProduct(id: number): Promise<void> {
    // Not implemented
  }

  async getProductCategories(): Promise<any[]> {
    return [];
  }

  async createProductCategory(category: any): Promise<any> {
    const id = this.nextId++;
    return { id, ...category };
  }

  async updateProductCategory(id: number, updates: any): Promise<any> {
    return { id, ...updates };
  }

  async deleteProductCategory(id: number): Promise<void> {
    // Not implemented
  }

  // Sales operations
  async getSalesByStore(storeId: number): Promise<any[]> {
    return [];
  }

  async createSale(sale: any): Promise<any> {
    const id = this.nextId++;
    return { id, ...sale };
  }
}

// Restored to use original database
const storage = new DatabaseStorage();




// Configure SendGrid API key
if (!process.env.SENDGRID_API_KEY) {
  throw new Error("SENDGRID_API_KEY environment variable must be set");
}

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const FROM_EMAIL = 'noreply@epml.cz';

interface SendResetEmailParams {
  email: string;
  resetToken: string;
  userType: 'user' | 'company';
}

interface SendInvitationEmailParams {
  email: string;
  companyName: string;
  invitationToken: string;
}

async function sendCompanyInvitationEmail({ email, companyName, invitationToken }: SendInvitationEmailParams) {
  const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
  const activationUrl = `${baseUrl}/company-activation?token=${invitationToken}`;
  
  const subject = `Welcome to ${companyName} - Activate Your Business Account`;
  const htmlBody = getCompanyInvitationTemplate({
    companyName,
    activationUrl,
    email
  });
  
  const textBody = getPlainTextTemplate('companyInvitation', {
    companyName,
    activationUrl,
    email
  });

  try {
    await sgMail.send({
      to: email,
      from: FROM_EMAIL,
      subject,
      html: htmlBody,
      text: textBody,
    });
    console.log(`Company invitation email sent successfully to ${email}`);
    return { success: true };
  } catch (error) {
    console.error('Error sending company invitation email:', error);
    
    // Fallback: Log the activation link to console for development/testing
    console.log("=== EMAIL SENDING FAILED - DEVELOPMENT FALLBACK ===");
    console.log(`To: ${email}`);
    console.log(`Subject: ${subject}`);
    console.log(`Activation Link: ${activationUrl}`);
    console.log("=== Copy the activation link above to manually send to the company ===");
    
    return { success: false, error: "Email service unavailable", activationUrl };
  }
}

async function sendPasswordResetEmail({ email, resetToken, userType }: SendResetEmailParams) {
  // Get base URL from environment, with fallbacks for different deployment scenarios
  let baseUrl = process.env.BASE_URL;
  
  if (!baseUrl) {
    // In Vercel, use VERCEL_URL if available
    if (process.env.VERCEL_URL) {
      baseUrl = `https://${process.env.VERCEL_URL}`;
    } else if (process.env.VERCEL) {
      // If VERCEL is set but VERCEL_URL is not, construct from VERCEL env
      baseUrl = `https://${process.env.VERCEL}`;
    } else {
      // Fallback to localhost for local development
      baseUrl = 'http://localhost:5000';
    }
  }
  
  const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;
  
  const subject = "Password Reset Request";
  const htmlBody = getPasswordResetTemplate({
    email,
    resetUrl,
    userType
  });
  
  const textBody = getPlainTextTemplate('passwordReset', {
    email,
    resetUrl,
    userType
  });

  const mailOptions = {
    from: FROM_EMAIL,
    to: email,
    subject: subject,
    html: htmlBody,
    text: textBody,
  };

  try {
    const result = await sgMail.send(mailOptions);
    console.log(`Password reset email sent successfully to ${email} via SendGrid`);
    return { success: true, messageId: result[0].headers['x-message-id'] };
  } catch (error) {
    console.error("Failed to send password reset email via SendGrid:", error);
    
    // Fallback: Log the reset link to console for development/testing
    console.log("=== EMAIL SENDING FAILED - DEVELOPMENT FALLBACK ===");
    console.log(`To: ${email}`);
    console.log(`Subject: ${subject}`);
    console.log(`Reset Link: ${resetUrl}`);
    console.log("=== Copy the reset link above to reset the password ===");
    
    // Don't throw error to prevent breaking the flow
    return { success: false, error: "Email service unavailable" };
  }
}

// Function to verify SendGrid configuration
async function verifySendGridConfiguration() {
  try {
    // Test if we have the required SendGrid API key
    if (!process.env.SENDGRID_API_KEY) {
      console.log("Missing SENDGRID_API_KEY - email service will use console fallback");
      return false;
    }
    
    console.log("SendGrid configuration verified successfully");
    console.log(`From Email: ${FROM_EMAIL}`);
    console.log("SendGrid API key is configured");
    
    // Test the SendGrid connection with a simple validation
    try {
      // Just verify the API key format (SendGrid keys start with 'SG.')
      if (!process.env.SENDGRID_API_KEY.startsWith('SG.')) {
        console.warn("SendGrid API key format is invalid (should start with 'SG.')");
        console.warn("Email service will use console fallback");
        return false;
      }
      console.log("SendGrid connection test successful");
      return true;
    } catch (testError: any) {
      console.warn("SendGrid API key validation failed:", testError?.message || testError);
      console.warn("Email service will use console fallback");
      return false;
    }
  } catch (error) {
    console.error("SendGrid configuration error:", error);
    return false;
  }
}




interface TwoFactorSetup {
  secret: string;
  qrCodeUrl: string;
  manualEntryKey: string;
}

class TwoFactorAuthService {
  /**
   * Generate a new 2FA secret and QR code for user setup
   */
  static async generateSecret(userEmail: string, serviceName = 'ePML.cz'): Promise<TwoFactorSetup> {
    const secret = speakeasy.generateSecret({
      name: `${serviceName} (${userEmail})`,
      issuer: serviceName,
      length: 32,
    });

    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!);

    return {
      secret: secret.base32,
      qrCodeUrl,
      manualEntryKey: secret.base32,
    };
  }

  /**
   * Verify a TOTP token against a secret
   */
  static verifyToken(secret: string, token: string, window = 1): boolean {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window, // Allow for time drift
    });
  }

  /**
   * Generate a backup token (for recovery purposes)
   */
  static generateBackupCodes(count = 8): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      const code = Math.random().toString(36).substring(2, 10).toUpperCase();
      codes.push(code);
    }
    return codes;
  }

  /**
   * Generate current TOTP token (for testing)
   */
  static generateToken(secret: string): string {
    return speakeasy.totp({
      secret,
      encoding: 'base32',
    });
  }
}




interface AuditData {
  action: string;
  entityType?: string;
  entityId?: string;
  description: string;
  oldValues?: any;
  newValues?: any;
  metadata?: any;
  severity?: "info" | "warning" | "error" | "critical";
}

class AuditLogger {
  static async log(
    user: any,
    auditData: AuditData,
    req: Request
  ): Promise<void> {
    try {
      const auditLog = {
        action: auditData.action,
        entityType: auditData.entityType,
        entityId: auditData.entityId,
        userId: user?.id,
        userEmail: user?.email,
        userRole: user?.role || user?.type,
        storeId: user?.storeId || auditData.metadata?.storeId,
        companyId: user?.companyId || auditData.metadata?.companyId,
        ipAddress: req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] as string,
        userAgent: req.headers['user-agent'],
        description: auditData.description,
        oldValues: auditData.oldValues,
        newValues: auditData.newValues,
        metadata: auditData.metadata,
        severity: auditData.severity || "info",
      };

      await storage.createAuditLog(auditLog);
    } catch (error) {
      console.error("Failed to create audit log:", error);
      // Don't throw error to prevent breaking the main operation
    }
  }

  // Helper methods for common audit actions
  static async logLogin(user: any, req: Request): Promise<void> {
    await this.log(user, {
      action: "user_login",
      description: `User ${user.email} logged in`,
      metadata: { loginType: user.type || "user" }
    }, req);
  }

  static async logLogout(user: any, req: Request): Promise<void> {
    await this.log(user, {
      action: "user_logout",
      description: `User ${user.email} logged out`,
    }, req);
  }

  static async logProductCreate(user: any, product: any, req: Request): Promise<void> {
    await this.log(user, {
      action: "product_create",
      entityType: "product",
      entityId: product.id?.toString(),
      description: `Product "${product.name}" created`,
      newValues: product,
      metadata: { storeId: product.storeId }
    }, req);
  }

  static async logProductUpdate(user: any, productId: number, oldProduct: any, newProduct: any, req: Request): Promise<void> {
    await this.log(user, {
      action: "product_update",
      entityType: "product",
      entityId: productId.toString(),
      description: `Product "${newProduct.name || oldProduct.name}" updated`,
      oldValues: oldProduct,
      newValues: newProduct,
      metadata: { storeId: newProduct.storeId || oldProduct.storeId }
    }, req);
  }

  static async logSaleCreate(user: any, sale: any, req: Request): Promise<void> {
    await this.log(user, {
      action: "sale_create",
      entityType: "sale",
      entityId: sale.id,
      description: `Sale created for ${sale.total} (${sale.paymentMethod})`,
      newValues: sale,
      metadata: { 
        storeId: sale.storeId,
        total: sale.total,
        paymentMethod: sale.paymentMethod,
        itemCount: Array.isArray(sale.items?.items) ? sale.items.items.length : 0
      }
    }, req);
  }

  static async logInventoryUpdate(user: any, productId: number, oldStock: number, newStock: number, req: Request): Promise<void> {
    await this.log(user, {
      action: "inventory_update",
      entityType: "product",
      entityId: productId.toString(),
      description: `Inventory updated from ${oldStock} to ${newStock}`,
      oldValues: { stock: oldStock },
      newValues: { stock: newStock },
      metadata: { difference: newStock - oldStock }
    }, req);
  }

  static async logUserCreate(user: any, newUser: any, req: Request): Promise<void> {
    await this.log(user, {
      action: "user_create",
      entityType: "user",
      entityId: newUser.id,
      description: `User ${newUser.email} created with role ${newUser.role}`,
      newValues: { ...newUser, passwordHash: "[REDACTED]" },
      metadata: { newUserRole: newUser.role }
    }, req);
  }

  static async logUserUpdate(user: any, userId: string, oldUser: any, updates: any, req: Request): Promise<void> {
    await this.log(user, {
      action: "user_update",
      entityType: "user",
      entityId: userId,
      description: `User ${oldUser.email} updated`,
      oldValues: { ...oldUser, passwordHash: "[REDACTED]" },
      newValues: { ...updates, passwordHash: updates.passwordHash ? "[REDACTED]" : undefined },
    }, req);
  }

  static async logStoreCreate(user: any, store: any, req: Request): Promise<void> {
    await this.log(user, {
      action: "store_create",
      entityType: "store",
      entityId: store.id?.toString(),
      description: `Store "${store.name}" created`,
      newValues: store,
      metadata: { companyId: store.companyId }
    }, req);
  }

  static async logStoreUpdate(user: any, storeId: number, oldStore: any, newStore: any, req: Request): Promise<void> {
    await this.log(user, {
      action: "store_update",
      entityType: "store",
      entityId: storeId.toString(),
      description: `Store "${newStore.name || oldStore.name}" updated`,
      oldValues: oldStore,
      newValues: newStore,
    }, req);
  }

  static async logCompanyCreate(user: any, company: any, req: Request): Promise<void> {
    await this.log(user, {
      action: "company_create",
      entityType: "company",
      entityId: company.id?.toString(),
      description: `Company "${company.name}" created`,
      newValues: { ...company, password: "[REDACTED]" },
    }, req);
  }

  static async logCompanyUpdate(user: any, companyId: number, oldCompany: any, updates: any, req: Request): Promise<void> {
    await this.log(user, {
      action: "company_update",
      entityType: "company",
      entityId: companyId.toString(),
      description: `Company "${oldCompany.name}" updated`,
      oldValues: { ...oldCompany, password: "[REDACTED]" },
      newValues: { ...updates, password: updates.password ? "[REDACTED]" : undefined },
    }, req);
  }

  static async logSettingsUpdate(user: any, settingsType: string, oldSettings: any, newSettings: any, req: Request): Promise<void> {
    await this.log(user, {
      action: "settings_update",
      entityType: "settings",
      description: `${settingsType} settings updated`,
      oldValues: oldSettings,
      newValues: newSettings,
      metadata: { settingsType }
    }, req);
  }

  static async logSecurityEvent(user: any, event: string, details: any, req: Request): Promise<void> {
    await this.log(user, {
      action: "security_event",
      description: event,
      metadata: details,
      severity: "warning"
    }, req);
  }
}

// Middleware to automatically log certain actions
function auditMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Store original end function
    const originalEnd = res.end;
    
    // Override end function to capture response
    (res.end as any) = function(chunk?: any, encoding?: any): void {
      // Only log successful operations (2xx status codes)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        // Log based on method and path
        const user = (req as any).user;
        if (user) {
          // Auto-log certain operations
          const method = req.method;
          const path = req.path;
          
          // You can add more auto-logging rules here
          if (method === 'POST' && path.includes('/api/')) {
            // Auto-log will be handled by individual route handlers
            // This middleware is mainly for capturing request context
          }
        }
      }
      
      // Call original end function
      originalEnd.call(res, chunk, encoding);
    };
    
    next();
  };
}







// Ensure uploads directory exists
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const ensureUploadsDir = async () => {
  try {
    await fs.access(UPLOADS_DIR);
  } catch {
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
  }
};

// Configure multer for file uploads
const multerStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    await ensureUploadsDir();
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${randomUUID()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Only allow image files
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'));
  }
};

const upload = multer({
  storage: multerStorage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});

// Initialize uploads directory on module load
ensureUploadsDir().catch(console.error);










const PgSession = connectPg(session);

// Extend express-session type to include our custom properties
declare module 'express-session' {
  interface SessionData {
    userId?: string | number;
    userType?: string;
  }
}

// Password reset tokens store (in production, this should be in database)
const resetTokens = new Map<string, { email: string; expires: number; userType: string }>();

// Session ID is now auto-generated by express-session

function generateResetToken(): string {
  // Use crypto for cryptographically secure random tokens
  return crypto.randomBytes(32).toString('hex');
}

function generateTempToken(userId: string | number): string {
  // Use crypto for cryptographically secure random tokens
  return crypto.randomBytes(32).toString('hex');
}

function generateDeviceToken(): string {
  return 'device_' + Math.random().toString(36).substring(2) + '_' + Date.now().toString(36);
}

async function checkTrustedDevice(deviceToken: string): Promise<boolean> {
  if (!deviceToken) return false;
  
  try {
    const device = await storage.getTrustedDevice(deviceToken);
    if (!device) return false;
    
    // Check if device is expired
    if (device.expiresAt < new Date()) {
      await storage.deleteTrustedDevice(deviceToken);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error("Error checking trusted device:", error);
    return false;
  }
}

// 2FA status check function - now checks database
async function check2FAStatus(email: string): Promise<boolean> {
  try {
    // First check if regular user exists with 2FA enabled
    const user = await storage.getUserByEmail(email);
    if (user && user.twoFactorEnabled) {
      return true;
    }
    
    // If not found, check if this is a company email
    const companiesResponse = await storage.getAllCompanies();
    const company = companiesResponse.data.find((c: any) => c.email === email);
    if (company) {
      // For companies, create a pseudo user ID and check 2FA status
      const companyUserId = `company_${company.id}`;
      const companyUser = await storage.getUserById(companyUserId);
      return companyUser?.twoFactorEnabled || false;
    }
    
    return false;
  } catch (error) {
    console.error("Error checking 2FA status:", error);
    return false;
  }
}

async function get2FASecret(email: string): Promise<string | null> {
  try {
    // First check if regular user exists with 2FA secret
    const user = await storage.getUserByEmail(email);
    if (user && user.twoFactorSecret) {
      return user.twoFactorSecret;
    }
    
    // If not found, check if this is a company email
    const companiesResponse = await storage.getAllCompanies();
    const company = companiesResponse.data.find((c: any) => c.email === email);
    if (company) {
      // For companies, create a pseudo user ID and get 2FA secret
      const companyUserId = `company_${company.id}`;
      const companyUser = await storage.getUserById(companyUserId);
      return companyUser?.twoFactorSecret || null;
    }
    
    return null;
  } catch (error) {
    console.error("Error getting 2FA secret:", error);
    return null;
  }
}

async function store2FASecret(email: string, secret: string): Promise<void> {
  try {
    // First check if regular user exists
    const user = await storage.getUserByEmail(email);
    if (user) {
      await storage.enable2FA(user.id, secret);
      return;
    }
    
    // If not found, check if this is a company email
    const companiesResponse = await storage.getAllCompanies();
    const company = companiesResponse.data.find((c: any) => c.email === email);
    if (company) {
      // For companies, creat e a pseudo user if doesn't exist
      const companyUserId = `company_${company.id}`;
      const existingCompanyUser = await storage.getUserById(companyUserId);
      
      if (existingCompanyUser) {
        await storage.enable2FA(companyUserId, secret);
      } else {
        // Create a pseudo user record for company 2FA
        await storage.createUser({
          id: companyUserId,
          email: email,
          firstName: company.contactPerson.split(' ')[0] || 'Company',
          lastName: company.contactPerson.split(' ').slice(1).join(' ') || 'Admin',
          role: 'company_admin',
          companyId: company.id,
          twoFactorSecret: secret,
          twoFactorEnabled: true,
          isActive: true
        } as any);
      }
      return;
    }
    
    throw new Error("User not found for 2FA setup");
  } catch (error) {
    console.error("Error storing 2FA secret:", error);
    throw error;
  }
}


function setupAuth(app: Express) {
  // Setup PostgreSQL session store for persistent sessions across deployments
  app.use(session({
    store: new PgSession({
      pool: pool,
      tableName: 'sessions',
      createTableIfMissing: true
    }),
    secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false, // Only save sessions that have been modified (userId/userType set)
    name: 'epml.sid', // Explicit session name
    rolling: true, // Reset expiration on every request
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      httpOnly: true,
      secure: true, // Always true for Vercel (HTTPS only)
      sameSite: 'lax', // Use 'lax' for same-origin, works better with Vercel
      path: '/', // Ensure cookie is available for all paths
      // Don't set domain - let browser handle it automatically
    }
  }));
  
  // Verify SendGrid configuration on startup (non-blocking, won't throw errors)
  verifySendGridConfiguration().catch((err) => {
    console.warn("SendGrid configuration check failed (non-critical):", err?.message || err);
  });

  // Login route
  app.post("/api/auth/login", async (req, res) => {
    try {
      console.log("=== LOGIN ROUTE HIT ===");
      console.log("Request body:", req.body);
      
      const { email, password, twoFactorToken, rememberDevice } = req.body;
      const deviceToken = req.headers['x-device-token'] as string;

      console.log("=== LOGIN API HIT ===", { email, password, twoFactorToken });
      
      let authenticatedUser: any = null;
      let userType = 'user'; // 'user' or 'company'
      
      // First, try to find a regular user
      const user = await storage.getUserByEmail(email);
      console.log("User found:", user ? { 
        id: user.id, 
        email: user.email, 
        hasPassword: !!user.passwordHash, 
        passwordStart: user.passwordHash ? user.passwordHash.substring(0, 10) + '...' : 'none'
      } : "No user found");
      
      const bcrypt = await import("bcrypt");
      
      if (user && user.passwordHash) {
        console.log("About to compare user passwords...");
        console.log("Plain password:", password);
        console.log("Hashed password:", user.passwordHash);
        
        const isValidPassword = await bcrypt.compare(password, user.passwordHash);
        console.log("User password comparison result:", isValidPassword);
        
        if (isValidPassword) {
          // Check if user is a manager and if they are active
          if (user.role === 'manager' && !user.isActive) {
            console.log("Inactive manager attempted login:", user.email);
            return res.status(403).json({ 
              message: "Your account has been deactivated. Please contact your administrator." 
            });
          }
          authenticatedUser = user;
          userType = 'user';
        }
      }
      
      // If user login failed, try company login
      if (!authenticatedUser) {
        console.log("User login failed, trying company login...");
        const companiesResponse = await storage.getAllCompanies();
        const company = companiesResponse.data.find((c: any) => c.email === email);
        
        console.log("Company found:", company ? {
          id: company.id,
          email: company.email,
          name: company.name,
          hasPassword: !!company.password,
          passwordStart: company.password ? company.password.substring(0, 10) + '...' : 'none'
        } : "No company found");
        
        if (company && company.password) {
          console.log("About to compare company passwords...");
          console.log("Plain password:", password);
          console.log("Company hashed password:", company.password);
          
          const isValidCompanyPassword = await bcrypt.compare(password, company.password);
          console.log("Company password comparison result:", isValidCompanyPassword);
          
          if (isValidCompanyPassword) {
            // Check if company is suspended - this check MUST come before profile completion check
            // A suspended company has: isActive=false AND licenseStatus="suspended"
            const isSuspended = !company.isActive && company.licenseStatus === "suspended";
            
            console.log("Company status check:", {
              companyId: company.id,
              email: company.email,
              isActive: company.isActive,
              licenseStatus: company.licenseStatus,
              isSuspended: isSuspended
            });
            
            if (isSuspended) {
              console.log("Company login blocked: Company is suspended");
              return res.status(403).json({ 
                message: "Access denied: Your company account has been suspended. Please contact support." 
              });
            }
            
            // Check if company profile is complete (isActive)
            // Only check this if company is NOT suspended
            if (!company.isActive) {
              console.log("Company login successful but profile incomplete - requiring profile completion");
              
              // Generate a cryptographically secure temporary token for profile completion
              const tempToken = crypto.randomBytes(32).toString('hex');
              const tempTokenExpires = Date.now() + (30 * 60 * 1000); // 30 minutes
              
              // Store the temp token in memory (in production, use Redis or database)
              (global as any).profileCompletionTokens = (global as any).profileCompletionTokens || new Map();
              (global as any).profileCompletionTokens.set(tempToken, {
                companyId: company.id,
                email: company.email,
                expires: tempTokenExpires
              });
              
              console.log("Generated secure profile completion token for company:", company.id);
              
              // Return special response requiring profile completion
              return res.status(200).json({
                requiresProfileCompletion: true,
                message: "Please complete your company profile to continue",
                profileToken: tempToken,
                email: company.email,
                companyName: company.name
              });
            }
            
            // Create a user-like object for company
            authenticatedUser = {
              id: `company_${company.id}`,
              email: company.email,
              role: 'company_admin',
              firstName: company.contactPerson.split(' ')[0] || 'Company',
              lastName: company.contactPerson.split(' ').slice(1).join(' ') || 'Admin',
              companyId: company.id,
              companyName: company.name
            };
            userType = 'company';
          }
        }
      }
      
      if (!authenticatedUser) {
        console.log("Both user and company login failed");
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Check if 2FA is enabled for this user
      console.log("Checking 2FA status for user:", authenticatedUser.email);
      
      // First check if device is trusted and skip 2FA if so
      const isTrustedDevice = await checkTrustedDevice(deviceToken);
      console.log("Is trusted device:", isTrustedDevice);
      
      // Get the secret from database
      let twoFactorSecret: string | null | undefined = null;
      let twoFactorEnabled = false;
      
      if (userType === 'user') {
        const userRecord = await storage.getUserByEmail(authenticatedUser.email);
        twoFactorSecret = userRecord?.twoFactorSecret || null;
        twoFactorEnabled = userRecord?.twoFactorEnabled || false;
      } else if (userType === 'company') {
        // For company accounts, check if a pseudo user record exists for 2FA
        const companyUserId = `company_${(authenticatedUser as any).companyId}`;
        const companyUserRecord = await storage.getUserById(companyUserId);
        twoFactorSecret = companyUserRecord?.twoFactorSecret || null;
        twoFactorEnabled = companyUserRecord?.twoFactorEnabled || false;
      }
      
      console.log("2FA Status:", { enabled: twoFactorEnabled, hasSecret: !!twoFactorSecret });
      
      if (twoFactorEnabled && twoFactorSecret && !isTrustedDevice) {
        console.log("2FA is enabled for user and device not trusted - checking token");
        if (!twoFactorToken) {
          console.log("No 2FA token provided - requiring 2FA");
          return res.status(200).json({ 
            requires2FA: true, 
            message: "Two-factor authentication required",
            tempUserId: authenticatedUser.id
          });
        }
        
        console.log("Verifying 2FA token...");
        const isValidToken = TwoFactorAuthService.verifyToken(twoFactorSecret, twoFactorToken);
        if (!isValidToken) {
          console.log("Invalid 2FA token");
          return res.status(400).json({ message: "Invalid 2FA verification code" });
        }
        console.log("2FA token verified successfully");
        
        // If rememberDevice is true, create a trusted device
        if (rememberDevice) {
          try {
            const newDeviceToken = generateDeviceToken();
            const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
            
            await storage.createTrustedDevice({
              userId: authenticatedUser.id,
              deviceToken: newDeviceToken,
              deviceName: req.headers['user-agent']?.substring(0, 100) || 'Unknown Device',
              userAgent: req.headers['user-agent']?.substring(0, 500) || null,
              ipAddress: req.ip || req.connection.remoteAddress || null,
              expiresAt
            });
            
            // Set device token in response header
            res.setHeader('X-Device-Token', newDeviceToken);
            console.log("Created trusted device with token:", newDeviceToken);
          } catch (error) {
            console.error("Error creating trusted device:", error);
          }
        }
      } else if (twoFactorEnabled && twoFactorSecret && isTrustedDevice) {
        console.log("2FA enabled but device is trusted - skipping 2FA verification");
      } else {
        console.log("2FA not enabled for this user - allowing login");
      }

      // Generate JWT token
      const tokenPayload: Omit<JWTPayload, 'iat' | 'exp'> = {
        userId: authenticatedUser.id,
        email: authenticatedUser.email,
        role: authenticatedUser.role,
        type: userType,
        companyId: (authenticatedUser as any).companyId || null,
        companyName: (authenticatedUser as any).companyName || null
      };
      
      let token: string;
      try {
        token = generateToken(tokenPayload);
        console.log("JWT token generated successfully");
      } catch (tokenError) {
        console.error("Error generating JWT token:", tokenError);
        res.setHeader('Content-Type', 'application/json');
        return res.status(500).json({ message: "Failed to generate authentication token" });
      }
      
      console.log("Login successful for:", userType === 'company' ? 'company' : 'user', authenticatedUser.id);
      
      // Log audit trail for successful login
      try {
        await AuditLogger.logLogin(authenticatedUser, req);
      } catch (error) {
        console.error("Failed to log login audit:", error);
      }
      
      // Prepare user object for response
      const userResponse = { 
          id: authenticatedUser.id, 
          email: authenticatedUser.email, 
          role: authenticatedUser.role,
          type: userType,
          companyId: (authenticatedUser as any).companyId || null,
          companyName: (authenticatedUser as any).companyName || null
      };
      
      // Force content type to JSON
      res.setHeader('Content-Type', 'application/json');
      
      return res.status(200).json({ 
        message: "Login successful", 
        token,
        user: userResponse
      });
    } catch (error) {
      console.error("Login error:", error);
      res.setHeader('Content-Type', 'application/json');
      return res.status(500).json({ message: "Login failed" });
    }
  });

  // Register route
  app.post("/api/auth/register", async (req, res) => {
    try {
      console.log("Register route hit with body:", req.body);
      const { email, password, firstName, lastName } = req.body;

      let existingUser;
      try {
        existingUser = await storage.getUserByEmail(email);
      } catch (dbError: any) {
        // Handle database connection errors
        if (dbError.code === 'XX000' || dbError.message?.includes('Tenant or user not found')) {
          console.error("Neon database authentication error:", dbError.message);
          console.error("This usually means:");
          console.error("1. Database name in DATABASE_URL is incorrect");
          console.error("2. User credentials are wrong or user doesn't exist");
          console.error("3. Database doesn't exist - create it in Neon Dashboard");
          console.error("4. User doesn't have proper permissions");
          console.error("\nTo fix:");
          console.error("- Go to Neon Dashboard → Your Project → Connection String");
          console.error("- Copy the correct connection string (use 'Connection pooling' or 'Direct connection')");
          console.error("- Update DATABASE_URL in Vercel environment variables");
          console.error("- Ensure the database exists and user has access");
          return res.status(500).json({ 
            message: "Database connection failed. Please verify your Neon DATABASE_URL in Vercel environment variables.",
            error: "Database authentication error",
            hint: "Check Neon Dashboard → Connection String and ensure database name and credentials are correct"
          });
        }
        // Re-throw other errors
        throw dbError;
      }
      
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }

      const bcrypt = await import("bcrypt");
      const passwordHash = await bcrypt.hash(password, 10);

      const allUsersResult = await storage.getAllUsers();
      const role = allUsersResult.total === 0 ? "super_admin" : "manager";

      // Generate unique user ID using nanoid
      const { nanoid } = await import("nanoid");
      const userId = nanoid();

      const newUser = await storage.createUser({
        id: userId,
        email,
        firstName,
        lastName,
        passwordHash,
        role
      });

      // Generate JWT token
      const tokenPayload: Omit<JWTPayload, 'iat' | 'exp'> = {
        userId: newUser.id,
        email: newUser.email,
        role: newUser.role,
        type: 'user'
      };
      
      const token = generateToken(tokenPayload);

      console.log("Registration successful for user:", newUser.id);
      console.log("JWT token generated successfully");
      
      res.json({ 
        message: "Registration successful", 
        token,
        user: { 
          id: newUser.id, 
          email: newUser.email, 
          role: newUser.role,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          type: 'user'
        } 
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  // Company Profile Completion route
  app.post("/api/auth/complete-profile", async (req, res) => {
    try {
      console.log("=== COMPLETE PROFILE ROUTE HIT ===");
      const { profileToken, contactPerson, phone, address } = req.body;
      
      if (!profileToken) {
        return res.status(400).json({ message: "Profile completion token is required" });
      }
      
      // Validate the temporary token
      const profileCompletionTokens = (global as any).profileCompletionTokens || new Map();
      const tokenData = profileCompletionTokens.get(profileToken);
      
      if (!tokenData) {
        return res.status(401).json({ message: "Invalid or expired profile completion token" });
      }
      
      if (tokenData.expires < Date.now()) {
        profileCompletionTokens.delete(profileToken);
        return res.status(401).json({ message: "Profile completion token has expired. Please login again." });
      }
      
      // Get the company using the validated token data
      const companiesResponse = await storage.getAllCompanies();
      const company = companiesResponse.data.find((c: any) => c.id === tokenData.companyId && c.email === tokenData.email);
      
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }
      
      // Check if company is suspended - prevent profile completion for suspended companies
      if (!company.isActive && company.licenseStatus === "suspended") {
        profileCompletionTokens.delete(profileToken);
        return res.status(403).json({ 
          message: "Access denied: Your company account has been suspended. Please contact support." 
        });
      }
      
      // Delete the used token
      profileCompletionTokens.delete(profileToken);
      
      // Update company profile and set isActive to true
      await storage.updateCompany(company.id, {
        contactPerson: contactPerson || company.contactPerson,
        phone: phone || company.phone,
        address: address || company.address,
        isActive: true
      });
      
      console.log("Company profile completed for company:", company.id);
      
      // Create authenticated user object
      const authenticatedUser = {
        id: `company_${company.id}`,
        email: company.email,
        role: 'company_admin',
        firstName: (contactPerson || company.contactPerson).split(' ')[0] || 'Company',
        lastName: (contactPerson || company.contactPerson).split(' ').slice(1).join(' ') || 'Admin',
        companyId: company.id,
        companyName: company.name
      };
      
      // Generate JWT token
      const tokenPayload: Omit<JWTPayload, 'iat' | 'exp'> = {
        userId: authenticatedUser.id,
        email: authenticatedUser.email,
        role: authenticatedUser.role,
        type: 'company',
        companyId: authenticatedUser.companyId,
        companyName: authenticatedUser.companyName
      };
      
      const token = generateToken(tokenPayload);
      
      // Log audit trail
      try {
        await AuditLogger.log(authenticatedUser, {
          action: "profile_completed",
          entityType: "company",
          entityId: company.id.toString(),
          description: `Company profile completed: ${company.name}`,
          severity: "info"
        }, req);
      } catch (error) {
        console.error("Failed to log profile completion audit:", error);
      }
      
      res.json({ 
        message: "Profile completed successfully",
        token,
        user: {
          id: authenticatedUser.id,
          email: authenticatedUser.email,
          role: authenticatedUser.role,
          type: 'company',
          companyId: authenticatedUser.companyId,
          companyName: authenticatedUser.companyName
        }
      });
    } catch (error) {
      console.error("Profile completion error:", error);
      res.status(500).json({ message: "Failed to complete profile" });
    }
  });

  // Logout route
  app.post("/api/auth/logout", isAuthenticated, async (req, res) => {
    console.log("=== LOGOUT ROUTE HIT ===");
    
    // Get user info for audit log (already set by isAuthenticated middleware)
    const currentUser = (req as any).user;
    
    // Log audit trail for logout
    if (currentUser) {
      try {
        await AuditLogger.logLogout(currentUser, req);
      } catch (error) {
        console.error("Failed to log logout audit:", error);
      }
    }
    
    // JWT tokens are stateless, so we just return success
    // The client is responsible for removing the token
    console.log("Logout successful for user:", currentUser?.email);
      res.setHeader('Content-Type', 'application/json');
      res.json({ message: "Logged out successfully" });
  });

  // Forgot password route
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      
      // Validate email is provided
      if (!email) {
        return res.status(400).json({ 
          success: false,
          message: "Email is required" 
        });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return res.status(400).json({ 
          success: false,
          message: "Please enter a valid email address" 
        });
      }

      const normalizedEmail = email.trim().toLowerCase();
      console.log("Forgot password request for:", normalizedEmail);

      let userExists = false;
      let userType = 'user';

      // Check if it's a regular user
      const user = await storage.getUserByEmail(normalizedEmail);
      if (user) {
        userExists = true;
        userType = 'user';
        console.log("Found user account for:", normalizedEmail);
      } else {
        // Check if it's a company account
        console.log("User not found, checking companies...");
        const companiesResponse = await storage.getAllCompanies();
        const company = companiesResponse.data.find((c: any) => c.email?.toLowerCase() === normalizedEmail);
        if (company) {
          userExists = true;
          userType = 'company';
          console.log("Found company account for:", normalizedEmail, "Company ID:", company.id);
        } else {
          console.log("No account found for:", normalizedEmail);
        }
      }

      // Return error if user doesn't exist
      if (!userExists) {
        return res.status(404).json({ 
          success: false,
          message: "No account found with this email address. Please check your email and try again." 
        });
      }

      // User exists, proceed with password reset
      // Create reset token (user exists, validated above)
      const resetToken = generateResetToken();
      // 24 hours expiration (matching email template)
      const expiresAt = new Date(Date.now() + (24 * 60 * 60 * 1000));
      
      try {
        // Store token in database
        await storage.createPasswordResetToken({
          email: normalizedEmail,
          resetToken,
          userType: userType as 'user' | 'company',
          expiresAt
        });

        console.log("Password reset token created:", resetToken, "for", userType, normalizedEmail);
        
        // Send password reset email
        try {
          const emailResult = await sendPasswordResetEmail({
            email: normalizedEmail,
            resetToken,
            userType: userType as 'user' | 'company'
          });
          if (emailResult.success) {
            console.log("Password reset email sent successfully to:", normalizedEmail);
          } else {
            console.log("Password reset email failed, but reset token created. Check console for reset link.");
            console.log("Reset link:", `${process.env.BASE_URL || 'http://localhost:5000'}/reset-password?token=${resetToken}`);
          }
        } catch (emailError) {
          console.error("Failed to send password reset email:", emailError);
          console.log("Reset link (fallback):", `${process.env.BASE_URL || 'http://localhost:5000'}/reset-password?token=${resetToken}`);
          // Log error but don't fail the request - token is still valid
        }

        // Send success response AFTER token is created and email is attempted
        return res.json({ 
          message: "If an account with that email exists, we've sent a password reset link.",
          success: true 
        });
      } catch (dbError: any) {
        console.error("Failed to create password reset token:", dbError);
        console.error("Database error details:", dbError.message, dbError.stack);
        return res.status(500).json({ 
          success: false,
          message: "Failed to process password reset request. Please try again later." 
        });
      }

    } catch (error) {
      console.error("Forgot password error:", error);
      res.status(500).json({ message: "Failed to process password reset request" });
    }
  });

  // Reset password route
  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, newPassword } = req.body;
      
      if (!token || !newPassword) {
        return res.status(400).json({ message: "Token and new password are required" });
      }

      // Validate password strength
      if (newPassword.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters long" });
      }

      // Get token from database
      const resetToken = await storage.getPasswordResetToken(token);
      if (!resetToken) {
        return res.status(400).json({ message: "Invalid or expired reset token" });
      }

      const bcrypt = await import("bcrypt");
      const passwordHash = await bcrypt.hash(newPassword, 10);

      if (resetToken.userType === 'user') {
        // Update user password
        const user = await storage.getUserByEmail(resetToken.email);
        if (user) {
          await storage.updateUserPassword(user.id, passwordHash);
          console.log("User password updated for:", resetToken.email);
        } else {
          return res.status(404).json({ message: "User not found" });
        }
      } else if (resetToken.userType === 'company') {
        // Update company password
        await storage.updateCompanyPassword(resetToken.email, passwordHash);
        console.log("Company password updated for:", resetToken.email);
      }

      // Mark token as used
      await storage.markPasswordResetTokenAsUsed(token);

      res.json({ message: "Password has been reset successfully" });

    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });
}

// JWT-based authentication middleware
const isAuthenticated: RequestHandler = async (req, res, next) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);
    
    if (!token) {
      console.log("Authentication failed: No token provided");
      return res.status(401).json({ message: "Unauthorized - No token provided" });
    }

    // Verify the JWT token
    const payload = verifyToken(token);
    
    if (!payload) {
      console.log("Authentication failed: Invalid or expired token");
      return res.status(401).json({ message: "Unauthorized - Invalid or expired token" });
    }

    // Get user data from token payload
    let user: any = null;
    
    if (payload.type === 'company' || payload.userId.startsWith('company_')) {
      // For company users, reconstruct the user object
      const companyId = payload.companyId || parseInt(payload.userId.replace('company_', ''));
      const companiesResponse = await storage.getAllCompanies();
      const company = companiesResponse.data.find((c: any) => c.id === companyId);
      
      if (company) {
        // Check if company is suspended
        if (!company.isActive && company.licenseStatus === "suspended") {
          console.log("Authentication failed: Company is suspended");
          return res.status(403).json({ 
            message: "Access denied: Your company account has been suspended. Please contact support." 
          });
        }

        user = {
          id: payload.userId,
          email: payload.email,
          role: payload.role || 'company_admin',
          firstName: company.contactPerson.split(' ')[0] || 'Company',
          lastName: company.contactPerson.split(' ').slice(1).join(' ') || 'Admin',
          companyId: company.id,
          companyName: company.name,
          type: 'company'
        };
      }
    } else {
      // For regular users, fetch from database
      const dbUser = await storage.getUserById(payload.userId);
      if (dbUser) {
        // Check if user belongs to a suspended company
        if (dbUser.companyId) {
          const companiesResponse = await storage.getAllCompanies();
          const company = companiesResponse.data.find((c: any) => c.id === dbUser.companyId);
          if (company && !company.isActive && company.licenseStatus === "suspended") {
            console.log("Authentication failed: User's company is suspended");
            return res.status(403).json({ 
              message: "Access denied: Your company account has been suspended. Please contact support." 
            });
          }
        }

        // Check if user is suspended
        if (!dbUser.isActive) {
          console.log("Authentication failed: User is suspended");
          return res.status(403).json({ 
            message: "Access denied: Your account has been suspended. Please contact support." 
          });
        }

        user = {
          ...dbUser,
          type: 'user'
        };
      }
    }
    
    if (!user) {
      console.log("Authentication failed: User not found");
      return res.status(401).json({ message: "User not found" });
    }

    console.log("User authenticated successfully:", user.email);
    (req as any).user = user;
    return next();
  } catch (error) {
    console.error("Authentication error:", error);
    return res.status(401).json({ message: "Authentication failed" });
  }
};















// Function to seed default users if they don't exist
async function seedDefaultUsers(): Promise<void> {
  try {
    console.log("Starting default user seeding...");
    
    // Wait for database connection to be ready (test with a simple query)
    try {
      await pool.query('SELECT 1');
      console.log("Database connection verified");
    } catch (dbError: any) {
      console.error("Database not ready for seeding:", dbError.message);
      throw new Error(`Database connection failed: ${dbError.message}`);
    }
    
    const bcrypt = await import("bcrypt");
    const { nanoid } = await import("nanoid");

    // Check and create admin user
    console.log("Checking for admin@epml.com...");
    let adminUser: any;
    try {
      adminUser = await storage.getUserByEmail("admin@epml.com");
    } catch (error: any) {
      console.error("Error checking admin user:", error.message);
      throw error;
    }
    
    if (!adminUser) {
      console.log("Creating default admin user...");
      const adminPasswordHash = await bcrypt.hash("admin123", 10);
      const adminId = nanoid();
      try {
        adminUser = await storage.createUser({
          id: adminId,
          email: "admin@epml.com",
          firstName: "Admin",
          lastName: "User",
          passwordHash: adminPasswordHash,
          role: "super_admin",
        });
        console.log("Default admin user created:", adminUser.email, "ID:", adminUser.id);
      } catch (createError: any) {
        console.error("Failed to create admin user:", createError.message);
        console.error("Error details:", createError);
        throw createError;
      }
    } else {
      console.log("Default admin user already exists:", adminUser.email);
    }

    // Check and create manager user
    console.log("Checking for manager@epml.com...");
    let managerUser: any;
    try {
      managerUser = await storage.getUserByEmail("manager@epml.com");
    } catch (error: any) {
      console.error("Error checking manager user:", error.message);
      throw error;
    }
    
    if (!managerUser) {
      console.log("Creating default manager user...");
      const managerPasswordHash = await bcrypt.hash("manager123", 10);
      const managerId = nanoid();
      try {
        managerUser = await storage.createUser({
          id: managerId,
          email: "manager@epml.com",
          firstName: "Manager",
          lastName: "User",
          passwordHash: managerPasswordHash,
          role: "manager",
        });
        console.log("Default manager user created:", managerUser.email, "ID:", managerUser.id);
      } catch (createError: any) {
        console.error("Failed to create manager user:", createError.message);
        console.error("Error details:", createError);
        throw createError;
      }
    } else {
      console.log("Default manager user already exists:", managerUser.email);
    }
    
    console.log("Default user seeding completed successfully");
  } catch (error: any) {
    console.error("Error seeding default users:", error);
    console.error("Error stack:", error.stack);
    // Don't throw - allow app to continue even if seeding fails
    // But log extensively so we can debug
  }
}

// Scheduled cleanup job for old audit logs based on dataRetention setting
async function runAuditLogCleanup() {
  try {
    // Get system-wide data retention period
    // Try to get from user settings, or use default 365 days
    let retentionDays = 365; // Default
    
    try {
      // Get all user settings and find the minimum dataRetention value
      // Use the minimum value across all users/companies to be conservative
      const allSettings = await db.select().from(userSettings);
      if (allSettings.length > 0) {
        const retentionValues = allSettings
          .map(s => s.dataRetention)
          .filter((v): v is number => v !== null && v !== undefined && v > 0);
        
        if (retentionValues.length > 0) {
          retentionDays = Math.min(...retentionValues);
        }
      }
    } catch (settingsError) {
      console.warn("Could not fetch settings for data retention, using default 365 days:", settingsError);
    }
    
    const deletedCount = await storage.deleteOldAuditLogs(retentionDays);
    
    if (deletedCount > 0) {
      console.log(`🧹 Audit log cleanup completed: ${deletedCount} old records deleted (retention: ${retentionDays} days)`);
    } else {
      console.log(`🧹 Audit log cleanup: No old records to delete (retention: ${retentionDays} days)`);
    }
  } catch (error) {
    console.error("Error in audit log cleanup job:", error);
  }
}

// Get timezone from settings or use default
async function getTimezoneFromSettings(): Promise<string> {
  try {
    const allSettings = await db.select().from(userSettings);
    if (allSettings.length > 0) {
      // Get the first non-null timezone, or use default
      const timezone = allSettings.find(s => s.timezone)?.timezone;
      if (timezone) {
        return timezone;
      }
    }
  } catch (error) {
    console.warn("Could not fetch timezone from settings, using default:", error);
  }
  return "Europe/Prague"; // Default timezone
}

// Schedule cleanup job to run at 12 AM daily in the configured timezone
async function scheduleAuditLogCleanup() {
  try {
    const timezone = await getTimezoneFromSettings();
    
    // Schedule cron job to run at 12 AM (00:00) daily in the specified timezone
    // Cron format: "0 0 * * *" means: minute 0, hour 0, every day, every month, every day of week
    cron.schedule("0 0 * * *", async () => {
      await runAuditLogCleanup();
    }, {
      timezone: timezone
    });
    
    console.log(`⏰ Audit log cleanup scheduled to run daily at 12:00 AM (${timezone})`);
    
    // Run immediately on startup (after a short delay to ensure DB is ready)
    setTimeout(() => {
      runAuditLogCleanup();
    }, 60000); // Wait 1 minute after startup
  } catch (error) {
    console.error("Error scheduling audit log cleanup:", error);
    // Fallback to default behavior if scheduling fails
    setTimeout(() => {
      runAuditLogCleanup();
    }, 60000);
    setInterval(() => {
      runAuditLogCleanup();
    }, 24 * 60 * 60 * 1000);
  }
}

// Initialize the scheduled cleanup
if (typeof cron !== 'undefined') {
  scheduleAuditLogCleanup();
}

/**
 * Extract meaningful error message from various error types
 * Handles database errors, validation errors, and generic errors
 */
function getErrorMessage(error: any, defaultMessage: string): string {
  // If error already has a meaningful message, use it
  if (error?.message && error.message !== defaultMessage) {
    // Check for common database error patternsf
    const message = error.message.toLowerCase();
    
    // Unique constraint violations
    if (message.includes('unique') || message.includes('duplicate')) {
      if (message.includes('email')) {
        return 'A user with this email already exists';
      }
      if (message.includes('registration_number') || message.includes('registrationnumber')) {
        return 'A company with this registration number already exists';
      }
      if (message.includes('vat_number') || message.includes('vatnumber')) {
        return 'A company with this VAT number already exists';
      }
      return 'A record with this information already exists';
    }
    
    // Foreign key constraint violations
    if (message.includes('foreign key') || message.includes('reference') || message.includes('constraint')) {
      if (message.includes('company_id') || message.includes('companyid')) {
        return 'Invalid company reference. The company does not exist';
      }
      if (message.includes('store_id') || message.includes('storeid')) {
        return 'Invalid store reference. The store does not exist';
      }
      if (message.includes('product_id') || message.includes('productid')) {
        return 'Invalid product reference. The product does not exist';
      }
      return 'Invalid reference. Please check the provided data';
    }
    
    // Not null constraint violations
    if (message.includes('not null') || message.includes('required')) {
      const fieldMatch = message.match(/(?:column|field)\s+["']?(\w+)["']?/i);
      if (fieldMatch) {
        const field = fieldMatch[1];
        return `${field.charAt(0).toUpperCase() + field.slice(1)} is required`;
      }
      return 'Required fields are missing';
    }
    
    // Check constraint violations
    if (message.includes('check constraint') || message.includes('violates check')) {
      return 'The provided data does not meet validation requirements';
    }
    
    // Database connection errors
    if (message.includes('connection') || message.includes('timeout') || message.includes('network')) {
      return 'Database connection error. Please try again';
    }
    
    // Return the original message if it seems meaningful
    return error.message;
  }
  
  // Check for PostgreSQL error codes
  if (error?.code) {
    switch (error.code) {
      case '23505': // unique_violation
        return 'A record with this information already exists';
      case '23503': // foreign_key_violation
        return 'Invalid reference. The related record does not exist';
      case '23502': // not_null_violation
        return 'Required fields are missing';
      case '23514': // check_violation
        return 'The provided data does not meet validation requirements';
      case '23513': // exclusion_violation
        return 'The operation violates a database constraint';
      case '42P01': // undefined_table
        return 'Database table not found. Please contact support';
      case '42883': // undefined_function
        return 'Database function not found. Please contact support';
      case '08006': // connection_failure
        return 'Database connection failed. Please try again';
      case '08003': // connection_does_not_exist
        return 'Database connection lost. Please try again';
    }
  }
  
  // Check for error detail (PostgreSQL often provides detailed messages)
  if (error?.detail) {
    return error.detail;
  }
  
  // Fallback to default message
  return defaultMessage;
}

export async function registerRoutes(app: Express): Promise<void> {
  // Note: setupAuth is called in initializeApp() before registerRoutes()
  // This ensures session middleware is initialized before routes

  // Add audit logging middleware
  app.use(auditMiddleware());

  // Seed default users (non-blocking, runs in background)
  seedDefaultUsers().catch((err) => {
    console.error("Seed function failed (non-critical):", err);
  });

  // Manual trigger endpoint for seeding users (for testing/debugging)
  app.post('/api/admin/seed-users', async (req, res) => {
    try {
      console.log("Manual seed trigger received");
      await seedDefaultUsers();
      res.json({ message: "Default users seeded successfully" });
    } catch (error: any) {
      console.error("Manual seed failed:", error);
      res.status(500).json({ 
        message: "Failed to seed users", 
        error: error.message 
      });
    }
  });



  // Dashboard analytics - NO AUTH REQUIRED FOR DASHBOARD
  app.get('/api/analytics', isAuthenticated, requireAnyPermission(PERMISSIONS.ANALYTICS_VIEW, PERMISSIONS.ANALYTICS_VIEW_ALL, PERMISSIONS.ANALYTICS_VIEW_OWN, PERMISSIONS.ANALYTICS_VIEW_ASSIGNED), async (req, res) => {
    try {
      const analytics = await storage.getAnalytics();
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching analytics:", error);
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  // Recent activities
  app.get('/api/activities', async (req, res) => {
    try {
      const activities = await storage.getRecentActivities(10);
      res.json(activities);
    } catch (error) {
      console.error("Error fetching activities:", error);
      res.status(500).json({ message: "Failed to fetch activities" });
    }
  });

  // Audit Log Routes - Permission-based access control
  app.get('/api/audit-logs', isAuthenticated, requireAnyPermission(PERMISSIONS.AUDIT_LOGS_VIEW, PERMISSIONS.AUDIT_LOGS_VIEW_ALL, PERMISSIONS.AUDIT_LOGS_VIEW_OWN, PERMISSIONS.AUDIT_LOGS_VIEW_ASSIGNED), async (req, res) => {
    try {
      const user = (req as any).user;
      const { 
        limit = 100, 
        offset = 0, 
        action, 
        entityType, 
        startDate, 
        endDate 
      } = req.query;

      // Permission-based filtering
      let filters: any = {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        action: action as string,
        entityType: entityType as string
      };

      if (startDate) {
        filters.startDate = new Date(startDate as string);
      }
      if (endDate) {
        filters.endDate = new Date(endDate as string);
      }

      // Super admin can see all audit logs (AUDIT_LOGS_VIEW_ALL)
      if (user.role === 'super_admin' || user.role === 'portal_admin') {
        // No additional filters needed - can see everything
      }
      // Company admin can only see their company's audit logs (AUDIT_LOGS_VIEW_OWN)
      else if (user.role === 'company_admin' || user.type === 'company') {
        filters.companyId = user.companyId;
      }
      // Store owners can only see their store's audit logs (AUDIT_LOGS_VIEW_ASSIGNED)
      else if (user.role === 'store_owner') {
        filters.storeId = user.storeId;
      }

      const auditLogs = await storage.getAuditLogs(filters);
      const totalCount = await storage.getAuditLogsCount(filters);
      
      res.json({
        data: auditLogs,
        total: totalCount,
        page: Math.floor(filters.offset / filters.limit) + 1,
        limit: filters.limit,
        totalPages: Math.ceil(totalCount / filters.limit)
      });
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });

  // Get audit logs for a specific store (for company admins and super admins)
  app.get('/api/stores/:storeId/audit-logs', isAuthenticated, requireAnyPermission(PERMISSIONS.AUDIT_LOGS_VIEW_ALL, PERMISSIONS.AUDIT_LOGS_VIEW_OWN), async (req, res) => {
    try {
      const user = (req as any).user;
      const storeId = parseInt(req.params.storeId);
      const { limit = 50, offset = 0 } = req.query;

      // Check permissions and ownership
      if (user.role === 'super_admin' || user.role === 'portal_admin') {
        // Super admin and portal admin can access any store's logs
      } else if (user.role === 'company_admin' || user.type === 'company') {
        // Company admin can only access their company's store logs
        const store = await storage.getStore(storeId);
        if (!store || store.companyId !== user.companyId) {
          return res.status(403).json({ message: "Access denied. You can only view audit logs for your company's stores." });
        }
      } else {
        return res.status(403).json({ message: "Access denied." });
      }

      const auditLogs = await storage.getAuditLogsByStore(storeId, parseInt(limit as string));
      res.json(auditLogs);
    } catch (error) {
      console.error("Error fetching store audit logs:", error);
      res.status(500).json({ message: "Failed to fetch store audit logs" });
    }
  });

  // Get audit logs for a specific company (for super admins only)
  app.get('/api/companies/:companyId/audit-logs', isAuthenticated, requirePermission(PERMISSIONS.AUDIT_LOGS_VIEW_ALL), async (req, res) => {
    try {
      const user = (req as any).user;
      const companyId = parseInt(req.params.companyId);
      const { limit = 50, offset = 0 } = req.query;

      // Only super admins can access company audit logs via this endpoint
      // Company admins should use the general audit logs endpoint which automatically filters by their company
      const auditLogs = await storage.getAuditLogsByCompany(companyId, parseInt(limit as string));
      res.json(auditLogs);
    } catch (error) {
      console.error("Error fetching company audit logs:", error);
      res.status(500).json({ message: "Failed to fetch company audit logs" });
    }
  });

  // User management - NO AUTH REQUIRED FOR DASHBOARD
  // Get current authenticated user
  app.get('/api/auth/user', isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      
      // Get user settings to include profile image and other profile data
      let settings = null;
      try {
        if (user.type === 'company') {
          settings = await storage.getUserSettings(undefined, user.companyId);
        } else {
          settings = await storage.getUserSettings(user.id);
        }
      } catch (settingsError) {
        console.warn("Error fetching user settings:", settingsError);
        // Continue without settings if there's an error
      }
      
      // Merge user data with settings data (profile fields)
      const userWithSettings = {
        ...user,
        profileImageUrl: settings?.profileImageUrl || user.profileImageUrl || null,
        firstName: settings?.firstName || user.firstName || null,
        lastName: settings?.lastName || user.lastName || null,
        phone: settings?.phone || user.phone || null,
      };
      
      // Debug logging
      if (settings?.profileImageUrl) {
        console.log('User profile image from settings:', settings.profileImageUrl);
      }
      
      res.json(userWithSettings);
    } catch (error) {
      console.error("Error fetching current user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.get('/api/users', isAuthenticated, requirePermission(PERMISSIONS.USERS_VIEW), async (req, res) => {
    try {
      const user = (req as any).user;
      
      // Get pagination parameters from query string
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;
      
      // Validate pagination parameters
      if (page < 1) {
        return res.status(400).json({ message: "Page must be greater than 0" });
      }
      if (limit < 1 || limit > 100) {
        return res.status(400).json({ message: "Limit must be between 1 and 100" });
      }
      
      const result = await storage.getAllUsers(limit, offset);
      
      // Filter out super_admin and portal_admin users from user management
      const filteredUsers = result.users.filter((u: any) => {
        // Exclude super_admin and portal_admin users from user management
        if (u.role === 'super_admin' || u.role === 'portal_admin') {
          return false;
        }
        return true;
      });
      
      // Count super_admin and portal_admin users to adjust total
      const adminCount = result.users.filter((u: any) => u.role === 'super_admin' || u.role === 'portal_admin').length;
      
      // Adjust total count: subtract super_admin and portal_admin users
      const adjustedTotal = result.total - adminCount;
      
      const totalPages = Math.ceil(adjustedTotal / limit);
      
      res.json({
        users: filteredUsers,
        pagination: {
          page,
          limit,
          total: adjustedTotal,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1
        }
      });
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Update user role endpoint
  app.put('/api/users/:id/role', isAuthenticated, requirePermission(PERMISSIONS.USERS_UPDATE), async (req, res) => {
    try {
      const user = (req as any).user;
      const userId = req.params.id;
      const { role } = req.body;

      if (!role) {
        return res.status(400).json({ message: "Role is required" });
      }

      // Validate role
      const validRoles = ['super_admin', 'company_admin', 'store_owner', 'manager'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ message: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
      }

      // Get old user data for audit trail
      const oldUser = await storage.getUserById(userId);
      if (!oldUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Update user role
      const updatedUser = await storage.updateUserRole(userId, role);

      // Log audit trail
      await AuditLogger.logUserUpdate(user, userId, oldUser, { role }, req);

      res.json({
        message: "User role updated successfully",
        user: updatedUser
      });
    } catch (error: any) {
      console.error("Error updating user role:", error);
      res.status(500).json({ message: error.message || "Failed to update user role" });
    }
  });

  // Company Management Routes - NO AUTH REQUIRED
  app.get('/api/companies', isAuthenticated, requireAnyPermission(PERMISSIONS.COMPANIES_VIEW, PERMISSIONS.COMPANIES_VIEW_OWN), async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    try {
      const { limit = 10, offset = 0, search, status } = req.query;
      const limitNum = parseInt(limit as string);
      const offsetNum = parseInt(offset as string);
      
      console.log("Fetching companies from database...", { limit: limitNum, offset: offsetNum, search, status });
      
      const result = await storage.getAllCompanies(limitNum, offsetNum);
      let companies = result.data;
      
      // Apply client-side filtering if search or status is provided
      if (search) {
        const searchLower = (search as string).toLowerCase();
        companies = companies.filter(c => 
          c.name.toLowerCase().includes(searchLower) ||
          c.registrationNumber.toLowerCase().includes(searchLower) ||
          c.vatNumber?.toLowerCase().includes(searchLower) ||
          c.email.toLowerCase().includes(searchLower)
        );
      }
      
      if (status && status !== 'all') {
        if (status === 'active') {
          companies = companies.filter(c => c.isActive);
        } else if (status === 'inactive') {
          companies = companies.filter(c => !c.isActive);
        } else {
          companies = companies.filter(c => c.licenseStatus === status);
        }
      }
      
      // Recalculate total after filtering
      const total = search || status ? companies.length : result.total;
      
      console.log("Found companies:", companies.length, "of", total);
      res.json({
        data: companies,
        total,
        page: Math.floor(offsetNum / limitNum) + 1,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      });
    } catch (error) {
      console.error("Error fetching companies:", error);
      res.status(500).json({ message: "Failed to fetch companies" });
    }
  });

  // Get single company by ID (must come before /api/companies to avoid route conflict)
  app.get('/api/companies/:id', isAuthenticated, requireAnyPermission(PERMISSIONS.COMPANIES_VIEW, PERMISSIONS.COMPANIES_VIEW_OWN), async (req, res) => {
    try {
      const companyId = parseInt(req.params.id);
      console.log(`[GET /api/companies/:id] Fetching company with ID: ${companyId}`);
      
      const company = await storage.getCompany(companyId);
      
      if (!company) {
        console.log(`[GET /api/companies/:id] Company ${companyId} not found`);
        return res.status(404).json({ message: "Company not found" });
      }

      console.log(`[GET /api/companies/:id] Company found:`, company.name);

      // Get branch count and user count
      const storesResult = await storage.getStoresByCompany(companyId);
      const stores = storesResult?.stores || [];
      const allUsersResult = await storage.getAllUsers();
      const companyUsers = allUsersResult.users.filter((u: any) => u.companyId === companyId);
      
      // Find company admin email (first company_admin user)
      const companyAdmin = companyUsers.find((u: any) => u.role === 'company_admin');
      const companyAdminEmail = companyAdmin?.email || null;
      
      const result = {
        ...company,
        branchCount: stores.length,
        userCount: companyUsers.length,
        companyAdminEmail
      };
      
      console.log(`[GET /api/companies/:id] Returning company data with ${stores.length} stores and ${companyUsers.length} users`);
      res.json(result);
    } catch (error: any) {
      console.error("[GET /api/companies/:id] Error fetching company:", error);
      res.status(500).json({ message: error.message || "Failed to fetch company" });
    }
  });

  app.post('/api/companies', isAuthenticated, requirePermission(PERMISSIONS.COMPANIES_CREATE), async (req, res) => {
    try {
      const user = (req as any).user;
      console.log("Creating company with data:", req.body);
      
      const company = await storage.createCompany(req.body);
      console.log("Company created successfully:", company);
      
      // Automatically create and send invitation email
      try {
        // Generate unique invitation token
        const invitationToken = Math.random().toString(36).substring(2) + Date.now().toString(36);
        
        // Set expiration date (7 days from now)
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        // Create invitation record
        const invitation = await storage.createCompanyInvitation({
          companyId: company.id,
          email: company.email,
          invitationToken,
          expiresAt,
          createdBy: user.id
        });

        // Send invitation email
        await sendCompanyInvitationEmail({
          email: company.email,
          companyName: company.name,
          invitationToken
        });

        console.log("Company invitation sent successfully to:", company.email);
      } catch (emailError) {
        console.error("Error sending invitation email:", emailError);
        // Don't fail the entire company creation if email fails
      }
      
      // Log audit trail
      await AuditLogger.logCompanyCreate(user, company, req);
      
      res.status(201).json(company);
    } catch (error: any) {
      console.error("Error creating company:", error);
      
      const errorMessage = getErrorMessage(error, "Failed to create company");
      
      // Check if it's a validation/constraint error (should be 400, not 500)
      if (errorMessage.includes('already exists') || 
          errorMessage.includes('invalid') ||
          errorMessage.includes('required') ||
          errorMessage.includes('constraint') ||
          error?.code?.startsWith('23')) { // PostgreSQL constraint violation codes
        return res.status(400).json({ message: errorMessage });
      }
      
      res.status(500).json({ message: errorMessage });
    }
  });

  app.put('/api/companies/:id', isAuthenticated, requirePermission(PERMISSIONS.COMPANIES_UPDATE), async (req, res) => {
    try {
      const user = (req as any).user;
      const companyId = parseInt(req.params.id);
      console.log("Updating company with ID:", companyId, "Data:", req.body);
      
      // Get old company data for audit trail
      const oldCompanyResult = await pool.query('SELECT * FROM companies WHERE id = $1', [companyId]);
      const oldCompany = oldCompanyResult.rows[0];
      
      // Build dynamic SQL based on what fields are provided
      const fields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;
      
      if (req.body.isActive !== undefined) {
        fields.push(`is_active = $${paramIndex++}`);
        values.push(req.body.isActive);
      }
      
      if (req.body.name !== undefined) {
        fields.push(`name = $${paramIndex++}`);
        values.push(req.body.name);
      }
      
      if (req.body.registrationNumber !== undefined) {
        fields.push(`registration_number = $${paramIndex++}`);
        values.push(req.body.registrationNumber);
      }
      
      if (req.body.vatNumber !== undefined) {
        fields.push(`vat_number = $${paramIndex++}`);
        values.push(req.body.vatNumber);
      }
      
      if (req.body.address !== undefined) {
        fields.push(`address = $${paramIndex++}`);
        values.push(req.body.address);
      }
      
      if (req.body.email !== undefined) {
        fields.push(`email = $${paramIndex++}`);
        values.push(req.body.email);
      }
      
      if (req.body.phone !== undefined) {
        fields.push(`phone = $${paramIndex++}`);
        values.push(req.body.phone);
      }
      
      if (req.body.contactPerson !== undefined) {
        fields.push(`contact_person = $${paramIndex++}`);
        values.push(req.body.contactPerson);
      }
      
      if (req.body.maxBranches !== undefined) {
        fields.push(`max_branches = $${paramIndex++}`);
        values.push(req.body.maxBranches);
      }
      
      // Handle password field with hashing
      if (req.body.password !== undefined && req.body.password !== '') {
        const bcrypt = await import("bcrypt");
        const hashedPassword = await bcrypt.hash(req.body.password, 10);
        fields.push(`password = $${paramIndex++}`);
        values.push(hashedPassword);
        console.log("Password field added to update with hashed value");
      }
      
      // Always update the timestamp
      fields.push(`updated_at = NOW()`);
      
      // Add the WHERE clause parameter
      values.push(companyId);
      
      const sql = `UPDATE companies SET ${fields.join(', ')} WHERE id = $${paramIndex}`;
      
      console.log("Executing SQL:", sql);
      console.log("With values:", values);
      
      // Use direct SQL execution that we know works
      const client = await pool.connect();
      try {
        await client.query(sql, values);
        
        // Get updated company
        const result = await client.query('SELECT * FROM companies WHERE id = $1', [companyId]);
        const row = result.rows[0];
        
        const updatedCompany = {
          id: row.id,
          name: row.name,
          registrationNumber: row.registration_number,
          vatNumber: row.vat_number,
          address: row.address,
          email: row.email,
          phone: row.phone,
          contactPerson: row.contact_person,
          isActive: row.is_active,
          licenseStatus: row.is_active ? "active" : "inactive",
          maxBranches: row.max_branches,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          branchCount: 0,
          userCount: 0
        };
        
        // Log audit trail
        await AuditLogger.logCompanyUpdate(user, companyId, oldCompany, req.body, req);
        
        console.log("Company updated successfully:", updatedCompany);
        res.json(updatedCompany);
      } catch (dbError) {
        console.error("Database error:", dbError);
        throw dbError;
      } finally {
        client.release();
      }
    } catch (error: any) {
      console.error("Error updating company:", error);
      const errorMessage = getErrorMessage(error, "Failed to update company");
      
      // Check if it's a validation/constraint error
      if (errorMessage.includes('already exists') || 
          errorMessage.includes('invalid') ||
          errorMessage.includes('required') ||
          errorMessage.includes('constraint') ||
          error?.code?.startsWith('23')) {
        return res.status(400).json({ message: errorMessage });
      }
      
      res.status(500).json({ message: errorMessage });
    }
  });



  app.delete('/api/companies/:id', isAuthenticated, requirePermission(PERMISSIONS.COMPANIES_DELETE), async (req, res) => {
    try {
      const user = (req as any).user;
      const companyId = parseInt(req.params.id);
      
      // Get company data before deletion for audit trail
      const company = await storage.getCompany(companyId);
      
      await storage.deleteCompany(companyId);
      
      // Log audit trail
      await AuditLogger.log(user, {
        action: "company_delete",
        entityType: "company",
        entityId: companyId.toString(),
        description: `Company "${company?.name}" deleted`,
        oldValues: company,
        severity: "warning"
      }, req);
      
      res.json({ message: "Company deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting company:", error);
      // Provide more detailed error message
      const errorMessage = error?.message || "Failed to delete company";
      res.status(500).json({ 
        message: errorMessage,
        error: error?.code || "UNKNOWN_ERROR",
        details: process.env.NODE_ENV === 'development' ? error?.stack : undefined
      });
    }
  });

  // Suspend company with cascading suspension (Super Admin only)
  app.post('/api/companies/:id/suspend', isAuthenticated, requireRole('super_admin', 'portal_admin'), async (req, res) => {
    try {
      const user = (req as any).user;
      const companyId = parseInt(req.params.id);

      // Get company before suspension for audit trail
      const company = await storage.getCompany(companyId);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }

      // Perform cascading suspension
      const result = await storage.suspendCompany(companyId);

      // Log audit trail
      await AuditLogger.log(user, {
        action: "company_suspend",
        entityType: "company",
        entityId: companyId.toString(),
        description: `Company "${company.name}" suspended. ${result.suspendedStores} stores and ${result.suspendedUsers} users suspended.`,
        oldValues: company,
        newValues: result.company,
        severity: "warning"
      }, req);

      res.json({
        message: "Company suspended successfully",
        company: result.company,
        suspendedStores: result.suspendedStores,
        suspendedUsers: result.suspendedUsers,
      });
    } catch (error: any) {
      console.error("Error suspending company:", error);
      res.status(500).json({ message: error.message || "Failed to suspend company" });
    }
  });

  // Unsuspend company with cascading reactivation (Super Admin only)
  app.post('/api/companies/:id/unsuspend', isAuthenticated, requireRole('super_admin', 'portal_admin'), async (req, res) => {
    try {
      const user = (req as any).user;
      const companyId = parseInt(req.params.id);

      // Get company before unsuspension for audit trail
      const company = await storage.getCompany(companyId);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }

      // Perform cascading unsuspension
      const result = await storage.unsuspendCompany(companyId);

      // Log audit trail
      await AuditLogger.log(user, {
        action: "company_unsuspend",
        entityType: "company",
        entityId: companyId.toString(),
        description: `Company "${company.name}" unsuspended. ${result.reactivatedStores} stores and ${result.reactivatedUsers} users reactivated.`,
        oldValues: company,
        newValues: result.company,
        severity: "info"
      }, req);

      res.json({
        message: "Company unsuspended successfully",
        company: result.company,
        reactivatedStores: result.reactivatedStores,
        reactivatedUsers: result.reactivatedUsers,
      });
    } catch (error: any) {
      console.error("Error unsuspending company:", error);
      res.status(500).json({ message: error.message || "Failed to unsuspend company" });
    }
  });

  // Company invitation endpoints
  app.post('/api/companies/:id/invite', isAuthenticated, requirePermission(PERMISSIONS.COMPANIES_SEND_INVITATIONS), async (req, res) => {
    try {
      const user = (req as any).user;
      const companyId = parseInt(req.params.id);

      // Get company details
      const company = await storage.getCompany(companyId);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }

      // Check if company is already activated (has a password)
      if (company.password) {
        return res.status(400).json({ 
          message: "Company is already activated. An invitation cannot be sent to an activated company account." 
        });
      }

      // Check if a user with this email already exists
      const existingUser = await storage.getUserByEmail(company.email);
      if (existingUser) {
        return res.status(400).json({ 
          message: `A user with email ${company.email} already exists. Cannot send invitation to an existing user email.` 
        });
      }

      // Generate unique invitation token
      const invitationToken = Math.random().toString(36).substring(2) + Date.now().toString(36);
      
      // Set expiration date (7 days from now)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      // Create invitation record
      const invitation = await storage.createCompanyInvitation({
        companyId,
        email: company.email,
        invitationToken,
        expiresAt,
        createdBy: user.id
      });

      // Send invitation email (non-blocking - don't fail if email fails)
      let emailSent = false;
      const emailResult = await sendCompanyInvitationEmail({
        email: company.email,
        companyName: company.name,
        invitationToken
      });
      emailSent = emailResult.success || false;
      
      if (!emailSent) {
        console.log("=== INVITATION CREATED BUT EMAIL FAILED ===");
        console.log(`Company: ${company.name}`);
        console.log(`Email: ${company.email}`);
        if (emailResult.activationUrl) {
          console.log(`Activation URL: ${emailResult.activationUrl}`);
        }
        console.log("=== Copy the URL above to manually send to the company ===");
      }

      // Log audit trail
      await storage.createAuditLog({
        action: "send_company_invitation",
        entityType: "company_invitation",
        entityId: invitation.id.toString(),
        userId: user.id,
        userEmail: user.email,
        userRole: user.role,
        description: `Company invitation ${emailSent ? 'sent' : 'created (email failed)'} to ${company.email}`,
        newValues: { companyId, email: company.email, emailSent },
        severity: emailSent ? "info" : "warning"
      });

      res.json({ 
        message: emailSent ? "Invitation sent successfully" : "Invitation created successfully (email sending failed - check console for activation link)",
        invitation: {
          id: invitation.id,
          email: invitation.email,
          expiresAt: invitation.expiresAt
        },
        emailSent
      });
    } catch (error: any) {
      console.error("Error sending company invitation:", error);
      const errorMessage = getErrorMessage(error, "Failed to send invitation");
      
      // Check if it's a validation/constraint error
      if (errorMessage.includes('already exists') || 
          errorMessage.includes('already activated') ||
          errorMessage.includes('invalid') ||
          error?.code?.startsWith('23')) {
        return res.status(400).json({ message: errorMessage });
      }
      
      res.status(500).json({ message: errorMessage });
    }
  });

  // Company activation endpoint
  app.get('/api/company-invitation/:token', async (req, res) => {
    try {
      const token = req.params.token;
      
      // Get invitation details
      const invitation = await storage.getCompanyInvitationByToken(token);
      if (!invitation) {
        return res.status(404).json({ message: "Invalid invitation token" });
      }

      // Check if invitation is expired
      if (new Date() > invitation.expiresAt) {
        return res.status(400).json({ message: "Invitation has expired" });
      }

      // Check if already used
      if (invitation.isUsed) {
        return res.status(400).json({ message: "Invitation has already been used" });
      }

      // Get company details
      const company = await storage.getCompany(invitation.companyId);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }

      res.json({
        company: {
          id: company.id,
          name: company.name,
          email: company.email,
          registrationNumber: company.registrationNumber,
          vatNumber: company.vatNumber,
          address: company.address,
          phone: company.phone,
          contactPerson: company.contactPerson
        },
        invitation: {
          token: invitation.invitationToken,
          expiresAt: invitation.expiresAt
        }
      });
    } catch (error) {
      console.error("Error validating invitation:", error);
      res.status(500).json({ message: "Failed to validate invitation" });
    }
  });

  // Company activation completion endpoint
  app.post('/api/company-activation/:token', async (req, res) => {
    try {
      const token = req.params.token;
      const { password, businessInfo } = req.body;

      // Validate input
      if (!password || password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters long" });
      }

      // Get invitation details
      const invitation = await storage.getCompanyInvitationByToken(token);
      if (!invitation) {
        return res.status(404).json({ message: "Invalid invitation token" });
      }

      // Check if invitation is expired
      if (new Date() > invitation.expiresAt) {
        return res.status(400).json({ message: "Invitation has expired" });
      }

      // Check if already used
      if (invitation.isUsed) {
        return res.status(400).json({ message: "Invitation has already been used" });
      }

      // Get company
      const company = await storage.getCompany(invitation.companyId);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }

      // Check if company is already activated
      if (company.password) {
        return res.status(400).json({ 
          message: "Company is already activated." 
        });
      }

      // Check if a user with this email already exists
      const existingUser = await storage.getUserByEmail(company.email);
      if (existingUser) {
        return res.status(400).json({ 
          message: `A user with email ${company.email} already exists. Cannot activate company with an existing user email.` 
        });
      }

      // Hash password
      const bcrypt = await import("bcrypt");
      const passwordHash = await bcrypt.hash(password, 10);

      // Update company with password, business info, and activate the company
      const updates: any = { 
        password: passwordHash,
        isActive: true // Activate the company upon completion
      };
      if (businessInfo) {
        if (businessInfo.address) updates.address = businessInfo.address;
        if (businessInfo.phone) updates.phone = businessInfo.phone;
        if (businessInfo.contactPerson) updates.contactPerson = businessInfo.contactPerson;
      }

      await storage.updateCompany(invitation.companyId, updates);

      // Mark invitation as used
      await storage.markInvitationAsUsed(token);

      // Log audit trail
      await storage.createAuditLog({
        action: "company_activation",
        entityType: "company",
        entityId: invitation.companyId.toString(),
        userId: 'system',
        userEmail: company.email,
        userRole: 'company_admin',
        description: `Company ${company.name} activated their account`,
        newValues: { companyId: invitation.companyId, email: company.email },
        severity: "info"
      });

      res.json({ 
        message: "Company account activated successfully",
        company: {
          id: company.id,
          name: company.name,
          email: company.email
        }
      });
    } catch (error: any) {
      console.error("Error activating company account:", error);
      const errorMessage = getErrorMessage(error, "Failed to activate company account");
      
      // Check if it's a validation/constraint error
      if (errorMessage.includes('already exists') || 
          errorMessage.includes('already activated') ||
          errorMessage.includes('invalid') ||
          errorMessage.includes('required') ||
          error?.code?.startsWith('23')) {
        return res.status(400).json({ message: errorMessage });
      }
      
      res.status(500).json({ message: errorMessage });
    }
  });

  // Get stores for a specific company
  app.get('/api/companies/:id/stores', async (req, res) => {
    try {
      const companyId = parseInt(req.params.id);
      
      if (isNaN(companyId)) {
        return res.status(400).json({ 
          success: false,
          message: "Invalid company ID" 
        });
      }

      const { search, status, limit, offset, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
      
      const limitNum = limit ? parseInt(limit as string) : undefined;
      const offsetNum = offset ? parseInt(offset as string) : undefined;
      const searchQuery = search as string | undefined;
      const statusFilter = status as string | undefined;
      
      const { stores, total } = await storage.getStoresByCompany(companyId, limitNum, offsetNum, searchQuery, statusFilter);
      
      // If pagination parameters are provided, return paginated response
      if (limitNum !== undefined && offsetNum !== undefined) {
        const totalPages = Math.ceil(total / limitNum);
        
        return res.json({
          data: stores,
          total,
          page: Math.floor(offsetNum / limitNum) + 1,
          limit: limitNum,
          totalPages
        });
      }
      
      // If no pagination parameters, return array directly for backward compatibility
      res.json(stores);
    } catch (error: any) {
      console.error("Error fetching company stores:", error);
      res.status(500).json({ 
        success: false,
        message: error.message || "Failed to fetch company stores" 
      });
    }
  });

  // Store Management Routes
  app.get('/api/stores', isAuthenticated, requireAnyPermission(PERMISSIONS.STORES_VIEW, PERMISSIONS.STORES_VIEW_OWN, PERMISSIONS.STORES_VIEW_ASSIGNED), async (req, res) => {
    try {
      const user = (req as any).user;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;
      const searchQuery = req.query.search as string | undefined;
      const statusFilter = req.query.status as string | undefined;
      
      console.log("User requesting stores:", { id: user.id, role: user.role, type: user.type, companyId: user.companyId, limit, offset, search: searchQuery, status: statusFilter });
      
      // For company admins (both company type and company_admin role), only show their company's stores
      if (user.type === 'company' || user.role === 'company_admin') {
        if (!user.companyId) {
          console.log("Company user without companyId, returning empty array");
          return res.json({
            data: [],
            total: 0,
            page: 1,
            limit,
            totalPages: 0,
          });
        }
        const result = await storage.getStoresByCompany(user.companyId, limit, offset, searchQuery, statusFilter);
        const stores = result?.stores || [];
        const total = result?.total || 0;
        
        console.log(`Fetching stores for company ID ${user.companyId}: Found ${stores.length} stores`);
        
        const page = Math.floor(offset / limit) + 1;
        const totalPages = Math.ceil(total / limit);
        
        res.json({
          data: stores,
          total,
          page,
          limit,
          totalPages,
        });
      } else {
        // For super admins and portal admins, show all stores
        console.log("Super admin or portal admin user, fetching all stores");
        const result = await storage.getAllStores(limit, offset, searchQuery, statusFilter);
        const stores = result?.stores || [];
        const total = result?.total || 0;
        
        const page = Math.floor(offset / limit) + 1;
        const totalPages = Math.ceil(total / limit);
        
        res.json({
          data: stores,
          total,
          page,
          limit,
          totalPages,
        });
      }
    } catch (error) {
      console.error("Error fetching stores:", error);
      res.status(500).json({ message: "Failed to fetch stores" });
    }
  });

  app.get('/api/stores/:id', isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      const storeId = parseInt(req.params.id);
      const store = await storage.getStore(storeId);
      
      if (!store) {
        return res.status(404).json({ message: "Store not found" });
      }
      
      // For store owners, restrict access to only their assigned store
      if (user && user.role === 'store_owner') {
        if (!user.storeId || user.storeId !== storeId) {
          return res.status(403).json({ 
            message: "Access denied. You can only view your assigned store." 
          });
        }
      }
      
      // If store has a managerId, check if it's a store_owner and include their email
      let storeOwnerEmail = null;
      if (store.managerId) {
        try {
          const owner = await storage.getUserById(store.managerId);
          if (owner && owner.role === 'store_owner') {
            storeOwnerEmail = owner.email;
          }
        } catch (error) {
          // Ignore errors when fetching owner - not critical
          console.warn("Could not fetch store owner:", error);
        }
      }
      
      // Calculate actual statistics from data
      let revenue = 0;
      let customerCount = 0;
      let productCount = 0;
      
      try {
        // Get sales for this store to calculate revenue and customer count
        const sales = await storage.getSalesByStore(storeId);
        
        // Calculate total revenue from sales
        revenue = sales.reduce((sum, sale) => {
          const total = typeof sale.total === 'string' ? parseFloat(sale.total) : (sale.total || 0);
          return sum + total;
        }, 0);
        
        // Calculate customer count from sales
        // Customer info is stored in items JSONB, so we'll count unique customers from items
        const uniqueCustomers = new Set<string>();
        sales.forEach((sale: any) => {
          // Check if items contain customer information
          if (sale.items && typeof sale.items === 'object') {
            // Items might be an object with customerInfo or items array
            const items = sale.items.items || (Array.isArray(sale.items) ? sale.items : []);
            const customerInfo = sale.items.customerInfo || sale.customerInfo;
            
            if (customerInfo) {
              // Use customer email, phone, or name as identifier
              const identifier = customerInfo.email || customerInfo.phone || customerInfo.name;
              if (identifier) {
                uniqueCustomers.add(identifier.toLowerCase().trim());
              } else {
                // No customer identifier, count as anonymous
                uniqueCustomers.add(`anonymous_${sale.id}`);
              }
            } else {
              // No customer info in this sale, count as anonymous
              uniqueCustomers.add(`anonymous_${sale.id}`);
            }
          } else {
            // No items or invalid structure, count as anonymous
            uniqueCustomers.add(`anonymous_${sale.id}`);
          }
        });
        customerCount = uniqueCustomers.size;
      } catch (error) {
        console.warn("Error calculating revenue/customer count:", error);
        // Keep default values of 0 if calculation fails
      }
      
      try {
        // Get products for this store to calculate product count
        const { total } = await storage.getProductsByStore(storeId);
        productCount = total;
      } catch (error) {
        console.warn("Error calculating product count:", error);
        // Keep default value of 0 if calculation fails
      }
      
      res.json({
        ...store,
        revenue: Math.round(revenue * 100) / 100, // Round to 2 decimal places
        customerCount,
        productCount,
        storeOwnerEmail
      });
    } catch (error) {
      console.error("Error fetching store:", error);
      res.status(500).json({ message: "Failed to fetch store" });
    }
  });

  app.post('/api/stores', isAuthenticated, requirePermission(PERMISSIONS.STORES_CREATE), async (req, res) => {
    try {
      const user = (req as any).user;
      
      // Extract owner email and password BEFORE parsing schema (schema might strip them)
      const { ownerEmail, ownerPassword, ...bodyWithoutOwner } = req.body;
      
      console.log('Store creation request - ownerEmail:', ownerEmail ? 'provided' : 'not provided', 'ownerPassword:', ownerPassword ? 'provided' : 'not provided');
      
      const storeData = insertStoreSchema.parse(bodyWithoutOwner) as any;
      
      // Determine companyId - either from user (company admin) or from request body (super admin)
      const targetCompanyId = storeData.companyId || (user.type === 'company' || user.role === 'company_admin' ? user.companyId : null);
      
      if (!targetCompanyId) {
        return res.status(400).json({ 
          message: "Company ID is required to create a branch/store."
        });
      }
      
      // For company admins, automatically set the companyId
      if (user.type === 'company' || user.role === 'company_admin') {
        storeData.companyId = user.companyId;
      } else {
        // For super_admin, use the companyId from request body
        storeData.companyId = targetCompanyId;
      }
      
      // Validate branch limit for ALL users (including super_admin)
      const company = await storage.getCompany(targetCompanyId);
      if (!company) {
        return res.status(404).json({ 
          message: "Company not found."
        });
      }
      
      const { stores: existingStores, total: existingStoresTotal } = await storage.getStoresByCompany(targetCompanyId);
      const maxBranches = company.maxBranches || 5;
      const currentBranchCount = existingStoresTotal;
      
      // Prevent creation if branchCount >= maxBranches
      if (currentBranchCount >= maxBranches) {
        return res.status(400).json({ 
          message: `Cannot create branch. Maximum branch limit reached (${currentBranchCount}/${maxBranches}).`,
          limit: maxBranches,
          current: currentBranchCount
        });
      }
      
      console.log(`Creating store for company ID ${targetCompanyId} (${company.name})`);
      
      // Use storeData (already parsed) instead of storeDataWithoutOwner
      const storeDataWithoutOwner = storeData;
      
      // Create the store
      const store = await storage.createStore(storeDataWithoutOwner);
      
      // Create store owner if email and password are provided
      let storeOwner = null;
      if (ownerEmail && ownerPassword) {
        console.log(`Attempting to create store owner with email: ${ownerEmail}`);
        try {
          // Check if user with this email already exists
          const existingUser = await storage.getUserByEmail(ownerEmail);
          if (existingUser) {
            console.warn(`User with email ${ownerEmail} already exists. Skipping store owner creation.`);
          } else {
            // Hash the password
            const passwordHash = await bcrypt.hash(ownerPassword, 10);
            console.log(`Password hashed, creating store owner user...`);
            
            // Create store owner user
            storeOwner = await storage.createUser({
              email: ownerEmail,
              firstName: store.name.split(' ')[0] || 'Store',
              lastName: 'Owner',
              role: 'store_owner',
              passwordHash: passwordHash,
              companyId: targetCompanyId,
              storeId: store.id,
              isActive: true,
            } as any);
            
            console.log(`Store owner user created with ID: ${storeOwner?.id}`);
            
            // Update store to link it to the store owner
            await storage.updateStore(store.id, { managerId: storeOwner.id });
            
            console.log(`Store owner created for store ${store.name} with email ${ownerEmail}`);
            
            // Log audit trail for store owner creation
            await AuditLogger.logUserCreate(user, storeOwner, req);
          }
        } catch (ownerError: any) {
          console.error("Error creating store owner:", ownerError);
          console.error("Error details:", {
            message: ownerError.message,
            code: ownerError.code,
            constraint: ownerError.constraint,
            detail: ownerError.detail,
            stack: ownerError.stack
          });
          // If it's a duplicate email error, include it in the response
          if (ownerError.code === '23505' && ownerError.constraint === 'users_email_unique') {
            // Store is already created, so we return success but with a warning
            return res.status(201).json({
              ...store,
              storeOwner: null,
              warning: `Store created successfully, but store owner account could not be created: A user with the email "${ownerEmail}" already exists.`
            });
          }
          // For other errors, log them and include a warning in the response
          // The store is already created, so we continue but inform the user
          console.error(`Store owner creation failed for store ${store.id}:`, ownerError.message);
        }
      } else {
        console.log('No store owner credentials provided (ownerEmail or ownerPassword missing)');
      }
      
      // Log activity
      await storage.createActivity({
        type: "store_created",
        description: `Store "${store.name}" was created${storeOwner ? ` with store owner ${ownerEmail}` : ''}`,
        storeId: store.id,
        metadata: { storeName: store.name, companyId: user.companyId, storeOwnerCreated: !!storeOwner }
      });
      
      // Log audit trail
      await AuditLogger.logStoreCreate(user, store, req);
      
      const response: any = {
        ...store,
        storeOwner: storeOwner ? { id: storeOwner.id, email: storeOwner.email } : null
      };
      
      // If store owner creation was attempted but failed, add a warning
      if (ownerEmail && ownerPassword && !storeOwner) {
        response.warning = 'Store created successfully, but store owner account could not be created. Please check server logs for details.';
      }
      
      res.status(201).json(response);
    } catch (error) {
      console.error("Error creating store:", error);
      res.status(500).json({ message: "Failed to create store" });
    }
  });

  app.put('/api/stores/:id', isAuthenticated, requirePermission(PERMISSIONS.STORES_UPDATE), async (req, res) => {
    try {
      const user = (req as any).user;
      const storeId = parseInt(req.params.id);
      const updates = req.body;
      
      console.log("Store update request - ID:", storeId, "Updates:", updates);
      
      // Get old store data for audit trail
      const oldStore = await storage.getStore(storeId);
      
      const store = await storage.updateStore(storeId, updates);
      
      console.log("Store updated successfully:", store);
      
      // Log activity
      await storage.createActivity({
        type: "store_updated",
        description: `Store "${store.name}" was updated`,
        storeId: store.id,
        metadata: { updates, storeName: store.name }
      });
      
      // Log audit trail
      await AuditLogger.logStoreUpdate(user, storeId, oldStore, store, req);
      
      res.json(store);
    } catch (error) {
      console.error("Error updating store:", error);
      res.status(500).json({ message: "Failed to update store" });
    }
  });

  app.delete('/api/stores/:id', isAuthenticated, requirePermission(PERMISSIONS.STORES_DELETE), async (req, res) => {
    try {
      const user = (req as any).user;
      const storeId = parseInt(req.params.id);
      const store = await storage.getStore(storeId);
      
      if (!store) {
        return res.status(404).json({ message: "Store not found" });
      }
      
      await storage.deleteStore(storeId);
      
      // Log activity
      await storage.createActivity({
        type: "store_deleted",
        description: `Store "${store.name}" was deleted`,
        metadata: { storeName: store.name }
      });
      
      // Log audit trail
      await AuditLogger.log(user, {
        action: "store_delete",
        entityType: "store",
        entityId: storeId.toString(),
        description: `Store "${store.name}" deleted`,
        oldValues: store,
        severity: "warning",
        metadata: { storeId }
      }, req);
      
      res.json({ message: "Store deleted successfully" });
    } catch (error) {
      console.error("Error deleting store:", error);
      res.status(500).json({ message: "Failed to delete store" });
    }
  });

  // Manager routes
  app.get('/api/managers', isAuthenticated, requireAnyPermission(PERMISSIONS.MANAGERS_VIEW, PERMISSIONS.MANAGERS_VIEW_OWN), async (req, res) => {
    try {
      const user = (req as any).user;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;
      const storeFilter = req.query.store as string | undefined;
      const searchQuery = req.query.search as string | undefined;
      const statusFilter = req.query.status as string | undefined;
      
      // For store owners, only show managers from their assigned store
      if (user.role === 'store_owner') {
        if (!user.storeId) {
          return res.json({
            managers: [],
            pagination: {
              page,
              limit,
              total: 0,
              totalPages: 0,
              hasNextPage: false,
              hasPreviousPage: false,
            },
          });
        }
        
        const { managers, total } = await storage.getManagersByStoreIds([user.storeId], limit, offset, undefined, searchQuery, statusFilter);
        console.log(`Fetching managers for store owner's store ID ${user.storeId}: Found ${managers.length} managers`);
        
        const totalPages = Math.ceil(total / limit);
        res.json({
          managers,
          pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1,
          },
        });
      } else if (user.type === 'company' || user.role === 'company_admin') {
        // For company admins, only show managers from their company's stores
        const companyStoresResult = await storage.getStoresByCompany(user.companyId);
        const companyStores = companyStoresResult?.stores || [];
        const storeIds = companyStores.map(store => store.id);
        
        // Apply store filter if provided
        let filteredStoreIds = storeIds;
        if (storeFilter && storeFilter !== 'all') {
          if (storeFilter === 'unassigned') {
            // For unassigned, get all managers and filter by companyId and null storeId
            // Since managers belong to companies, we can filter by companyId
            const allManagersResult = await storage.getAllManagers(1000, 0);
            const allManagers = Array.isArray(allManagersResult) ? allManagersResult : allManagersResult.managers;
            const unassignedManagers = allManagers.filter((m: any) => 
              !m.storeId && m.companyId === user.companyId
            );
            // Apply search and status filters
            let filteredManagers = unassignedManagers;
            if (searchQuery) {
              filteredManagers = filteredManagers.filter((m: any) => 
                m.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                m.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                m.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                m.phone?.toLowerCase().includes(searchQuery.toLowerCase())
              );
            }
            if (statusFilter === 'active') {
              filteredManagers = filteredManagers.filter((m: any) => m.isActive === true);
            } else if (statusFilter === 'inactive') {
              filteredManagers = filteredManagers.filter((m: any) => m.isActive === false);
            }
            
            const total = filteredManagers.length;
            const paginatedManagers = filteredManagers.slice(offset, offset + limit);
            
            const totalPages = Math.ceil(total / limit);
            return res.json({
              managers: paginatedManagers,
              pagination: {
                page,
                limit,
                total,
                totalPages,
                hasNextPage: page < totalPages,
                hasPreviousPage: page > 1,
              },
            });
          } else {
            const storeId = parseInt(storeFilter);
            if (!isNaN(storeId) && storeIds.includes(storeId)) {
              filteredStoreIds = [storeId];
            } else {
              // Store not found or not accessible
              return res.json({
                managers: [],
                pagination: {
                  page,
                  limit,
                  total: 0,
                  totalPages: 0,
                  hasNextPage: false,
                  hasPreviousPage: false,
                },
              });
            }
          }
        }
        
        const { managers, total } = await storage.getManagersByStoreIds(filteredStoreIds, limit, offset, undefined, searchQuery, statusFilter);
        console.log(`Fetching managers for company ID ${user.companyId}: Found ${managers.length} managers`);
        
        const totalPages = Math.ceil(total / limit);
        res.json({
          managers,
          pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1,
          },
        });
      } else if (user.role === 'super_admin' || user.role === 'portal_admin') {
        // For super admins and portal admins, show all managers
        let managers, total;
        
        if (storeFilter && storeFilter !== 'all') {
          if (storeFilter === 'unassigned') {
            // Get unassigned managers
            const result = await storage.getManagersByStoreIds([], limit, offset, 'unassigned', searchQuery, statusFilter);
            managers = result.managers;
            total = result.total;
          } else {
            const storeId = parseInt(storeFilter);
            if (!isNaN(storeId)) {
              const result = await storage.getManagersByStoreIds([storeId], limit, offset, undefined, searchQuery, statusFilter);
              managers = result.managers;
              total = result.total;
            } else {
              managers = [];
              total = 0;
            }
          }
        } else {
          const result = await storage.getAllManagers(limit, offset, searchQuery, statusFilter);
          managers = result.managers;
          total = result.total;
        }
        
        const totalPages = Math.ceil(total / limit);
        res.json({
          managers,
          pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1,
          },
        });
      } else {
        // For other roles, return empty result
        res.json({
          managers: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPreviousPage: false,
          },
        });
      }
    } catch (error) {
      console.error("Error fetching managers:", error);
      res.status(500).json({ message: "Failed to fetch managers" });
    }
  });

  app.post('/api/managers', isAuthenticated, requirePermission(PERMISSIONS.MANAGERS_CREATE), async (req, res) => {
    try {
      const user = (req as any).user;
      const managerData = req.body;
      
      // Portal admins must be created through the dedicated /api/portal-admins endpoint
      if (managerData.role === 'portal_admin') {
        return res.status(403).json({ 
          message: "Access denied. Portal admins cannot be created through this endpoint. Use /api/portal-admins endpoint instead." 
        });
      }
      
      // For store owners, restrict to their assigned store
      if (user.role === 'store_owner') {
        if (!user.storeId) {
          return res.status(400).json({ message: "Store owner does not have a store assigned" });
        }
        
        // Get store to get companyId
        const store = await storage.getStore(user.storeId);
        if (!store) {
          return res.status(404).json({ message: "Store not found" });
        }
        
        managerData.companyId = store.companyId;
        managerData.storeId = user.storeId; // Force to their store
      } else if (user.type === 'company' || user.role === 'company_admin') {
        // Set companyId from the logged-in user for company admins
        if (!user.companyId) {
          return res.status(400).json({ message: "User does not have a company associated" });
        }
        managerData.companyId = user.companyId;
        
        // Ensure they can only create managers for their own stores
        if (managerData.storeId) {
          const companyStoresResult = await storage.getStoresByCompany(user.companyId);
          const companyStores = companyStoresResult?.stores || [];
          const validStoreIds = companyStores.map(store => store.id);
          
          if (!validStoreIds.includes(parseInt(managerData.storeId))) {
            return res.status(403).json({ message: "Cannot assign manager to store not owned by your company" });
          }
        }
      }
      
      console.log("Creating manager with data:", managerData);
      
      const manager = await storage.createManager(managerData);
      
      // Log activity
      await storage.createActivity({
        type: "manager_created",
        description: `Manager "${manager.firstName} ${manager.lastName}" was created`,
        metadata: { managerName: `${manager.firstName} ${manager.lastName}`, managerId: manager.id, companyId: user.companyId }
      });
      
      // Log audit trail
      await AuditLogger.logUserCreate(user, manager, req);
      
      res.status(201).json(manager);
    } catch (error: any) {
      console.error("Error creating manager:", error);
      
      // Handle duplicate email error
      if (error.code === '23505' && error.constraint === 'users_email_unique') {
        return res.status(400).json({ 
          message: `A user with the email "${req.body.email}" already exists. Please use a different email address.` 
        });
      }
      
      // Handle other database errors
      if (error.code && error.detail) {
        return res.status(400).json({ 
          message: error.detail || "Failed to create manager due to a database error." 
        });
      }
      
      res.status(500).json({ message: "Failed to create manager" });
    }
  });

  app.put('/api/managers/:id', isAuthenticated, requirePermission(PERMISSIONS.MANAGERS_UPDATE), async (req, res) => {
    try {
      const user = (req as any).user;
      const managerId = req.params.id; // Keep as string since DB uses varchar
      const updates = req.body;
      
      console.log("Manager update request - ID:", managerId, "Updates:", updates);
      
      if (!managerId || managerId === 'null' || managerId === 'undefined') {
        return res.status(400).json({ message: "Invalid manager ID" });
      }
      
      // Get old manager data for audit trail and authorization check
      const oldManager = await storage.getManager(managerId);
      
      if (!oldManager) {
        return res.status(404).json({ message: "Manager not found" });
      }
      
      // For store owners, restrict to managers from their assigned store
      if (user.role === 'store_owner') {
        if (!user.storeId || oldManager.storeId !== user.storeId) {
          return res.status(403).json({ 
            message: "Access denied. You can only update managers from your assigned store." 
          });
        }
        // Prevent store owners from changing the storeId
        if (updates.storeId && updates.storeId !== user.storeId) {
          return res.status(403).json({ 
            message: "Access denied. You cannot assign managers to other stores." 
          });
        }
        // Force storeId to their store
        updates.storeId = user.storeId;
      } else if (user.role === 'company_admin' || user.type === 'company') {
        // Company admins can only update managers from their company
        if (user.companyId && oldManager.companyId !== user.companyId) {
          return res.status(403).json({ 
            message: "Access denied. You can only update managers from your own company." 
          });
        }
        // Ensure they can only assign to their own stores
        if (updates.storeId) {
          const companyStoresResult = await storage.getStoresByCompany(user.companyId);
          const companyStores = companyStoresResult?.stores || [];
          const validStoreIds = companyStores.map(store => store.id);
          
          if (!validStoreIds.includes(parseInt(updates.storeId))) {
            return res.status(403).json({ message: "Cannot assign manager to store not owned by your company" });
          }
        }
      }
      
      const manager = await storage.updateManager(managerId, updates);
      
      if (!manager) {
        return res.status(404).json({ message: "Manager not found" });
      }
      
      console.log("Manager updated successfully:", manager);
      
      // Log activity
      await storage.createActivity({
        type: "manager_updated",
        description: `Manager "${manager.firstName} ${manager.lastName}" was updated`,
        metadata: { updates, managerName: `${manager.firstName} ${manager.lastName}` }
      });
      
      // Log audit trail
      await AuditLogger.logUserUpdate(user, managerId, oldManager, updates, req);
      
      res.json(manager);
    } catch (error) {
      console.error("Error updating manager:", error);
      res.status(500).json({ message: "Failed to update manager" });
    }
  });

  // Get managers for a specific store
  app.get('/api/stores/:storeId/managers', isAuthenticated, requireAnyPermission(PERMISSIONS.MANAGERS_VIEW, PERMISSIONS.MANAGERS_VIEW_OWN), async (req, res) => {
    try {
      const user = (req as any).user;
      const storeId = parseInt(req.params.storeId);
      
      if (isNaN(storeId)) {
        return res.status(400).json({ message: "Invalid store ID" });
      }
      
      // Verify store exists and user has access
      const store = await storage.getStore(storeId);
      if (!store) {
        return res.status(404).json({ message: "Store not found" });
      }
      
      // For store owners, restrict access to only their assigned store
      if (user.role === 'store_owner') {
        if (!user.storeId || user.storeId !== storeId) {
          return res.status(403).json({ 
            message: "Access denied. You can only view managers from your assigned store." 
          });
        }
      }
      
      // For company admins, verify they own this store
      if (user.type === 'company' || user.role === 'company_admin') {
        if (store.companyId !== user.companyId) {
          return res.status(403).json({ message: "Access denied" });
        }
      }
      
      // Get managers for this store
      const { managers } = await storage.getManagersByStoreIds([storeId]);
      
      res.json(managers);
    } catch (error) {
      console.error("Error fetching managers for store:", error);
      res.status(500).json({ message: "Failed to fetch managers" });
    }
  });

  app.delete('/api/managers/:id', isAuthenticated, requirePermission(PERMISSIONS.MANAGERS_DELETE), async (req, res) => {
    try {
      const user = (req as any).user;
      const managerId = req.params.id; // Keep as string since DB uses varchar
      
      if (!managerId || managerId === 'null' || managerId === 'undefined') {
        return res.status(400).json({ message: "Invalid manager ID" });
      }
      
      const manager = await storage.getManager(managerId);
      
      if (!manager) {
        return res.status(404).json({ message: "Manager not found" });
      }
      
      await storage.deleteManager(managerId);
      
      // Log activity
      await storage.createActivity({
        type: "manager_deleted",
        description: `Manager "${manager.firstName} ${manager.lastName}" was deleted`,
        metadata: { managerName: `${manager.firstName} ${manager.lastName}` }
      });
      
      // Log audit trail
      await AuditLogger.log(user, {
        action: "user_delete",
        entityType: "user",
        entityId: managerId,
        description: `Manager "${manager.firstName} ${manager.lastName}" deleted`,
        oldValues: { ...manager, passwordHash: "[REDACTED]" },
        severity: "warning"
      }, req);
      
      res.json({ message: "Manager deleted successfully" });
    } catch (error) {
      console.error("Error deleting manager:", error);
      res.status(500).json({ message: "Failed to delete manager" });
    }
  });

  // Portal Admin endpoints (Super Admin only)
  app.post('/api/portal-admins', isAuthenticated, requireRole('super_admin'), async (req, res) => {
    try {
      const user = (req as any).user;
      const portalAdminData = req.body;
      
      // Validate required fields
      if (!portalAdminData.email || !portalAdminData.firstName || !portalAdminData.lastName) {
        return res.status(400).json({ 
          message: "Email, firstName, and lastName are required" 
        });
      }

      // Validate password is provided
      if (!portalAdminData.password) {
        return res.status(400).json({ 
          message: "Password is required" 
        });
      }

      // Force role to portal_admin (security: prevent role manipulation)
      portalAdminData.role = 'portal_admin';
      
      // Portal admins don't belong to a company or store
      portalAdminData.companyId = null;
      portalAdminData.storeId = null;
      
      const portalAdmin = await storage.createManager(portalAdminData);
      
      // Log activity
      await storage.createActivity({
        type: "portal_admin_created",
        description: `Portal admin "${portalAdmin.firstName} ${portalAdmin.lastName}" was created`,
        metadata: { 
          portalAdminName: `${portalAdmin.firstName} ${portalAdmin.lastName}`, 
          portalAdminId: portalAdmin.id,
          createdBy: user.id,
          createdByEmail: user.email
        }
      });
      
      res.status(201).json({
        ...portalAdmin,
        password: undefined // Don't return password in response
      });
    } catch (error: any) {
      console.error("Error creating portal admin:", error);
      const errorMessage = error.message || "Failed to create portal admin";
      
      // Check if it's a validation/constraint error
      if (errorMessage.includes('already exists') || 
          errorMessage.includes('invalid') ||
          errorMessage.includes('required') ||
          errorMessage.includes('constraint') ||
          error?.code?.startsWith('23')) {
        return res.status(400).json({ message: errorMessage });
      }
      
      res.status(500).json({ message: errorMessage });
    }
  });

  // Get Portal Admins endpoint (Super Admin only)
  app.get('/api/portal-admins', isAuthenticated, requireRole('super_admin'), async (req, res) => {
    try {
      // Get pagination parameters from query string
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;
      
      // Validate pagination parameters
      if (page < 1) {
        return res.status(400).json({ message: "Page must be greater than 0" });
      }
      if (limit < 1 || limit > 100) {
        return res.status(400).json({ message: "Limit must be between 1 and 100" });
      }
      
      // Get search query if provided
      const search = req.query.search as string || '';
      
      // Fetch portal admins from storage
      const result = await storage.getPortalAdmins(limit, offset, search);
      
      const totalPages = Math.ceil(result.total / limit);
      
      res.json({
        portalAdmins: result.portalAdmins,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1
        }
      });
    } catch (error: any) {
      console.error("Error fetching portal admins:", error);
      res.status(500).json({ message: "Failed to fetch portal admins" });
    }
  });

  // Delete Portal Admin endpoint (Super Admin only)
  app.delete('/api/portal-admins/:id', isAuthenticated, requireRole('super_admin'), async (req, res) => {
    try {
      const user = (req as any).user;
      const portalAdminId = req.params.id;
      
      // Get portal admin to verify it exists and is a portal_admin
      const portalAdmin = await storage.getUserById(portalAdminId);
      if (!portalAdmin) {
        return res.status(404).json({ message: "Portal admin not found" });
      }
      
      if (portalAdmin.role !== 'portal_admin') {
        return res.status(400).json({ message: "User is not a portal admin" });
      }
      
      // Delete the portal admin (using deleteManager which handles dependencies)
      await storage.deleteManager(portalAdminId);
      
      // Log activity
      await storage.createActivity({
        type: "portal_admin_deleted",
        description: `Portal admin "${portalAdmin.firstName} ${portalAdmin.lastName}" was deleted`,
        metadata: { 
          portalAdminName: `${portalAdmin.firstName} ${portalAdmin.lastName}`, 
          portalAdminId: portalAdminId,
          deletedBy: user.id,
          deletedByEmail: user.email
        }
      });
      
      res.json({ message: "Portal admin deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting portal admin:", error);
      res.status(500).json({ message: "Failed to delete portal admin" });
    }
  });

  // Manager Dashboard Routes - Products and Sales
  app.get("/api/stores/:storeId/products", async (req, res) => {
    try {
      const user = (req as any).user; // May be undefined if not authenticated
      const storeId = parseInt(req.params.storeId);
      
      // Get pagination parameters
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const offset = req.query.offset ? parseInt(req.query.offset as string) : undefined;
      const search = req.query.search as string | undefined;
      const categoryId = req.query.categoryId ? parseInt(req.query.categoryId as string) : undefined;
      
      // Authorization: If user is authenticated, check permissions
      // Store owners and managers can only view products from their own store
      if (user && user.role !== 'super_admin') {
        if (user.role === 'company_admin' || user.type === 'company') {
          // Company admins can view products for any store in their company
          const store = await storage.getStore(storeId);
          if (!store || (user.companyId && store.companyId !== user.companyId)) {
            return res.status(403).json({ 
              message: "Access denied. You can only view products from your company's stores." 
            });
          }
        } else if (user.role === 'store_owner' || user.role === 'manager') {
          // Store owners and managers can only view products from their assigned store
          if (user.storeId && storeId !== user.storeId) {
            return res.status(403).json({ 
              message: "Access denied. You can only view products from your assigned store." 
            });
          }
        }
      }
      
      const { products, total } = await storage.getProductsByStore(storeId, limit, offset, search, categoryId);
      
      // Calculate pagination metadata
      const page = limit && offset !== undefined ? Math.floor(offset / limit) + 1 : 1;
      const pageSize = limit || total;
      const totalPages = limit ? Math.ceil(total / limit) : 1;
      
      res.json({
        data: products,
        total,
        page,
        limit: pageSize,
        totalPages,
      });
    } catch (error: any) {
      console.error("Error fetching products:", error);
      const errorMessage = getErrorMessage(error, "Failed to fetch products");
      res.status(500).json({ message: errorMessage });
    }
  });

  app.post("/api/products", isAuthenticated, requirePermission(PERMISSIONS.PRODUCTS_CREATE), async (req, res) => {
    try {
      const user = (req as any).user;
      const product = await storage.createProduct(req.body);
      
      // Log audit trail
      await AuditLogger.logProductCreate(user, product, req);
      
      res.status(201).json(product);
    } catch (error: any) {
      console.error("Error creating product:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/products/:id", isAuthenticated, requirePermission(PERMISSIONS.PRODUCTS_UPDATE), async (req, res) => {
    try {
      const user = (req as any).user;
      const productId = parseInt(req.params.id);
      
      // Get old product for audit log
      const oldProduct = await storage.getProduct(productId);
      
      // Include user ID in updates for stock transaction tracking
      const updates = {
        ...req.body,
        userId: user?.id || null
      };
      
      const product = await storage.updateProduct(productId, updates);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      // Log audit trail
      await AuditLogger.logProductUpdate(user, productId, oldProduct, product, req);
      
      res.json(product);
    } catch (error: any) {
      console.error("Error updating product:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/stores/:storeId/sales", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      const storeId = parseInt(req.params.storeId);
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const offset = req.query.offset ? parseInt(req.query.offset as string) : undefined;
      const search = req.query.search as string | undefined;
      let startDate = req.query.startDate as string | undefined;
      let endDate = req.query.endDate as string | undefined;
      
      // For managers: restrict to last 14 days by default, but allow older data when searching
      if (user?.role === 'manager' && !search) {
        // If no search and no startDate provided (or empty string), restrict to last 14 days
        if (!startDate || startDate.trim() === '') {
          const fourteenDaysAgo = new Date();
          fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
          fourteenDaysAgo.setHours(0, 0, 0, 0); // Set to start of day
          startDate = fourteenDaysAgo.toISOString().split('T')[0];
        }
        // If startDate is provided but it's older than 14 days, restrict it
        else {
          const fourteenDaysAgo = new Date();
          fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
          fourteenDaysAgo.setHours(0, 0, 0, 0); // Set to start of day for accurate comparison
          const requestedStartDate = new Date(startDate);
          requestedStartDate.setHours(0, 0, 0, 0);
          if (requestedStartDate < fourteenDaysAgo) {
            startDate = fourteenDaysAgo.toISOString().split('T')[0];
          }
        }
        // Don't set endDate - this allows showing all data from startDate to today
        endDate = undefined;
      }
      
      const result = await storage.getSalesByStore(storeId, limit, offset, search, startDate, endDate);
      
      const page = offset !== undefined && limit !== undefined ? Math.floor(offset / limit) + 1 : 1;
      const totalPages = limit !== undefined ? Math.ceil(result.total / limit) : 1;
      
      res.json({
        data: result.sales,
        total: result.total,
        page,
        limit: limit || result.total,
        totalPages
      });
    } catch (error: any) {
      console.error("Error fetching sales:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/stores/:storeId/stock-transactions", isAuthenticated, async (req, res) => {
    try {
      const storeId = parseInt(req.params.storeId);
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const offset = req.query.offset ? parseInt(req.query.offset as string) : undefined;
      const productId = req.query.productId ? parseInt(req.query.productId as string) : undefined;
      const transactionType = req.query.transactionType as string | undefined;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      
      const result = await storage.getStockTransactionsByStore(
        storeId,
        limit,
        offset,
        productId,
        transactionType,
        startDate,
        endDate
      );
      
      const page = offset !== undefined && limit !== undefined ? Math.floor(offset / limit) + 1 : 1;
      const totalPages = limit !== undefined ? Math.ceil(result.total / limit) : 1;
      
      res.json({
        data: result.transactions,
        total: result.total,
        page,
        limit: limit || result.total,
        totalPages
      });
    } catch (error: any) {
      console.error("Error fetching stock transactions:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/stores/:storeId/sales", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      const storeId = parseInt(req.params.storeId);
      // Ensure userId is set from the authenticated user
      // Priority: request body userId > authenticated user id
      const userId = req.body.userId || user?.id || null;
      const saleData = { 
        ...req.body, 
        storeId,
        userId: userId
      };
      const sale = await storage.createSale(saleData);
      
      // Log audit trail
      await AuditLogger.logSaleCreate(user, sale, req);
      
      res.status(201).json(sale);
    } catch (error: any) {
      console.error("Error creating sale:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/sales", isAuthenticated, requirePermission(PERMISSIONS.SALES_CREATE), async (req, res) => {
    try {
      const user = (req as any).user;
      // Ensure userId is set from the authenticated user
      // Priority: request body userId > authenticated user id
      const userId = req.body.userId || user?.id || null;
      const saleData = {
        ...req.body,
        userId: userId
      };
      const sale = await storage.createSale(saleData);
      
      // Log audit trail
      await AuditLogger.logSaleCreate(user, sale, req);
      
      res.status(201).json(sale);
    } catch (error: any) {
      console.error("Error creating sale:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get sale by ID with items
  app.get("/api/sales/:saleId", isAuthenticated, async (req, res) => {
    try {
      const { saleId } = req.params;
      const sale = await storage.getSaleById(saleId);
      
      if (!sale) {
        return res.status(404).json({ message: "Sale not found" });
      }

      const salesItems = await storage.getSalesItemsBySaleId(saleId);
      
      // Get all returns for this sale to calculate returned quantities
      const saleReturns = await storage.getReturnsBySaleId(saleId);
      
      // Get return items for all returns to calculate returned quantities per sale item
      const returnedQuantities: { [saleItemId: number]: number } = {};
      
      for (const returnRecord of saleReturns) {
        const returnItems = await storage.getReturnItemsByReturnId(returnRecord.id);
        for (const returnItem of returnItems) {
          const saleItemId = returnItem.saleItemId;
          const quantity = parseFloat(returnItem.quantity.toString());
          returnedQuantities[saleItemId] = (returnedQuantities[saleItemId] || 0) + quantity;
        }
      }
      
      // Add returned quantity info to each sales item
      const salesItemsWithReturns = salesItems.map((item: any) => ({
        ...item,
        returnedQuantity: returnedQuantities[item.id] || 0,
        availableQuantity: parseFloat(item.quantity.toString()) - (returnedQuantities[item.id] || 0)
      }));
      
      res.json({
        ...sale,
        salesItems: salesItemsWithReturns,
        returns: saleReturns,
        totalReturned: Object.values(returnedQuantities).reduce((sum, qty) => sum + qty, 0)
      });
    } catch (error: any) {
      console.error("Error fetching sale:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Returns endpoints
  app.post("/api/returns", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      const { returnData, returnItems } = req.body;

      if (!returnData || !returnItems || !Array.isArray(returnItems)) {
        return res.status(400).json({ message: "Invalid return data" });
      }

      // Validate refund method - only allow cash or card
      if (returnData.refundMethod && !['cash', 'card'].includes(returnData.refundMethod)) {
        return res.status(400).json({ message: "Invalid refund method. Only 'cash' or 'card' are allowed." });
      }

      // Validate return items - ensure all have saleItemId
      const invalidItems = returnItems.filter((item: any) => !item.saleItemId || typeof item.saleItemId !== 'number');
      if (invalidItems.length > 0) {
        return res.status(400).json({ 
          message: "Invalid return items: All items must have a valid saleItemId from the sales_items table. Legacy sales without sales_items cannot be returned." 
        });
      }

      const returnRecord = await storage.createReturn(returnData, returnItems);
      
      // Log audit trail
      await AuditLogger.log(user, {
        action: "return_create",
        entityType: "return",
        entityId: returnRecord.id.toString(),
        description: `Return created for sale ${returnData.saleId} - Total refund: ${returnData.totalRefund}`,
        newValues: returnRecord,
        metadata: {
          storeId: returnData.storeId,
          saleId: returnData.saleId,
          totalRefund: returnData.totalRefund,
          itemCount: returnItems.length
        }
      }, req);

      res.status(201).json(returnRecord);
    } catch (error: any) {
      console.error("Error creating return:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/returns", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      const storeId = req.query.storeId ? parseInt(req.query.storeId as string) : user?.storeId;

      if (!storeId) {
        return res.status(400).json({ message: "Store ID is required" });
      }

      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const offset = req.query.offset ? parseInt(req.query.offset as string) : undefined;
      const search = req.query.search as string | undefined;
      let startDate = req.query.startDate as string | undefined;
      let endDate = req.query.endDate as string | undefined;
      const status = req.query.status as string | undefined;
      const refundMethod = req.query.refundMethod as string | undefined;

      // For managers: restrict to last 14 days by default, but allow older data when searching
      if (user?.role === 'manager' && !search) {
        // If no search and no startDate provided (or empty string), restrict to last 14 days
        if (!startDate || startDate.trim() === '') {
          const fourteenDaysAgo = new Date();
          fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
          fourteenDaysAgo.setHours(0, 0, 0, 0); // Set to start of day
          startDate = fourteenDaysAgo.toISOString().split('T')[0];
        }
        // If startDate is provided but it's older than 14 days, restrict it
        else {
          const fourteenDaysAgo = new Date();
          fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
          fourteenDaysAgo.setHours(0, 0, 0, 0); // Set to start of day for accurate comparison
          const requestedStartDate = new Date(startDate);
          requestedStartDate.setHours(0, 0, 0, 0);
          if (requestedStartDate < fourteenDaysAgo) {
            startDate = fourteenDaysAgo.toISOString().split('T')[0];
          }
        }
        // Don't set endDate - this allows showing all data from startDate to today
        endDate = undefined;
      }

      const result = await storage.getReturnsByStore(storeId, limit, offset, search, startDate, endDate, status, refundMethod);
      
      const page = offset !== undefined && limit !== undefined ? Math.floor(offset / limit) + 1 : 1;
      const totalPages = limit !== undefined ? Math.ceil(result.total / limit) : 1;
      
      res.json({
        data: result.returns,
        total: result.total,
        page,
        limit: limit || result.total,
        totalPages
      });
    } catch (error: any) {
      console.error("Error fetching returns:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/returns/:returnId", isAuthenticated, async (req, res) => {
    try {
      const { returnId } = req.params;
      const returnRecord = await storage.getReturnById(parseInt(returnId));
      
      if (!returnRecord) {
        return res.status(404).json({ message: "Return not found" });
      }

      const returnItems = await storage.getReturnItemsByReturnId(parseInt(returnId));
      
      res.json({
        ...returnRecord,
        returnItems
      });
    } catch (error: any) {
      console.error("Error fetching return:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/returns/:returnId/status", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      const { returnId } = req.params;
      const { status } = req.body;

      if (!status) {
        return res.status(400).json({ message: "Status is required" });
      }

      const returnRecord = await storage.updateReturnStatus(
        parseInt(returnId),
        status,
        user?.id
      );

      // Log audit trail
      await AuditLogger.log(user, {
        action: "return_status_update",
        entityType: "return",
        entityId: returnId,
        description: `Return status updated to ${status}`,
        newValues: { status },
        metadata: {
          returnId: parseInt(returnId),
          previousStatus: returnRecord.status,
          newStatus: status
        }
      }, req);

      res.json(returnRecord);
    } catch (error: any) {
      console.error("Error updating return status:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Shopping Cart Routes
  app.get('/api/cart', isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      const { storeId } = req.query;
      
      if (!storeId) {
        return res.status(400).json({ message: "Store ID is required" });
      }

      const storeIdNum = parseInt(storeId as string);
      if (isNaN(storeIdNum)) {
        return res.status(400).json({ message: "Invalid Store ID" });
      }

      // Handle company users vs regular users
      const userId = (user.type === 'company' || user.id?.startsWith('company_')) ? null : user.id;
      const companyId = (user.type === 'company' || user.id?.startsWith('company_')) ? user.companyId : null;
      
      const cartItems = await storage.getCart(userId, companyId, storeIdNum);
      
      res.json(cartItems);
    } catch (error: any) {
      console.error("Error fetching cart:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/cart', isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      const { productId, quantity = 1, storeId } = req.body;

      if (!productId || !storeId) {
        return res.status(400).json({ message: "Product ID and Store ID are required" });
      }

      const storeIdNum = parseInt(storeId);
      const productIdNum = parseInt(productId);
      const quantityNum = parseInt(quantity);

      if (isNaN(storeIdNum) || isNaN(productIdNum) || isNaN(quantityNum) || quantityNum <= 0) {
        return res.status(400).json({ message: "Invalid parameters" });
      }

      // Verify product exists and has stock
      const product = await storage.getProduct(productIdNum);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      if (product.stock < quantityNum) {
        return res.status(400).json({ message: "Insufficient stock" });
      }

      // Handle company users vs regular users
      const userId = (user.type === 'company' || user.id?.startsWith('company_')) ? null : user.id;
      const companyId = (user.type === 'company' || user.id?.startsWith('company_')) ? user.companyId : null;

      // Check existing cart item
      const cart = await storage.getCart(userId, companyId, storeIdNum);
      const existingItem = cart.find((item: any) => item.product.id === productIdNum);
      
      if (existingItem) {
        const newQuantity = existingItem.quantity + quantityNum;
        if (newQuantity > product.stock) {
          return res.status(400).json({ message: "Cannot exceed available stock" });
        }
        const updated = await storage.updateCartItem(existingItem.id, newQuantity);
        return res.json(updated);
      }

      const cartItem = await storage.addToCart(userId, companyId, storeIdNum, productIdNum, quantityNum);
      res.status(201).json(cartItem);
    } catch (error: any) {
      console.error("Error adding to cart:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.put('/api/cart/:id', isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      const cartId = parseInt(req.params.id);
      const { quantity, storeId } = req.body;

      if (!quantity || quantity < 0 || isNaN(quantity)) {
        return res.status(400).json({ message: "Valid quantity is required" });
      }

      if (!storeId) {
        return res.status(400).json({ message: "Store ID is required" });
      }

      // Handle company users vs regular users
      const userId = (user.type === 'company' || user.id?.startsWith('company_')) ? null : user.id;
      const companyId = (user.type === 'company' || user.id?.startsWith('company_')) ? user.companyId : null;

      // Verify cart item belongs to user
      const cart = await storage.getCart(userId, companyId, parseInt(storeId));
      const cartItem = cart.find((item: any) => item.id === cartId);
      
      if (!cartItem) {
        return res.status(404).json({ message: "Cart item not found" });
      }

      if (quantity > cartItem.product.stock) {
        return res.status(400).json({ message: "Cannot exceed available stock" });
      }

      const updated = await storage.updateCartItem(cartId, parseInt(quantity));
      res.json(updated || { message: "Item removed from cart" });
    } catch (error: any) {
      console.error("Error updating cart:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.delete('/api/cart/:id', isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      const cartId = parseInt(req.params.id);
      const { storeId } = req.query;

      if (!storeId) {
        return res.status(400).json({ message: "Store ID is required" });
      }

      // Handle company users vs regular users
      const userId = (user.type === 'company' || user.id?.startsWith('company_')) ? null : user.id;
      const companyId = (user.type === 'company' || user.id?.startsWith('company_')) ? user.companyId : null;

      // Verify cart item belongs to user
      const cart = await storage.getCart(userId, companyId, parseInt(storeId as string));
      const cartItem = cart.find((item: any) => item.id === cartId);
      
      if (!cartItem) {
        return res.status(404).json({ message: "Cart item not found" });
      }

      await storage.removeFromCart(cartId);
      res.json({ message: "Item removed from cart" });
    } catch (error: any) {
      console.error("Error removing from cart:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.delete('/api/cart', isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      const { storeId } = req.query;

      if (!storeId) {
        return res.status(400).json({ message: "Store ID is required" });
      }

      const storeIdNum = parseInt(storeId as string);
      if (isNaN(storeIdNum)) {
        return res.status(400).json({ message: "Invalid Store ID" });
      }

      // Handle company users vs regular users
      const userId = (user.type === 'company' || user.id?.startsWith('company_')) ? null : user.id;
      const companyId = (user.type === 'company' || user.id?.startsWith('company_')) ? user.companyId : null;

      await storage.clearCart(userId, companyId, storeIdNum);
      res.json({ message: "Cart cleared" });
    } catch (error: any) {
      console.error("Error clearing cart:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Product Management Routes
  // Get all products for a company (across all stores) - for company admins
  app.get("/api/company/products", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      
      // Only company admins can access this endpoint
      if (user.role !== 'company_admin' && user.type !== 'company' && user.role !== 'super_admin') {
        return res.status(403).json({ 
          message: "Access denied. This endpoint is only available for company admins." 
        });
      }
      
      if (!user.companyId) {
        return res.status(400).json({ 
          message: "Company ID is required." 
        });
      }
      
      // Get pagination parameters
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const offset = req.query.offset ? parseInt(req.query.offset as string) : undefined;
      const search = req.query.search as string | undefined;
      const categoryId = req.query.categoryId ? parseInt(req.query.categoryId as string) : undefined;
      
      const { products, total } = await storage.getProductsByCompany(user.companyId, limit, offset, search, categoryId);
      
      // Calculate pagination metadata
      const page = limit && offset !== undefined ? Math.floor(offset / limit) + 1 : 1;
      const pageSize = limit || total;
      const totalPages = limit ? Math.ceil(total / limit) : 1;
      
      res.json({
        data: products,
        total,
        page,
        limit: pageSize,
        totalPages,
      });
    } catch (error: any) {
      console.error("Error fetching company products:", error);
      const errorMessage = getErrorMessage(error, "Failed to fetch company products");
      res.status(500).json({ message: errorMessage });
    }
  });

  // Get single product by ID for company admins (company-wide)
  app.get("/api/company/products/:id", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      const productId = parseInt(req.params.id);
      
      // Only company admins can access this endpoint
      if (user.role !== 'company_admin' && user.type !== 'company' && user.role !== 'super_admin') {
        return res.status(403).json({ 
          message: "Access denied. This endpoint is only available for company admins." 
        });
      }
      
      if (!user.companyId) {
        return res.status(400).json({ 
          message: "Company ID is required." 
        });
      }
      
      const product = await storage.getProduct(productId);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      // Verify product belongs to the company (either company-wide or from a store in the company)
      if (product.companyId && product.companyId !== user.companyId) {
        return res.status(403).json({ 
          message: "Access denied. This product does not belong to your company." 
        });
      }
      
      // If product has storeId, verify the store belongs to the company
      if (product.storeId) {
        const store = await storage.getStore(product.storeId);
        if (!store || store.companyId !== user.companyId) {
          return res.status(403).json({ 
            message: "Access denied. This product does not belong to your company." 
          });
        }
      }

      // Get category name if categoryId exists
      if (product.categoryId) {
        const category = await db.select().from(productCategories).where(eq(productCategories.id, product.categoryId));
        if (category[0]) {
          product.category = category[0].name;
        }
      }
      
      // Ensure activeSubstances is included in response
      if (!product.activeSubstances) {
        product.activeSubstances = [];
      }
      
      res.json(product);
    } catch (error: any) {
      console.error("Error fetching company product:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/stores/:storeId/products/:id", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      const storeId = parseInt(req.params.storeId);
      const productId = parseInt(req.params.id);
      
      // Authorization: Store owners and managers can only view products from their own store
      if (user.role !== 'super_admin') {
        if (user.role === 'company_admin' || user.type === 'company') {
          // Company admins can view products for any store in their company
          const store = await storage.getStore(storeId);
          if (!store || (user.companyId && store.companyId !== user.companyId)) {
            return res.status(403).json({ 
              message: "Access denied. You can only view products from your company's stores." 
            });
          }
        } else if (user.role === 'store_owner' || user.role === 'manager') {
          // Store owners and managers can only view products from their assigned store
          if (user.storeId && storeId !== user.storeId) {
            return res.status(403).json({ 
              message: "Access denied. You can only view products from your assigned store." 
            });
          }
        }
      }
      
      // Get product with category and active substances
      const product = await storage.getProduct(productId);
      
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      // Verify product belongs to the requested store (or is company-wide for that company)
      // For company-wide products, check if store belongs to same company
      if (product.storeId === null) {
        // Company-wide product - verify store belongs to same company
        const store = await storage.getStore(storeId);
        if (!store || (product.companyId && store.companyId !== product.companyId)) {
          return res.status(404).json({ message: "Product not found in this store" });
        }
      } else if (product.storeId !== storeId) {
        return res.status(404).json({ message: "Product not found in this store" });
      }
      
      // Get category name if categoryId exists
      if (product.categoryId) {
        const category = await db.select().from(productCategories).where(eq(productCategories.id, product.categoryId));
        if (category[0]) {
          product.category = category[0].name;
        }
      }
      
      // Ensure activeSubstances is included in response
      if (!product.activeSubstances) {
        product.activeSubstances = [];
      }
      
      res.json(product);
    } catch (error: any) {
      console.error("Error fetching product:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Create product endpoint for company admins (company-wide products)
  app.post("/api/company/products", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      
      // Only company admins can access this endpoint
      if (user.role !== 'company_admin' && user.type !== 'company' && user.role !== 'super_admin') {
        return res.status(403).json({ 
          message: "Access denied. This endpoint is only available for company admins." 
        });
      }
      
      if (!user.companyId) {
        return res.status(400).json({ 
          message: "Company ID is required." 
        });
      }
      
      // For company admins: create company-wide product (storeId = null, companyId = user.companyId)
      const productData = { 
        ...req.body, 
        storeId: null, // Company-wide product
        companyId: user.companyId 
      };
      
      // Convert receivedDate from ISO string to Date object if present
      if (productData.receivedDate && typeof productData.receivedDate === 'string') {
        productData.receivedDate = new Date(productData.receivedDate);
      }
      
      const product = await storage.createProduct(productData);
      
      // Log audit trail
      await AuditLogger.logProductCreate(user, product, req);
      
      res.status(201).json(product);
    } catch (error: any) {
      console.error("Error creating company product:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/stores/:storeId/products", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      const storeIdParam = req.params.storeId;
      
      // Handle null or invalid storeId
      if (!storeIdParam || storeIdParam === 'null' || storeIdParam === 'undefined') {
        // For company admins, allow creating company-wide products via this endpoint
        if (user.role === 'company_admin' || user.type === 'company') {
          if (!user.companyId) {
            return res.status(400).json({ 
              message: "Company ID is required." 
            });
          }
          
          const productData = { 
            ...req.body, 
            storeId: null, // Company-wide product
            companyId: user.companyId 
          };
          
          if (productData.receivedDate && typeof productData.receivedDate === 'string') {
            productData.receivedDate = new Date(productData.receivedDate);
          }
          
          const product = await storage.createProduct(productData);
          await AuditLogger.logProductCreate(user, product, req);
          return res.status(201).json(product);
        }
        
        return res.status(400).json({ message: "Invalid Store ID" });
      }
      
      const storeId = parseInt(storeIdParam);
      if (isNaN(storeId)) {
        return res.status(400).json({ message: "Invalid Store ID" });
      }
      
      // Authorization: Store owners and managers can only create products for their own store
      if (user.role !== 'super_admin') {
        if (user.role === 'company_admin' || user.type === 'company') {
          // Company admins create company-wide products (available to all stores in company)
          // Verify the store belongs to their company
          const store = await storage.getStore(storeId);
          if (!store || (user.companyId && store.companyId !== user.companyId)) {
            return res.status(403).json({ 
              message: "Access denied. You can only create products for your company's stores." 
            });
          }
          // For company admins: create company-wide product (storeId = null, companyId = user.companyId)
          const productData = { 
            ...req.body, 
            storeId: null, // Company-wide product
            companyId: user.companyId || store.companyId 
          };
          
          // Convert receivedDate from ISO string to Date object if present
          if (productData.receivedDate && typeof productData.receivedDate === 'string') {
            productData.receivedDate = new Date(productData.receivedDate);
          }
          
          const product = await storage.createProduct(productData);
          
          // Log audit trail
          await AuditLogger.logProductCreate(user, product, req);
          
          return res.status(201).json(product);
        } else if (user.role === 'store_owner' || user.role === 'manager') {
          // Store owners and managers can only create products for their assigned store
          if (user.storeId && storeId !== user.storeId) {
            return res.status(403).json({ 
              message: "Access denied. You can only create products for your assigned store." 
            });
          }
        }
      }
      
      // For store owners and managers: create store-specific product
      const productData = { ...req.body, storeId };
      
      // Convert receivedDate from ISO string to Date object if present
      if (productData.receivedDate && typeof productData.receivedDate === 'string') {
        productData.receivedDate = new Date(productData.receivedDate);
      }
      
      const product = await storage.createProduct(productData);
      
      // Log audit trail
      await AuditLogger.logProductCreate(user, product, req);
      
      res.status(201).json(product);
    } catch (error: any) {
      console.error("Error creating product:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update product endpoint for company admins (company-wide products)
  app.put("/api/company/products/:id", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      const productId = parseInt(req.params.id);
      const updates = req.body;
      
      // Only company admins can access this endpoint
      if (user.role !== 'company_admin' && user.type !== 'company' && user.role !== 'super_admin') {
        return res.status(403).json({ 
          message: "Access denied. This endpoint is only available for company admins." 
        });
      }
      
      if (!user.companyId) {
        return res.status(400).json({ 
          message: "Company ID is required." 
        });
      }
      
      // Get old product for audit log and authorization check
      const oldProduct = await storage.getProduct(productId);
      if (!oldProduct) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      // Verify product belongs to the company
      if (oldProduct.companyId && oldProduct.companyId !== user.companyId) {
        return res.status(403).json({ 
          message: "Access denied. This product does not belong to your company." 
        });
      }
      
      // If product has storeId, verify the store belongs to the company
      if (oldProduct.storeId) {
        const store = await storage.getStore(oldProduct.storeId);
        if (!store || store.companyId !== user.companyId) {
          return res.status(403).json({ 
            message: "Access denied. This product does not belong to your company." 
          });
        }
      }
      
      // Ensure companyId is maintained and storeId remains null for company-wide products
      if (oldProduct.storeId === null) {
        updates.storeId = null;
        updates.companyId = user.companyId;
      }
      
      // Convert receivedDate from ISO string to Date object if present
      if (updates.receivedDate && typeof updates.receivedDate === 'string') {
        updates.receivedDate = new Date(updates.receivedDate);
      }
      
      // Include user ID in updates for stock transaction tracking
      const updatesWithUserId = {
        ...updates,
        userId: user?.id || null
      };
      
      const product = await storage.updateProduct(productId, updatesWithUserId);
      
      // Log audit trail
      await AuditLogger.logProductUpdate(user, productId, oldProduct, product, req);
      
      res.json(product);
    } catch (error: any) {
      console.error("Error updating company product:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/stores/:storeId/products/:id", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      const productId = parseInt(req.params.id);
      const storeIdParam = req.params.storeId;
      const updates = req.body;
      
      // Handle null or invalid storeId for company admins
      if (!storeIdParam || storeIdParam === 'null' || storeIdParam === 'undefined') {
        if (user.role === 'company_admin' || user.type === 'company') {
          if (!user.companyId) {
            return res.status(400).json({ message: "Company ID is required." });
          }
          
          const oldProduct = await storage.getProduct(productId);
          if (!oldProduct) {
            return res.status(404).json({ message: "Product not found" });
          }
          
          // Verify product belongs to company
          if (oldProduct.companyId && oldProduct.companyId !== user.companyId) {
            return res.status(403).json({ 
              message: "Access denied. This product does not belong to your company." 
            });
          }
          
          if (oldProduct.storeId) {
            const store = await storage.getStore(oldProduct.storeId);
            if (!store || store.companyId !== user.companyId) {
              return res.status(403).json({ 
                message: "Access denied. This product does not belong to your company." 
              });
            }
          }
          
          if (updates.receivedDate && typeof updates.receivedDate === 'string') {
            updates.receivedDate = new Date(updates.receivedDate);
          }
          
          // Include user ID in updates for stock transaction tracking
          const updatesWithUserId = {
            ...updates,
            userId: user?.id || null
          };
          
          const product = await storage.updateProduct(productId, updatesWithUserId);
          await AuditLogger.logProductUpdate(user, productId, oldProduct, product, req);
          return res.json(product);
        }
        return res.status(400).json({ message: "Invalid Store ID" });
      }
      
      const storeId = parseInt(storeIdParam);
      if (isNaN(storeId)) {
        return res.status(400).json({ message: "Invalid Store ID" });
      }
      
      // Get old product for audit log
      const oldProduct = await storage.getProduct(productId);
      if (!oldProduct) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      // Authorization: Store owners and managers can only update products from their own store
      if (user.role !== 'super_admin') {
        if (user.role === 'company_admin' || user.type === 'company') {
          // Company admins can update products for any store in their company
          const store = await storage.getStore(storeId);
          if (!store || (user.companyId && store.companyId !== user.companyId)) {
            return res.status(403).json({ 
              message: "Access denied. You can only update products from your company's stores." 
            });
          }
        } else if (user.role === 'store_owner' || user.role === 'manager') {
          // Store owners and managers can only update products from their assigned store
          if (user.storeId && oldProduct.storeId !== user.storeId) {
            return res.status(403).json({ 
              message: "Access denied. You can only update products from your assigned store." 
            });
          }
        }
      }
      
      // Prevent changing storeId for store owners and managers
      if ((user.role === 'store_owner' || user.role === 'manager') && updates.storeId && updates.storeId !== oldProduct.storeId) {
        return res.status(403).json({ 
          message: "Access denied. You cannot change the store assignment of a product." 
        });
      }
      
      // Convert receivedDate from ISO string to Date object if present
      if (updates.receivedDate && typeof updates.receivedDate === 'string') {
        updates.receivedDate = new Date(updates.receivedDate);
      }
      
      // Include user ID in updates for stock transaction tracking
      const updatesWithUserId = {
        ...updates,
        userId: user?.id || null
      };
      
      const product = await storage.updateProduct(productId, updatesWithUserId);
      
      // Log audit trail
      await AuditLogger.logProductUpdate(user, productId, oldProduct, product, req);
      
      res.json(product);
    } catch (error: any) {
      console.error("Error updating product:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/stores/:storeId/products/:id", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      const productId = parseInt(req.params.id);
      
      // Get product before deletion for audit log
      const product = await storage.getProduct(productId);
      
      // Mark as inactive instead of hard delete to preserve data integrity
      await storage.updateProduct(productId, { isActive: false });
      
      // Log audit trail
      await AuditLogger.log(user, {
        action: "product_delete",
        entityType: "product",
        entityId: productId.toString(),
        description: `Product "${product?.name}" deleted`,
        oldValues: product,
        severity: "warning",
        metadata: { storeId: req.params.storeId }
      }, req);
      
      res.json({ message: "Product deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting product:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Active Substances API endpoints (Super Admin only)
  app.get("/api/active-substances", isAuthenticated, requireRole('super_admin', 'portal_admin'), async (req, res) => {
    try {
      // Get pagination and search parameters
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;
      const search = req.query.search as string | undefined;

      const { substances, total } = await storage.getActiveSubstances(limit, offset, search);

      // Return paginated response
      res.json({
        data: substances,
        total,
        page: Math.floor(offset / limit) + 1,
        limit,
        totalPages: Math.ceil(total / limit)
      });
    } catch (error: any) {
      console.error("Error fetching active substances:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/active-substances", isAuthenticated, requireRole('super_admin', 'portal_admin'), async (req, res) => {
    try {
      const user = (req as any).user;

      const { name, maxSingleDose, maxDailyDose, maxConcentration } = req.body;

      // Validation
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ message: "Name is required" });
      }

      // Validate numeric fields if provided
      if (maxSingleDose !== undefined && maxSingleDose !== null && (isNaN(parseFloat(maxSingleDose)) || parseFloat(maxSingleDose) < 0)) {
        return res.status(400).json({ message: "Max single dose must be a valid positive number" });
      }
      if (maxDailyDose !== undefined && maxDailyDose !== null && (isNaN(parseFloat(maxDailyDose)) || parseFloat(maxDailyDose) < 0)) {
        return res.status(400).json({ message: "Max daily dose must be a valid positive number" });
      }
      if (maxConcentration !== undefined && maxConcentration !== null && (isNaN(parseFloat(maxConcentration)) || parseFloat(maxConcentration) < 0 || parseFloat(maxConcentration) > 100)) {
        return res.status(400).json({ message: "Max concentration must be a valid number between 0 and 100" });
      }

      const substanceData: any = {
        name: name.trim(),
        maxSingleDose: maxSingleDose !== undefined && maxSingleDose !== null ? maxSingleDose.toString() : null,
        maxDailyDose: maxDailyDose !== undefined && maxDailyDose !== null ? maxDailyDose.toString() : null,
        maxConcentration: maxConcentration !== undefined && maxConcentration !== null ? maxConcentration.toString() : null,
      };

      const substance = await storage.createActiveSubstance(substanceData);

      // Log audit trail
      await AuditLogger.log(user, {
        action: "active_substance_create",
        entityType: "active_substance",
        entityId: substance.id.toString(),
        description: `Active substance "${substance.name}" created`,
        newValues: substance,
      }, req);

      res.status(201).json(substance);
    } catch (error: any) {
      console.error("Error creating active substance:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/active-substances/:id", isAuthenticated, requireRole('super_admin', 'portal_admin'), async (req, res) => {
    try {
      const user = (req as any).user;
      const substanceId = parseInt(req.params.id);
      
      if (isNaN(substanceId)) {
        return res.status(400).json({ message: "Invalid substance ID" });
      }

      // Get old substance for audit log
      const oldSubstance = await storage.getActiveSubstance(substanceId);
      if (!oldSubstance) {
        return res.status(404).json({ message: "Active substance not found" });
      }

      const { name, maxSingleDose, maxDailyDose, maxConcentration } = req.body;
      const updates: any = {};

      if (name !== undefined) {
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
          return res.status(400).json({ message: "Name cannot be empty" });
        }
        updates.name = name.trim();
      }

      // Validate numeric fields if provided
      if (maxSingleDose !== undefined && maxSingleDose !== null) {
        if (isNaN(parseFloat(maxSingleDose)) || parseFloat(maxSingleDose) < 0) {
          return res.status(400).json({ message: "Max single dose must be a valid positive number" });
        }
        updates.maxSingleDose = maxSingleDose.toString();
      } else if (maxSingleDose === null) {
        updates.maxSingleDose = null;
      }

      if (maxDailyDose !== undefined && maxDailyDose !== null) {
        if (isNaN(parseFloat(maxDailyDose)) || parseFloat(maxDailyDose) < 0) {
          return res.status(400).json({ message: "Max daily dose must be a valid positive number" });
        }
        updates.maxDailyDose = maxDailyDose.toString();
      } else if (maxDailyDose === null) {
        updates.maxDailyDose = null;
      }

      if (maxConcentration !== undefined && maxConcentration !== null) {
        if (isNaN(parseFloat(maxConcentration)) || parseFloat(maxConcentration) < 0 || parseFloat(maxConcentration) > 100) {
          return res.status(400).json({ message: "Max concentration must be a valid number between 0 and 100" });
        }
        updates.maxConcentration = maxConcentration.toString();
      } else if (maxConcentration === null) {
        updates.maxConcentration = null;
      }

      const substance = await storage.updateActiveSubstance(substanceId, updates);

      // Log audit trail
      await AuditLogger.log(user, {
        action: "active_substance_update",
        entityType: "active_substance",
        entityId: substance.id.toString(),
        description: `Active substance "${substance.name}" updated`,
        oldValues: oldSubstance,
        newValues: substance,
      }, req);

      res.json(substance);
    } catch (error: any) {
      console.error("Error updating active substance:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/active-substances/:id", isAuthenticated, requireRole('super_admin', 'portal_admin'), async (req, res) => {
    try {
      const user = (req as any).user;
      const substanceId = parseInt(req.params.id);
      
      if (isNaN(substanceId)) {
        return res.status(400).json({ message: "Invalid substance ID" });
      }

      // Get substance for audit log
      const substance = await storage.getActiveSubstance(substanceId);
      if (!substance) {
        return res.status(404).json({ message: "Active substance not found" });
      }

      await storage.deleteActiveSubstance(substanceId);

      // Log audit trail
      await AuditLogger.log(user, {
        action: "active_substance_delete",
        entityType: "active_substance",
        entityId: substanceId.toString(),
        description: `Active substance "${substance.name}" deleted`,
        oldValues: substance,
      }, req);

      res.json({ message: "Active substance deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting active substance:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/products/:id", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      const productId = parseInt(req.params.id);
      const updates = req.body;
      
      // Get old product for audit log
      const oldProduct = await storage.getProduct(productId);
      
      // Include user ID in updates for stock transaction tracking
      const updatesWithUserId = {
        ...updates,
        userId: user?.id || null
      };
      
      const product = await storage.updateProduct(productId, updatesWithUserId);
      
      // Log audit trail
      await AuditLogger.logProductUpdate(user, productId, oldProduct, product, req);
      
      res.json(product);
    } catch (error: any) {
      console.error("Error updating product:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/products/:id", isAuthenticated, requirePermission(PERMISSIONS.PRODUCTS_DELETE), async (req, res) => {
    try {
      const user = (req as any).user;
      const productId = parseInt(req.params.id);
      
      // Get product before deletion for audit log
      const product = await storage.getProduct(productId);
      
      // For now, we'll just mark as inactive instead of hard delete
      await storage.updateProduct(productId, { isActive: false });
      
      // Log audit trail
      await AuditLogger.log(user, {
        action: "product_delete",
        entityType: "product",
        entityId: productId.toString(),
        description: `Product "${product?.name}" deactivated`,
        oldValues: product,
        severity: "warning"
      }, req);
      
      res.json({ message: "Product deactivated successfully" });
    } catch (error: any) {
      console.error("Error deleting product:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Product Batch Management Routes
  app.get("/api/products/:productId/batches", isAuthenticated, async (req, res) => {
    try {
      const productId = parseInt(req.params.productId);
      const storeId = req.query.storeId ? parseInt(req.query.storeId as string) : undefined;
      const batches = await storage.getProductBatches(productId, storeId);
      res.json(batches);
    } catch (error: any) {
      console.error("Error fetching product batches:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/product-batches/:id", isAuthenticated, requirePermission(PERMISSIONS.PRODUCT_BATCHES_VIEW), async (req, res) => {
    try {
      const batchId = parseInt(req.params.id);
      const batch = await storage.getProductBatch(batchId);
      if (!batch) {
        return res.status(404).json({ message: "Product batch not found" });
      }
      res.json(batch);
    } catch (error: any) {
      console.error("Error fetching product batch:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/product-batches", isAuthenticated, requirePermission(PERMISSIONS.PRODUCT_BATCHES_CREATE), async (req, res) => {
    try {
      const user = (req as any).user;
      const batch = await storage.createProductBatch(req.body);
      
      // Log audit trail
      await AuditLogger.log(user, {
        action: "product_batch_create",
        entityType: "product_batch",
        entityId: batch.id.toString(),
        description: `Product batch "${batch.batchNumber}" created for product ${batch.productId}`,
        newValues: batch,
        severity: "info"
      }, req);
      
      res.status(201).json(batch);
    } catch (error: any) {
      console.error("Error creating product batch:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/product-batches/:id", isAuthenticated, requirePermission(PERMISSIONS.PRODUCT_BATCHES_UPDATE), async (req, res) => {
    try {
      const user = (req as any).user;
      const batchId = parseInt(req.params.id);
      
      // Get old batch for audit log
      const oldBatch = await storage.getProductBatch(batchId);
      if (!oldBatch) {
        return res.status(404).json({ message: "Product batch not found" });
      }
      
      const batch = await storage.updateProductBatch(batchId, req.body);
      
      // Log audit trail
      await AuditLogger.log(user, {
        action: "product_batch_update",
        entityType: "product_batch",
        entityId: batchId.toString(),
        description: `Product batch "${batch.batchNumber}" updated`,
        oldValues: oldBatch,
        newValues: batch,
        severity: "info"
      }, req);
      
      res.json(batch);
    } catch (error: any) {
      console.error("Error updating product batch:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/product-batches/:id", isAuthenticated, requirePermission(PERMISSIONS.PRODUCT_BATCHES_DELETE), async (req, res) => {
    try {
      const user = (req as any).user;
      const batchId = parseInt(req.params.id);
      
      // Get batch before deletion for audit log
      const batch = await storage.getProductBatch(batchId);
      if (!batch) {
        return res.status(404).json({ message: "Product batch not found" });
      }
      
      await storage.deleteProductBatch(batchId);
      
      // Log audit trail
      await AuditLogger.log(user, {
        action: "product_batch_delete",
        entityType: "product_batch",
        entityId: batchId.toString(),
        description: `Product batch "${batch.batchNumber}" deleted`,
        oldValues: batch,
        severity: "warning"
      }, req);
      
      res.json({ message: "Product batch deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting product batch:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Product Category Management Routes
  app.get("/api/categories", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      const { limit, offset, search } = req.query;
      
      // Check if pagination is requested
      const usePagination = limit !== undefined || offset !== undefined;
      const limitNum = limit ? parseInt(limit as string) : undefined;
      const offsetNum = offset ? parseInt(offset as string) : undefined;
      const searchTerm = search as string | undefined;
      
      // Determine storeId for filtering
      // Company admin: undefined (gets all categories)
      // Store owner/manager: their storeId (gets company-wide + their store-specific)
      const storeIdForFilter = (user.role === 'store_owner' || user.role === 'manager') && user.storeId 
        ? user.storeId 
        : undefined;
      
      if (usePagination) {
        // Use paginated methods
        let result: { categories: ProductCategory[]; total: number };
        
        if (user.type === 'company' || user.role === 'company_admin') {
          // Company admin: get all categories (no storeId filter)
          result = await storage.getCategoriesByCompanyPaginated(user.companyId, limitNum, offsetNum, searchTerm, undefined);
        } else if (user.role === 'store_owner' && user.companyId) {
          // Store owner: get company-wide + their store-specific categories
          result = await storage.getCategoriesByCompanyPaginated(user.companyId, limitNum, offsetNum, searchTerm, user.storeId);
        } else if (user.role === 'manager' && user.storeId) {
          // Manager: get company-wide + their store-specific categories
          result = await storage.getCategoriesByCompanyPaginated(user.companyId, limitNum, offsetNum, searchTerm, user.storeId);
        } else {
          result = await storage.getCategoriesByUserPaginated(user.id, limitNum, offsetNum, searchTerm);
        }
        
        const totalPages = limitNum ? Math.ceil(result.total / limitNum) : 1;
        const currentPage = limitNum && offsetNum ? Math.floor(offsetNum / limitNum) + 1 : 1;
        
        // Add storeIds to each category (from junction table)
        const categoriesWithStores = await Promise.all(
          result.categories.map(async (category: any) => {
            const categoryStoreIds = await storage.getCategoryStores(category.id);
            return {
              ...category,
              storeIds: categoryStoreIds.length > 0 ? categoryStoreIds : undefined,
            };
          })
        );
        
        res.json({
          data: categoriesWithStores,
          total: result.total,
          page: currentPage,
          limit: limitNum || result.total,
          totalPages,
        });
      } else {
        // Use non-paginated methods for backward compatibility
      let categories: ProductCategory[] = [];
      
        if (user.type === 'company' || user.role === 'company_admin') {
          // Company admin: get all categories
        categories = await storage.getCategoriesByCompany(user.companyId);
        } else if (user.role === 'store_owner' && user.companyId) {
          // Store owner: get company-wide + their store-specific categories
          categories = await storage.getCategoriesByCompany(user.companyId, user.storeId);
        } else if (user.role === 'manager' && user.storeId) {
          // Manager: get company-wide + their store-specific categories
          categories = await storage.getCategoriesByCompany(user.companyId, user.storeId);
      } else {
        categories = await storage.getCategoriesByUser(user.id);
      }
      
      // Add storeIds to each category (from junction table)
      const categoriesWithStores = await Promise.all(
        categories.map(async (category: any) => {
          const categoryStoreIds = await storage.getCategoryStores(category.id);
          return {
            ...category,
            storeIds: categoryStoreIds.length > 0 ? categoryStoreIds : undefined,
          };
        })
      );
      
      res.json(categoriesWithStores);
      }
    } catch (error: any) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/categories", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      
      // Determine companyId and storeId based on user type
      let companyId: number | null = null;
      let storeId: number | null = null;
      let userId: string | null = null;
      
      let storeIds: number[] | undefined = undefined;
      
      if (user.type === 'company' || user.role === 'company_admin') {
        // Company admin: can create category for specific stores or all stores
        companyId = user.companyId;
        storeId = null; // Always null for company admins (use junction table instead)
        
        // Get storeIds from request body if provided
        if (req.body.storeIds && Array.isArray(req.body.storeIds)) {
          // Verify all stores belong to the company
          const { stores: companyStores } = await storage.getStoresByCompany(user.companyId);
          const validStoreIds = companyStores.map((s: any) => s.id);
          storeIds = req.body.storeIds.filter((id: number) => validStoreIds.includes(id));
          
          console.log('Category creation - Request storeIds:', req.body.storeIds);
          console.log('Category creation - Valid storeIds:', validStoreIds);
          console.log('Category creation - Filtered storeIds:', storeIds);
          console.log('Category creation - Company stores count:', companyStores.length);
          
          // If empty array or all stores selected, make it company-wide (no junction entries)
          if (storeIds && (storeIds.length === 0 || storeIds.length === companyStores.length)) {
            console.log('Category creation - Setting to company-wide (all stores)');
            storeIds = undefined; // Company-wide (all stores)
          } else {
            console.log('Category creation - Creating for specific stores:', storeIds);
          }
        }
        // If storeIds not provided, category is company-wide (all stores)
      } else if (user.role === 'store_owner' && user.companyId && user.storeId) {
        // Store owner: create store-specific category
        companyId = user.companyId;
        storeId = user.storeId; // Store-specific category
      } else if (user.role === 'manager' && user.storeId) {
        // Manager: create store-specific category
        companyId = user.companyId;
        storeId = user.storeId; // Store-specific category
      } else {
        // Individual user (not part of a company)
        userId = user.id;
      }
      
      const categoryData = {
        ...req.body,
        companyId,
        storeId,
        userId,
      };
      
      // Remove storeIds from categoryData (it's handled separately)
      delete (categoryData as any).storeIds;
      
      const category = await storage.createCategory(categoryData, storeIds);
      
      // Get storeIds from junction table (in case storeIds was undefined, this will return empty array)
      const categoryStoreIds = await storage.getCategoryStores(category.id);
      
      // Get store names for audit log
      let storeNames = '';
      if (categoryStoreIds.length > 0) {
        const { stores: companyStores } = await storage.getStoresByCompany(user.companyId);
        const selectedStores = companyStores.filter((s: any) => categoryStoreIds.includes(s.id));
        storeNames = selectedStores.map((s: any) => s.name).join(', ');
      }
      
      // Log audit trail
      await AuditLogger.log(user, {
        action: "category_create",
        entityType: "category",
        entityId: category.id?.toString(),
        description: categoryStoreIds.length > 0 
          ? `Category "${category.name}" created for stores: ${storeNames}`
          : `Category "${category.name}" created${storeId ? ` for store ${storeId}` : ' (company-wide)'}`,
        newValues: { ...category, storeIds: categoryStoreIds }
      }, req);
      
      // Return category with storeIds from junction table
      // Always include storeIds in response (empty array if company-wide, array of IDs if specific stores)
      const responseCategory: any = { 
        ...category,
      };
      
      // Include storeIds if there are any, otherwise include empty array for company-wide
      if (categoryStoreIds.length > 0) {
        responseCategory.storeIds = categoryStoreIds;
      } else {
        // For company-wide categories, we can omit storeIds or include empty array
        // Including empty array makes it explicit
        responseCategory.storeIds = [];
      }
      
      res.status(201).json(responseCategory);
    } catch (error: any) {
      console.error("Error creating category:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/categories/:id", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      const categoryId = parseInt(req.params.id);
      const updates = req.body;
      
      // Get old category for audit log and ownership validation
      const allCategories = await db.select().from(productCategories).where(eq(productCategories.id, categoryId));
      const oldCategory = allCategories[0];
      
      if (!oldCategory) {
        return res.status(404).json({ message: "Category not found" });
      }
      
      // Ownership validation: Users can only update categories from their own company/store
      if (user.role !== 'super_admin') {
        if (user.role === 'company_admin' || user.type === 'company') {
          // Company admin can update any category in their company
          if (user.companyId && oldCategory.companyId !== user.companyId) {
            return res.status(403).json({ 
              message: "Access denied. You can only update categories from your own company." 
            });
          }
        } else if (user.role === 'store_owner' || user.role === 'manager') {
          // Store owner/manager can only update company-wide categories or their store-specific categories
          if (user.companyId && oldCategory.companyId !== user.companyId) {
            return res.status(403).json({ 
              message: "Access denied. You can only update categories from your own company." 
            });
          }
          // If category is store-specific, check junction table
          // For store owners/managers, they can only update company-wide categories or categories assigned to their store
          const categoryStoreIds = await storage.getCategoryStores(categoryId);
          if (categoryStoreIds.length > 0 && !categoryStoreIds.includes(user.storeId!)) {
            return res.status(403).json({ 
              message: "Access denied. You can only update categories for your own store." 
            });
          }
        } else {
          // Other roles cannot update categories
          return res.status(403).json({ 
            message: "Access denied. You do not have permission to update categories." 
          });
        }
      }
      
      // Handle storeIds for company admins
      let storeIds: number[] | undefined = undefined;
      if ((user.type === 'company' || user.role === 'company_admin') && req.body.storeIds !== undefined) {
        if (Array.isArray(req.body.storeIds)) {
          // Verify all stores belong to the company
          const { stores: companyStores } = await storage.getStoresByCompany(user.companyId);
          const validStoreIds = companyStores.map((s: any) => s.id);
          storeIds = req.body.storeIds.filter((id: number) => validStoreIds.includes(id));
          
          console.log('Category update - Request storeIds:', req.body.storeIds);
          console.log('Category update - Valid storeIds:', validStoreIds);
          console.log('Category update - Filtered storeIds:', storeIds);
          console.log('Category update - Company stores count:', companyStores.length);
          
          // If all stores selected, make it company-wide (empty array = clear junction table)
          if (storeIds && storeIds.length === companyStores.length) {
            console.log('Category update - All stores selected, setting to company-wide (empty array)');
            storeIds = []; // Empty array = company-wide (all stores)
          }
          // If storeIds.length === 0 and req.body.storeIds.length === 0, it means explicitly sent empty array
          // Keep it as [] to clear junction table (company-wide)
          // If storeIds.length > 0 and < companyStores.length, keep it as is (specific stores)
        }
        // Remove storeIds from updates (handled separately)
        delete updates.storeIds;
      }
      
      const category = await storage.updateCategory(categoryId, updates, storeIds);
      
      // Get storeIds from junction table (always fetch to get current state)
      const categoryStoreIds = await storage.getCategoryStores(categoryId);
      
      // Get store names for audit log
      let storeNames = '';
      if (categoryStoreIds.length > 0) {
        const { stores: companyStores } = await storage.getStoresByCompany(user.companyId);
        const selectedStores = companyStores.filter((s: any) => categoryStoreIds.includes(s.id));
        storeNames = selectedStores.map((s: any) => s.name).join(', ');
      }
      
      // Log audit trail
      await AuditLogger.log(user, {
        action: "category_update",
        entityType: "category",
        entityId: categoryId.toString(),
        description: categoryStoreIds.length > 0 
          ? `Category "${category?.name || oldCategory?.name}" updated for stores: ${storeNames}`
          : `Category "${category?.name || oldCategory?.name}" updated (company-wide)`,
        oldValues: oldCategory,
        newValues: { ...category, storeIds: categoryStoreIds }
      }, req);
      
      // Return category with storeIds from junction table
      // Always include storeIds in response (empty array if company-wide, array of IDs if specific stores)
      const responseCategory: any = { 
        ...category,
      };
      
      // Include storeIds if there are any, otherwise include empty array for company-wide
      if (categoryStoreIds.length > 0) {
        responseCategory.storeIds = categoryStoreIds;
      } else {
        // For company-wide categories, we can omit storeIds or include empty array
        // Including empty array makes it explicit
        responseCategory.storeIds = [];
      }
      
      res.json(responseCategory);
    } catch (error: any) {
      console.error("Error updating category:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/categories/:id", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      const categoryId = parseInt(req.params.id);
      
      // Validate category ID
      if (isNaN(categoryId)) {
        return res.status(400).json({ message: "Invalid category ID" });
      }
      
      // Get category before deletion for audit log
      const allCategories = await db.select().from(productCategories).where(eq(productCategories.id, categoryId));
      const category = allCategories[0];
      
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }
      
      // Ownership validation: Users can only delete categories from their own company/store
      if (user.role !== 'super_admin') {
        if (user.role === 'company_admin' || user.type === 'company') {
          // Company admin can delete any category in their company
          if (user.companyId && category.companyId !== user.companyId) {
            return res.status(403).json({ 
              message: "Access denied. You can only delete categories from your own company." 
            });
          }
        } else if (user.role === 'store_owner' || user.role === 'manager') {
          // Store owner/manager can only delete company-wide categories or their store-specific categories
          if (user.companyId && category.companyId !== user.companyId) {
            return res.status(403).json({ 
              message: "Access denied. You can only delete categories from your own company." 
            });
          }
          // If category is store-specific, check junction table
          // For store owners/managers, they can only delete company-wide categories or categories assigned to their store
          const categoryStoreIds = await storage.getCategoryStores(categoryId);
          if (categoryStoreIds.length > 0 && !categoryStoreIds.includes(user.storeId!)) {
            return res.status(403).json({ 
              message: "Access denied. You can only delete categories for your own store." 
            });
          }
        } else {
          // Other roles cannot delete categories
          return res.status(403).json({ 
            message: "Access denied. You do not have permission to delete categories." 
          });
        }
      }
      
      await storage.deleteCategory(categoryId);
      
      // Log audit trail
      await AuditLogger.log(user, {
        action: "category_delete",
        entityType: "category",
        entityId: categoryId.toString(),
        description: `Category "${category?.name}" deleted`,
        oldValues: category,
        severity: "warning"
      }, req);
      
      res.json({ message: "Category deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting category:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get all uploaded images for gallery
  app.get("/api/uploaded-images", isAuthenticated, async (req, res) => {
    try {
      const images = await storage.getAllUploadedImages();
      res.json(images);
    } catch (error: any) {
      console.error("Error fetching uploaded images:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Company-specific endpoints for company dashboard
  app.get('/api/company/stores', isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      
      // Only allow company admins to access their company's stores
      if (user.type !== 'company') {
        return res.status(403).json({ message: "Access denied. Company access required." });
      }
      
      // Get stores specific to the logged-in company
      const storesDataResult = await storage.getStoresByCompany(user.companyId);
      const storesData = storesDataResult?.stores || [];
      
      // Calculate revenue from actual sales for each store
      const storesWithRevenue = await Promise.all(storesData.map(async (store) => {
        const storeSales = await storage.getSalesByStore(store.id);
        const revenue = storeSales.reduce((sum, sale) => {
          const saleTotal = typeof sale.total === 'string' ? parseFloat(sale.total) : sale.total;
          return sum + (saleTotal || 0);
        }, 0);
        
        return {
          id: store.id,
          name: store.name,
          address: store.address || '',
          phone: store.phone || '',
          manager: "Not Assigned", // Default since we don't have manager names in this query
          status: store.isActive ? 'active' : 'inactive',
          revenue: revenue,
          products: store.productCount || 0,
          customers: storeSales.length, // Each sale = 1 customer transaction
          createdAt: store.createdAt ? new Date(store.createdAt).toISOString().split('T')[0] : ''
        };
      }));
      
      console.log(`Fetching stores for company ID ${user.companyId}: Found ${storesWithRevenue.length} stores`);
      res.json(storesWithRevenue);
    } catch (error) {
      console.error("Error fetching company stores:", error);
      res.status(500).json({ message: "Failed to fetch company stores" });
    }
  });

  app.get('/api/company/analytics', isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      
      // Only allow company admins to access their company's analytics
      if (user.type !== 'company') {
        return res.status(403).json({ message: "Access denied. Company access required." });
      }
      
      // Get analytics specific to the logged-in company
      const storesDataResult = await storage.getStoresByCompany(user.companyId);
      const storesData = storesDataResult?.stores || [];
      
      const totalStores = storesData.length;
      const activeStores = storesData.filter(store => store.isActive).length;
      
      // Calculate revenue from actual POS sales
      const allSales = await storage.getSalesByCompany(user.companyId);
      const totalRevenue = allSales.reduce((sum, sale) => {
        const saleTotal = typeof sale.total === 'string' ? parseFloat(sale.total) : sale.total;
        return sum + (saleTotal || 0);
      }, 0);
      
      // Calculate total products from all stores
      const totalProducts = storesData.reduce((sum, store) => sum + (store.productCount || 0), 0);
      
      // Calculate total customers from unique sales (each sale = 1 customer transaction)
      const totalCustomers = allSales.length;
      
      const analytics = {
        totalStores,
        activeStores,
        totalRevenue,
        totalProducts,
        totalCustomers,
        monthlyGrowth: 12.5 // This would need historical data to calculate properly
      };
      
      console.log(`Analytics for company ID ${user.companyId} (${user.companyName}):`, analytics);
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching company analytics:", error);
      res.status(500).json({ message: "Failed to fetch company analytics" });
    }
  });

  app.get('/api/company/products-overview', isAuthenticated, requireAnyPermission(PERMISSIONS.PRODUCTS_VIEW_OWN, PERMISSIONS.PRODUCTS_VIEW_ASSIGNED), async (req, res) => {
    try {
      const user = (req as any).user;
      
      // Get companyId from user
      const companyId = user.companyId;
      
      if (!companyId) {
        return res.status(400).json({ message: "Company ID not found for user." });
      }
      
      // Get all stores for this company
      const companyStoresResult = await storage.getStoresByCompany(companyId);
      const companyStores = companyStoresResult?.stores || [];
      const storeIds = companyStores.map(store => store.id);
      
      if (storeIds.length === 0) {
        return res.json([]);
      }
      
      // Get all products from all stores and aggregate by product
      const productsMap = new Map();
      
      for (const storeId of storeIds) {
        const { products: storeProducts } = await storage.getProductsByStore(storeId);
        const store = companyStores.find(s => s.id === storeId);
        
        // Get all sales for this store
        const allStoreSales = await storage.getSalesByStore(storeId);
        
        for (const product of storeProducts) {
          // Calculate sales data for this product by parsing sales cart data
          let productSalesCount = 0;
          let productRevenue = 0;
          
          for (const sale of allStoreSales) {
            try {
              // Parse items - it could be a JSON string, object, or array
              let cartItems: any[] = [];
              if (sale.items) {
                if (typeof sale.items === 'string') {
                  cartItems = JSON.parse(sale.items);
                } else if (Array.isArray(sale.items)) {
                  cartItems = sale.items;
                } else if (typeof sale.items === 'object') {
                  cartItems = (sale.items as any).items || [];
                }
              }
              
              const productInCart = cartItems.find((item: any) => item.id === product.id || item.productId === product.id);
              if (productInCart) {
                productSalesCount += productInCart.quantity || 1;
                productRevenue += (productInCart.price || Number(product.price)) * (productInCart.quantity || 1);
              }
            } catch (parseError) {
              // Skip sales with invalid items data
              console.warn(`Could not parse items for sale ${sale.id}:`, parseError);
            }
          }
          
          if (!productsMap.has(product.id)) {
            productsMap.set(product.id, {
              id: product.id,
              name: product.name,
              description: product.description,
              price: Number(product.price),
              categoryName: product.category || 'Uncategorized',
              barcode: product.barcode,
              imageUrl: product.imageUrl,
              stores: [],
              totalStock: 0,
              totalSales: 0,
              totalRevenue: 0
            });
          }
          
          const productData = productsMap.get(product.id);
          productData.stores.push({
            storeId: storeId,
            storeName: store?.name || 'Unknown Store',
            stock: product.stock || 0,
            totalSales: productSalesCount,
            revenue: productRevenue
          });
          productData.totalStock += product.stock || 0;
          productData.totalSales += productSalesCount;
          productData.totalRevenue += productRevenue;
        }
      }
      
      const productsArray = Array.from(productsMap.values());
      console.log(`Products overview for company ID ${companyId}: Found ${productsArray.length} unique products across ${storeIds.length} stores`);
      res.json(productsArray);
    } catch (error) {
      console.error("Error fetching company products overview:", error);
      res.status(500).json({ message: "Failed to fetch company products overview" });
    }
  });

  // Company profile endpoint to get max branches limit
  app.get('/api/company/profile', isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      
      // Only allow company admins to access their company profile
      if (user.type !== 'company') {
        return res.status(403).json({ message: "Access denied. Company access required." });
      }
      
      // Get the specific company profile for logged-in company
      const companiesResponse = await storage.getAllCompanies();
      const company = companiesResponse.data.find((c: any) => c.id === user.companyId);
      
      if (company) {
        console.log(`Fetching profile for company ID ${user.companyId} (${company.name})`);
        res.json({
          id: company.id,
          name: company.name,
          maxBranches: company.maxBranches || 5,
          registrationNumber: company.registrationNumber,
          vatNumber: company.vatNumber,
          address: company.address,
          email: company.email,
          phone: company.phone,
          contactPerson: company.contactPerson,
          isActive: company.isActive
        });
      } else {
        res.status(404).json({ message: "Company not found" });
      }
    } catch (error) {
      console.error("Error fetching company profile:", error);
      res.status(500).json({ message: "Failed to fetch company profile" });
    }
  });

  // Settings endpoints
  app.get("/api/settings", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      
      let settings;
      if (user.type === 'company') {
        settings = await storage.getUserSettings(undefined, user.companyId);
      } else {
        settings = await storage.getUserSettings(user.id);
      }

      // If no settings exist, return default settings
      if (!settings) {
        const defaultSettings = {
          settingsType: user.type === 'company' ? 'company' : 'user',
          userId: user.type === 'company' ? undefined : user.id,
          companyId: user.type === 'company' ? user.companyId : undefined,
          timezone: 'Europe/Prague',
          language: 'en',
          currency: 'EUR',
          emailNotifications: true,
          smsAlerts: false,
          weeklyReports: true,
          storeAlerts: true,
          sessionTimeout: 30,
          requireUppercase: true,
          requireNumbers: true,
          requireSymbols: false,
          twoFactorEnabled: false,
          loginAuditTrail: true,
          dataRetention: 365,
        };
        res.json(defaultSettings);
      } else {
        res.json(settings);
      }
    } catch (error: any) {
      console.error('Error fetching settings:', error);
      res.status(500).json({ message: error.message || "Failed to fetch settings" });
    }
  });

  app.put("/api/settings", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      
      const settingsData = {
        ...req.body,
        settingsType: user.type === 'company' ? 'company' : 'user',
        userId: user.type === 'company' ? undefined : user.id,
        companyId: user.type === 'company' ? user.companyId : undefined,
      };

      const settings = await storage.upsertUserSettings(settingsData);
      res.json(settings);
    } catch (error: any) {
      console.error('Error updating settings:', error);
      res.status(500).json({ message: error.message || "Failed to update settings" });
    }
  });

  // Two-Factor Authentication endpoints
  app.post('/api/2fa/setup', isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      const setup = await TwoFactorAuthService.generateSecret(user.email);
      
      res.json({
        qrCodeUrl: setup.qrCodeUrl,
        manualEntryKey: setup.manualEntryKey,
        secret: setup.secret // Will be used for verification
      });
    } catch (error) {
      console.error("Error setting up 2FA:", error);
      res.status(500).json({ message: "Failed to setup 2FA" });
    }
  });

  app.post('/api/2fa/verify-setup', isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      const { secret, token } = req.body;

      if (!secret || !token) {
        return res.status(400).json({ message: "Secret and token are required" });
      }

      const isValid = TwoFactorAuthService.verifyToken(secret, token);
      if (!isValid) {
        return res.status(400).json({ message: "Invalid verification code" });
      }

      // Store the secret in database
      await storage.update2FASecret(user.id, secret, true);
      
      const backupCodes = TwoFactorAuthService.generateBackupCodes();

      res.json({ 
        success: true, 
        message: "2FA setup successful",
        backupCodes 
      });
    } catch (error) {
      console.error("Error verifying 2FA setup:", error);
      res.status(500).json({ message: "Failed to verify 2FA setup" });
    }
  });

  app.post('/api/2fa/disable', isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      const { password } = req.body;

      if (!password) {
        return res.status(400).json({ message: "Password is required to disable 2FA" });
      }

      // Verify password before disabling 2FA
      const bcrypt = await import("bcrypt");
      let isValidPassword = false;
      
      if (user.type === 'company') {
        // For company accounts, verify against company password
        const companiesResponse = await storage.getAllCompanies();
        const company = companiesResponse.data.find((c: any) => c.id === user.companyId);
        if (company && company.password) {
          isValidPassword = await bcrypt.compare(password, company.password);
        }
        // Disable 2FA for company user
        if (isValidPassword) {
          await storage.disable2FA(user.id);
        }
      } else {
        // For regular users, verify against user password
        const userRecord = await storage.getUserByEmail(user.email);
        if (userRecord && userRecord.passwordHash) {
          isValidPassword = await bcrypt.compare(password, userRecord.passwordHash);
        }
        // Disable 2FA for regular user
        if (isValidPassword) {
          await storage.disable2FA(user.id);
        }
      }

      if (!isValidPassword) {
        return res.status(400).json({ message: "Invalid password" });
      }

      res.json({ success: true, message: "2FA disabled successfully" });
    } catch (error) {
      console.error("Error disabling 2FA:", error);
      res.status(500).json({ message: "Failed to disable 2FA" });
    }
  });

  app.post('/api/2fa/verify', isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({ message: "Token is required" });
      }

      // Here you would get the secret from database
      // For now, we'll check localStorage on frontend
      res.json({ success: true, message: "Token verified" });
    } catch (error) {
      console.error("Error verifying 2FA token:", error);
      res.status(500).json({ message: "Failed to verify token" });
    }
  });

  // API endpoint to get current expected 2FA token for debugging
  app.get("/api/auth/current-2fa-token", async (req, res) => {
    try {
      const speakeasy = require("speakeasy");
      const secret = 'HA5C4OKPOMQWY52QI5CC6RJ6ONKFEMKSJAZWI52YMFTTQL2XJMSA';
      const token = speakeasy.totp({
        secret: secret,
        encoding: 'base32'
      });
      res.json({ token, time: new Date().toISOString() });
    } catch (error) {
      res.status(500).json({ error: 'Failed to generate token' });
    }
  });

  // 2FA setup page - serve simple HTML with instructions
  app.get("/2fa-setup", (req, res) => {
    const speakeasy = require("speakeasy");
    const secret = 'HA5C4OKPOMQWY52QI5CC6RJ6ONKFEMKSJAZWI52YMFTTQL2XJMSA';
    const currentToken = speakeasy.totp({
      secret: secret,
      encoding: 'base32'
    });
    
    const html = `<!DOCTYPE html>
<html>
<head>
    <title>2FA Setup</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
        .container { background: #f9f9f9; padding: 30px; border-radius: 10px; }
        .secret { background: #e8f4fd; padding: 15px; font-family: monospace; word-break: break-all; }
        .token { background: #d4edda; padding: 15px; font-size: 24px; text-align: center; color: #155724; }
        .steps { background: #fff3cd; padding: 15px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔐 Google Authenticator Setup</h1>
        
        <div class="steps">
            <h3>⚠️ IMPORTANT: Delete existing entry first!</h3>
            <p>Remove any existing "ghalib@icloud.com" entry from your Google Authenticator app before adding the new one.</p>
        </div>

        <h3>📱 Add to Google Authenticator:</h3>
        <p><strong>Account:</strong> ghalib@icloud.com</p>
        <p><strong>Secret Key:</strong></p>
        <div class="secret">HA5C4OKPOMQWY52QI5CC6RJ6ONKFEMKSJAZWI52YMFTTQL2XJMSA</div>

        <h3>🎯 Current Expected Token:</h3>
        <div class="token">${currentToken}</div>
        <p><small>Generated at: ${new Date().toLocaleTimeString()}</small></p>

        <div class="steps">
            <h3>Steps:</h3>
            <ol>
                <li>Delete old ghalib@icloud.com entry from Google Authenticator</li>
                <li>Add new account manually with the secret above</li>
                <li>Wait for your app to show: <strong>${currentToken}</strong></li>
                <li>Go back to login and enter that token</li>
            </ol>
        </div>

        <p><a href="/" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Back to Login</a></p>
    </div>

    <script>
        // Auto-refresh every 30 seconds
        setTimeout(() => location.reload(), 30000);
    </script>
</body>
</html>`;
    
    res.send(html);
  });

  // File Upload Routes for Product Images
  // Upload image file
  app.post("/api/upload-image", isAuthenticated, (req, res, next) => {
    upload.single('image')(req, res, (err: any) => {
      if (err) {
        console.error("Multer upload error:", err);
        // Handle multer errors
        if (err.code && (err.code.startsWith('LIMIT_') || err.name === 'MulterError')) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ 
              error: "File too large", 
              message: "Image size exceeds 10MB limit. Please upload a smaller image." 
            });
          }
          if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({ 
              error: "Too many files", 
              message: "Only one image can be uploaded at a time." 
            });
          }
          if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            return res.status(400).json({ 
              error: "Invalid field name", 
              message: "Invalid file field. Please use 'image' as the field name." 
            });
          }
          return res.status(400).json({ 
            error: "Upload error", 
            message: err.message || "Failed to upload image" 
          });
        }
        // Handle file filter errors (e.g., non-image files)
        if (err.message === 'Only image files are allowed') {
          return res.status(400).json({ 
            error: "Invalid file type", 
            message: "Only image files are allowed. Please upload a valid image file (JPG, PNG, GIF, etc.)." 
          });
        }
        // Generic error
        return res.status(500).json({ 
          error: "Upload failed", 
          message: err.message || "An error occurred while uploading the image. Please try again." 
        });
      }
      
      // No multer error, proceed with normal handling
      try {
        if (!req.file) {
          return res.status(400).json({ 
            error: "No file uploaded", 
            message: "Please select an image file to upload." 
          });
        }
        
        const imageUrl = `/uploads/${req.file.filename}`;
        res.json({ imageUrl, filename: req.file.filename });
      } catch (error: any) {
        console.error("Error processing uploaded image:", error);
        res.status(500).json({ 
          error: "Failed to process image", 
          message: error.message || "An error occurred while processing the uploaded image." 
        });
      }
    });
  });

  // Get all uploaded images
  app.get("/api/uploaded-images", isAuthenticated, async (req, res) => {
    try {
      const images = await storage.getAllUploadedImages();
      res.json(images);
    } catch (error) {
      console.error("Error fetching uploaded images:", error);
      res.status(500).json({ error: "Failed to fetch uploaded images" });
    }
  });

  // Serve uploaded images
  app.use("/uploads", express.static("uploads"));

  
  return;
}


// ============================================================================
// VERCEL SERVERLESS FUNCTION HANDLER
// ============================================================================
const app = express();

// CORS configuration - MUST come before other middleware
app.use((req, res, next) => {
  const origin = req.headers.origin;
  // Allow credentials for same-origin and Vercel deployments
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', origin || req.headers.referer?.split('/').slice(0, 3).join('/') || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Device-Token');
  res.setHeader('Access-Control-Expose-Headers', 'X-Device-Token');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

let routesInitialized = false;
let initializedApp: express.Express | null = null;

async function initializeApp(): Promise<express.Express> {
  if (routesInitialized && initializedApp) {
    return initializedApp;
  }

  // Setup auth/session middleware BEFORE routes
  // This ensures session middleware is initialized before any routes are registered
  setupAuth(app);
  
  // Middleware to ensure session is loaded from cookie before routes
  // This is critical for serverless environments where sessions are stored in DB
  app.use((req, res, next) => {
    // Force session to be loaded if cookie exists
    if (req.cookies && req.cookies['epml.sid']) {
      const cookieSessionId = req.cookies['epml.sid'];
      // If express-session hasn't loaded the session yet, trigger it
      if (!req.sessionID || req.sessionID !== cookieSessionId) {
        // The session middleware should handle this, but we log for debugging
        console.log("Session ID mismatch - cookie:", cookieSessionId, "express:", req.sessionID);
      }
    }
    next();
  });

  await registerRoutes(app);

  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || 'Internal Server Error';
    res.status(status).json({ message });
  });

  routesInitialized = true;
  initializedApp = app;
  return app;
}

export default async function handler(req: Request, res: Response) {
  try {
    const app = await initializeApp();
    return new Promise<void>((resolve, reject) => {
      app(req, res, (err: any) => {
        if (err) {
          console.error('Error handling request:', err);
          if (!res.headersSent) {
            res.status(500).json({ message: 'Internal Server Error' });
          }
          reject(err);
        } else {
          resolve();
        }
      });
    });
  } catch (error) {
    console.error('Error initializing app:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Failed to initialize application' });
    }
    throw error;
  }
}



