import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Store, DollarSign, Activity } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function AnalyticsCards() {
  const { data: analytics, isLoading } = useQuery({
    queryKey: ["/api/analytics"],
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="border-slate-200">
            <CardContent className="p-6">
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const cards = [
    {
      title: "Total Users",
      value: analytics?.totalUsers || 0,
      icon: Users,
      bgColor: "bg-blue-50",
      iconColor: "text-primary",
      change: "+12.5%",
    },
    {
      title: "Active Stores",
      value: analytics?.activeStores || 0,
      icon: Store,
      bgColor: "bg-emerald-50",
      iconColor: "text-accent",
      change: "+8.2%",
    },
    {
      title: "Monthly Revenue",
      value: "$84,532",
      icon: DollarSign,
      bgColor: "bg-amber-50",
      iconColor: "text-amber-500",
      change: "+15.3%",
    },
    {
      title: "System Uptime",
      value: "99.98%",
      icon: Activity,
      bgColor: "bg-green-50",
      iconColor: "text-green-500",
      change: "All systems operational",
      isUptime: true,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
      {cards.map((card, index) => {
        const gradients = [
          "bg-gradient-to-br from-blue-500 to-blue-600",
          "bg-gradient-to-br from-emerald-500 to-teal-600", 
          "bg-gradient-to-br from-amber-500 to-orange-600",
          "bg-gradient-to-br from-green-500 to-emerald-600"
        ];
        
        return (
          <Card key={card.title} className="border-0 bg-white/60 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 overflow-hidden">
            <CardContent className="p-6 relative">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <dt className="text-sm font-medium text-slate-600 mb-1">{card.title}</dt>
                  <dd className="text-2xl font-bold text-slate-900">{card.value}</dd>
                  <div className="mt-3 flex items-center text-sm">
                    <span className={`font-medium ${card.isUptime ? 'text-green-600' : 'text-blue-600'}`}>
                      {card.change}
                    </span>
                    {!card.isUptime && (
                      <span className="text-slate-500 ml-2">from last month</span>
                    )}
                  </div>
                </div>
                <div className={`w-12 h-12 ${gradients[index]} rounded-xl flex items-center justify-center shadow-lg`}>
                  <card.icon className="text-white h-6 w-6" />
                </div>
              </div>
              
              {/* Decorative gradient overlay */}
              <div className="absolute top-0 right-0 w-16 h-16 opacity-5">
                <div className={`w-full h-full ${gradients[index]} rounded-bl-3xl`}></div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
