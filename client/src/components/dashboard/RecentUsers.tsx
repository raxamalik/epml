import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { Edit } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";

export function RecentUsers() {
  const { user: currentUser } = useAuth();
  const [, setLocation] = useLocation();
  const { data: users, isLoading, error } = useQuery({
    queryKey: ["/api/users"],
    enabled: currentUser?.role === "super_admin",
    retry: false,
    refetchOnWindowFocus: false,
  });

  if (currentUser?.role !== "super_admin") {
    return null;
  }

  if (isLoading) {
    return (
      <Card className="mt-8 border-slate-200">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Users</CardTitle>
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

  const recentUsers = Array.isArray(users) ? users.slice(0, 5) : [];

  // Handle empty user data gracefully
  if (!users || users.length === 0) {
    return (
      <Card className="mt-8 border-0 bg-white/60 backdrop-blur-sm shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-slate-800 font-semibold">Recent Users</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 bg-gradient-to-br from-slate-50 to-blue-50 rounded-xl">
            <p className="text-slate-600 font-medium">No users found in the system.</p>
            <p className="text-sm text-slate-500 mt-2">Users will appear here once they register.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "super_admin":
        return "bg-gradient-to-r from-purple-500 to-indigo-600 text-white";
      case "store_owner":
        return "bg-gradient-to-r from-emerald-500 to-teal-600 text-white";
      case "manager":
        return "bg-gradient-to-r from-blue-500 to-cyan-600 text-white";
      default:
        return "bg-gradient-to-r from-slate-500 to-gray-600 text-white";
    }
  };

  return (
    <Card className="mt-8 border-0 bg-white/60 backdrop-blur-sm shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="text-slate-800 font-semibold">Recent Users</CardTitle>
        <Button 
          variant="link" 
          size="sm" 
          onClick={() => setLocation("/users")}
          className="bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent hover:from-blue-600 hover:to-purple-700 font-semibold"
          data-testid="button-view-all-users"
        >
          View all
        </Button>
      </CardHeader>
      <CardContent>
        <div className="overflow-hidden rounded-xl">
          <table className="min-w-full">
            <thead className="bg-gradient-to-r from-slate-50 to-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Store
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Joined
                </th>
                <th className="relative px-6 py-4">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentUsers.map((user: any, index: number) => (
                <tr key={user.id} className={`hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all duration-200 ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <ProfileAvatar
                        user={user}
                        size="lg"
                        showBorder={true}
                      />
                      <div className="ml-4">
                        <div className="text-sm font-semibold text-slate-900">
                          {user.firstName || user.email}
                        </div>
                        <div className="text-sm text-slate-600">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge className={`${getRoleBadgeColor(user.role)} font-semibold shadow-sm border-0`}>
                      {user.role?.replace('_', ' ')}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-700">
                    {user.store?.name || "No store assigned"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge className={`font-semibold shadow-sm border-0 ${user.isActive ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white" : "bg-gradient-to-r from-red-500 to-rose-600 text-white"}`}>
                      {user.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-medium">
                    {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setLocation("/users")}
                      className="hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 rounded-lg"
                      data-testid={`button-edit-user-${user.id}`}
                    >
                      <Edit className="h-4 w-4 text-blue-600" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
