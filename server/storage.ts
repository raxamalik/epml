import {
  users,
  stores,
  activities,
  auditLogs,
  companies,
  products,
  productCategories,
  sales,
  userSettings,
  trustedDevices,
  companyInvitations,
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
  type Sale,
  type InsertSale,
  type UserSettings,
  type InsertUserSettings,
  type TrustedDevice,
  type InsertTrustedDevice,
  type CompanyInvitation,
  type InsertCompanyInvitation,
  type UserWithStore,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, count, and, or, isNotNull, sql, inArray } from "drizzle-orm";
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
  getAllUsers(): Promise<UserWithStore[]>;
  updateUserRole(id: number, role: string): Promise<User>;
  updateUserPassword(id: string, passwordHash: string): Promise<void>;
  
  // Store operations
  getAllStores(): Promise<Store[]>;
  getStoresByCompany(companyId: number): Promise<Store[]>;
  createStore(store: InsertStore): Promise<Store>;
  getStore(id: number): Promise<Store | undefined>;
  updateStore(id: number, updates: Partial<Store>): Promise<Store>;
  deleteStore(id: number): Promise<void>;
  
  // Manager operations
  getAllManagers(): Promise<any[]>;
  getManagersByStoreIds(storeIds: number[]): Promise<any[]>;
  getManager(id: string): Promise<any | undefined>;
  createManager(manager: any): Promise<any>;
  updateManager(id: string, updates: any): Promise<any>;
  deleteManager(id: string): Promise<void>;
  
  // Company operations
  getAllCompanies(): Promise<any[]>;
  createCompany(company: any): Promise<any>;
  getCompany(id: number): Promise<any | undefined>;
  getCompanyByEmail(email: string): Promise<any | undefined>;
  updateCompany(id: number, updates: Partial<any>): Promise<any>;
  deleteCompany(id: number): Promise<void>;
  updateCompanyPassword(email: string, passwordHash: string): Promise<void>;
  
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
  getProductsByStore(storeId: number): Promise<Product[]>;
  getProduct(id: number): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, updates: Partial<Product>): Promise<Product>;
  
  // Product category operations
  getCategoriesByCompany(companyId: number): Promise<ProductCategory[]>;
  getCategoriesByUser(userId: string): Promise<ProductCategory[]>;
  createCategory(categoryData: InsertProductCategory): Promise<ProductCategory>;
  updateCategory(id: number, updates: Partial<ProductCategory>): Promise<ProductCategory>;
  deleteCategory(id: number): Promise<void>;
  getAllUploadedImages(): Promise<string[]>;
  
  // Sale operations
  getSalesByStore(storeId: number): Promise<Sale[]>;
  getSalesByCompany(companyId: number): Promise<Sale[]>;
  createSale(sale: InsertSale): Promise<Sale>;
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
    // Generate ID if not provided
    if (!userData.id) {
      const { nanoid } = await import("nanoid");
      userData.id = nanoid();
    }
    
    const [user] = await db
      .insert(users)
      .values(userData as any) // Type assertion needed because InsertUser omits id
      .returning();
    return user;
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

  async getAllUsers(): Promise<UserWithStore[]> {
    const results = await db
      .select()
      .from(users)
      .leftJoin(stores, eq(users.storeId, stores.id))
      .orderBy(desc(users.createdAt));
    
    return results.map(result => ({
      ...result.users,
      store: result.stores,
    }));
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
  async getAllStores(): Promise<Store[]> {
    return await db.select().from(stores).orderBy(desc(stores.createdAt));
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

  async getStoresByCompany(companyId: number): Promise<Store[]> {
    return await db.select().from(stores).where(eq(stores.companyId, companyId)).orderBy(desc(stores.createdAt));
  }

  async deleteStore(id: number): Promise<void> {
    // First delete any activities related to this store
    await db.delete(activities).where(eq(activities.storeId, id));
    // Then delete the store
    await db.delete(stores).where(eq(stores.id, id));
  }

  // Manager operations
  async getAllManagers(): Promise<any[]> {
    const managersQuery = await db
      .select()
      .from(users)
      .where(eq(users.role, 'manager'))
      .orderBy(desc(users.createdAt));
    
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
    
    return managers;
  }

  async getManagersByStoreIds(storeIds: number[]): Promise<any[]> {
    if (storeIds.length === 0) {
      return [];
    }
    
    const managersQuery = await db
      .select()
      .from(users)
      .where(and(
        eq(users.role, 'manager'),
        or(...storeIds.map(id => eq(users.storeId, id)))
      ))
      .orderBy(desc(users.createdAt));
    
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
    
    return managers;
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
    const [result] = await db
      .insert(userSettings)
      .values(settings)
      .onConflictDoUpdate({
        target: settings.userId ? [userSettings.userId] : [userSettings.companyId!],
        set: {
          ...settings,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result;
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
  async getAllCompanies(): Promise<any[]> {
    try {
      console.log("Fetching companies from database...");
      const companiesData = await db.select().from(companies);
      console.log("Raw companies data:", companiesData);
      
      const companiesWithDetails = companiesData.map(company => ({
        ...company,
        branchCount: 0,
        userCount: 0,
        licenseStatus: company.isActive ? "active" : "inactive"
      }));
      
      console.log("Companies with details:", companiesWithDetails);
      return companiesWithDetails;
    } catch (error) {
      console.error("Database error in getAllCompanies:", error);
      return [];
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
        licenseStatus: company.isActive ? "active" : "inactive"
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
      
      // Hash password if provided
      if (updates.password) {
        const bcrypt = await import("bcrypt");
        updateData.password = await bcrypt.hash(updates.password, 10);
        console.log("Password hashed successfully for company:", id);
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
        licenseStatus: updatedCompany.isActive ? "active" : "inactive"
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
        licenseStatus: company.isActive ? "active" : "inactive"
      };
    } catch (error) {
      console.error("Database error in getCompanyByEmail:", error);
      return undefined;
    }
  }

  async deleteCompany(id: number): Promise<void> {
    try {
      // First delete any related invitation records
      await db.delete(companyInvitations).where(eq(companyInvitations.companyId, id));
      
      // Then delete the company
      await db.delete(companies).where(eq(companies.id, id));
    } catch (error) {
      console.error("Database error in deleteCompany:", error);
      throw new Error("Failed to delete company");
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

  // Product operations
  async getProductsByStore(storeId: number): Promise<Product[]> {
    try {
      return await db.select().from(products)
        .where(and(eq(products.storeId, storeId), eq(products.isActive, true)))
        .orderBy(desc(products.createdAt));
    } catch (error) {
      console.error("Error fetching products by store:", error);
      return [];
    }
  }

  async getProduct(id: number): Promise<Product | undefined> {
    try {
      const result = await db.select().from(products)
        .where(eq(products.id, id));
      return result[0] || undefined;
    } catch (error) {
      console.error("Error fetching product by id:", error);
      return undefined;
    }
  }

  async createProduct(productData: InsertProduct): Promise<Product> {
    try {
      const [product] = await db.insert(products).values(productData).returning();
      return product;
    } catch (error) {
      console.error("Error creating product:", error);
      throw new Error("Failed to create product");
    }
  }

  async updateProduct(id: number, updates: Partial<Product>): Promise<Product> {
    try {
      const [product] = await db
        .update(products)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(products.id, id))
        .returning();
      return product;
    } catch (error) {
      console.error("Error updating product:", error);
      throw new Error("Failed to update product");
    }
  }

  // Product category operations
  async getCategoriesByCompany(companyId: number): Promise<ProductCategory[]> {
    try {
      return await db.select().from(productCategories)
        .where(and(eq(productCategories.companyId, companyId), eq(productCategories.isActive, true)))
        .orderBy(productCategories.name);
    } catch (error) {
      console.error("Error fetching categories by company:", error);
      return [];
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

  async createCategory(categoryData: InsertProductCategory): Promise<ProductCategory> {
    try {
      const [category] = await db.insert(productCategories).values(categoryData).returning();
      return category;
    } catch (error) {
      console.error("Error creating category:", error);
      throw new Error("Failed to create category");
    }
  }

  async updateCategory(id: number, updates: Partial<ProductCategory>): Promise<ProductCategory> {
    try {
      const [category] = await db
        .update(productCategories)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(productCategories.id, id))
        .returning();
      return category;
    } catch (error) {
      console.error("Error updating category:", error);
      throw new Error("Failed to update category");
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



  // Sale operations
  async getSalesByStore(storeId: number): Promise<Sale[]> {
    try {
      return await db.select().from(sales).where(eq(sales.storeId, storeId));
    } catch (error) {
      console.error("Error fetching sales by store:", error);
      return [];
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
      // Generate a unique ID for the sale
      const saleId = `sale_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      
      // Store customer info in the items metadata for now
      const itemsWithCustomer = {
        items: saleData.items,
        customerInfo: saleData.customerInfo
      };

      const [sale] = await db.insert(sales).values({
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
      return sale;
    } catch (error) {
      console.error("Error creating sale:", error);
      throw new Error("Failed to create sale");
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
}

// Simple in-memory storage for immediate functionality
class MemoryStorage implements IStorage {
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

  async getStoresByCompany(companyId: number): Promise<any[]> {
    return Array.from(this.stores.values()).filter(store => store.companyId === companyId);
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

  async getManagersByStoreIds(storeIds: number[]): Promise<any[]> {
    return Array.from(this.managers.values()).filter(manager => 
      storeIds.includes(manager.storeId)
    );
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
export const storage = new DatabaseStorage();
