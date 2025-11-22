import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserPlus, Store, Settings } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";

export function RecentActivity() {
  const { data: activities, isLoading } = useQuery({
    queryKey: ["/api/activities"],
  });

  if (isLoading) {
    return (
      <Card className="lg:col-span-2 border-slate-200">
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
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
        <CardTitle className="text-slate-800 font-semibold">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flow-root">
          <ul className="-mb-6">
            {activities?.map((activity: any, index: number) => {
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
                            Store: {activity.metadata.storeName}
                          </p>
                        )}
                      </div>
                      <div className="text-right text-xs text-slate-500 bg-slate-50 px-2 py-1 rounded-lg">
                        {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
