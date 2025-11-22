import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function UserRoles() {
  const { data: analytics, isLoading } = useQuery({
    queryKey: ["/api/analytics"],
  });

  if (isLoading) {
    return (
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle>User Roles</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const roles = [
    {
      name: "Super Admins",
      count: analytics?.superAdmins || 0,
      gradient: "bg-gradient-to-r from-purple-500 to-indigo-600",
      bgGradient: "bg-gradient-to-r from-purple-50 to-indigo-50",
    },
    {
      name: "Store Owners",
      count: analytics?.storeOwners || 0,
      gradient: "bg-gradient-to-r from-blue-500 to-cyan-600",
      bgGradient: "bg-gradient-to-r from-blue-50 to-cyan-50",
    },
    {
      name: "Managers",
      count: analytics?.managers || 0,
      gradient: "bg-gradient-to-r from-amber-500 to-orange-600",
      bgGradient: "bg-gradient-to-r from-amber-50 to-orange-50",
    },
    {
      name: "Regular Users",
      count: (analytics?.totalUsers || 0) - (analytics?.superAdmins || 0) - (analytics?.storeOwners || 0) - (analytics?.managers || 0),
      gradient: "bg-gradient-to-r from-slate-500 to-gray-600",
      bgGradient: "bg-gradient-to-r from-slate-50 to-gray-50",
    },
  ];

  return (
    <Card className="border-0 bg-white/60 backdrop-blur-sm shadow-lg">
      <CardHeader className="pb-4">
        <CardTitle className="text-slate-800 font-semibold">User Roles</CardTitle>
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
