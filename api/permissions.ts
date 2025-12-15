/**
 * Permission-based access control system
 * 
 * Permissions follow the pattern: resource:action
 * Example: users:create, stores:read, audit_logs:view
 */

export const PERMISSIONS = {
  // User Management
  USERS_VIEW: 'users:view',
  USERS_CREATE: 'users:create',
  USERS_UPDATE: 'users:update',
  USERS_DELETE: 'users:delete',
  USERS_MANAGE: 'users:manage', // All user operations

  // Company Management
  COMPANIES_VIEW: 'companies:view',
  COMPANIES_CREATE: 'companies:create',
  COMPANIES_UPDATE: 'companies:update',
  COMPANIES_DELETE: 'companies:delete',
  COMPANIES_MANAGE: 'companies:manage', // All company operations
  COMPANIES_SEND_INVITATIONS: 'companies:send_invitations',
  COMPANIES_VIEW_OWN: 'companies:view_own', // View own company only

  // Store Management
  STORES_VIEW: 'stores:view',
  STORES_CREATE: 'stores:create',
  STORES_UPDATE: 'stores:update',
  STORES_DELETE: 'stores:delete',
  STORES_MANAGE: 'stores:manage', // All store operations
  STORES_VIEW_OWN: 'stores:view_own', // View own company's stores only
  STORES_VIEW_ASSIGNED: 'stores:view_assigned', // View assigned store only

  // Manager Management
  MANAGERS_VIEW: 'managers:view',
  MANAGERS_CREATE: 'managers:create',
  MANAGERS_UPDATE: 'managers:update',
  MANAGERS_DELETE: 'managers:delete',
  MANAGERS_MANAGE: 'managers:manage', // All manager operations
  MANAGERS_VIEW_OWN: 'managers:view_own', // View own company's managers only

  // Product Management
  PRODUCTS_VIEW: 'products:view',
  PRODUCTS_CREATE: 'products:create',
  PRODUCTS_UPDATE: 'products:update',
  PRODUCTS_DELETE: 'products:delete',
  PRODUCTS_MANAGE: 'products:manage', // All product operations
  PRODUCTS_VIEW_OWN: 'products:view_own', // View own company's products only
  PRODUCTS_VIEW_ASSIGNED: 'products:view_assigned', // View assigned store's products only

  // Product Batches
  PRODUCT_BATCHES_VIEW: 'product_batches:view',
  PRODUCT_BATCHES_CREATE: 'product_batches:create',
  PRODUCT_BATCHES_UPDATE: 'product_batches:update',
  PRODUCT_BATCHES_DELETE: 'product_batches:delete',
  PRODUCT_BATCHES_MANAGE: 'product_batches:manage',

  // Sales Management
  SALES_VIEW: 'sales:view',
  SALES_CREATE: 'sales:create',
  SALES_UPDATE: 'sales:update',
  SALES_DELETE: 'sales:delete',
  SALES_MANAGE: 'sales:manage',
  SALES_VIEW_OWN: 'sales:view_own', // View own company's sales only
  SALES_VIEW_ASSIGNED: 'sales:view_assigned', // View assigned store's sales only

  // POS Operations
  POS_ACCESS: 'pos:access',
  POS_CREATE_SALE: 'pos:create_sale',
  POS_VIEW_SALES: 'pos:view_sales',

  // Inventory Management
  INVENTORY_VIEW: 'inventory:view',
  INVENTORY_UPDATE: 'inventory:update',
  INVENTORY_MANAGE: 'inventory:manage',

  // Audit Logs
  AUDIT_LOGS_VIEW: 'audit_logs:view',
  AUDIT_LOGS_VIEW_ALL: 'audit_logs:view_all', // View all audit logs
  AUDIT_LOGS_VIEW_OWN: 'audit_logs:view_own', // View own company's audit logs
  AUDIT_LOGS_VIEW_ASSIGNED: 'audit_logs:view_assigned', // View assigned store's audit logs

  // Analytics
  ANALYTICS_VIEW: 'analytics:view',
  ANALYTICS_VIEW_ALL: 'analytics:view_all', // View all analytics
  ANALYTICS_VIEW_OWN: 'analytics:view_own', // View own company's analytics
  ANALYTICS_VIEW_ASSIGNED: 'analytics:view_assigned', // View assigned store's analytics

  // Settings
  SETTINGS_VIEW: 'settings:view',
  SETTINGS_UPDATE: 'settings:update',
  SETTINGS_MANAGE: 'settings:manage',
  SETTINGS_VIEW_OWN: 'settings:view_own', // View own company's settings only

  // 2FA Management
  TWO_FA_ENABLE: '2fa:enable',
  TWO_FA_DISABLE: '2fa:disable',
  TWO_FA_MANAGE: '2fa:manage',
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

/**
 * Role definitions
 */
export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  COMPANY_ADMIN: 'company_admin',
  STORE_OWNER: 'store_owner',
  MANAGER: 'manager',
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];

