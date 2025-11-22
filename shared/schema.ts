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
  isActive: boolean("is_active").default(true),
  licenseStatus: varchar("license_status").default("active"), // active, inactive, suspended
  maxBranches: integer("max_branches").default(1),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: integer("created_by").references(() => users.id),
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
  userId: varchar("user_id"), // For individual users who aren't part of a company
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

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
  storeId: integer("store_id").notNull().references(() => stores.id),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const sales = pgTable("sales", {
  id: varchar("id").primaryKey(),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  netAmount: decimal("net_amount", { precision: 10, scale: 2 }),
  totalVAT: decimal("total_vat", { precision: 10, scale: 2 }),
  vatBreakdown: jsonb("vat_breakdown"),
  paymentMethod: varchar("payment_method", { length: 20 }).notNull(),
  items: jsonb("items").notNull(),
  storeId: integer("store_id").notNull().references(() => stores.id),
  userId: varchar("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

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

export const productsRelations = relations(products, ({ one }) => ({
  store: one(stores, {
    fields: [products.storeId],
    references: [stores.id],
  }),
}));

export const salesRelations = relations(sales, ({ one }) => ({
  store: one(stores, {
    fields: [sales.storeId],
    references: [stores.id],
  }),
  user: one(users, {
    fields: [sales.userId],
    references: [users.id],
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

// Schemas for validation
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true });
export const upsertUserSchema = createInsertSchema(users);
export const insertStoreSchema = createInsertSchema(stores).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, createdAt: true });
export const insertActivitySchema = createInsertSchema(activities).omit({ id: true, createdAt: true });
export const insertCompanySchema = createInsertSchema(companies).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProductCategorySchema = createInsertSchema(productCategories).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProductSchema = createInsertSchema(products).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSaleSchema = createInsertSchema(sales).omit({ id: true, createdAt: true });
export const insertUserSettingsSchema = createInsertSchema(userSettings).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTrustedDeviceSchema = createInsertSchema(trustedDevices).omit({ id: true, createdAt: true });
export const insertCompanyInvitationSchema = createInsertSchema(companyInvitations).omit({ id: true, createdAt: true, usedAt: true });

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
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;
export type InsertSale = z.infer<typeof insertSaleSchema>;
export type Sale = typeof sales.$inferSelect;
export type InsertUserSettings = z.infer<typeof insertUserSettingsSchema>;
export type UserSettings = typeof userSettings.$inferSelect;
export type InsertTrustedDevice = z.infer<typeof insertTrustedDeviceSchema>;
export type TrustedDevice = typeof trustedDevices.$inferSelect;
export type InsertCompanyInvitation = z.infer<typeof insertCompanyInvitationSchema>;
export type CompanyInvitation = typeof companyInvitations.$inferSelect;

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
