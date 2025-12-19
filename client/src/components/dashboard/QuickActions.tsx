import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserPlus, BarChart3, Settings } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/hooks/useTranslation";

export function QuickActions() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { t } = useTranslation();

  const actions = [
    {
      title: t("quickActions.addUser"),
      icon: UserPlus,
      onClick: () => setLocation("/portal-admins"),
      roles: ["super_admin"],
    },
    {
      title: t("quickActions.viewAnalytics"),
      icon: BarChart3,
      onClick: () => setLocation("/analytics"),
      roles: ["store_owner", "manager"],
    },
    {
      title: t("quickActions.systemSettings"),
      icon: Settings,
      onClick: () => setLocation("/settings"),
      roles: ["super_admin", "portal_admin", "store_owner", "manager"],
    },
  ];

  const availableActions = actions.filter(action => 
    user?.role && action.roles.includes(user.role)
  );

  return (
    <>
      <Card className="border-0 bg-white/60 backdrop-blur-sm shadow-lg">
        <CardHeader className="pb-4">
          <CardTitle className="text-slate-800 font-semibold">{t("quickActions.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {availableActions.map((action, index) => {
            const gradients = [
              "bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700",
              "bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700",
              "bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700",
              "bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700"
            ];
            
            return (
              <Button
                key={action.title}
                onClick={action.onClick}
                className={`w-full justify-start text-white border-0 shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 ${gradients[index % gradients.length]}`}
              >
                <action.icon className="mr-3 h-4 w-4" />
                {action.title}
              </Button>
            );
          })}
        </CardContent>
      </Card>
    </>
  );
}
