import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/hooks/useTranslation";

export function UserRoles() {
  const { t } = useTranslation();
  const { data: analytics, isLoading } = useQuery<{
    superAdmins?: number;
    portalAdmins?: number;
    companyAdmins?: number;
    storeOwners?: number;
    managers?: number;
    totalUsers?: number;
    activeStores?: number;
    totalStores?: number;
  }>({
    queryKey: ["/api/analytics"],
  });

  if (isLoading) {
    return (
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle>{t("dashboard.userRoles.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const roles = [
    {
      name: t("dashboard.userRoles.superAdmin"),
      count: analytics?.superAdmins || 0,
      gradient: "bg-gradient-to-r from-purple-500 to-indigo-600",
      bgGradient: "bg-gradient-to-r from-purple-50 to-indigo-50",
    },
    {
      name: t("dashboard.userRoles.portalAdmin"),
      count: analytics?.portalAdmins || 0,
      gradient: "bg-gradient-to-r from-violet-500 to-purple-600",
      bgGradient: "bg-gradient-to-r from-violet-50 to-purple-50",
    },
    {
      name: t("dashboard.userRoles.companyAdmin"),
      count: analytics?.companyAdmins || 0,
      gradient: "bg-gradient-to-r from-emerald-500 to-teal-600",
      bgGradient: "bg-gradient-to-r from-emerald-50 to-teal-50",
    },
    {
      name: t("dashboard.userRoles.storeOwner"),
      count: analytics?.storeOwners || 0,
      gradient: "bg-gradient-to-r from-blue-500 to-cyan-600",
      bgGradient: "bg-gradient-to-r from-blue-50 to-cyan-50",
    },
    {
      name: t("dashboard.userRoles.manager"),
      count: analytics?.managers || 0,
      gradient: "bg-gradient-to-r from-amber-500 to-orange-600",
      bgGradient: "bg-gradient-to-r from-amber-50 to-orange-50",
    },
  ];

  return (
    <Card className="border-0 bg-white/60 backdrop-blur-sm shadow-lg">
      <CardHeader className="pb-4">
        <CardTitle className="text-slate-800 font-semibold">{t("dashboard.userRoles.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {roles.map((role) => (
            <div key={role.name} className={`p-3 rounded-lg ${role.bgGradient} transition-all duration-200 hover:scale-105 border border-white/50`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className={`w-4 h-4 rounded-full ${role.gradient} mr-3 shadow-sm`}></div>
                  <span className="text-sm font-medium text-slate-700">{role.name}</span>
                </div>
                <div className={`px-3 py-1 ${role.gradient} text-white text-sm font-bold rounded-full shadow-sm`}>
                  {role.count}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
