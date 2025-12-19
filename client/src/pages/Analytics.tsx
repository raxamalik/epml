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
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"];

export default function Analytics() {
  const { t } = useTranslation();
  const { user } = useAuth();
  
  // Determine if user should see company-wide or store-specific analytics
  const isCompanyAdmin = user?.type === 'company' || user?.role === 'company_admin';
  const isStoreOwner = user?.role === 'store_owner';
  const isManager = user?.role === 'manager';
  const isStoreView = isStoreOwner || isManager; // Store owners and managers see store-specific view
  
  // Fetch stores - only for company admins
  const { data: stores = [], isLoading: storesLoading } = useQuery<any[]>({
    queryKey: ["/api/company/stores", isCompanyAdmin],
    queryFn: async () => {
      if (!isCompanyAdmin) return [];
      const res = await apiRequest('GET', '/api/company/stores');
      const data = await res.json();
      // Handle both paginated response and array response
      if (Array.isArray(data)) {
        return data;
      }
      return data.data || [];
    },
    enabled: isCompanyAdmin,
  });

  // Fetch analytics - company-wide for admins, store-specific for store owners/managers
  const { data: analytics = {}, isLoading: analyticsLoading } = useQuery<any>({
    queryKey: isStoreView 
      ? ["/api/stores", user?.storeId, "analytics"]
      : ["/api/company/analytics"],
    queryFn: async () => {
      if (isStoreView && user?.storeId) {
        const res = await apiRequest('GET', `/api/stores/${user.storeId}/analytics`);
        return await res.json();
      } else {
        const res = await apiRequest('GET', '/api/company/analytics');
        return await res.json();
      }
    },
    enabled: !!(isCompanyAdmin || (isStoreView && user?.storeId)),
  });

  if ((isCompanyAdmin && storesLoading) || analyticsLoading) {
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
  const revenueChartData = stores.map((store: any) => ({
    name: store.name && store.name.length > 12 ? store.name.substring(0, 12) + "..." : (store.name || 'Unknown'),
    revenue: store.revenue || 0,
    // Use 'customers' and 'products' from API response, fallback to 'customerCount' and 'productCount' for backward compatibility
    customers: store.customers || store.customerCount || 0,
    products: store.products || store.productCount || 0,
  }));

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

  // Monthly performance data from backend
  const monthlyData = (analytics?.monthlyData || []).map((item: any) => ({
    month: t(`analyticsDashboard.months.${item.month}`) || item.month,
    revenue: item.revenue || 0,
    customers: item.customers || 0,
    orders: item.orders || 0,
  }));

  const topPerformingStores = stores
    .sort((a: any, b: any) => (b.revenue || 0) - (a.revenue || 0))
    .slice(0, 5)
    .map((store: any) => ({
      ...store,
      performance: ((store.revenue || 0) / 1000).toFixed(1)
    }));

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
              {analytics?.totalRevenue?.toLocaleString() || "0"} Kč
            </div>
            <p className="text-xs text-muted-foreground">
              {t("analyticsDashboard.cards.monthlyGrowth", {
                value: analytics?.monthlyGrowth || 0,
              })}
            </p>
          </CardContent>
        </Card>

        {isCompanyAdmin && (
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
        )}
        {isStoreView && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t("analyticsDashboard.cards.storeName") || "Store"}
              </CardTitle>
              <Store className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics?.storeName || "N/A"}</div>
              <p className="text-xs text-muted-foreground">
                {analytics?.storeId ? `Store ID: ${analytics.storeId}` : ""}
              </p>
            </CardContent>
          </Card>
        )}

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
        {/* Revenue Comparison Chart - Show for company admins, single store view for store owners/managers */}
        {isCompanyAdmin && revenueChartData.length > 0 ? (
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
                      tickFormatter={(value) => `${(value / 1000).toFixed(0)}k Kč`}
                    />
                    <Tooltip 
                      formatter={(value, name) => [
                        `${Number(value).toLocaleString()} Kč`, 
                        name === 'revenue' ? 'Revenue' : name
                      ]}
                    />
                    <Bar dataKey="revenue" fill="#0088FE" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        ) : isStoreView ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                {t("analyticsDashboard.charts.storeRevenue") || "Store Revenue Overview"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-4xl font-bold mb-2">
                    {analytics?.totalRevenue?.toLocaleString() || "0"} Kč
                  </div>
                  <p className="text-muted-foreground">
                    {analytics?.storeName || "Total Revenue"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Store Status Distribution - Only for company admins */}
        {isCompanyAdmin && (
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
        )}
        
        {/* For store view, show customer vs products chart in first row */}
        {isStoreView && (
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
                  <BarChart data={[
                    {
                      name: analytics?.storeName || "Store",
                      customers: analytics?.totalCustomers || 0,
                      products: analytics?.totalProducts || 0,
                    }
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="customers" fill="#00C49F" name="Customers" />
                    <Bar dataKey="products" fill="#FFBB28" name="Products" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
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
              {monthlyData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis tickFormatter={(value) => `${(value / 1000).toFixed(0)}k Kč`} />
                    <Tooltip 
                      formatter={(value: any, name: string) => {
                        if (name === 'revenue') {
                          return [`${Number(value).toLocaleString()} Kč`, 'Revenue'];
                        }
                        return [Number(value).toLocaleString(), name];
                      }}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  <p>No sales data available for the last 6 months</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Customer vs Products - Only for company admins */}
        {isCompanyAdmin && (
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
        )}
      </div>

      {/* Top Performing Stores - Only for company admins */}
      {isCompanyAdmin && topPerformingStores.length > 0 && (
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
                        {store.revenue?.toLocaleString() || "0"} Kč
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
      )}
    </div>
  );
}