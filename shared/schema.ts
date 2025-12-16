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
import { relations } from "drizzle-orm";

// Session storage table.
// (IMPORTANT) This table is mandatory for authentication, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Trusted devices table for 2FA remember functionality
export const trustedDevices = pgTable("trusted_devices", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull(), // Can be user ID or company ID
  deviceToken: varchar("device_token", { length: 255 }).notNull().unique(),
  deviceName: varchar("device_name", { length: 100 }),
  userAgent: varchar("user_agent", { length: 500 }),
  ipAddress: varchar("ip_address", { length: 45 }),
  expiresAt: timestamp("expires_at").notNull(), // 30 days from creation
  createdAt: timestamp("created_at").defaultNow(),
});

// User storage table.
// (IMPORTANT) This table is mandatory for authentication, don't drop it.
// Companies table for multi-tenant system
export const companies = pgTable("companies", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: varchar("name").notNull(),
  registrationNumber: varchar("registration_number").notNull().unique(), // IČO
  vatNumber: varchar("vat_number"), // DIČ
  address: text("address").notNull(),
  email: varchar("email").notNull().unique(),
  phone: varchar("phone").notNull(),
  contactPerson: varchar("contact_person").notNull(),
  password: varchar("password"), // Company login password
  companyLogo: varchar("company_logo"), // Company logo URL
  isActive: boolean("is_active").default(true),
  licenseStatus: varchar("license_status").default("active"), // active, inactive, suspended
  maxBranches: integer("max_branches").default(1),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: varchar("created_by").references(() => users.id),
});

