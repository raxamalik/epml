import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Mail, UserPlus, Store, Settings, CheckCircle2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { enUS, cs } from "date-fns/locale";
import { useTranslation } from "@/hooks/useTranslation";
import { apiRequest } from "@/lib/queryClient";

export function RecentActivity() {
  const { t, currentLanguage } = useTranslation();
  const { data: activities, isLoading } = useQuery({
    queryKey: ["/api/audit-logs", "super-admin"],
    queryFn: async () => {
      // Fetch audit logs filtered for super admin activities (company creation, invitations)
      const res = await apiRequest('GET', '/api/audit-logs?limit=100');
      const data = await res.json();
      // Filter for company-related actions performed by super admins or portal admins
      const filtered = (data.data || []).filter((log: any) => {
        // Check if it's a company-related action
        const isCompanyAction = 
          log.action === 'company_create' || 
          log.action === 'send_company_invitation' ||
          log.action === 'company_activate' ||
          log.action === 'company_update' ||
          log.entityType === 'company' ||
          log.entityType === 'company_invitation' ||
          (log.action && (
            log.action.includes('company') || 
            log.action.includes('invitation') ||
            log.action.includes('invite')
          ));
        
        // Only show activities from super admins or portal admins
        const isSuperAdminActivity = 
          log.userRole === 'super_admin' || 
          log.userRole === 'portal_admin';
        
        return isCompanyAction && isSuperAdminActivity;
      });
      
      // Sort by date and take the 10 most recent
      return filtered
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 10)
        .map((log: any) => ({
          id: log.id,
          type: log.action,
          description: log.description,
          userId: log.userId,
          userEmail: log.userEmail,
          userRole: log.userRole,
          createdAt: log.createdAt,
          metadata: log.metadata || {}
        }));
    },
  });

  if (isLoading) {
    return (
      <Card className="lg:col-span-2 border-slate-200">
        <CardHeader>
          <CardTitle>{t("dashboard.recentActivity")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'company_create':
        return Building2;
      case 'send_company_invitation':
        return Mail;
      case 'company_activate':
        return CheckCircle2;
      case 'user_registered':
      case 'user_role_updated':
        return UserPlus;
      case 'store_created':
        return Store;
      default:
        return Settings;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'company_create':
        return 'bg-gradient-to-r from-purple-500 to-indigo-600';
      case 'send_company_invitation':
        return 'bg-gradient-to-r from-blue-500 to-cyan-600';
      case 'company_activate':
        return 'bg-gradient-to-r from-green-500 to-emerald-600';
      case 'user_registered':
      case 'user_role_updated':
        return 'bg-gradient-to-r from-green-500 to-emerald-600';
      case 'store_created':
        return 'bg-gradient-to-r from-blue-500 to-indigo-600';
      default:
        return 'bg-gradient-to-r from-amber-500 to-orange-600';
    }
  };

  return (
    <Card className="lg:col-span-2 border-0 bg-white/60 backdrop-blur-sm shadow-lg">
      <CardHeader className="pb-4">
        <CardTitle className="text-slate-800 font-semibold">{t("dashboard.recentActivity")}</CardTitle>
      </CardHeader>
      <CardContent>
        {!activities || activities.length === 0 ? (
          <div className="text-center py-8">
            <Settings className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-500">{t("dashboard.recentActivityEmpty")}</p>
          </div>
        ) : (
          <div className="flow-root">
            <ul className="-mb-6">
              {activities.map((activity: any, index: number) => {
                const Icon = getActivityIcon(activity.type);
                const isLast = index === activities.length - 1;
                
                return (
                  <li key={activity.id} className="relative pb-6">
                    {!isLast && (
                      <div className="absolute top-2 left-8 -ml-px h-full w-0.5 bg-gradient-to-b from-slate-300 to-slate-100"></div>
                    )}
                    <div className="relative flex space-x-3">
                      <div>
                        <span className={`h-8 w-8 rounded-full ${getActivityColor(activity.type)} flex items-center justify-center ring-4 ring-white shadow-lg`}>
                          <Icon className="text-white h-4 w-4" />
                        </span>
                      </div>
                      <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                        <div>
                          <p className="text-sm font-medium text-slate-900">{activity.description}</p>
                          {activity.metadata?.storeName && (
                            <p className="text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded-md inline-block mt-1">
                              {t("dashboard.recentUsers.store")}: {activity.metadata.storeName}
                            </p>
                          )}
                          {activity.metadata?.companyName && (
                            <p className="text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded-md inline-block mt-1">
                              {t("dashboard.recentActivity.company")}: {activity.metadata.companyName}
                            </p>
                          )}
                        </div>
                        <div className="text-right text-xs text-slate-500 bg-slate-50 px-2 py-1 rounded-lg">
                          {formatDistanceToNow(new Date(activity.createdAt), { 
                            addSuffix: true,
                            locale: currentLanguage === 'cz' ? cs : enUS
                          })}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
