import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  BarChart3, 
  PieChart, 
  TrendingUp, 
  Users, 
  Store, 
  DollarSign,
  ShoppingCart,
  Activity
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart,
} from "recharts";
import { useTranslation } from "@/hooks/useTranslation";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"];

export default function Analytics() {
  const { t } = useTranslation();
  const { data: stores = [], isLoading: storesLoading } = useQuery<any[]>({
    queryKey: ["/api/company/stores"],
  });

  const { data: analytics = {}, isLoading: analyticsLoading } = useQuery<any>({
    queryKey: ["/api/company/analytics"],
  });

  if (storesLoading || analyticsLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {t("analyticsDashboard.header.title")}
          </h1>
          <p className="text-slate-600">
            {t("analyticsDashboard.header.subtitle")}
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-80 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Prepare chart data
  const revenueChartData = stores?.map((store: any) => ({
    name: store.name.length > 12 ? store.name.substring(0, 12) + "..." : store.name,
    revenue: store.revenue || 0,
    customers: store.customerCount || 0,
    products: store.productCount || 0,
  })) || [];

  const statusPieData = [
    {
      name: t("analyticsDashboard.status.active"),
      value: analytics?.activeStores || 0,
    },
    {
      name: t("analyticsDashboard.status.inactive"),
      value: (analytics?.totalStores || 0) - (analytics?.activeStores || 0),
    },
  ];

  // Monthly performance data (simulated for demonstration)
  const monthlyData = [
    { month: t("analyticsDashboard.months.jan"), revenue: 45000, customers: 1200, orders: 890 },
    { month: t("analyticsDashboard.months.feb"), revenue: 52000, customers: 1350, orders: 980 },
    { month: t("analyticsDashboard.months.mar"), revenue: 48000, customers: 1280, orders: 920 },
    { month: t("analyticsDashboard.months.apr"), revenue: 61000, customers: 1450, orders: 1150 },
    { month: t("analyticsDashboard.months.may"), revenue: 58000, customers: 1380, orders: 1080 },
    { month: t("analyticsDashboard.months.jun"), revenue: 67000, customers: 1520, orders: 1220 },
  ];

  const topPerformingStores = stores?.slice(0, 5).map((store: any) => ({
    ...store,
    performance: ((store.revenue || 0) / 1000).toFixed(1)
  })) || [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          {t("analyticsDashboard.header.title")}
        </h1>
        <p className="text-slate-600 mt-2">
          {t("analyticsDashboard.header.subtitle")}
        </p>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("analyticsDashboard.cards.totalRevenue")}
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              €{analytics?.totalRevenue?.toLocaleString() || "0"}
            </div>
            <p className="text-xs text-muted-foreground">
              {t("analyticsDashboard.cards.monthlyGrowth", {
                value: analytics?.monthlyGrowth || 0,
              })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("analyticsDashboard.cards.activeStores")}
            </CardTitle>
            <Store className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.activeStores || 0}</div>
            <p className="text-xs text-muted-foreground">
              {t("analyticsDashboard.cards.totalStores", {
                count: analytics?.totalStores || 0,
              })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("analyticsDashboard.cards.totalProducts")}
            </CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics?.totalProducts?.toLocaleString() || "0"}
            </div>
            <p className="text-xs text-muted-foreground">
              {t("analyticsDashboard.cards.acrossStores")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("analyticsDashboard.cards.totalCustomers")}
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics?.totalCustomers?.toLocaleString() || "0"}
            </div>
            <p className="text-xs text-muted-foreground">
              {t("analyticsDashboard.cards.customerBase")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Comparison Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              {t("analyticsDashboard.charts.revenueComparison")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 12 }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => `€${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip 
                    formatter={(value, name) => [
                      `€${Number(value).toLocaleString()}`, 
                      name === 'revenue' ? 'Revenue' : name
                    ]}
                  />
                  <Bar dataKey="revenue" fill="#0088FE" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Store Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              {t("analyticsDashboard.charts.statusDistribution")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie 
                    data={statusPieData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {statusPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Performance Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              {t("analyticsDashboard.charts.monthlyPerformance")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={(value) => `€${(value / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value, name) => [`€${Number(value).toLocaleString()}`, name]} />
                  <Area type="monotone" dataKey="revenue" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Customer vs Products */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {t("analyticsDashboard.charts.customersVsProducts")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 12 }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="customers" fill="#00C49F" name="Customers" />
                  <Bar dataKey="products" fill="#FFBB28" name="Products" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Performing Stores */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            {t("analyticsDashboard.topStores.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {topPerformingStores.map((store: any, index: number) => (
              <div key={store.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center justify-center w-8 h-8 bg-primary/10 rounded-full">
                    <span className="text-sm font-semibold text-primary">#{index + 1}</span>
                  </div>
                  <div>
                    <h3 className="font-semibold">{store.name}</h3>
                    <p className="text-sm text-slate-600">{store.address}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <p className="font-semibold">
                      €{store.revenue?.toLocaleString() || "0"}
                    </p>
                    <p className="text-xs text-slate-600">
                      {t("analyticsDashboard.topStores.revenue", {
                        value: store.performance,
                      })}
                    </p>
                  </div>
                  <Badge variant={store.isActive ? "default" : "secondary"}>
                    {store.isActive
                      ? t("analyticsDashboard.status.active")
                      : t("analyticsDashboard.status.inactive")}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}