export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email", { length: 255 }).unique().notNull(),
  firstName: varchar("first_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }),
  phone: varchar("phone", { length: 20 }),
  profileImageUrl: varchar("profile_image_url", { length: 500 }),
  passwordHash: varchar("password_hash", { length: 255 }),
  role: varchar("role", { length: 20 }).notNull().default("manager"),
  isActive: boolean("is_active").notNull().default(true),
  companyId: integer("company_id").references(() => companies.id),
  storeId: integer("store_id"),
  twoFactorSecret: varchar("two_factor_secret", { length: 100 }),
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const stores = pgTable("stores", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: varchar("name").notNull(),
  address: text("address"),
  phone: varchar("phone"),
  managerId: varchar("manager_id").references(() => users.id),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  revenue: integer("revenue").default(0),
  customerCount: integer("customer_count").default(0),
  productCount: integer("product_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Enhanced audit log table for comprehensive activity tracking
export const auditLogs = pgTable("audit_logs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  action: varchar("action", { length: 100 }).notNull(), // login, logout, create_product, update_sale, etc.
  entityType: varchar("entity_type", { length: 50 }), // user, product, sale, store, etc.
  entityId: varchar("entity_id", { length: 100 }), // ID of the affected entity
  userId: varchar("user_id"), // Stores user ID or company user ID (company_X)
  userEmail: varchar("user_email", { length: 255 }),
  userRole: varchar("user_role", { length: 20 }),
  storeId: integer("store_id").references(() => stores.id),
  companyId: integer("company_id").references(() => companies.id),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: varchar("user_agent", { length: 500 }),
  description: text("description").notNull(),
  oldValues: jsonb("old_values"), // Previous state for updates
  newValues: jsonb("new_values"), // New state for updates/creates
  metadata: jsonb("metadata"), // Additional context data
  severity: varchar("severity", { length: 20 }).default("info"), // info, warning, error, critical
  createdAt: timestamp("created_at").defaultNow(),
});

// Keep existing activities table for backward compatibility
export const activities = pgTable("activities", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  type: varchar("type").notNull(),
  description: text("description").notNull(),
  userId: varchar("user_id"),
  storeId: integer("store_id").references(() => stores.id),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const productCategories = pgTable("product_categories", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  companyId: integer("company_id").references(() => companies.id),
  storeId: integer("store_id").references(() => stores.id), // null = company-wide, set = store-specific (legacy support)
  userId: varchar("user_id"), // For individual users who aren't part of a company
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Junction table for categories to stores (allows multiple stores per category)
export const categoryStores = pgTable("category_stores", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  categoryId: integer("category_id").notNull().references(() => productCategories.id, { onDelete: "cascade" }),
  storeId: integer("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_category_stores_category").on(table.categoryId),
  index("IDX_category_stores_store").on(table.storeId),
]);

export const products = pgTable("products", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  vatRate: decimal("vat_rate", { precision: 5, scale: 2 }).notNull().default("21.00"), // VAT rate as percentage (e.g., 21.00 for 21%)
  category: varchar("category", { length: 100 }), // Keep for backward compatibility
  categoryId: integer("category_id").references(() => productCategories.id),
  barcode: varchar("barcode", { length: 50 }),
  stock: integer("stock").notNull().default(0),
  imageUrl: varchar("image_url", { length: 500 }),
  storeId: integer("store_id").references(() => stores.id), // Nullable: null = company-wide, set = store-specific
  companyId: integer("company_id").references(() => companies.id), // For company-wide products (when storeId is null)
  isActive: boolean("is_active").default(true),
  // Regulatory compliance fields
  substanceName: varchar("substance_name", { length: 255 }), // Name of the substance (according to government regulation)
  form: varchar("form", { length: 50 }), // Product form (e.g. liquid, tablet, powder)
  subtype: varchar("subtype", { length: 100 }), // More specific product subtype (if applicable)
  packageSize: varchar("package_size", { length: 50 }), // Size/volume of the package (e.g. 500ml, 30 tablets)
  receivedDate: timestamp("received_date"), // Date the product was received
  batchNumber: varchar("batch_number", { length: 100 }), // Batch or lot number (legacy - use product_batches table for multiple batches)
  quantityUnit: varchar("quantity_unit", { length: 20 }), // Unit of measurement (e.g. ml, pcs, kg)
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
export const productBatches = pgTable("product_batches", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  productId: integer("product_id").notNull().references(() => products.id),
  storeId: integer("store_id").notNull().references(() => stores.id), // Integer FK for referential integrity
  batchNumber: varchar("batch_number", { length: 100 }).notNull(), // Batch codes may be alphanumeric
  receivedDate: timestamp("received_date").notNull(),
  quantity: integer("quantity").notNull().default(0),
  quantityUnit: varchar("quantity_unit", { length: 20 }).notNull(), // Unit (e.g. pcs, ml, kg)
  expirationDate: timestamp("expiration_date"), // Optional expiry date
  supplierName: varchar("supplier_name", { length: 255 }), // Each batch may have a different supplier
  status: varchar("status", { length: 50 }).default("Pending"), // Status for internal control (e.g. "Pending", "Released", "Blocked")
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_product_batches_status").on(table.status),
]);

// Active substances table - stores active substances with their maximum allowed doses and concentrations
// Managed only by Super Admin, not linked to companies
export const activeSubstances = pgTable("active_substances", {
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
export const productActiveSubstance = pgTable("product_active_substance", {
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

export const sales = pgTable("sales", {
  id: varchar("id").primaryKey(),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  netAmount: decimal("net_amount", { precision: 10, scale: 2 }),
  totalVAT: decimal("total_vat", { precision: 10, scale: 2 }),
  vatBreakdown: jsonb("vat_breakdown"),
  paymentMethod: varchar("payment_method", { length: 20 }).notNull(),
  items: jsonb("items").notNull(), // Legacy - kept for backward compatibility, use sales_items table for normalized data
  isCancelled: boolean("is_cancelled").default(false), // Mark for canceled/voided sales
  storeId: integer("store_id").notNull().references(() => stores.id),
  userId: varchar("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_sales_is_cancelled").on(table.isCancelled),
]);

// Sales items table - stores individual line items for each sale transaction
export const salesItems = pgTable("sales_items", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  saleId: varchar("sale_id").notNull().references(() => sales.id, { onDelete: "cascade" }),
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  batchId: integer("batch_id").references(() => productBatches.id, { onDelete: "set null" }), // Nullable - not all products may have batches
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
export const returns = pgTable("returns", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  saleId: varchar("sale_id").notNull().references(() => sales.id, { onDelete: "restrict" }),
  returnDate: timestamp("return_date").notNull().defaultNow(),
  reason: text("reason"),
  totalRefund: decimal("total_refund", { precision: 10, scale: 2 }).notNull(),
  refundMethod: varchar("refund_method", { length: 50 }).notNull(), // e.g. "cash", "card", "store_credit"
  status: varchar("status", { length: 50 }).default("pending"), // e.g. "pending", "approved", "completed", "rejected"
  storeId: integer("store_id").notNull().references(() => stores.id, { onDelete: "restrict" }),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  processedBy: varchar("processed_by").references(() => users.id, { onDelete: "set null" }), // User who processed the return
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
export const returnsItems = pgTable("returns_items", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  returnId: integer("return_id").notNull().references(() => returns.id, { onDelete: "cascade" }),
  saleItemId: integer("sale_item_id").notNull().references(() => salesItems.id, { onDelete: "restrict" }), // Reference to the original sale item
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: "restrict" }),
  batchId: integer("batch_id").references(() => productBatches.id, { onDelete: "set null" }),
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
export const stockTransactions = pgTable("stock_transactions", {
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

// Shopping cart table - stores cart items per user per store
export const shoppingCarts = pgTable("shopping_carts", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }), // Nullable for company users
  companyId: integer("company_id").references(() => companies.id, { onDelete: "cascade" }), // Nullable for regular users
  storeId: integer("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  quantity: integer("quantity").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("IDX_cart_user_store").on(table.userId, table.storeId),
  index("IDX_cart_company_store").on(table.companyId, table.storeId),
  index("IDX_cart_user_product").on(table.userId, table.productId),
  // Unique constraint to prevent duplicate items in cart
  index("IDX_cart_user_store_product").on(table.userId, table.storeId, table.productId),
  index("IDX_cart_company_store_product").on(table.companyId, table.storeId, table.productId),
]);

// Company invitations table
export const companyInvitations = pgTable("company_invitations", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  companyId: integer("company_id").notNull().references(() => companies.id),
  email: varchar("email", { length: 255 }).notNull(),
  invitationToken: varchar("invitation_token", { length: 255 }).notNull().unique(),
  isUsed: boolean("is_used").default(false),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  usedAt: timestamp("used_at"),
  createdBy: varchar("created_by").references(() => users.id),
});

// Password reset tokens table
export const passwordResetTokens = pgTable("password_reset_tokens", {
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

// User settings/preferences table
export const userSettings = pgTable("user_settings", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").references(() => users.id),
  companyId: integer("company_id").references(() => companies.id),
  settingsType: varchar("settings_type", { length: 20 }).notNull(), // 'user' or 'company'
  
  // Profile settings
  firstName: varchar("first_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }),
  phone: varchar("phone", { length: 20 }),
  profileImageUrl: varchar("profile_image_url", { length: 500 }),
  
  // Regional settings
  timezone: varchar("timezone", { length: 50 }).default("Europe/Prague"),
  language: varchar("language", { length: 10 }).default("en"),
  currency: varchar("currency", { length: 10 }).default("EUR"),
  
  // Notification preferences
  emailNotifications: boolean("email_notifications").default(true),
  smsAlerts: boolean("sms_alerts").default(false),
  weeklyReports: boolean("weekly_reports").default(true),
  storeAlerts: boolean("store_alerts").default(true),
  
  // Security settings
  sessionTimeout: integer("session_timeout").default(30), // minutes
  requireUppercase: boolean("require_uppercase").default(true),
  requireNumbers: boolean("require_numbers").default(true),
  requireSymbols: boolean("require_symbols").default(false),
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  twoFactorSecret: varchar("two_factor_secret", { length: 100 }),
  
  // System preferences
  loginAuditTrail: boolean("login_audit_trail").default(true),
  dataRetention: integer("data_retention").default(365), // days
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  company: one(companies, {
    fields: [users.companyId],
    references: [companies.id],
  }),
  store: one(stores, {
    fields: [users.storeId],
    references: [stores.id],
  }),
  managedStores: many(stores),
  activities: many(activities),
  createdCompanies: many(companies),
}));

export const companiesRelations = relations(companies, ({ one, many }) => ({
  creator: one(users, {
    fields: [companies.createdBy],
    references: [users.id],
  }),
  users: many(users),
  stores: many(stores),
}));

export const storesRelations = relations(stores, ({ one, many }) => ({
  manager: one(users, {
    fields: [stores.managerId],
    references: [users.id],
  }),
  company: one(companies, {
    fields: [stores.companyId],
    references: [companies.id],
  }),
  users: many(users),
  activities: many(activities),
  products: many(products),
  sales: many(sales),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  store: one(stores, {
    fields: [products.storeId],
    references: [stores.id],
  }),
  batches: many(productBatches),
  activeSubstances: many(productActiveSubstance),
}));

export const categoryStoresRelations = relations(categoryStores, ({ one }) => ({
  category: one(productCategories, {
    fields: [categoryStores.categoryId],
    references: [productCategories.id],
  }),
  store: one(stores, {
    fields: [categoryStores.storeId],
    references: [stores.id],
  }),
}));

export const productBatchesRelations = relations(productBatches, ({ one }) => ({
  product: one(products, {
    fields: [productBatches.productId],
    references: [products.id],
  }),
  store: one(stores, {
    fields: [productBatches.storeId],
    references: [stores.id],
  }),
}));

export const salesRelations = relations(sales, ({ one, many }) => ({
  store: one(stores, {
    fields: [sales.storeId],
    references: [stores.id],
  }),
  user: one(users, {
    fields: [sales.userId],
    references: [users.id],
  }),
  items: many(salesItems),
}));

export const salesItemsRelations = relations(salesItems, ({ one, many }) => ({
  sale: one(sales, {
    fields: [salesItems.saleId],
    references: [sales.id],
  }),
  product: one(products, {
    fields: [salesItems.productId],
    references: [products.id],
  }),
  batch: one(productBatches, {
    fields: [salesItems.batchId],
    references: [productBatches.id],
  }),
  returnItems: many(returnsItems),
}));

export const returnsRelations = relations(returns, ({ one, many }) => ({
  sale: one(sales, {
    fields: [returns.saleId],
    references: [sales.id],
  }),
  store: one(stores, {
    fields: [returns.storeId],
    references: [stores.id],
  }),
  user: one(users, {
    fields: [returns.userId],
    references: [users.id],
  }),
  processedByUser: one(users, {
    fields: [returns.processedBy],
    references: [users.id],
  }),
  items: many(returnsItems),
}));

export const returnsItemsRelations = relations(returnsItems, ({ one }) => ({
  return: one(returns, {
    fields: [returnsItems.returnId],
    references: [returns.id],
  }),
  saleItem: one(salesItems, {
    fields: [returnsItems.saleItemId],
    references: [salesItems.id],
  }),
  product: one(products, {
    fields: [returnsItems.productId],
    references: [products.id],
  }),
  batch: one(productBatches, {
    fields: [returnsItems.batchId],
    references: [productBatches.id],
  }),
}));

export const stockTransactionsRelations = relations(stockTransactions, ({ one }) => ({
  product: one(products, {
    fields: [stockTransactions.productId],
    references: [products.id],
  }),
  store: one(stores, {
    fields: [stockTransactions.storeId],
    references: [stores.id],
  }),
  batch: one(productBatches, {
    fields: [stockTransactions.batchId],
    references: [productBatches.id],
  }),
  sale: one(sales, {
    fields: [stockTransactions.saleId],
    references: [sales.id],
  }),
  saleItem: one(salesItems, {
    fields: [stockTransactions.saleItemId],
    references: [salesItems.id],
  }),
  return: one(returns, {
    fields: [stockTransactions.returnId],
    references: [returns.id],
  }),
  returnItem: one(returnsItems, {
    fields: [stockTransactions.returnItemId],
    references: [returnsItems.id],
  }),
  user: one(users, {
    fields: [stockTransactions.userId],
    references: [users.id],
  }),
}));

export const shoppingCartsRelations = relations(shoppingCarts, ({ one }) => ({
  user: one(users, {
    fields: [shoppingCarts.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [shoppingCarts.storeId],
    references: [stores.id],
  }),
  product: one(products, {
    fields: [shoppingCarts.productId],
    references: [products.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  // Note: userId can be either a user ID or company user ID (company_X), so no direct relation
  store: one(stores, {
    fields: [auditLogs.storeId],
    references: [stores.id],
  }),
  company: one(companies, {
    fields: [auditLogs.companyId],
    references: [companies.id],
  }),
}));

export const activitiesRelations = relations(activities, ({ one }) => ({
  user: one(users, {
    fields: [activities.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [activities.storeId],
    references: [stores.id],
  }),
}));

export const userSettingsRelations = relations(userSettings, ({ one }) => ({
  user: one(users, {
    fields: [userSettings.userId],
    references: [users.id],
  }),
  company: one(companies, {
    fields: [userSettings.companyId],
    references: [companies.id],
  }),
}));

export const activeSubstancesRelations = relations(activeSubstances, ({ many }) => ({
  products: many(productActiveSubstance),
}));

export const productActiveSubstanceRelations = relations(productActiveSubstance, ({ one }) => ({
  product: one(products, {
    fields: [productActiveSubstance.productId],
    references: [products.id],
  }),
  substance: one(activeSubstances, {
    fields: [productActiveSubstance.substanceId],
    references: [activeSubstances.id],
  }),
}));

// Schemas for validation
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true });
export const upsertUserSchema = createInsertSchema(users);
export const insertStoreSchema = createInsertSchema(stores).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, createdAt: true });
export const insertActivitySchema = createInsertSchema(activities).omit({ id: true, createdAt: true });
export const insertCompanySchema = createInsertSchema(companies).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProductCategorySchema = createInsertSchema(productCategories).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCategoryStoreSchema = createInsertSchema(categoryStores).omit({ id: true, createdAt: true });
export const insertProductSchema = createInsertSchema(products).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProductBatchSchema = createInsertSchema(productBatches).omit({ id: true, createdAt: true, updatedAt: true });
export const insertActiveSubstanceSchema = createInsertSchema(activeSubstances).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProductActiveSubstanceSchema = createInsertSchema(productActiveSubstance).omit({ id: true, createdAt: true });
export const insertSaleSchema = createInsertSchema(sales).omit({ id: true, createdAt: true });
export const insertSalesItemSchema = createInsertSchema(salesItems).omit({ id: true, createdAt: true });
export const insertReturnSchema = createInsertSchema(returns).omit({ id: true, createdAt: true, updatedAt: true });
export const insertReturnItemSchema = createInsertSchema(returnsItems).omit({ id: true, createdAt: true });
export const insertStockTransactionSchema = createInsertSchema(stockTransactions).omit({ id: true, createdAt: true });
export const insertShoppingCartSchema = createInsertSchema(shoppingCarts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertUserSettingsSchema = createInsertSchema(userSettings).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTrustedDeviceSchema = createInsertSchema(trustedDevices).omit({ id: true, createdAt: true });
export const insertCompanyInvitationSchema = createInsertSchema(companyInvitations).omit({ id: true, createdAt: true, usedAt: true });
export const insertPasswordResetTokenSchema = createInsertSchema(passwordResetTokens).omit({ id: true, createdAt: true, usedAt: true });

export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpsertUser = z.infer<typeof upsertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertStore = z.infer<typeof insertStoreSchema>;
export type Store = typeof stores.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activities.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companies.$inferSelect;
export type InsertProductCategory = z.infer<typeof insertProductCategorySchema>;
export type ProductCategory = typeof productCategories.$inferSelect;
export type InsertCategoryStore = z.infer<typeof insertCategoryStoreSchema>;
export type CategoryStore = typeof categoryStores.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;
export type InsertProductBatch = z.infer<typeof insertProductBatchSchema>;
export type ProductBatch = typeof productBatches.$inferSelect;
export type InsertActiveSubstance = z.infer<typeof insertActiveSubstanceSchema>;
export type ActiveSubstance = typeof activeSubstances.$inferSelect;
export type InsertProductActiveSubstance = z.infer<typeof insertProductActiveSubstanceSchema>;
export type ProductActiveSubstance = typeof productActiveSubstance.$inferSelect;
export type InsertSale = z.infer<typeof insertSaleSchema>;
export type Sale = typeof sales.$inferSelect;
export type InsertSalesItem = z.infer<typeof insertSalesItemSchema>;
export type SalesItem = typeof salesItems.$inferSelect;
export type InsertReturn = z.infer<typeof insertReturnSchema>;
export type Return = typeof returns.$inferSelect;
export type InsertReturnItem = z.infer<typeof insertReturnItemSchema>;
export type ReturnItem = typeof returnsItems.$inferSelect;
export type InsertStockTransaction = z.infer<typeof insertStockTransactionSchema>;
export type StockTransaction = typeof stockTransactions.$inferSelect;
export type InsertShoppingCart = z.infer<typeof insertShoppingCartSchema>;
export type ShoppingCart = typeof shoppingCarts.$inferSelect;
export type InsertUserSettings = z.infer<typeof insertUserSettingsSchema>;
export type UserSettings = typeof userSettings.$inferSelect;
export type InsertTrustedDevice = z.infer<typeof insertTrustedDeviceSchema>;
export type TrustedDevice = typeof trustedDevices.$inferSelect;
export type InsertCompanyInvitation = z.infer<typeof insertCompanyInvitationSchema>;
export type CompanyInvitation = typeof companyInvitations.$inferSelect;
export type InsertPasswordResetToken = z.infer<typeof insertPasswordResetTokenSchema>;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;

// User with store relation
export type UserWithStore = User & {
  store?: Store | null;
};

export type CompanyWithDetails = Company & {
  branchCount?: number;
  userCount?: number;
};

// Role constants for validation and type safety
export const USER_ROLES = {
  SUPER_ADMIN: 'super_admin',
  COMPANY_ADMIN: 'company_admin',
  STORE_OWNER: 'store_owner',
  MANAGER: 'manager'
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];
