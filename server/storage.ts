import {
  users,
  stores,
  activities,
  auditLogs,
  companies,
  products,
  productCategories,
  categoryStores,
  productBatches,
  sales,
  salesItems,
  returns,
  returnsItems,
  shoppingCarts,
  userSettings,
  trustedDevices,
  companyInvitations,
  passwordResetTokens,
  type User,
  type InsertUser,
  type UpsertUser,
  type Store,
  type InsertStore,
  type Activity,
  type InsertActivity,
  type AuditLog,
  type InsertAuditLog,
  type Product,
  type InsertProduct,
  type ProductCategory,
  type InsertProductCategory,
  type CategoryStore,
  type InsertCategoryStore,
  type ProductBatch,
  type InsertProductBatch,
  type Sale,
  type InsertSale,
  type SalesItem,
  type InsertSalesItem,
  type Return,
  type InsertReturn,
  type ReturnItem,
  type InsertReturnItem,
  type ShoppingCart,
  type InsertShoppingCart,
  type UserSettings,
  type InsertUserSettings,
  type TrustedDevice,
  type InsertTrustedDevice,
  type CompanyInvitation,
  type InsertCompanyInvitation,
  type PasswordResetToken,
  type InsertPasswordResetToken,
  type UserWithStore,
  activeSubstances,
  productActiveSubstance,
  type ActiveSubstance,
  type InsertActiveSubstance,
  type ProductActiveSubstance,
  type InsertProductActiveSubstance,
  stockTransactions,
  type StockTransaction,
  type InsertStockTransaction,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, count, and, or, isNotNull, isNull, sql, inArray, ilike, like } from "drizzle-orm";
import bcrypt from "bcrypt";

// Interface for storage operations
export interface IStorage {
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
  
  // Password reset token operations
  createPasswordResetToken(tokenData: InsertPasswordResetToken): Promise<PasswordResetToken>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  markPasswordResetTokenAsUsed(token: string): Promise<void>;
  deleteExpiredPasswordResetTokens(): Promise<void>;
  deleteOldAuditLogs(dataRetentionDays?: number): Promise<number>;
  
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

  // Analytics
  getAnalytics(): Promise<{
    totalUsers: number;
    activeStores: number;
    totalStores: number;
    superAdmins: number;
    portalAdmins: number;
    companyAdmins: number;
    storeOwners: number;
    managers: number;
  }>;

