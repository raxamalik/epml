import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { 
  Home, 
  Store, 
  Users, 
  BarChart3, 
  Settings,
  Building,
  Building2,
  ShoppingCart,
  Package,
  ClipboardList,
  History,
  FileText
} from "lucide-react";

const adminNavigation = [
  { name: "Dashboard", href: "/", icon: Home, roles: ["super_admin", "store_owner", "manager"] },
  { name: "Company Management", href: "/companies", icon: Building2, roles: ["super_admin"] },
  { name: "User Management", href: "/users", icon: Users, roles: ["super_admin"] },
  { name: "Store Management", href: "/stores", icon: Store, roles: ["store_owner"] },
  { name: "Audit Logs", href: "/audit-logs", icon: FileText, roles: ["super_admin", "company_admin", "store_owner"] },
  { name: "Analytics", href: "/analytics", icon: BarChart3, roles: ["store_owner", "manager"] },
  { name: "Settings", href: "/settings", icon: Settings, roles: ["super_admin", "store_owner", "manager"] },
];

const companyNavigation = [
  { name: "Dashboard", href: "/", icon: Home },
  { name: "My Stores", href: "/stores", icon: Store },
  { name: "Managers", href: "/managers", icon: Users },
  { name: "Audit Logs", href: "/audit-logs", icon: FileText },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
  { name: "Settings", href: "/settings", icon: Settings },
];

const managerNavigation = [
  { name: "Dashboard", href: "/", icon: Home },
  { name: "POS", href: "/manager/pos", icon: ShoppingCart },
  { name: "Products", href: "/manager/products", icon: Package },
  { name: "Inventory", href: "/manager/inventory", icon: ClipboardList },
  { name: "Sales History", href: "/manager/sales-history", icon: History },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const [location] = useLocation();
  const { user } = useAuth();

  // Determine navigation based on user role
  const getNavigation = () => {
    if (user?.type === 'company' || user?.role === 'company_admin') {
      return companyNavigation;
    } else if (user?.role === 'manager') {
      return managerNavigation;
    } else {
      return adminNavigation.filter(item => 
        user?.role && item.roles.includes(user.role)
      );
    }
  };
  
  const filteredNavigation = getNavigation();

  return (
    <div className="hidden lg:flex lg:flex-shrink-0">
      <div className="flex flex-col w-64">
        <div className="flex flex-col flex-grow bg-white border-r border-slate-200 pt-5 pb-4 overflow-y-auto">
          {/* Logo Section */}
          <div className="flex items-center flex-shrink-0 px-6">
            <div className="flex items-center">
              <div className="bg-primary rounded-lg p-2">
                <Building className="h-6 w-6 text-white" />
              </div>
              <h1 className="ml-3 text-xl font-bold text-slate-900">EPML</h1>
            </div>
          </div>
          
          {/* Navigation Menu */}
          <nav className="mt-8 flex-1 px-4 space-y-1">
            {filteredNavigation.map((item) => {
              // Exact match for active state to prevent multiple active items
              const isActive = location === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                    isActive
                      ? "bg-primary text-white"
                      : "text-slate-700 hover:bg-slate-100"
                  )}
                >
                  <item.icon className={cn(
                    "mr-3 h-5 w-5",
                    isActive ? "text-white" : "text-slate-400"
                  )} />
                  {item.name}
                </Link>
              );
            })}
          </nav>
          
          {/* User Profile Section */}
          <div className="flex-shrink-0 border-t border-slate-200 p-4">
            <div className="flex items-center">
              <ProfileAvatar
                user={user}
                size="lg"
                showBorder={true}
              />
              <div className="ml-3">
                <p className="text-sm font-medium text-slate-700">
                  {user?.firstName || user?.email || "User"}
                </p>
                <p className="text-xs text-slate-500 capitalize">
                  {user?.role?.replace('_', ' ') || "Loading..."}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
