import { RequestHandler, Response } from 'express';
import { PERMISSIONS, Permission, getPermissionsForRole, hasPermission, hasAnyPermission } from './permissions.js';

// Re-export PERMISSIONS for convenience
export { PERMISSIONS };

/**
 * Extended Express Request with user information
 */
export interface AuthenticatedRequest extends Express.Request {
  user?: {
    id: string;
    email: string;
    role: string;
    type?: 'user' | 'company';
    companyId?: number | null;
    companyName?: string | null;
    storeId?: number | null;
    permissions?: Permission[];
  };
}

/**
 * Middleware to require a specific permission
 * Returns 403 if user doesn't have the required permission
 */
export function requirePermission(permission: Permission): RequestHandler {
  return (req: AuthenticatedRequest, res: Response, next) => {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({ message: "Unauthorized - User not authenticated" });
    }

    // Super admin and portal admin have all permissions
    if (user.role === 'super_admin' || user.role === 'portal_admin') {
      return next();
    }

    // Check if user has the required permission
    if (!hasPermission(user.role, permission)) {
      console.warn(`Permission denied: User ${user.email} (role: ${user.role}) attempted to access ${permission}`);
      return res.status(403).json({ 
        message: "Access denied. You don't have permission to perform this action.",
        requiredPermission: permission
      });
    }

    next();
  };
}

/**
 * Middleware to require any of the specified permissions
 * Returns 403 if user doesn't have at least one of the required permissions
 */
export function requireAnyPermission(...permissions: Permission[]): RequestHandler {
  return (req: AuthenticatedRequest, res: Response, next) => {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({ message: "Unauthorized - User not authenticated" });
    }

    // Super admin and portal admin have all permissions
    if (user.role === 'super_admin' || user.role === 'portal_admin') {
      return next();
    }

    // Check if user has any of the required permissions
    if (!hasAnyPermission(user.role, permissions)) {
      console.warn(`Permission denied: User ${user.email} (role: ${user.role}) attempted to access any of: ${permissions.join(', ')}`);
      return res.status(403).json({ 
        message: "Access denied. You don't have permission to perform this action.",
        requiredPermissions: permissions
      });
    }

    next();
  };
}

/**
 * Middleware to require a specific role
 * Returns 403 if user doesn't have the required role
 */
export function requireRole(...roles: string[]): RequestHandler {
  return (req: AuthenticatedRequest, res: Response, next) => {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({ message: "Unauthorized - User not authenticated" });
    }

    // Check if user has one of the required roles
    if (!roles.includes(user.role)) {
      console.warn(`Role denied: User ${user.email} (role: ${user.role}) attempted to access route requiring: ${roles.join(', ')}`);
      return res.status(403).json({ 
        message: "Access denied. You don't have the required role.",
        requiredRoles: roles
      });
    }

    next();
  };
}

/**
 * Helper function to check if user owns a resource (by companyId)
 */
export function ownsResource(user: AuthenticatedRequest['user'], resourceCompanyId: number | null | undefined): boolean {
  if (!user) return false;
  
  // Super admin and portal admin own everything
  if (user.role === 'super_admin' || user.role === 'portal_admin') return true;
  
  // Company admin owns resources from their company
  if ((user.role === 'company_admin' || user.type === 'company') && user.companyId) {
    return user.companyId === resourceCompanyId;
  }
  
  return false;
}

/**
 * Helper function to check if user is assigned to a resource (by storeId)
 */
export function isAssignedToResource(user: AuthenticatedRequest['user'], resourceStoreId: number | null | undefined): boolean {
  if (!user) return false;
  
  // Super admin and portal admin are assigned to everything
  if (user.role === 'super_admin' || user.role === 'portal_admin') return true;
  
  // Company admin is assigned to their company's stores
  if ((user.role === 'company_admin' || user.type === 'company') && user.companyId) {
    // We'll need to check if the store belongs to their company
    // This is a simplified check - in practice, you'd verify the store's companyId
    return true; // Will be checked in the route handler
  }
  
  // Store owner/manager is assigned to their store
  if (user.storeId) {
    return user.storeId === resourceStoreId;
  }
  
  return false;
}

/**
 * Middleware to ensure user owns the company resource
 * Checks that the resource's companyId matches the user's companyId
 */
export function requireOwnership(): RequestHandler {
    return async (req: AuthenticatedRequest, res: Response, next) => {
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({ message: "Unauthorized - User not authenticated" });
      }
  
      // Super admin and portal admin bypass ownership checks
      if (user.role === 'super_admin' || user.role === 'portal_admin') {
        return next();
      }
  
      // Extract companyId from request (could be in params, body, or query)
      const request = req as any; // Type assertion to access body and query
      const resourceCompanyId = request.body?.companyId || request.params?.companyId || request.query?.companyId;
      
      if (resourceCompanyId && !ownsResource(user, parseInt(resourceCompanyId))) {
        console.warn(`Ownership denied: User ${user.email} attempted to access resource from company ${resourceCompanyId}`);
        return res.status(403).json({ 
          message: "Access denied. You don't have permission to access this resource."
        });
      }
  
      next();
    };
  }

