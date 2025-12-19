import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { Logo } from "@/components/ui/Logo";
import { 
  Home, 
  Store, 
  Users, 
  BarChart3, 
  Settings,
  Building2,
  ShoppingCart,
  Package,
  ClipboardList,
  History,
  FileText,
  Tag,
  FlaskConical,
  RotateCcw,
  ArrowUpDown,
  Shield,
  Download
} from "lucide-react";

const adminNavigation = [
  { nameKey: "navigation.dashboard", href: "/", icon: Home, roles: ["super_admin", "portal_admin", "store_owner", "manager"] },
  { nameKey: "navigation.companyManagement", href: "/companies", icon: Building2, roles: ["super_admin", "portal_admin"] },
  { nameKey: "navigation.users", href: "/users", icon: Users, roles: ["super_admin", "portal_admin"] },
  { nameKey: "navigation.portalAdmins", href: "/portal-admins", icon: Shield, roles: ["super_admin"] },
  { nameKey: "navigation.activeSubstances", href: "/active-substances", icon: FlaskConical, roles: ["super_admin", "portal_admin"] },
  { nameKey: "navigation.stores", href: "/stores", icon: Store, roles: ["company_admin"] },
  { nameKey: "navigation.auditLogs", href: "/audit-logs", icon: FileText, roles: ["super_admin", "portal_admin", "company_admin", "store_owner"] },
  { nameKey: "navigation.analytics", href: "/analytics", icon: BarChart3, roles: ["store_owner", "manager"] },
  { nameKey: "navigation.settings", href: "/settings", icon: Settings, roles: ["super_admin", "portal_admin", "store_owner", "manager"] },
];

const storeOwnerNavigation = [
  { nameKey: "navigation.dashboard", href: "/", icon: Home },
  { nameKey: "navigation.myStore", href: "/store-owner/store", icon: Store },
  { nameKey: "navigation.managers", href: "/store-owner/managers", icon: Users },
  { nameKey: "navigation.categories", href: "/categories", icon: Tag },
  { nameKey: "navigation.products", href: "/products", icon: Package },
  { nameKey: "navigation.inventory", href: "/inventory", icon: ClipboardList },
  { nameKey: "navigation.salesHistory", href: "/sales-history", icon: History },
  { nameKey: "navigation.returnsHistory", href: "/returns-history", icon: RotateCcw },
  { nameKey: "navigation.stockTransactions", href: "/stock-transactions", icon: ArrowUpDown },
  { nameKey: "navigation.exports", href: "/exports", icon: Download },
  { nameKey: "navigation.auditLogs", href: "/audit-logs", icon: FileText },
  { nameKey: "navigation.analytics", href: "/analytics", icon: BarChart3 },
  { nameKey: "navigation.settings", href: "/settings", icon: Settings },
];

const companyNavigation = [
  { nameKey: "navigation.dashboard", href: "/", icon: Home },
  { nameKey: "navigation.myStores", href: "/stores", icon: Store },
  { nameKey: "navigation.categories", href: "/categories", icon: Tag },
  { nameKey: "navigation.products", href: "/products", icon: Package },
  { nameKey: "navigation.managers", href: "/managers", icon: Users },
  { nameKey: "navigation.exports", href: "/exports", icon: Download },
  { nameKey: "navigation.auditLogs", href: "/audit-logs", icon: FileText },
  { nameKey: "navigation.analytics", href: "/analytics", icon: BarChart3 },
  { nameKey: "navigation.settings", href: "/settings", icon: Settings },
];

const managerNavigation = [
  { nameKey: "navigation.dashboard", href: "/", icon: Home },
  { nameKey: "navigation.pos", href: "/manager/pos", icon: ShoppingCart },
  { nameKey: "navigation.inventory", href: "/inventory", icon: ClipboardList },
  { nameKey: "navigation.salesHistory", href: "/sales-history", icon: History },
  { nameKey: "navigation.returnsHistory", href: "/returns-history", icon: RotateCcw },
  { nameKey: "navigation.stockTransactions", href: "/stock-transactions", icon: ArrowUpDown },
  { nameKey: "navigation.exports", href: "/exports", icon: Download },
  { nameKey: "navigation.analytics", href: "/analytics", icon: BarChart3 },
  { nameKey: "navigation.settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const { t } = useTranslation();

  // Determine navigation based on user role
  const getNavigation = () => {
    if (user?.type === 'company' || user?.role === 'company_admin') {
      return companyNavigation;
    } else if (user?.role === 'manager') {
      return managerNavigation;
    } else if (user?.role === 'store_owner') {
      return storeOwnerNavigation;
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
              <Logo className="h-8" width={100} height={58} />
            </div>
          </div>
          
          {/* Navigation Menu */}
          <nav className="mt-8 flex-1 px-4 space-y-1">
            {filteredNavigation.map((item, index) => {
              // Exact match for active state to prevent multiple active items
              const isActive = location === item.href;
              return (
                <Link
                  key={index}
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
                  {t(item.nameKey)}
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
                  {user?.firstName || user?.email || t("sidebar.defaultUser")}
                </p>
                <p className="text-xs text-slate-500 capitalize">
                  {user?.role?.replace('_', ' ') || t("sidebar.loading")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
