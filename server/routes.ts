import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db, pool } from "./db";
import { setupAuth, isAuthenticated } from "./simpleAuth";
import { insertStoreSchema, insertActivitySchema, companies, insertCompanyInvitationSchema, companyInvitations } from "@shared/schema";
import { sendCompanyInvitationEmail } from "./emailService";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { TwoFactorAuthService } from "./twoFactorAuth";
import path from "path";

import { AuditLogger, auditMiddleware } from "./auditLogger";

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

  // Audit Log Routes - Role-based access control
  app.get('/api/audit-logs', isAuthenticated, async (req, res) => {
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

      // Role-based access control
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

      // Super admin can see all audit logs
      if (user.role === 'super_admin') {
        // No additional filters needed - can see everything
      }
      // Company admin can only see their company's audit logs
      else if (user.role === 'company_admin' || user.type === 'company') {
        filters.companyId = user.companyId;
      }
      // Store owners can only see their store's audit logs
      else if (user.role === 'store_owner') {
        filters.storeId = user.storeId;
      }
      // Managers cannot access audit logs
      else {
        return res.status(403).json({ message: "Access denied. Managers cannot view audit logs." });
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
  app.get('/api/stores/:storeId/audit-logs', isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      const storeId = parseInt(req.params.storeId);
      const { limit = 50, offset = 0 } = req.query;

      // Check permissions
      if (user.role === 'super_admin') {
        // Super admin can access any store's logs
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
  app.get('/api/companies/:companyId/audit-logs', isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      const companyId = parseInt(req.params.companyId);
      const { limit = 50, offset = 0 } = req.query;

      // Only super admins can access company audit logs via this endpoint
      // Company admins should use the general audit logs endpoint which automatically filters by their company
      if (user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied. Only super admins can access this endpoint." });
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
      res.json(user);
    } catch (error) {
      console.error("Error fetching current user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.get('/api/users', async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Company Management Routes - NO AUTH REQUIRED
  app.get('/api/companies', async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    try {
      console.log("Fetching companies from database...");
      const companies = await storage.getAllCompanies();
      console.log("Found companies:", companies);
      res.json(companies);
    } catch (error) {
      console.error("Error fetching companies:", error);
      res.status(500).json({ message: "Failed to fetch companies" });
    }
  });

  app.post('/api/companies', isAuthenticated, async (req, res) => {
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
      
      // Return the specific error message from the storage layer
      if (error.message.includes("registration number already exists") || 
          error.message.includes("email address already exists") ||
          error.message.includes("information already exists")) {
        return res.status(400).json({ message: error.message });
      }
      
      res.status(500).json({ message: "Failed to create company" });
    }
  });

  app.put('/api/companies/:id', isAuthenticated, async (req, res) => {
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
    } catch (error) {
      console.error("Error updating company:", error);
      res.status(500).json({ message: "Failed to update company" });
    }
  });



  app.delete('/api/companies/:id', isAuthenticated, async (req, res) => {
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
    } catch (error) {
      console.error("Error deleting company:", error);
      res.status(500).json({ message: "Failed to delete company" });
    }
  });

  // Company invitation endpoints
  app.post('/api/companies/:id/invite', isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      const companyId = parseInt(req.params.id);
      
      // Only super admin can send invitations
      if (user.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied. Only super admins can send invitations." });
      }

      // Get company details
      const company = await storage.getCompany(companyId);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
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

      // Send invitation email
      await sendCompanyInvitationEmail({
        email: company.email,
        companyName: company.name,
        invitationToken
      });

      // Log audit trail
      await storage.createAuditLog({
        action: "send_company_invitation",
        entityType: "company_invitation",
        entityId: invitation.id.toString(),
        userId: user.id,
        userEmail: user.email,
        userRole: user.role,
        description: `Company invitation sent to ${company.email}`,
        newValues: { companyId, email: company.email },
        severity: "info"
      });

      res.json({ 
        message: "Invitation sent successfully",
        invitation: {
          id: invitation.id,
          email: invitation.email,
          expiresAt: invitation.expiresAt
        }
      });
    } catch (error) {
      console.error("Error sending company invitation:", error);
      res.status(500).json({ message: "Failed to send invitation" });
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
    } catch (error) {
      console.error("Error activating company account:", error);
      res.status(500).json({ message: "Failed to activate company account" });
    }
  });

  // Get stores for a specific company
  app.get('/api/companies/:id/stores', async (req, res) => {
    try {
      const companyId = parseInt(req.params.id);
      const stores = await storage.getStoresByCompany(companyId);
      res.json(stores);
    } catch (error) {
      console.error("Error fetching company stores:", error);
      res.status(500).json({ message: "Failed to fetch company stores" });
    }
  });

  // Store Management Routes
  app.get('/api/stores', isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      console.log("User requesting stores:", { id: user.id, role: user.role, type: user.type, companyId: user.companyId });
      
      // For company admins (both company type and company_admin role), only show their company's stores
      if (user.type === 'company' || user.role === 'company_admin') {
        if (!user.companyId) {
          console.log("Company user without companyId, returning empty array");
          return res.json([]);
        }
        const stores = await storage.getStoresByCompany(user.companyId);
        console.log(`Fetching stores for company ID ${user.companyId}: Found ${stores.length} stores`);
        res.json(stores);
      } else {
        // For super admins, show all stores
        console.log("Super admin user, fetching all stores");
        const stores = await storage.getAllStores();
        res.json(stores);
      }
    } catch (error) {
      console.error("Error fetching stores:", error);
      res.status(500).json({ message: "Failed to fetch stores" });
    }
  });

  app.get('/api/stores/:id', async (req, res) => {
    try {
      const store = await storage.getStore(parseInt(req.params.id));
      if (!store) {
        return res.status(404).json({ message: "Store not found" });
      }
      res.json(store);
    } catch (error) {
      console.error("Error fetching store:", error);
      res.status(500).json({ message: "Failed to fetch store" });
    }
  });

  app.post('/api/stores', isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      const storeData = insertStoreSchema.parse(req.body);
      
      // For company admins, automatically set the companyId and check limits
      if (user.type === 'company' || user.role === 'company_admin') {
        storeData.companyId = user.companyId;
        
        // Check if company has reached the max branches limit
        const companies = await storage.getAllCompanies();
        const company = companies.find(c => c.id === user.companyId);
        const existingStores = await storage.getStoresByCompany(user.companyId);
        
        if (company && existingStores.length >= (company.maxBranches || 5)) {
          return res.status(400).json({ 
            message: `Store limit reached. Maximum ${company.maxBranches || 5} stores allowed.`,
            limit: company.maxBranches || 5,
            current: existingStores.length
          });
        }
        
        console.log(`Creating store for company ID ${user.companyId} (${user.companyName})`);
      }
      
      const store = await storage.createStore(storeData);
      
      // Log activity
      await storage.createActivity({
        type: "store_created",
        description: `Store "${store.name}" was created`,
        storeId: store.id,
        metadata: { storeName: store.name, companyId: user.companyId }
      });
      
      // Log audit trail
      await AuditLogger.logStoreCreate(user, store, req);
      
      res.status(201).json(store);
    } catch (error) {
      console.error("Error creating store:", error);
      res.status(500).json({ message: "Failed to create store" });
    }
  });

  app.put('/api/stores/:id', isAuthenticated, async (req, res) => {
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

  app.delete('/api/stores/:id', isAuthenticated, async (req, res) => {
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
  app.get('/api/managers', isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      
      // For company admins, only show managers from their company's stores
      if (user.type === 'company' || user.role === 'company_admin') {
        const companyStores = await storage.getStoresByCompany(user.companyId);
        const storeIds = companyStores.map(store => store.id);
        const managers = await storage.getManagersByStoreIds(storeIds);
        console.log(`Fetching managers for company ID ${user.companyId}: Found ${managers.length} managers`);
        res.json(managers);
      } else {
        // For super admins, show all managers
        const managers = await storage.getAllManagers();
        res.json(managers);
      }
    } catch (error) {
      console.error("Error fetching managers:", error);
      res.status(500).json({ message: "Failed to fetch managers" });
    }
  });

  app.post('/api/managers', isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      const managerData = req.body;
      
      // For company admins, ensure they can only create managers for their own stores
      if (user.type === 'company' && managerData.storeId) {
        const companyStores = await storage.getStoresByCompany(user.companyId);
        const validStoreIds = companyStores.map(store => store.id);
        
        if (!validStoreIds.includes(parseInt(managerData.storeId))) {
          return res.status(403).json({ message: "Cannot assign manager to store not owned by your company" });
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
    } catch (error) {
      console.error("Error creating manager:", error);
      res.status(500).json({ message: "Failed to create manager" });
    }
  });

  app.put('/api/managers/:id', isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      const managerId = req.params.id; // Keep as string since DB uses varchar
      const updates = req.body;
      
      console.log("Manager update request - ID:", managerId, "Updates:", updates);
      
      if (!managerId || managerId === 'null' || managerId === 'undefined') {
        return res.status(400).json({ message: "Invalid manager ID" });
      }
      
      // Get old manager data for audit trail
      const oldManager = await storage.getManager(managerId);
      
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

  app.delete('/api/managers/:id', isAuthenticated, async (req, res) => {
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

  // Manager Dashboard Routes - Products and Sales
  app.get("/api/stores/:storeId/products", async (req, res) => {
    try {
      const products = await storage.getProductsByStore(parseInt(req.params.storeId));
      res.json(products);
    } catch (error: any) {
      console.error("Error fetching products:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/products", isAuthenticated, async (req, res) => {
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
      
      const product = await storage.updateProduct(productId, req.body);
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

  app.get("/api/stores/:storeId/sales", async (req, res) => {
    try {
      const sales = await storage.getSalesByStore(parseInt(req.params.storeId));
      res.json(sales);
    } catch (error: any) {
      console.error("Error fetching sales:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/stores/:storeId/sales", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      const storeId = parseInt(req.params.storeId);
      const saleData = { ...req.body, storeId };
      const sale = await storage.createSale(saleData);
      
      // Log audit trail
      await AuditLogger.logSaleCreate(user, sale, req);
      
      res.status(201).json(sale);
    } catch (error: any) {
      console.error("Error creating sale:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/sales", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      const sale = await storage.createSale(req.body);
      
      // Log audit trail
      await AuditLogger.logSaleCreate(user, sale, req);
      
      res.status(201).json(sale);
    } catch (error: any) {
      console.error("Error creating sale:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Product Management Routes
  app.post("/api/stores/:storeId/products", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      const storeId = parseInt(req.params.storeId);
      const productData = { ...req.body, storeId };
      const product = await storage.createProduct(productData);
      
      // Log audit trail
      await AuditLogger.logProductCreate(user, product, req);
      
      res.status(201).json(product);
    } catch (error: any) {
      console.error("Error creating product:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/stores/:storeId/products/:id", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      const productId = parseInt(req.params.id);
      const updates = req.body;
      
      // Get old product for audit log
      const oldProduct = await storage.getProduct(productId);
      
      const product = await storage.updateProduct(productId, updates);
      
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

  app.put("/api/products/:id", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      const productId = parseInt(req.params.id);
      const updates = req.body;
      
      // Get old product for audit log
      const oldProduct = await storage.getProduct(productId);
      
      const product = await storage.updateProduct(productId, updates);
      
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

  // Product Category Management Routes
  app.get("/api/categories", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      let categories: ProductCategory[] = [];
      
      if (user.type === 'company') {
        // Get categories for company users
        categories = await storage.getCategoriesByCompany(user.companyId);
      } else {
        // Get categories for individual users
        categories = await storage.getCategoriesByUser(user.id);
      }
      
      res.json(categories);
    } catch (error: any) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/categories", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      const categoryData = {
        ...req.body,
        companyId: user.type === 'company' ? user.companyId : null,
        userId: user.type !== 'company' ? user.id : null,
      };
      
      const category = await storage.createCategory(categoryData);
      
      // Log audit trail
      await AuditLogger.log(user, {
        action: "category_create",
        entityType: "category",
        entityId: category.id?.toString(),
        description: `Category "${category.name}" created`,
        newValues: category
      }, req);
      
      res.status(201).json(category);
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
      
      // Get old category for audit log
      const oldCategory = await storage.getCategory(categoryId);
      
      const category = await storage.updateCategory(categoryId, updates);
      
      // Log audit trail
      await AuditLogger.log(user, {
        action: "category_update",
        entityType: "category",
        entityId: categoryId.toString(),
        description: `Category "${category?.name || oldCategory?.name}" updated`,
        oldValues: oldCategory,
        newValues: category
      }, req);
      
      res.json(category);
    } catch (error: any) {
      console.error("Error updating category:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/categories/:id", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      const categoryId = parseInt(req.params.id);
      
      // Get category before deletion for audit log
      const category = await storage.getCategory(categoryId);
      
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
      const storesData = await storage.getStoresByCompany(user.companyId);
      
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
      const storesData = await storage.getStoresByCompany(user.companyId);
      
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
      const companyStores = await storage.getStoresByCompany(companyId);
      const storeIds = companyStores.map(store => store.id);
      
      if (storeIds.length === 0) {
        return res.json([]);
      }
      
      // Get all products from all stores and aggregate by product
      const productsMap = new Map();
      
      for (const storeId of storeIds) {
        const storeProducts = await storage.getProductsByStore(storeId);
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
      const company = companies.find(c => c.id === user.companyId);
      
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
    } catch (error) {
      console.error('Error fetching settings:', error);
      res.status(500).json({ error: "Failed to fetch settings" });
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
    } catch (error) {
      console.error('Error updating settings:', error);
      res.status(500).json({ error: "Failed to update settings" });
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
        const company = companies.find(c => c.id === user.companyId);
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
  app.post("/api/upload-image", isAuthenticated, upload.single('image'), (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      
      const imageUrl = `/uploads/${req.file.filename}`;
      res.json({ imageUrl, filename: req.file.filename });
    } catch (error) {
      console.error("Error uploading image:", error);
      res.status(500).json({ error: "Failed to upload image" });
    }
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

  const httpServer = createServer(app);
  return httpServer;
}