/**
 * Role to Permissions mapping
 * Each role has a set of permissions that define what they can do
 */
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [ROLES.SUPER_ADMIN]: [
    // Super admin has all permissions
    ...Object.values(PERMISSIONS),
  ],

  [ROLES.COMPANY_ADMIN]: [
    // Company Management (own company only)
    PERMISSIONS.COMPANIES_VIEW_OWN,
    PERMISSIONS.COMPANIES_UPDATE, // Can update own company
    
    // Store Management (own company's stores)
    PERMISSIONS.STORES_VIEW_OWN,
    PERMISSIONS.STORES_CREATE,
    PERMISSIONS.STORES_UPDATE,
    PERMISSIONS.STORES_DELETE,
    PERMISSIONS.STORES_MANAGE,
    
    // Manager Management (own company's managers)
    PERMISSIONS.MANAGERS_VIEW_OWN,
    PERMISSIONS.MANAGERS_CREATE,
    PERMISSIONS.MANAGERS_UPDATE,
    PERMISSIONS.MANAGERS_DELETE,
    PERMISSIONS.MANAGERS_MANAGE,
    
    // Product Management (own company's products)
    PERMISSIONS.PRODUCTS_VIEW_OWN,
    PERMISSIONS.PRODUCTS_CREATE,
    PERMISSIONS.PRODUCTS_UPDATE,
    PERMISSIONS.PRODUCTS_DELETE,
    PERMISSIONS.PRODUCTS_MANAGE,
    
    // Product Batches
    PERMISSIONS.PRODUCT_BATCHES_VIEW,
    PERMISSIONS.PRODUCT_BATCHES_CREATE,
    PERMISSIONS.PRODUCT_BATCHES_UPDATE,
    PERMISSIONS.PRODUCT_BATCHES_DELETE,
    PERMISSIONS.PRODUCT_BATCHES_MANAGE,
    
    // Sales (own company's sales)
    PERMISSIONS.SALES_VIEW_OWN,
    PERMISSIONS.SALES_VIEW,
    PERMISSIONS.SALES_CREATE,
    
    // POS Access
    PERMISSIONS.POS_ACCESS,
    PERMISSIONS.POS_CREATE_SALE,
    PERMISSIONS.POS_VIEW_SALES,
    
    // Inventory (own company)
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.INVENTORY_UPDATE,
    PERMISSIONS.INVENTORY_MANAGE,
    
    // Audit Logs (own company)
    PERMISSIONS.AUDIT_LOGS_VIEW_OWN,
    PERMISSIONS.AUDIT_LOGS_VIEW,
    
    // Analytics (own company)
    PERMISSIONS.ANALYTICS_VIEW_OWN,
    PERMISSIONS.ANALYTICS_VIEW,
    
    // Settings (own company)
    PERMISSIONS.SETTINGS_VIEW_OWN,
    PERMISSIONS.SETTINGS_UPDATE,
    PERMISSIONS.SETTINGS_MANAGE,
    
    // 2FA
    PERMISSIONS.TWO_FA_ENABLE,
    PERMISSIONS.TWO_FA_DISABLE,
    PERMISSIONS.TWO_FA_MANAGE,
  ],

  [ROLES.STORE_OWNER]: [
    // Store Management (own store)
    PERMISSIONS.STORES_VIEW_ASSIGNED,
    PERMISSIONS.STORES_UPDATE, // Can update own store
    
    // Manager Management (own store's managers)
    PERMISSIONS.MANAGERS_VIEW_OWN,
    PERMISSIONS.MANAGERS_CREATE,
    PERMISSIONS.MANAGERS_UPDATE,
    PERMISSIONS.MANAGERS_DELETE,
    PERMISSIONS.MANAGERS_MANAGE,
    
    // Product Management (own store's products)
    PERMISSIONS.PRODUCTS_VIEW_ASSIGNED,
    PERMISSIONS.PRODUCTS_CREATE,
    PERMISSIONS.PRODUCTS_UPDATE,
    PERMISSIONS.PRODUCTS_DELETE,
    PERMISSIONS.PRODUCTS_MANAGE,
    
    // Product Batches
    PERMISSIONS.PRODUCT_BATCHES_VIEW,
    PERMISSIONS.PRODUCT_BATCHES_CREATE,
    PERMISSIONS.PRODUCT_BATCHES_UPDATE,
    PERMISSIONS.PRODUCT_BATCHES_DELETE,
    PERMISSIONS.PRODUCT_BATCHES_MANAGE,
    
    // Sales (own store's sales)
    PERMISSIONS.SALES_VIEW_ASSIGNED,
    PERMISSIONS.SALES_VIEW,
    PERMISSIONS.SALES_CREATE,
    
    // POS Access
    PERMISSIONS.POS_ACCESS,
    PERMISSIONS.POS_CREATE_SALE,
    PERMISSIONS.POS_VIEW_SALES,
    
    // Inventory (own store)
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.INVENTORY_UPDATE,
    PERMISSIONS.INVENTORY_MANAGE,
    
    // Audit Logs (own store)
    PERMISSIONS.AUDIT_LOGS_VIEW_ASSIGNED,
    PERMISSIONS.AUDIT_LOGS_VIEW,
    
    // Analytics (own store)
    PERMISSIONS.ANALYTICS_VIEW_ASSIGNED,
    PERMISSIONS.ANALYTICS_VIEW,
    
    // Settings (own store)
    PERMISSIONS.SETTINGS_VIEW_OWN,
    PERMISSIONS.SETTINGS_UPDATE,
    PERMISSIONS.SETTINGS_MANAGE,
    
    // 2FA
    PERMISSIONS.TWO_FA_ENABLE,
    PERMISSIONS.TWO_FA_DISABLE,
    PERMISSIONS.TWO_FA_MANAGE,
  ],

  [ROLES.MANAGER]: [
    // Product Management (assigned store's products - read only mostly)
    PERMISSIONS.PRODUCTS_VIEW_ASSIGNED,
    PERMISSIONS.PRODUCTS_VIEW,
    
    // Product Batches (view only)
    PERMISSIONS.PRODUCT_BATCHES_VIEW,
    
    // Sales (assigned store's sales)
    PERMISSIONS.SALES_VIEW_ASSIGNED,
    PERMISSIONS.SALES_VIEW,
    PERMISSIONS.SALES_CREATE,
    
    // POS Access
    PERMISSIONS.POS_ACCESS,
    PERMISSIONS.POS_CREATE_SALE,
    PERMISSIONS.POS_VIEW_SALES,
    
    // Inventory (assigned store - view only)
    PERMISSIONS.INVENTORY_VIEW,
    
    // Analytics (assigned store)
    PERMISSIONS.ANALYTICS_VIEW_ASSIGNED,
    PERMISSIONS.ANALYTICS_VIEW,
    
    // Settings (view only)
    PERMISSIONS.SETTINGS_VIEW_OWN,
    
    // 2FA
    PERMISSIONS.TWO_FA_ENABLE,
    PERMISSIONS.TWO_FA_DISABLE,
    PERMISSIONS.TWO_FA_MANAGE,
  ],
};

/**
 * Get all permissions for a role
 */
export function getPermissionsForRole(role: string): Permission[] {
  const normalizedRole = role.toLowerCase();
  return ROLE_PERMISSIONS[normalizedRole as Role] || [];
}

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: string, permission: Permission): boolean {
  const permissions = getPermissionsForRole(role);
  return permissions.includes(permission);
}

/**
 * Check if a role has any of the specified permissions
 */
export function hasAnyPermission(role: string, permissions: Permission[]): boolean {
  return permissions.some(permission => hasPermission(role, permission));
}

/**
 * Check if a role has all of the specified permissions
 */
export function hasAllPermissions(role: string, permissions: Permission[]): boolean {
  return permissions.every(permission => hasPermission(role, permission));
}

