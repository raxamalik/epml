import { Request, Response, NextFunction } from "express";
import { storage } from "./storage";

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

export class AuditLogger {
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
export function auditMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Store original end function
    const originalEnd = res.end;
    
    // Override end function to capture response
    res.end = function(chunk?: any, encoding?: any) {
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
      originalEnd.call(this, chunk, encoding);
    };
    
    next();
  };
}