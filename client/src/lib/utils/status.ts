import { BadgeProps } from "@/components/ui/badge";

/**
 * Get badge variant based on status
 * @param status - Status string (active, inactive, etc.)
 * @returns Badge variant
 */
export function getStatusBadgeVariant(status: string | boolean): BadgeProps["variant"] {
  if (typeof status === "boolean") {
    return status ? "default" : "secondary";
  }
  
  const normalizedStatus = status.toLowerCase();
  switch (normalizedStatus) {
    case "active":
    case "enabled":
    case "true":
      return "default";
    case "inactive":
    case "disabled":
    case "false":
      return "secondary";
    case "pending":
      return "outline";
    case "error":
    case "failed":
      return "destructive";
    default:
      return "secondary";
  }
}

/**
 * Get status text from boolean or string
 * @param status - Status value
 * @returns Status text
 */
export function getStatusText(status: string | boolean): string {
  if (typeof status === "boolean") {
    return status ? "Active" : "Inactive";
  }
  
  const normalizedStatus = status.toLowerCase();
  switch (normalizedStatus) {
    case "active":
    case "enabled":
    case "true":
      return "Active";
    case "inactive":
    case "disabled":
    case "false":
      return "Inactive";
    default:
      return status;
  }
}

/**
 * Get status color class
 * @param status - Status string
 * @returns Tailwind color class
 */
export function getStatusColor(status: string | boolean): string {
  if (typeof status === "boolean") {
    return status ? "text-green-600" : "text-gray-600";
  }
  
  const normalizedStatus = status.toLowerCase();
  switch (normalizedStatus) {
    case "active":
    case "enabled":
      return "text-green-600";
    case "inactive":
    case "disabled":
      return "text-gray-600";
    case "pending":
      return "text-yellow-600";
    case "error":
    case "failed":
      return "text-red-600";
    default:
      return "text-gray-600";
  }
}

/**
 * Get role badge color class
 * @param role - User role
 * @returns Tailwind color class
 */
export function getRoleBadgeColor(role: string): string {
  switch (role) {
    case "super_admin":
      return "bg-red-100 text-red-800";
    case "store_owner":
      return "bg-green-100 text-green-800";
    case "company_admin":
      return "bg-blue-100 text-blue-800";
    case "manager":
      return "bg-purple-100 text-purple-800";
    default:
      return "bg-slate-100 text-slate-800";
  }
}

