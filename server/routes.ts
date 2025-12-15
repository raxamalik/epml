import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db, pool } from "./db";
import { setupAuth, isAuthenticated } from "./simpleAuth";
import { requirePermission, requireAnyPermission, requireRole } from "./permission-middleware";
import { PERMISSIONS } from "../shared/permissions";
import { insertStoreSchema, insertActivitySchema, companies, insertCompanyInvitationSchema, companyInvitations, userSettings, productCategories, type ProductCategory } from "@shared/schema";
import { sendCompanyInvitationEmail } from "./emailService";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { TwoFactorAuthService } from "./twoFactorAuth";
import path from "path";
import cron from "node-cron";

import { AuditLogger, auditMiddleware } from "./auditLogger";

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
    // Check for common database error patterns
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

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication
  setupAuth(app);

  // Add audit logging middleware
  app.use(auditMiddleware());



  // Dashboard analytics - NO AUTH REQUIRED FOR DASHBOARD
  app.get('/api/analytics', async (req, res) => {
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

      // Super admin and portal admin can see all audit logs (AUDIT_LOGS_VIEW_ALL)
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

      // Check permissions
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

      // Only super admins and portal admins can access company audit logs via this endpoint
      // Company admins should use the general audit logs endpoint which automatically filters by their company
      if (user.role !== 'super_admin' && user.role !== 'portal_admin') {
        return res.status(403).json({ message: "Access denied. Only super admins and portal admins can access this endpoint." });
      }

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
      const validRoles = ['super_admin', 'portal_admin', 'company_admin', 'store_owner', 'manager'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ message: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
      }

      // Prevent portal_admin from assigning portal_admin role
      if (user.role === 'portal_admin' && role === 'portal_admin') {
        return res.status(403).json({ 
          message: "Access denied. Portal admins cannot assign portal_admin role. Only super admins can assign portal_admin role." 
        });
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
      const { stores } = await storage.getStoresByCompany(companyId);
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
      
      // Calculate branchCount and userCount for each company (like /api/companies/:id)
      // Fetch all users once for efficiency
      const allUsersResult = await storage.getAllUsers();
      
      const companiesWithCounts = await Promise.all(companies.map(async (company: any) => {
        const { stores } = await storage.getStoresByCompany(company.id);
        const companyUsers = allUsersResult.users.filter((u: any) => u.companyId === company.id);
        
        return {
          ...company,
          branchCount: stores.length,
          userCount: companyUsers.length
        };
      }));
      
      // Recalculate total after filtering
      const total = search || status ? companiesWithCounts.length : result.total;
      
      console.log("Found companies:", companiesWithCounts.length, "of", total);
      res.json({
        data: companiesWithCounts,
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
      const fields = [];
      const values = [];
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
      await AuditLogger.logCompanySuspension(
        user,
        companyId,
        company,
        result.suspendedStores,
        result.suspendedUsers,
        req
      );

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
      await AuditLogger.logCompanyUnsuspension(
        user,
        companyId,
        company,
        result.reactivatedStores,
        result.reactivatedUsers,
        req
      );

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

  app.delete('/api/companies/:id', isAuthenticated, requirePermission(PERMISSIONS.COMPANIES_DELETE), async (req, res) => {
    try {
      const user = (req as any).user;
      const companyId = parseInt(req.params.id);
      
      // Validate company ID
      if (isNaN(companyId)) {
        return res.status(400).json({ message: "Invalid company ID" });
      }
      
      // Only super_admin and portal_admin can delete companies
      if (user.role !== 'super_admin' && user.role !== 'portal_admin') {
        return res.status(403).json({ message: "Access denied. Only super administrators and portal administrators can delete companies." });
      }
      
      // Get company data before deletion for audit trail
      const company = await storage.getCompany(companyId);
      
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }
      
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
    } catch (error: any) {
      console.error("Error validating invitation:", error);
      const errorMessage = getErrorMessage(error, "Failed to validate invitation");
      res.status(500).json({ message: errorMessage });
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
      
      console.log("User requesting stores:", { id: user.id, role: user.role, type: user.type, companyId: user.companyId, storeId: user.storeId, limit, offset, search: searchQuery, status: statusFilter });
      
      // For store owners, only return their assigned store
      if (user.role === 'store_owner') {
        if (!user.storeId) {
          console.log("Store owner without storeId, returning empty array");
          return res.json({
            data: [],
            total: 0,
            page: 1,
            limit,
            totalPages: 0,
          });
        }
        const store = await storage.getStore(user.storeId);
        if (!store) {
          console.log(`Store ${user.storeId} not found for store owner`);
          return res.json({
            data: [],
            total: 0,
            page: 1,
            limit,
            totalPages: 0,
          });
        }
        
        console.log(`Store owner accessing their store: ${store.id}`);
        
        res.json({
          data: [store],
          total: 1,
          page: 1,
          limit,
          totalPages: 1,
        });
      } else if (user.type === 'company' || user.role === 'company_admin') {
      // For company admins (both company type and company_admin role), only show their company's stores
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
      if (user.role === 'store_owner') {
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
        // For now, count each sale as one customer transaction
        // If items contain customer info, we can extract unique customers
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
      const storeData = insertStoreSchema.parse(req.body) as any;
      
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
      
      // Extract owner email and password if provided
      const { ownerEmail, ownerPassword, ...storeDataWithoutOwner } = req.body;
      
      // Create the store
      const store = await storage.createStore(storeDataWithoutOwner);
      
      // Create store owner if email and password are provided
      let storeOwner = null;
      if (ownerEmail && ownerPassword) {
        try {
          // Check if user with this email already exists
          const existingUser = await storage.getUserByEmail(ownerEmail);
          if (existingUser) {
            console.warn(`User with email ${ownerEmail} already exists. Skipping store owner creation.`);
          } else {
            // Hash the password
            const bcrypt = await import("bcrypt");
            const passwordHash = await bcrypt.hash(ownerPassword, 10);
            
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
            });
            
            // Update store to link it to the store owner
            await storage.updateStore(store.id, { managerId: storeOwner.id });
            
            console.log(`Store owner created for store ${store.name} with email ${ownerEmail}`);
            
            // Log audit trail for store owner creation
            await AuditLogger.logUserCreate(user, storeOwner, req);
          }
        } catch (ownerError: any) {
          console.error("Error creating store owner:", ownerError);
          // If it's a duplicate email error, include it in the response
          if (ownerError.code === '23505' && ownerError.constraint === 'users_email_unique') {
            // Store is already created, so we return success but with a warning
            return res.status(201).json({
              ...store,
              storeOwner: null,
              warning: `Store created successfully, but store owner account could not be created: A user with the email "${ownerEmail}" already exists.`
            });
          }
          // For other errors, just log them but don't fail store creation
          // The store is already created, so we continue
        }
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
      
      res.status(201).json({
        ...store,
        storeOwner: storeOwner ? { id: storeOwner.id, email: storeOwner.email } : null
      });
    } catch (error: any) {
      console.error("Error creating store:", error);
      const errorMessage = getErrorMessage(error, "Failed to create store");
      
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
      
      // Validate store ID
      if (isNaN(storeId)) {
        return res.status(400).json({ message: "Invalid store ID" });
      }
      
      const store = await storage.getStore(storeId);
      
      if (!store) {
        return res.status(404).json({ message: "Store not found" });
      }
      
      // Ownership validation: Company admins can only delete stores from their own company
      // Store owners cannot delete stores (they don't have STORES_DELETE permission, but double-check)
      if (user.role !== 'super_admin' && user.role !== 'portal_admin') {
        if (user.role === 'store_owner') {
          return res.status(403).json({ message: "Access denied. Store owners cannot delete stores." });
        }
        
        if ((user.role === 'company_admin' || user.type === 'company') && user.companyId) {
          if (store.companyId !== user.companyId) {
            return res.status(403).json({ 
              message: "Access denied. You can only delete stores from your own company." 
            });
          }
        }
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
        const { stores: companyStores } = await storage.getStoresByCompany(user.companyId);
        const storeIds = companyStores.map((store: any) => store.id);
        
        // Apply store filter if provided
        let filteredStoreIds = storeIds;
        if (storeFilter && storeFilter !== 'all') {
          if (storeFilter === 'unassigned') {
            // For unassigned, get all managers and filter client-side by companyId and null storeId
            // Since managers belong to companies, we can filter by companyId
            const { managers: allManagers } = await storage.getAllManagers(1000, 0); // Get all to filter
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
      
      // Prevent portal_admin role from being created through this endpoint
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
          const { stores: companyStores } = await storage.getStoresByCompany(user.companyId);
          const validStoreIds = companyStores.map((store: any) => store.id);
          
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
      
      const errorMessage = getErrorMessage(error, "Failed to create manager");
      
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

  // Create Portal Admin endpoint (Super Admin only)
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
      
      console.log("Creating portal admin with data:", {
        ...portalAdminData,
        password: '[REDACTED]'
      });
      
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
      
      // Log audit trail
      await AuditLogger.logUserCreate(user, portalAdmin, req);
      
      res.status(201).json({
        ...portalAdmin,
        password: undefined // Don't return password in response
      });
    } catch (error: any) {
      console.error("Error creating portal admin:", error);
      
      const errorMessage = getErrorMessage(error, "Failed to create portal admin");
      
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
    } catch (error) {
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
      
      // Log audit trail
      await AuditLogger.logUserDelete(user, portalAdmin, req);
      
      res.json({ message: "Portal admin deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting portal admin:", error);
      const errorMessage = getErrorMessage(error, "Failed to delete portal admin");
      res.status(500).json({ message: errorMessage });
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
          const { stores: companyStores } = await storage.getStoresByCompany(user.companyId);
          const validStoreIds = companyStores.map((store: any) => store.id);
          
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
    } catch (error: any) {
      console.error("Error updating manager:", error);
      const errorMessage = getErrorMessage(error, "Failed to update manager");
      
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
      
      // Ownership validation: Company admins can only delete managers from their own company
      // Store owners can only delete managers from their own store
      if (user.role !== 'super_admin' && user.role !== 'portal_admin') {
        if (user.role === 'company_admin' || user.type === 'company') {
          if (user.companyId && manager.companyId !== user.companyId) {
            return res.status(403).json({ 
              message: "Access denied. You can only delete managers from your own company." 
            });
          }
        } else if (user.role === 'store_owner') {
          if (user.storeId && manager.storeId !== user.storeId) {
            return res.status(403).json({ 
              message: "Access denied. You can only delete managers from your own store." 
            });
          }
        }
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

  // Manager Dashboard Routes - Products and Sales
  // Get all products for a company (across all stores) - for company admins
  app.get("/api/company/products", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      
      // Only company admins can access this endpoint
      if (user.role !== 'company_admin' && user.type !== 'company' && user.role !== 'super_admin' && user.role !== 'portal_admin') {
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
      if (user && user.role !== 'super_admin' && user.role !== 'portal_admin') {
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

  // Get single product by ID for company admins (company-wide)
  app.get("/api/company/products/:id", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      const productId = parseInt(req.params.id);
      
      // Only company admins can access this endpoint
      if (user.role !== 'company_admin' && user.type !== 'company' && user.role !== 'super_admin' && user.role !== 'portal_admin') {
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

      // Get category information if categoryId exists
      let categoryName = null;
      if (product.categoryId) {
        const [category] = await db.select().from(productCategories)
          .where(eq(productCategories.id, product.categoryId));
        if (category) {
          categoryName = category.name;
        }
      }

      // Return product with category information and active substances
      const productWithCategory = {
        ...product,
        category: categoryName,
        activeSubstances: product.activeSubstances || []
      };

      res.json(productWithCategory);
    } catch (error: any) {
      console.error("Error fetching company product:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get single product by ID
  app.get("/api/stores/:storeId/products/:id", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      const productId = parseInt(req.params.id);
      const storeId = parseInt(req.params.storeId);
      
      // Authorization: Store owners and managers can only view products from their own store
      if (user.role !== 'super_admin' && user.role !== 'portal_admin') {
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
      
      // Get category information if categoryId exists
      let categoryName = null;
      if (product.categoryId) {
        const [category] = await db.select().from(productCategories)
          .where(eq(productCategories.id, product.categoryId));
        if (category) {
          categoryName = category.name;
        }
      }
      
      // Return product with category information and active substances
      const productWithCategory = {
        ...product,
        category: categoryName,
        activeSubstances: product.activeSubstances || []
      };
      
      res.json(productWithCategory);
    } catch (error: any) {
      console.error("Error fetching product:", error);
      res.status(500).json({ message: error.message });
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

  app.put("/api/products/:id", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      const productId = parseInt(req.params.id);
      
      // Get old product for audit log
      const oldProduct = await storage.getProduct(productId);
      
      // Determine effective storeId for stock transaction tracking
      // Priority: product.storeId > user.storeId > request body storeId
      const effectiveStoreId = oldProduct?.storeId || user?.storeId || req.body.storeId || null;
      
      // Include user ID and storeId in updates for stock transaction tracking
      const updates = {
        ...req.body,
        userId: user?.id || null,
        storeIdForTransaction: effectiveStoreId // Pass storeId for stock transaction
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

  app.post("/api/stores/:storeId/sales", isAuthenticated, requirePermission(PERMISSIONS.SALES_CREATE), async (req, res) => {
    try {
      const user = (req as any).user;
      const storeId = parseInt(req.params.storeId);
      // Ensure userId is set from the authenticated user
      // Priority: request body userId > authenticated user id
      const userId = req.body.userId || user?.id || null;
      console.log(`[POST /api/stores/:storeId/sales] Setting userId:`, { 
        fromBody: req.body.userId, 
        fromUser: user?.id, 
        final: userId,
        userObject: { id: user?.id, email: user?.email, role: user?.role }
      });
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

  app.post("/api/sales", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      // Ensure userId is set from the authenticated user
      // Priority: request body userId > authenticated user id
      const userId = req.body.userId || user?.id || null;
      console.log(`[POST /api/sales] Setting userId:`, { 
        fromBody: req.body.userId, 
        fromUser: user?.id, 
        final: userId,
        userObject: { id: user?.id, email: user?.email, role: user?.role }
      });
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

  // Get sale by ID with items and return information
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
      const salesItemsWithReturns = salesItems.map(item => ({
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
  // Create product endpoint for company admins (company-wide products)
  app.post("/api/company/products", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      
      // Only company admins can access this endpoint
      if (user.role !== 'company_admin' && user.type !== 'company' && user.role !== 'super_admin' && user.role !== 'portal_admin') {
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
      if (user.role !== 'super_admin' && user.role !== 'portal_admin') {
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
      if (user.role !== 'company_admin' && user.type !== 'company' && user.role !== 'super_admin' && user.role !== 'portal_admin') {
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
          // Use company-wide endpoint
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
      
      // Get old product for audit log and authorization check
      const oldProduct = await storage.getProduct(productId);
      if (!oldProduct) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      // Authorization: Store owners and managers can only update products from their own store
      if (user.role !== 'super_admin' && user.role !== 'portal_admin') {
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
      
      // Include user ID and storeId in updates for stock transaction tracking
      // Use the storeId from URL if product doesn't have one (company-wide products)
      const effectiveStoreId = oldProduct.storeId || storeId || user?.storeId || null;
      const updatesWithUserId = {
        ...updates,
        userId: user?.id || null,
        storeIdForTransaction: effectiveStoreId // Pass storeId for stock transaction
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
      const storeId = parseInt(req.params.storeId);
      
      // Validate IDs
      if (isNaN(productId) || isNaN(storeId)) {
        return res.status(400).json({ message: "Invalid product or store ID" });
      }
      
      // Get product before deletion for audit log
      const product = await storage.getProduct(productId);
      
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      // Ownership validation: Verify product belongs to the specified store
      if (product.storeId !== storeId) {
        return res.status(400).json({ message: "Product does not belong to the specified store" });
      }
      
      // Ownership validation: Users can only delete products from stores they have access to
      if (user.role !== 'super_admin' && user.role !== 'portal_admin') {
        if (user.role === 'company_admin' || user.type === 'company') {
          // Get store to verify company ownership
          const store = await storage.getStore(storeId);
          if (!store || (user.companyId && store.companyId !== user.companyId)) {
            return res.status(403).json({ 
              message: "Access denied. You can only delete products from your company's stores." 
            });
          }
        } else if (user.role === 'store_owner' || user.role === 'manager') {
          if (user.storeId && product.storeId !== user.storeId) {
            return res.status(403).json({ 
              message: "Access denied. You can only delete products from your assigned store." 
            });
          }
        }
      }
      
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

  app.put("/api/products/:id", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      const productId = parseInt(req.params.id);
      const updates = req.body;
      
      // Get old product for audit log
      const oldProduct = await storage.getProduct(productId);
      
      // Determine effective storeId for stock transactions
      // Priority: product.storeId > user.storeId > updates.storeId
      const effectiveStoreId = oldProduct?.storeId || user?.storeId || updates.storeId || null;
      
      // Include user ID and storeId in updates for stock transaction tracking
      const updatesWithUserId = {
        ...updates,
        userId: user?.id || null,
        storeIdForTransaction: effectiveStoreId // Pass storeId for stock transaction
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

  app.delete("/api/products/:id", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      const productId = parseInt(req.params.id);
      
      // Validate product ID
      if (isNaN(productId)) {
        return res.status(400).json({ message: "Invalid product ID" });
      }
      
      // Get product before deletion for audit log
      const product = await storage.getProduct(productId);
      
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      // Ownership validation: Users can only delete products from stores they have access to
      if (user.role !== 'super_admin' && user.role !== 'portal_admin') {
        if (user.role === 'company_admin' || user.type === 'company') {
          // Get store to verify company ownership
          const store = await storage.getStore(product.storeId);
          if (!store || (user.companyId && store.companyId !== user.companyId)) {
            return res.status(403).json({ 
              message: "Access denied. You can only delete products from your company's stores." 
            });
          }
        } else if (user.role === 'store_owner' || user.role === 'manager') {
          if (user.storeId && product.storeId !== user.storeId) {
            return res.status(403).json({ 
              message: "Access denied. You can only delete products from your assigned store." 
            });
          }
        }
      }
      
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

  app.get("/api/product-batches/:id", isAuthenticated, async (req, res) => {
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

  app.post("/api/product-batches", isAuthenticated, async (req, res) => {
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

  app.put("/api/product-batches/:id", isAuthenticated, async (req, res) => {
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

  app.delete("/api/product-batches/:id", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      const batchId = parseInt(req.params.id);
      
      // Validate batch ID
      if (isNaN(batchId)) {
        return res.status(400).json({ message: "Invalid product batch ID" });
      }
      
      // Get batch before deletion for audit log
      const batch = await storage.getProductBatch(batchId);
      if (!batch) {
        return res.status(404).json({ message: "Product batch not found" });
      }
      
      // Ownership validation: Users can only delete batches from stores they have access to
      if (user.role !== 'super_admin' && user.role !== 'portal_admin') {
        if (user.role === 'company_admin' || user.type === 'company') {
          // Get store to verify company ownership
          const store = await storage.getStore(batch.storeId);
          if (!store || (user.companyId && store.companyId !== user.companyId)) {
            return res.status(403).json({ 
              message: "Access denied. You can only delete product batches from your company's stores." 
            });
          }
        } else if (user.role === 'store_owner' || user.role === 'manager') {
          if (user.storeId && batch.storeId !== user.storeId) {
            return res.status(403).json({ 
              message: "Access denied. You can only delete product batches from your assigned store." 
            });
          }
        }
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
      if (user.role !== 'super_admin' && user.role !== 'portal_admin') {
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
          // If category is store-specific, it must be for their store
          if (oldCategory.storeId !== null && oldCategory.storeId !== user.storeId) {
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
      if (user.role !== 'super_admin' && user.role !== 'portal_admin') {
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
          // If category is store-specific, it must be for their store
          if (category.storeId !== null && category.storeId !== user.storeId) {
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
      const { stores: storesData } = await storage.getStoresByCompany(user.companyId);
      
      // Calculate revenue from actual sales for each store
      const storesWithRevenue = await Promise.all(storesData.map(async (store: any) => {
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
      const { stores: storesData } = await storage.getStoresByCompany(user.companyId);
      
      const totalStores = storesData.length;
      const activeStores = storesData.filter((store: any) => store.isActive).length;
      
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

  app.get('/api/company/products-overview', isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      
      // Allow company admins and store owners to access company products
      // Super admins are excluded since they don't have a specific companyId
      if (user.type !== 'company' && user.role !== 'store_owner' && user.role !== 'company_admin') {
        return res.status(403).json({ message: "Access denied. Company access required." });
      }
      
      // Get companyId from user
      const companyId = user.companyId;
      
      if (!companyId) {
        return res.status(400).json({ message: "Company ID not found for user." });
      }
      
      // Get all stores for this company
      const { stores: companyStores } = await storage.getStoresByCompany(companyId);
      const storeIds = companyStores.map((store: any) => store.id);
      
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
      const companies = await storage.getAllCompanies();
      const company = companies.data.find(c => c.id === user.companyId);
      
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
        const companies = await storage.getAllCompanies();
        const company = companies.data.find(c => c.id === user.companyId);
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
  const { upload } = await import("./fileUpload");

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
        // Return both 'url' and 'imageUrl' for compatibility
        res.json({ url: imageUrl, imageUrl: imageUrl, filename: req.file.filename });
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

  // Active Substances Management Routes (Super Admin only)
  // GET /api/active-substances - Get all active substances with pagination and search
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

  // POST /api/active-substances - Create new active substance
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

  // PUT /api/active-substances/:id - Update active substance
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

  // DELETE /api/active-substances/:id - Delete active substance
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
        entityId: substance.id.toString(),
        description: `Active substance "${substance.name}" deleted`,
        oldValues: substance,
      }, req);

      res.json({ message: "Active substance deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting active substance:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Serve uploaded images
  app.use("/uploads", express.static("uploads"));

  const httpServer = createServer(app);
  return httpServer;
}
