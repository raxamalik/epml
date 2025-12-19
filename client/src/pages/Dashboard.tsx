import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/hooks/useTranslation";
import { AnalyticsCards } from "@/components/dashboard/AnalyticsCards";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { UserRoles } from "@/components/dashboard/UserRoles";
import { RecentUsers } from "@/components/dashboard/RecentUsers";
import { Shield, BarChart3, Users, Settings } from "lucide-react";

export default function Dashboard() {
  const { user } = useAuth();
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-6 space-y-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Analytics Cards */}
        <AnalyticsCards />

        {/* Main Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Activity */}
          <RecentActivity />

          {/* Quick Actions & Stats */}
          <div className="space-y-6">
            <QuickActions />
            <UserRoles />
          </div>
        </div>

        {/* Recent Users Table */}
        <RecentUsers />
      </div>
    </div>
  );
}
