import { useAuth } from "@/hooks/useAuth";
import { AnalyticsCards } from "@/components/dashboard/AnalyticsCards";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { UserRoles } from "@/components/dashboard/UserRoles";
import { RecentUsers } from "@/components/dashboard/RecentUsers";
import { Shield, BarChart3, Users, Settings } from "lucide-react";

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-6 space-y-8">
      {/* Compact Modern Header with Gradient */}
      <div className="relative">
        <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-xl p-6 text-white shadow-xl">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                  <Shield className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">Super Admin Dashboard</h1>
                  <p className="text-indigo-100 text-sm">
                    Complete platform oversight and management
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-sm">System Active</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span className="text-sm">All Users & Companies</span>
                </div>
                <div className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  <span className="text-sm">Full Access Control</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="hidden lg:block">
                <div className="relative">
                  <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
                    <BarChart3 className="h-8 w-8 text-white/80" />
                  </div>
                </div>
              </div>
              
              {/* Manager Dashboard Button */}
              <a 
                href="/manager" 
                className="bg-white/20 hover:bg-white/30 text-white font-semibold px-4 py-2 rounded-lg backdrop-blur-sm border border-white/30 transition-all duration-200 hover:scale-105 inline-flex items-center gap-2"
              >
                🏪 Manager Dashboard
              </a>
            </div>
          </div>
        </div>
      </div>

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