  // Product operations
  getProductsByStore(storeId: number, limit?: number, offset?: number, search?: string, categoryId?: number): Promise<{ products: Product[]; total: number }>;
  getProductsByCompany(companyId: number, limit?: number, offset?: number, search?: string, categoryId?: number): Promise<{ products: Product[]; total: number }>;
  getProduct(id: number): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, updates: Partial<Product>): Promise<Product>;
  
  // Product batch operations
  getProductBatches(productId: number, storeId?: number): Promise<ProductBatch[]>;
  getProductBatch(id: number): Promise<ProductBatch | undefined>;
  createProductBatch(batchData: InsertProductBatch): Promise<ProductBatch>;
  updateProductBatch(id: number, updates: Partial<ProductBatch>): Promise<ProductBatch>;
  deleteProductBatch(id: number): Promise<void>;
  
  // Product category operations
  getCategoriesByCompany(companyId: number): Promise<ProductCategory[]>;
  getCategoriesByCompanyPaginated(companyId: number, limit?: number, offset?: number, search?: string): Promise<{ categories: ProductCategory[]; total: number }>;
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
  getSalesItemsBySaleId(saleId: string): Promise<SalesItem[]>;
  
  // Return operations
  createReturn(returnData: InsertReturn, returnItems: InsertReturnItem[]): Promise<Return>;
  getReturnsByStore(storeId: number, limit?: number, offset?: number, search?: string, startDate?: string, endDate?: string, status?: string, refundMethod?: string): Promise<{ returns: Return[]; total: number }>;
  getReturnsBySaleId(saleId: string): Promise<Return[]>;
  getReturnById(returnId: number): Promise<Return | undefined>;
  getReturnItemsByReturnId(returnId: number): Promise<ReturnItem[]>;
  updateReturnStatus(returnId: number, status: string, processedBy?: string): Promise<Return>;
  
  // Stock transaction operations
  getStockTransactionsByStore(storeId: number, limit?: number, offset?: number, productId?: number, transactionType?: string, startDate?: string, endDate?: string): Promise<{ transactions: any[]; total: number }>;
  
  // Cart operations
  getCart(userId: string | null, companyId: number | null, storeId: number): Promise<any[]>;
  addToCart(userId: string | null, companyId: number | null, storeId: number, productId: number, quantity: number): Promise<any>;
  updateCartItem(cartId: number, quantity: number): Promise<any>;
  removeFromCart(cartId: number): Promise<void>;
  clearCart(userId: string | null, companyId: number | null, storeId: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
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
    } catch (error) {
      console.error("Error fetching user by email:", error);
      return undefined;
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
    
    // Generate ID if not provided
    if (!userData.id) {
      const { nanoid } = await import("nanoid");
      userData.id = nanoid();
    }
    
    try {
      const [user] = await db
        .insert(users)
        .values(userData as any) // Type assertion needed because InsertUser omits id
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
      .values(device)
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
      .where(and(
        trustedDevices.expiresAt < new Date()
      ));
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

  async getUserWithStore(id: string): Promise<UserWithStore | undefined> {
    const [result] = await db
      .select()
      .from(users)
      .leftJoin(stores, eq(users.storeId, stores.id))
      .where(eq(users.id, id));
    
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
    try {
      // Build conditions for filtering portal admins
      const conditions = [eq(users.role, 'portal_admin')];
      
      // Add search condition if provided
      if (search) {
        conditions.push(
          or(
            ilike(users.email, `%${search}%`),
            ilike(users.firstName, `%${search}%`),
            ilike(users.lastName, `%${search}%`)
          )!
        );
      }
      
      const whereClause = and(...conditions);
      
      // Get total count
      const [totalResult] = await db
        .select({ count: count() })
        .from(users)
        .where(whereClause);
      const total = Number(totalResult.count);
      
      // Build query with pagination
      let query = db
        .select()
        .from(users)
        .leftJoin(stores, eq(users.storeId, stores.id))
        .where(whereClause)
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
    } catch (error) {
      console.error("Error fetching portal admins:", error);
      return { portalAdmins: [], total: 0 };
    }
  }

  async updateUserRole(id: string, role: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, id))
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
          ilike(stores.address || sql`''`, `%${search}%`),
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
    
    // Build query with pagination and join with companies to get logo
    let query = db
      .select({
        id: stores.id,
        name: stores.name,
        address: stores.address,
        phone: stores.phone,
        managerId: stores.managerId,
        companyId: stores.companyId,
        isActive: stores.isActive,
        revenue: stores.revenue,
        customerCount: stores.customerCount,
        productCount: stores.productCount,
        createdAt: stores.createdAt,
        updatedAt: stores.updatedAt,
        companyLogo: companies.companyLogo,
      })
      .from(stores)
      .leftJoin(companies, eq(stores.companyId, companies.id))
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
    const [newStore] = await db.insert(stores).values(store).returning();
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
          ilike(stores.address || sql`''`, `%${search}%`),
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
    
    // Build query with pagination and join with companies to get logo
    let query = db
      .select({
        id: stores.id,
        name: stores.name,
        address: stores.address,
        phone: stores.phone,
        managerId: stores.managerId,
        companyId: stores.companyId,
        isActive: stores.isActive,
        revenue: stores.revenue,
        customerCount: stores.customerCount,
        productCount: stores.productCount,
        createdAt: stores.createdAt,
        updatedAt: stores.updatedAt,
        companyLogo: companies.companyLogo,
      })
      .from(stores)
      .leftJoin(companies, eq(stores.companyId, companies.id))
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

      // 6. Clear manager_id reference from this store (if any store has this store's manager_id)
      // This must be done BEFORE deleting users to avoid foreign key constraint violations
      await db.update(stores).set({ managerId: null }).where(eq(stores.id, id));

      // 7. Get all store_owner users associated with this store
      const storeOwnerUsers = await db
        .select()
        .from(users)
        .where(and(eq(users.storeId, id), eq(users.role, "store_owner")));

      // 8. Before deleting store_owner users, clear any manager_id references to them from other stores
      for (const storeOwner of storeOwnerUsers) {
        // Clear manager_id references from all stores that reference this user
        await db.update(stores).set({ managerId: null }).where(eq(stores.managerId, storeOwner.id));
      }

      // 9. Delete store_owner users (cascade delete all their related data)
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

        // Delete the store_owner user
        await db.delete(users).where(eq(users.id, storeOwner.id));
      }

      // 10. Unlink remaining users (managers) from this store (set storeId to null, don't delete them)
      // Note: store_owners are already deleted above, so this will only affect managers
      await db.update(users).set({ storeId: null }).where(eq(users.storeId, id));

      // 11. Finally, delete the store
      await db.delete(stores).where(eq(stores.id, id));
    } catch (error: any) {
      console.error("Database error in deleteStore:", error);
      if (error.code === '23503') { // Foreign key constraint violation
        throw new Error(`Cannot delete store: It has related records that must be deleted first. ${error.message}`);
      }
      throw new Error(`Failed to delete store: ${error.message || 'Unknown error'}`);
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
    // We need to do this after fetching because store is a join
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
      // Check if email already exists
      if (managerData.email) {
        const existingUser = await this.getUserByEmail(managerData.email);
        if (existingUser) {
          throw new Error(`A user with the email "${managerData.email}" already exists. Please use a different email address.`);
        }
      }

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
    } catch (error: any) {
      console.error('Error in createManager:', error);
      // Re-throw with better error message if it's a database constraint error
      if (error.code === '23505' && error.constraint === 'users_email_unique') {
        throw new Error(`A user with the email "${managerData.email}" already exists. Please use a different email address.`);
      }
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
    try {
      // Delete in order of dependencies (most dependent first)
      // 1. Delete sales (via userId)
      await db.delete(sales).where(eq(sales.userId, id));

      // 2. Delete audit logs (via userId)
      await db.delete(auditLogs).where(eq(auditLogs.userId, id));

      // 3. Delete activities (via userId)
      await db.delete(activities).where(eq(activities.userId, id));

      // 4. Delete user settings
      await db.delete(userSettings).where(eq(userSettings.userId, id));

      // 5. Delete trusted devices
      await db.delete(trustedDevices).where(eq(trustedDevices.userId, id));

      // 6. Delete password reset tokens associated with this user (by email)
      // Note: password reset tokens are linked by email + userType, not userId
      const userForTokens = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, id))
        .limit(1);

      if (userForTokens.length > 0) {
        await db
          .delete(passwordResetTokens)
          .where(eq(passwordResetTokens.email, userForTokens[0].email));
      }

      // 7. Delete company invitations created by this user
      await db.delete(companyInvitations).where(eq(companyInvitations.createdBy, id));

      // 8. Unlink stores from this manager (set managerId to null)
      await db.update(stores).set({ managerId: null }).where(eq(stores.managerId, id));

      // 9. Finally, delete the user/manager
      await db.delete(users).where(eq(users.id, id));
    } catch (error: any) {
      console.error("Database error in deleteManager:", error);
      if (error.code === '23503') { // Foreign key constraint violation
        throw new Error(`Cannot delete manager: It has related records that must be deleted first. ${error.message}`);
      }
      throw new Error(`Failed to delete manager: ${error.message || 'Unknown error'}`);
    }
  }

  // Activity operations
  async createActivity(activity: InsertActivity): Promise<Activity> {
    const [newActivity] = await db.insert(activities).values(activity).returning();
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
      const portalAdminsResult = await db.select({ count: count() }).from(users).where(eq(users.role, "portal_admin"));
      const companyAdminsResult = await db.select({ count: count() }).from(users).where(eq(users.role, "company_admin"));
      const storeOwnersResult = await db.select({ count: count() }).from(users).where(eq(users.role, "store_owner"));
      const managersResult = await db.select({ count: count() }).from(users).where(eq(users.role, "manager"));

      return {
        totalUsers: totalUsersResult[0]?.count || 0,
        activeStores: activeStoresResult[0]?.count || 0,
        totalStores: totalStoresResult[0]?.count || 0,
        superAdmins: superAdminsResult[0]?.count || 0,
        portalAdmins: portalAdminsResult[0]?.count || 0,
        companyAdmins: companyAdminsResult[0]?.count || 0,
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
        portalAdmins: 0,
        companyAdmins: 0,
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
        // Preserve licenseStatus from database, only set default if not already set
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
      let passwordHash = null;
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
        // Preserve licenseStatus from database, only set default if not already set
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
        // Preserve licenseStatus from database, only set default if not already set
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
        // Preserve licenseStatus from database, only set default if not already set
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

      // 3.5. Delete audit logs for stores (via storeId)
      if (storeIds.length > 0) {
        await db.delete(auditLogs).where(inArray(auditLogs.storeId, storeIds));
      }

      // 3.6. Delete activities (via stores)
      if (storeIds.length > 0) {
        await db.delete(activities).where(inArray(activities.storeId, storeIds));
      }

      // 3.7. Unlink users from stores (set storeId to null for users linked to these stores)
      if (storeIds.length > 0) {
        await db.update(users).set({ storeId: null }).where(inArray(users.storeId, storeIds));
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
      // Provide more detailed error message
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

        // 2. Suspend the company
        const [updatedCompany] = await tx
          .update(companies)
          .set({
            isActive: false,
            licenseStatus: "suspended",
            updatedAt: new Date(),
          })
          .where(eq(companies.id, companyId))
          .returning();

        // 3. Get all stores for this company
        const companyStores = await tx
          .select()
          .from(stores)
          .where(eq(stores.companyId, companyId));

        const storeIds = companyStores.map(store => store.id);
        let suspendedStoresCount = 0;

        // 4. Suspend all stores
        if (storeIds.length > 0) {
          const suspendedStores = await tx
            .update(stores)
            .set({
              isActive: false,
              updatedAt: new Date(),
            })
            .where(inArray(stores.id, storeIds))
            .returning();
          suspendedStoresCount = suspendedStores.length;
        }

        // 5. Get all users associated with the company
        // - Company admins (users with companyId and role = 'company_admin')
        // - Store owners (users with role = 'store_owner' and storeId in company's stores)
        // - Store managers (users with role = 'manager' and storeId in company's stores)
        const companyUsers = await tx
          .select()
          .from(users)
          .where(
            or(
              // Company admins
              and(
                eq(users.companyId, companyId),
                eq(users.role, "company_admin")
              ),
              // Store owners and managers linked to company's stores
              storeIds.length > 0
                ? and(
                    inArray(users.storeId, storeIds),
                    or(
                      eq(users.role, "store_owner"),
                      eq(users.role, "manager")
                    )
                  )
                : sql`false`
            )
          );

        let suspendedUsersCount = 0;

        // 6. Suspend all associated users
        if (companyUsers.length > 0) {
          const userIds = companyUsers.map(user => user.id);
          const suspendedUsers = await tx
            .update(users)
            .set({
              isActive: false,
              updatedAt: new Date(),
            })
            .where(inArray(users.id, userIds))
            .returning();
          suspendedUsersCount = suspendedUsers.length;
        }

        return {
          company: {
            ...updatedCompany,
            branchCount: 0,
            userCount: 0,
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
        const [updatedCompany] = await tx
          .update(companies)
          .set({
            isActive: true,
            licenseStatus: "active",
            updatedAt: new Date(),
          })
          .where(eq(companies.id, companyId))
          .returning();

        // 3. Get all stores for this company
        const companyStores = await tx
          .select()
          .from(stores)
          .where(eq(stores.companyId, companyId));

        const storeIds = companyStores.map(store => store.id);
        let reactivatedStoresCount = 0;

        // 4. Reactivate all stores
        if (storeIds.length > 0) {
          const reactivatedStores = await tx
            .update(stores)
            .set({
              isActive: true,
              updatedAt: new Date(),
            })
            .where(inArray(stores.id, storeIds))
            .returning();
          reactivatedStoresCount = reactivatedStores.length;
        }

        // 5. Get all users associated with the company
        // - Company admins (users with companyId and role = 'company_admin')
        // - Store owners (users with role = 'store_owner' and storeId in company's stores)
        // - Store managers (users with role = 'manager' and storeId in company's stores)
        const companyUsers = await tx
          .select()
          .from(users)
          .where(
            or(
              // Company admins
              and(
                eq(users.companyId, companyId),
                eq(users.role, "company_admin")
              ),
              // Store owners and managers linked to company's stores
              storeIds.length > 0
                ? and(
                    inArray(users.storeId, storeIds),
                    or(
                      eq(users.role, "store_owner"),
                      eq(users.role, "manager")
                    )
                  )
                : sql`false`
            )
          );

        let reactivatedUsersCount = 0;

        // 6. Reactivate all associated users
        if (companyUsers.length > 0) {
          const userIds = companyUsers.map(user => user.id);
          const reactivatedUsers = await tx
            .update(users)
            .set({
              isActive: true,
              updatedAt: new Date(),
            })
            .where(inArray(users.id, userIds))
            .returning();
          reactivatedUsersCount = reactivatedUsers.length;
        }

        return {
          company: {
            ...updatedCompany,
            branchCount: 0,
            userCount: 0,
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
        .values(invitation)
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
        .values(tokenData)
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
      
      // Delete audit logs older than the retention period
      await db
        .delete(auditLogs)
        .where(sql`created_at < ${cutoffDate.toISOString()}`);
      
      console.log(`Cleaned up audit logs older than ${retentionDays} days (cutoff: ${cutoffDate.toISOString()})`);
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
      // Get store to find companyId for company-wide products
      const store = await this.getStore(storeId);
      if (!store) {
        return { products: [], total: 0 };
      }
      
      // Build where conditions: include store-specific products OR company-wide products
      const productConditions: any[] = [
        eq(products.isActive, true),
        or(
          eq(products.storeId, storeId), // Store-specific products
          and(
            isNull(products.storeId), // Company-wide products (storeId is null)
            store.companyId ? eq(products.companyId, store.companyId) : sql`false` // Match company
          )!
        )!
      ];
      
      // Add search filter
      if (search) {
        productConditions.push(
          or(
            ilike(products.name, `%${search}%`),
            ilike(products.barcode, `%${search}%`),
            ilike(productCategories.name, `%${search}%`)
          )!
        );
      }
      
      // Add category filter
      if (categoryId) {
        productConditions.push(eq(products.categoryId, categoryId));
      }
      
      const whereClause = and(...productConditions);
      
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
        })
        .from(products)
        .leftJoin(productCategories, eq(products.categoryId, productCategories.id))
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
      
      // Map results to include category name as 'category' field
      const mappedProducts = productsList.map((p: any) => ({
        ...p,
        category: p.categoryName || null,
      }));
      
      return { products: mappedProducts, total };
    } catch (error) {
      console.error("Error fetching products by store:", error);
      return { products: [], total: 0 };
    }
  }

  async getProductsByCompany(companyId: number, limit?: number, offset?: number, search?: string, categoryId?: number): Promise<{ products: any[]; total: number }> {
    try {
      // Build where conditions: include all products for stores in this company OR company-wide products
      const productConditions: any[] = [
        eq(products.isActive, true),
        or(
          // Products from stores in this company
          sql`${products.storeId} IN (SELECT id FROM stores WHERE company_id = ${companyId})`,
          // Company-wide products for this company
          and(
            isNull(products.storeId),
            eq(products.companyId, companyId)
          )!
        )!
      ];
      
      // Add search filter
      if (search) {
        productConditions.push(
          or(
            ilike(products.name, `%${search}%`),
            ilike(products.barcode, `%${search}%`),
            ilike(productCategories.name, `%${search}%`)
          )!
        );
      }
      
      // Add category filter
      if (categoryId) {
        productConditions.push(eq(products.categoryId, categoryId));
      }
      
      const whereClause = and(...productConditions);
      
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
      console.error("Error fetching products by company:", error);
      return { products: [], total: 0 };
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
      const [product] = await db.insert(products).values(productFields).returning();
      
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
        
        // Extract active substances and metadata from updates
        const { 
          activeSubstances: activeSubstancesData, 
          userId: userIdFromUpdates, 
          reason: reasonFromUpdates, 
          notes: notesFromUpdates,
          storeIdForTransaction, // Special field for stock transaction (not part of product update)
          ...productFields 
        } = updates;
        
        // Normalize stock values to numbers for comparison
        // Handle both null/undefined and string/number types
        const currentStockRaw = currentProduct.stock;
        const newStockRaw = productFields.stock;
        
        const currentStock = (currentStockRaw !== null && currentStockRaw !== undefined) 
          ? Number(currentStockRaw) 
          : 0;
        const newStock = (newStockRaw !== null && newStockRaw !== undefined) 
          ? Number(newStockRaw) 
          : currentStock;
        
        // Check if stock field is present in updates AND if it's different from current
        const stockFieldPresent = 'stock' in productFields;
        const stockValueChanged = Number(newStock) !== Number(currentStock);
        const stockUpdated = stockFieldPresent && stockValueChanged;
        
        const quantityBefore = currentStock;
        const quantityAfter = newStock;
        const quantityChange = quantityAfter - quantityBefore;
        
        console.log(`[updateProduct] Product ${id}: stock update check`);
        console.log(`  - stockFieldPresent: ${stockFieldPresent} ('stock' in productFields: ${'stock' in productFields})`);
        console.log(`  - productFields.stock: ${productFields.stock} (type: ${typeof productFields.stock})`);
        console.log(`  - currentProduct.stock: ${currentProduct.stock} (type: ${typeof currentProduct.stock})`);
        console.log(`  - currentStock (normalized): ${currentStock}`);
        console.log(`  - newStock (normalized): ${newStock}`);
        console.log(`  - stockValueChanged: ${stockValueChanged} (${newStock} !== ${currentStock})`);
        console.log(`  - stockUpdated: ${stockUpdated}`);
        console.log(`  - quantityBefore: ${quantityBefore}`);
        console.log(`  - quantityAfter: ${quantityAfter}`);
        console.log(`  - quantityChange: ${quantityChange}`);
        console.log(`  - storeId: ${currentProduct.storeId}`);
        
        // Update product (ensure stock is stored as a number)
        const updateData: any = { ...productFields, updatedAt: new Date() };
        if (productFields.stock !== undefined) {
          updateData.stock = newStock; // Use normalized number
        }
        
        const [product] = await tx
          .update(products)
          .set(updateData)
          .where(eq(products.id, id))
          .returning();
        
        // Create stock transaction if stock was manually adjusted
        // Priority: storeIdForTransaction (from request context) > currentProduct.storeId > product.storeId
        const storeId = storeIdForTransaction || currentProduct.storeId || product.storeId;
        
        console.log(`[updateProduct] Final check - stockUpdated: ${stockUpdated}, quantityChange: ${quantityChange}`);
        console.log(`  - storeIdForTransaction: ${storeIdForTransaction}`);
        console.log(`  - currentProduct.storeId: ${currentProduct.storeId}`);
        console.log(`  - product.storeId: ${product.storeId}`);
        console.log(`  - effective storeId: ${storeId}`);
        
        if (stockUpdated && quantityChange !== 0) {
          if (!storeId) {
            console.warn(`⚠️  Cannot create stock transaction for product ${id}: storeId is missing`);
            console.warn(`  - storeIdForTransaction: ${storeIdForTransaction}`);
            console.warn(`  - currentProduct.storeId: ${currentProduct.storeId}`);
            console.warn(`  - product.storeId: ${product.storeId}`);
          } else {
            try {
              const stockTransactionData = {
                productId: id,
                storeId: storeId,
                batchId: null, // Products don't have batchId directly, batches are separate entities
                transactionType: 'adjustment',
                quantityChange: quantityChange,
                quantityBefore: quantityBefore,
                quantityAfter: quantityAfter,
                saleId: null,
                saleItemId: null,
                returnId: null,
                returnItemId: null,
                reason: reasonFromUpdates || 'Manual stock adjustment',
                notes: notesFromUpdates || null,
                userId: userIdFromUpdates || null,
                createdAt: new Date()
              };
              
              console.log(`[updateProduct] Creating stock transaction:`, JSON.stringify(stockTransactionData, null, 2));
              
              await tx.insert(stockTransactions).values(stockTransactionData);
              console.log(`✅ Created stock transaction for product ${id} (adjustment: ${quantityChange > 0 ? '+' : ''}${quantityChange}, storeId: ${storeId})`);
            } catch (error) {
              console.error(`❌ Error creating stock transaction for product ${id}:`, error);
              console.error(`Stock transaction data:`, JSON.stringify({
                productId: id,
                storeId: storeId,
                batchId: null, // Products don't have batchId directly, batches are separate entities
                transactionType: 'adjustment',
                quantityChange: quantityChange,
                quantityBefore: quantityBefore,
                quantityAfter: quantityAfter,
                reason: reasonFromUpdates || 'Manual stock adjustment',
                userId: userIdFromUpdates || null,
              }, null, 2));
              throw error; // Re-throw to rollback transaction
            }
          }
        } else {
          if (stockUpdated && quantityChange === 0) {
            console.log(`[updateProduct] ⚠️  Skipping stock transaction: stock updated but quantityChange is 0`);
          } else if (!stockUpdated) {
            console.log(`[updateProduct] ⚠️  Skipping stock transaction: stock not updated (productFields.stock: ${productFields.stock}, currentProduct.stock: ${currentProduct.stock})`);
          }
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
  async getProductBatches(productId: number, storeId?: number): Promise<ProductBatch[]> {
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

  async getProductBatch(id: number): Promise<ProductBatch | undefined> {
    try {
      const [batch] = await db.select().from(productBatches)
        .where(eq(productBatches.id, id));
      return batch || undefined;
    } catch (error) {
      console.error("Error fetching product batch:", error);
      return undefined;
    }
  }

  async createProductBatch(batchData: InsertProductBatch): Promise<ProductBatch> {
    try {
      const [batch] = await db.insert(productBatches).values(batchData).returning();
      return batch;
    } catch (error) {
      console.error("Error creating product batch:", error);
      throw new Error("Failed to create product batch");
    }
  }

  async updateProductBatch(id: number, updates: Partial<ProductBatch>): Promise<ProductBatch> {
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
      // Build conditions: company-wide (storeId is null) OR store-specific (storeId matches)
      const conditions = [
        eq(productCategories.companyId, companyId),
        eq(productCategories.isActive, true)
      ];

      if (storeId !== undefined && storeId !== null) {
        // For store owners/managers: get company-wide (null) OR their store-specific categories
        conditions.push(
          or(
            isNull(productCategories.storeId),
            eq(productCategories.storeId, storeId)
          )!
        );
      } else {
        // For company admins: get all categories (company-wide and store-specific)
        // No additional filter needed
      }

      return await db.select().from(productCategories)
        .where(and(...conditions))
        .orderBy(productCategories.name);
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
        // For store owners/managers: get categories that are:
        // 1. Company-wide (storeId is null AND no entries in category_stores)
        // 2. Legacy store-specific (storeId = their storeId)
        // 3. Assigned to their store via category_stores junction table
        
        // Get category IDs assigned to this store via junction table
        const assignedCategoryIds = await db
          .select({ categoryId: categoryStores.categoryId })
          .from(categoryStores)
          .where(eq(categoryStores.storeId, storeId));
        
        const assignedIds = assignedCategoryIds.map(r => r.categoryId);
        
        // Build condition: (storeId is null AND not in junction table) OR (storeId = their storeId) OR (in junction table)
        if (assignedIds.length > 0) {
          conditions.push(
            or(
              and(
                isNull(productCategories.storeId),
                sql`NOT EXISTS (SELECT 1 FROM category_stores WHERE category_stores.category_id = ${productCategories.id})`
              ),
              eq(productCategories.storeId, storeId),
              inArray(productCategories.id, assignedIds)
            )!
          );
        } else {
          // No categories assigned via junction table, use legacy logic
          conditions.push(
            or(
              and(
                isNull(productCategories.storeId),
                sql`NOT EXISTS (SELECT 1 FROM category_stores WHERE category_stores.category_id = ${productCategories.id})`
              ),
              eq(productCategories.storeId, storeId)
            )!
          );
        }
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
      // Create the category
      const [category] = await db.insert(productCategories).values(categoryData).returning();
      
      // If storeIds provided, create entries in junction table
      if (storeIds !== undefined && storeIds.length > 0) {
        const categoryStoreEntries: InsertCategoryStore[] = storeIds.map(storeId => ({
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
        if (storeIds !== undefined && storeIds.length > 0) {
          const categoryStoreEntries: InsertCategoryStore[] = storeIds.map(storeId => ({
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
      // Delete from junction table (cascade will handle this, but explicit for clarity)
      await db.delete(categoryStores).where(eq(categoryStores.categoryId, id));
      
      // Soft delete the category
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



  // Sale operations
  async getSalesByStore(storeId: number, limit?: number, offset?: number, search?: string, startDate?: string, endDate?: string): Promise<{ sales: Sale[]; total: number }> {
    try {
      const conditions = [eq(sales.storeId, storeId)];
      
      // Add date filters if provided
      if (startDate) {
        conditions.push(sql`${sales.createdAt} >= ${startDate}::date`);
      }
      if (endDate) {
        // Include the entire endDate (up to end of day)
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        conditions.push(sql`${sales.createdAt} <= ${endDateTime.toISOString()}`);
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
        
        console.log(`[createSale] Creating sale ${saleId} with userId:`, saleData.userId);
        
        // Store customer info in the items metadata for backward compatibility
        const itemsWithCustomer = {
          items: saleData.items,
          customerInfo: saleData.customerInfo
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
          userId: saleData.userId || null
        }).returning();
        
        console.log(`[createSale] Sale created with userId:`, sale.userId);

        // Extract items array - handle both direct array and nested structure
        let itemsArray: any[] = [];
        if (Array.isArray(saleData.items)) {
          itemsArray = saleData.items;
        } else if (saleData.items && typeof saleData.items === 'object' && Array.isArray(saleData.items.items)) {
          itemsArray = saleData.items.items;
        }

        console.log(`[createSale] Processing sale ${saleId} with ${itemsArray.length} items`);

        // Insert sales items into sales_items table
        let insertedSalesItems: any[] = [];
        if (itemsArray.length > 0) {
          const salesItemsToInsert: InsertSalesItem[] = itemsArray.map((item: any) => ({
            saleId: saleId,
            productId: item.productId || item.product?.id,
            batchId: item.batchId || null,
            quantity: item.quantity.toString(),
            unitPrice: (item.price || item.unitPrice || item.product?.price || 0).toString(),
            vatRate: (item.vatRate || item.product?.vatRate || 21).toString()
          }));

          if (salesItemsToInsert.length > 0) {
            try {
              insertedSalesItems = await tx.insert(salesItems).values(salesItemsToInsert).returning();
              console.log(`[createSale] Inserted ${insertedSalesItems.length} sales items`);
            } catch (error) {
              console.error("Error inserting sales items:", error);
              // Continue even if sales_items insertion fails - we still need to update stock
            }
          }
        }

        // Update product stock and create stock transactions
        console.log(`[createSale] Starting stock update for ${itemsArray.length} items`);
        if (itemsArray.length > 0) {
          const stockTransactionsToInsert = [];
          
          // Create a map of productId to saleItemId for easier lookup (only if we have inserted sales items)
          const productToSaleItemMap = new Map();
          if (insertedSalesItems.length > 0) {
            insertedSalesItems.forEach((saleItem: any, index: number) => {
              if (index < itemsArray.length) {
                const item = itemsArray[index];
                const productId = item.productId || item.product?.id;
                if (productId) {
                  productToSaleItemMap.set(productId, saleItem.id);
                }
              }
            });
          }
          
          for (const item of itemsArray) {
            const productId = item.productId || item.product?.id;
            const quantity = typeof item.quantity === 'number' ? item.quantity : parseFloat(item.quantity || '0');
            const batchId = item.batchId || null;
            
            console.log(`[createSale] Processing item: productId=${productId}, quantity=${quantity}`);
            
            if (productId && quantity > 0) {
              try {
                // Get current product
                const [product] = await tx.select().from(products).where(eq(products.id, productId));
                if (product) {
                  const quantityBefore = product.stock || 0;
                  const newStock = Math.max(0, quantityBefore - quantity);
                  
                  console.log(`[createSale] Product ${productId}: stock ${quantityBefore} -> ${newStock} (change: -${quantity})`);
                  
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
                  console.log(`[createSale] Added stock transaction for product ${productId}`);
                } else {
                  console.warn(`[createSale] Product ${productId} not found`);
                }
              } catch (error) {
                console.error(`Error processing stock transaction for product ${productId}:`, error);
                // Continue with other items even if one fails
              }
            } else {
              console.warn(`[createSale] Skipping item: productId=${productId}, quantity=${quantity}`);
            }
          }
          
          // Insert all stock transactions
          if (stockTransactionsToInsert.length > 0) {
            try {
              await tx.insert(stockTransactions).values(stockTransactionsToInsert);
              console.log(`✅ Created ${stockTransactionsToInsert.length} stock transaction(s) for sale ${saleId}`);
            } catch (error) {
              console.error("Error inserting stock transactions:", error);
              console.error("Stock transactions data:", JSON.stringify(stockTransactionsToInsert, null, 2));
              throw error; // Re-throw to rollback transaction
            }
          } else {
            console.warn(`⚠️  No stock transactions to insert for sale ${saleId} (itemsArray.length: ${itemsArray.length})`);
          }
        } else {
          console.warn(`⚠️  Skipping stock transactions - itemsArray is empty`);
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

  async getSalesItemsBySaleId(saleId: string): Promise<SalesItem[]> {
    try {
      return await db.select().from(salesItems).where(eq(salesItems.saleId, saleId));
    } catch (error) {
      console.error("Error fetching sales items:", error);
      return [];
    }
  }

  async createReturn(returnData: InsertReturn, returnItems: InsertReturnItem[]): Promise<Return> {
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
            try {
              await tx.insert(stockTransactions).values(stockTransactionsToInsert);
              console.log(`✅ Created ${stockTransactionsToInsert.length} stock transaction(s) for return ${returnRecord.id}`);
            } catch (error) {
              console.error("Error inserting stock transactions for return:", error);
              throw error; // Re-throw to rollback transaction
            }
          }
        }

        return returnRecord;
      });
    } catch (error) {
      console.error("Error creating return:", error);
      throw new Error("Failed to create return");
    }
  }

  async getReturnsByStore(storeId: number, limit?: number, offset?: number, search?: string, startDate?: string, endDate?: string, status?: string, refundMethod?: string): Promise<{ returns: Return[]; total: number }> {
    try {
      const conditions = [eq(returns.storeId, storeId)];
      
      // Add date filters if provided
      if (startDate) {
        conditions.push(sql`${returns.returnDate} >= ${startDate}::date`);
      }
      if (endDate) {
        // Include the entire endDate (up to end of day)
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        conditions.push(sql`${returns.returnDate} <= ${endDateTime.toISOString()}`);
      }
      
      // Add status filter if provided
      if (status && status !== 'all') {
        conditions.push(eq(returns.status, status));
      }
      
      // Add refund method filter if provided
      if (refundMethod && refundMethod !== 'all') {
        conditions.push(eq(returns.refundMethod, refundMethod));
      }
      
      // Add search filter if provided (search in sale ID, refund method, reason)
      if (search) {
        conditions.push(
          or(
            ilike(returns.saleId, `%${search}%`),
            ilike(returns.refundMethod, `%${search}%`),
            ilike(returns.reason || sql`''`, `%${search}%`)
          )
        );
      }
      
      const whereClause = and(...conditions);
      
      // Get total count
      const totalResult = await db
        .select({ count: count() })
        .from(returns)
        .where(whereClause);
      const total = totalResult[0]?.count || 0;
      
      // Get paginated results
      let query = db
        .select()
        .from(returns)
        .where(whereClause)
        .orderBy(desc(returns.returnDate));
      
      if (limit !== undefined) {
        query = query.limit(limit) as any;
      }
      if (offset !== undefined) {
        query = query.offset(offset) as any;
      }
      
      const returnsData = await query;
      
      return { returns: returnsData, total };
    } catch (error) {
      console.error("Error fetching returns by store:", error);
      return { returns: [], total: 0 };
    }
  }

  async getReturnsBySaleId(saleId: string): Promise<Return[]> {
    try {
      return await db.select().from(returns).where(eq(returns.saleId, saleId));
    } catch (error) {
      console.error("Error fetching returns by sale ID:", error);
      return [];
    }
  }

  async getReturnById(returnId: number): Promise<Return | undefined> {
    try {
      const [returnRecord] = await db.select().from(returns).where(eq(returns.id, returnId));
      return returnRecord;
    } catch (error) {
      console.error("Error fetching return by ID:", error);
      return undefined;
    }
  }

  async getReturnItemsByReturnId(returnId: number): Promise<ReturnItem[]> {
    try {
      return await db.select().from(returnsItems).where(eq(returnsItems.returnId, returnId));
    } catch (error) {
      console.error("Error fetching return items:", error);
      return [];
    }
  }

  async updateReturnStatus(returnId: number, status: string, processedBy?: string): Promise<Return> {
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
          userName: sql<string | null>`COALESCE(
            NULLIF(TRIM(COALESCE(${users.firstName}, '') || ' ' || COALESCE(${users.lastName}, '')), ''),
            ${users.email},
            'System'
          )`.as('userName'),
          userEmail: users.email,
        })
        .from(stockTransactions)
        .leftJoin(products, eq(stockTransactions.productId, products.id))
        .leftJoin(users, eq(stockTransactions.userId, users.id))
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
      const [auditLog] = await db.insert(auditLogs).values(auditLogData).returning();
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

  // Active Substances operations (Super Admin only, not linked to companies)
  async getActiveSubstances(limit?: number, offset?: number, search?: string): Promise<{ substances: ActiveSubstance[]; total: number }> {
    try {
      const conditions: any[] = [];

      if (search) {
        conditions.push(like(activeSubstances.name, `%${search}%`));
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

  async getActiveSubstance(id: number): Promise<ActiveSubstance | undefined> {
    try {
      const [substance] = await db
        .select()
        .from(activeSubstances)
        .where(eq(activeSubstances.id, id));
      return substance;
    } catch (error) {
      console.error("Error fetching active substance:", error);
      return undefined;
    }
  }

  async createActiveSubstance(substanceData: InsertActiveSubstance): Promise<ActiveSubstance> {
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

  async updateActiveSubstance(id: number, updates: Partial<InsertActiveSubstance>): Promise<ActiveSubstance> {
    try {
      const [substance] = await db
        .update(activeSubstances)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(activeSubstances.id, id))
        .returning();
      
      if (!substance) {
        throw new Error("Active substance not found");
      }
      
      return substance;
    } catch (error: any) {
      console.error("Error updating active substance:", error);
      if (error.message === "Active substance not found") {
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
}

// Simple in-memory storage for immediate functionality
class MemoryStorage implements IStorage {
  private users: Map<number, any> = new Map();
  private stores: Map<number, any> = new Map();
  private companies: Map<number, any> = new Map();
  private activities: Map<number, any> = new Map();
  private managers: Map<string, any> = new Map();
  private productBatches: Map<number, any> = new Map();
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

  async getAllUsers(): Promise<any[]> {
    return Array.from(this.users.values()).map(user => {
      const store = Array.from(this.stores.values()).find(s => s.managerId === user.id);
      return { ...user, store };
    });
  }

  async updateUserRole(id: any, role: string): Promise<any> {
    const user = this.users.get(Number(id));
    if (!user) throw new Error("User not found");
    
    const updatedUser = { ...user, role, updatedAt: new Date() };
    this.users.set(Number(id), updatedUser);
    return updatedUser;
  }

  async getAllStores(): Promise<any[]> {
    return Array.from(this.stores.values());
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

  async getAllManagers(): Promise<any[]> {
    return Array.from(this.managers.values());
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
    const portalAdmins = Array.from(this.users.values()).filter(u => u.role === 'portal_admin').length;
    const companyAdmins = Array.from(this.users.values()).filter(u => u.role === 'company_admin').length;
    const storeOwners = Array.from(this.users.values()).filter(u => u.role === 'store_owner').length;
    const managers = Array.from(this.users.values()).filter(u => u.role === 'manager').length;

    return {
      totalUsers,
      activeStores,
      totalStores,
      superAdmins,
      portalAdmins,
      companyAdmins,
      storeOwners,
      managers
    };
  }

  async getAllCompanies(): Promise<any[]> {
    return Array.from(this.companies.values()).map(company => ({
      ...company,
      branchCount: Array.from(this.stores.values()).filter(s => s.companyId === company.id).length,
      userCount: Array.from(this.users.values()).filter(u => u.companyId === company.id).length,
      licenseStatus: company.isActive ? "active" : "inactive"
    }));
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
      licenseStatus: company.isActive ? "active" : "inactive"
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
      licenseStatus: updatedCompany.isActive ? "active" : "inactive"
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

  async getManagersByStoreIds(storeIds: number[], limit?: number, offset?: number, filter?: 'unassigned'): Promise<{ managers: any[]; total: number }> {
    let allManagers = Array.from(this.managers.values());
    
    if (filter === 'unassigned') {
      allManagers = allManagers.filter(manager => !manager.storeId);
    } else if (storeIds.length > 0) {
      allManagers = allManagers.filter(manager => storeIds.includes(manager.storeId));
    } else {
      allManagers = [];
    }
    
    const total = allManagers.length;
    
    // Apply pagination
    if (offset !== undefined && limit !== undefined) {
      allManagers = allManagers.slice(offset, offset + limit);
    } else if (limit !== undefined) {
      allManagers = allManagers.slice(0, limit);
    }
    
    return { managers: allManagers, total };
  }

  // Product operations
  async getProductsByStore(storeId: number, limit?: number, offset?: number, search?: string, categoryId?: number): Promise<{ products: any[]; total: number }> {
    return { products: [], total: 0 };
  }

  async getProductsByCompany(companyId: number, limit?: number, offset?: number, search?: string, categoryId?: number): Promise<{ products: any[]; total: number }> {
    return { products: [], total: 0 };
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

  // Product batch operations (MemoryStorage)
  async getProductBatches(productId: number, storeId?: number): Promise<ProductBatch[]> {
    const batches = Array.from(this.productBatches?.values() || [])
      .filter((b: any) => b.productId === productId && (!storeId || b.storeId === storeId));
    return batches.sort((a: any, b: any) => 
      new Date(b.receivedDate).getTime() - new Date(a.receivedDate).getTime()
    );
  }

  async getProductBatch(id: number): Promise<ProductBatch | undefined> {
    return this.productBatches?.get(id);
  }

  async createProductBatch(batchData: InsertProductBatch): Promise<ProductBatch> {
    if (!this.productBatches) {
      this.productBatches = new Map();
    }
    const id = this.productBatches.size + 1;
    const batch = { id, ...batchData };
    this.productBatches.set(id, batch);
    return batch as ProductBatch;
  }

  async updateProductBatch(id: number, updates: Partial<ProductBatch>): Promise<ProductBatch> {
    const batch = this.productBatches?.get(id);
    if (!batch) {
      throw new Error("Product batch not found");
    }
    const updated = { ...batch, ...updates };
    this.productBatches!.set(id, updated);
    return updated as ProductBatch;
  }

  async deleteProductBatch(id: number): Promise<void> {
    this.productBatches?.delete(id);
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
export const storage = new DatabaseStorage();

