import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Store, 
  TrendingUp, 
  TrendingDown,
  DollarSign,
  Package,
  Users,
  ShoppingCart,
  BarChart3,
  PieChart,
  MapPin,
  Phone,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Activity
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart as RechartsPieChart, Pie, Cell } from 'recharts';
import { subDays, startOfDay, endOfDay, isToday, isYesterday } from "date-fns";
import { formatCurrencyWithSymbol } from "@/lib/utils/currency";
import { getStatusBadgeVariant, getStatusText } from "@/lib/utils/status";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/hooks/useTranslation";

interface StoreData {
  id: number;
  name: string;
  address: string | null;
  phone: string | null;
  managerId: string | null;
  companyId: number;
  isActive: boolean;
  revenue: number;
  customerCount: number;
  productCount: number;
  createdAt: string;
  updatedAt: string;
}

interface Sale {
  id: string;
  total: string;
  paymentMethod: 'cash' | 'card';
  createdAt: string;
  items?: any;
}

interface Product {
  id: number;
  name: string;
  price: string;
  stock: number;
  category: string;
}

interface Manager {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

export default function StoreOwnerDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  
  const storeId = user?.storeId;
  const [activeTab, setActiveTab] = useState('overview');

  // Redirect if not a store owner
  useEffect(() => {
    if (user && user.role !== 'store_owner') {
      setLocation('/');
    }
  }, [user, setLocation]);

  // Fetch store details
  const { data: store, isLoading: storeLoading, error: storeError } = useQuery<StoreData>({
    queryKey: ['/api/stores', storeId],
    queryFn: async () => {
      if (!storeId) throw new Error("No store assigned");
      const res = await apiRequest('GET', `/api/stores/${storeId}`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: "" }));
        throw new Error(errorData.message || "Failed to fetch store");
      }
      return await res.json();
    },
    enabled: !!storeId && user?.role === 'store_owner',
    refetchOnWindowFocus: true,
  });

  // Fetch sales (all sales for analytics, using high limit to get all data)
  const { data: salesResponse, isLoading: salesLoading } = useQuery({
    queryKey: ['/api/stores', storeId, 'sales', 'all'],
    queryFn: async () => {
      if (!storeId) return { data: [], total: 0 };
      const res = await apiRequest('GET', `/api/stores/${storeId}/sales?limit=10000`);
      const data = await res.json();
      // Handle both paginated response and array response (for backward compatibility)
      if (Array.isArray(data)) {
        return { data, total: data.length };
      }
      return {
        data: data.data || [],
        total: data.total || 0,
      };
    },
    enabled: !!storeId,
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });

  // Normalize sales to always be an array
  // Handle both paginated response { data: [], total: number } and array response
  const sales: Sale[] = (() => {
    if (!salesResponse) return [];
    if (Array.isArray(salesResponse)) return salesResponse;
    if (Array.isArray(salesResponse.data)) return salesResponse.data;
    return [];
  })();

  // Fetch products
  const { data: productsResponse, isLoading: productsLoading } = useQuery({
    queryKey: ['/api/stores', storeId, 'products'],
    queryFn: async () => {
      if (!storeId) return { data: [], total: 0 };
      const res = await apiRequest('GET', `/api/stores/${storeId}/products`);
      const data = await res.json();
      return Array.isArray(data) ? { data: data, total: data.length } : { data: data.data || [], total: data.total || 0 };
    },
    enabled: !!storeId,
    refetchInterval: 60000,
    refetchOnWindowFocus: true,
  });

  const products: Product[] = productsResponse?.data || [];

  // Fetch managers/staff
  const { data: managers = [], isLoading: managersLoading } = useQuery<Manager[]>({
    queryKey: ['/api/stores', storeId, 'managers'],
    queryFn: async () => {
      if (!storeId) return [];
      const res = await apiRequest('GET', `/api/stores/${storeId}/managers`);
      if (!res.ok) return [];
      return await res.json();
    },
    enabled: !!storeId,
  });

  // Calculate sales trend data for the last 7 days
  const getSalesTrendData = () => {
    const last7Days = [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    for (let i = 6; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const dayStart = startOfDay(date);
      const dayEnd = endOfDay(date);
      
      const daySales = sales.filter((sale: Sale) => {
        const saleDate = new Date(sale.createdAt);
        return saleDate >= dayStart && saleDate <= dayEnd;
      });
      
      const totalSales = daySales.reduce((sum: number, sale: Sale) => sum + (parseFloat(sale.total) || 0), 0);
      const transactions = daySales.length;
      
      last7Days.push({
        day: dayNames[date.getDay()],
        sales: Math.round(totalSales),
        transactions: transactions
      });
    }
    
    return last7Days;
  };

  // Calculate payment method statistics
  const getPaymentMethodStats = () => {
    const totalRevenue = sales.reduce((sum: number, sale: Sale) => sum + (parseFloat(sale.total) || 0), 0);
    
    const cardRevenue = sales.filter((sale: Sale) => sale.paymentMethod === 'card')
      .reduce((sum: number, sale: Sale) => sum + (parseFloat(sale.total) || 0), 0);
    
    const cashRevenue = sales.filter((sale: Sale) => sale.paymentMethod === 'cash')
      .reduce((sum: number, sale: Sale) => sum + (parseFloat(sale.total) || 0), 0);
    
    const cardPercentage = totalRevenue > 0 ? Math.round((cardRevenue / totalRevenue) * 100) : 0;
    const cashPercentage = totalRevenue > 0 ? Math.round((cashRevenue / totalRevenue) * 100) : 0;
    
    return {
      total: totalRevenue,
      card: { revenue: cardRevenue, percentage: cardPercentage },
      cash: { revenue: cashRevenue, percentage: cashPercentage }
    };
  };

  // Calculate today's and yesterday's sales
  const todaysSales = sales.filter((sale: Sale) => isToday(new Date(sale.createdAt)));
  const yesterdaysSales = sales.filter((sale: Sale) => isYesterday(new Date(sale.createdAt)));
  
  const todayRevenue = todaysSales.reduce((sum: number, sale: Sale) => sum + (parseFloat(sale.total) || 0), 0);
  const yesterdayRevenue = yesterdaysSales.reduce((sum: number, sale: Sale) => sum + (parseFloat(sale.total) || 0), 0);
  const revenueChange = yesterdayRevenue > 0 ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue * 100) : 0;

  // Calculate inventory stats
  const lowStockProducts = products.filter(p => p.stock <= 10 && p.stock > 0).length;
  const outOfStockProducts = products.filter(p => p.stock === 0).length;
  const totalInventoryValue = products.reduce((sum, product) => 
    sum + (parseFloat(product.price) * product.stock), 0
  );

  const paymentStats = getPaymentMethodStats();
  const salesTrendData = getSalesTrendData();

  const paymentMethodData = [
    { name: t("storeOwnerDashboard.overview.payment.cash"), value: paymentStats.cash.percentage, revenue: paymentStats.cash.revenue },
    { name: t("storeOwnerDashboard.overview.payment.card"), value: paymentStats.card.percentage, revenue: paymentStats.card.revenue }
  ];

  if (storeLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="space-y-6">
            <Skeleton className="h-32 w-full" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
            <Skeleton className="h-96 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (storeError || !store) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <Store className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">{t("storeDetail.notFoundTitle")}</h2>
              <p className="text-muted-foreground mb-4">
                {(storeError as Error)?.message || t("storeDetail.notFoundDescription")}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("storeDetail.notFoundHelp")}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="border-0 shadow-lg bg-white dark:bg-slate-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t("storeOwnerDashboard.cards.totalRevenue")}</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
                    {formatCurrencyWithSymbol(store.revenue || 0)}
                  </p>
                  <div className="flex items-center gap-1 mt-2">
                    {revenueChange >= 0 ? (
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-500" />
                    )}
                    <span className={`text-xs ${revenueChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {t("storeOwnerDashboard.cards.revenueChange", {
                        value: `${revenueChange >= 0 ? "+" : ""}${revenueChange.toFixed(1)}%`,
                      })}
                    </span>
                  </div>
                </div>
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-white dark:bg-slate-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t("storeOwnerDashboard.cards.todaysSales")}</p>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                    {formatCurrencyWithSymbol(todayRevenue)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {t("storeOwnerDashboard.cards.todaysTransactions", { count: todaysSales.length })}
                  </p>
                </div>
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <DollarSign className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-white dark:bg-slate-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t("storeOwnerDashboard.cards.products")}</p>
                  <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">
                    {products.length}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {t("storeOwnerDashboard.cards.productsLowOut", {
                      low: lowStockProducts,
                      out: outOfStockProducts,
                    })}
                  </p>
                </div>
                <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <Package className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-white dark:bg-slate-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t("storeOwnerDashboard.cards.staff")}</p>
                  <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                    {managers.length}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {t("storeOwnerDashboard.cards.staffActive")}
                  </p>
                </div>
                <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                  <Users className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs for different views */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              {t("storeOwnerDashboard.tabs.overview")}
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              {t("storeOwnerDashboard.tabs.analytics")}
            </TabsTrigger>
            <TabsTrigger value="products" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              {t("storeOwnerDashboard.tabs.products")}
            </TabsTrigger>
            <TabsTrigger value="staff" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              {t("storeOwnerDashboard.tabs.staff")}
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Sales Trend Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    {t("storeOwnerDashboard.overview.salesTrend")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={salesTrendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" />
                      <YAxis tickFormatter={(value) => `€${value}`} />
                      <Tooltip formatter={(value) => `€${value}`} />
                      <Line 
                        type="monotone" 
                        dataKey="sales" 
                        stroke="#0088FE" 
                        strokeWidth={2}
                        name="Revenue"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Payment Methods */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="h-5 w-5" />
                    {t("storeOwnerDashboard.overview.paymentMethods")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <RechartsPieChart>
                      <Pie
                        data={paymentMethodData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value }) => `${name}: ${value}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {paymentMethodData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value, name, props) => [
                        `${formatCurrencyWithSymbol(props.payload.revenue)} (${value}%)`,
                        name
                      ]} />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">{t("storeOwnerDashboard.overview.payment.cash")}</span>
                      <span className="font-semibold">{formatCurrencyWithSymbol(paymentStats.cash.revenue)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">{t("storeOwnerDashboard.overview.payment.card")}</span>
                      <span className="font-semibold">{formatCurrencyWithSymbol(paymentStats.card.revenue)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>{t("storeOwnerDashboard.overview.quickActionsTitle")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Button 
                    variant="outline" 
                    className="h-auto p-4 flex flex-col items-start gap-2"
                    onClick={() => setLocation('/products')}
                  >
                    <div className="flex items-center gap-2 w-full">
                      <Package className="h-5 w-5" />
                      <span className="font-semibold">{t("storeOwnerDashboard.overview.manageProductsTitle")}</span>
                      <ArrowRight className="h-4 w-4 ml-auto" />
                    </div>
                    <span className="text-sm text-muted-foreground">{t("storeOwnerDashboard.overview.manageProductsDesc")}</span>
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="h-auto p-4 flex flex-col items-start gap-2"
                    onClick={() => setLocation('/inventory')}
                  >
                    <div className="flex items-center gap-2 w-full">
                      <ShoppingCart className="h-5 w-5" />
                      <span className="font-semibold">{t("storeOwnerDashboard.overview.inventoryTitle")}</span>
                      <ArrowRight className="h-4 w-4 ml-auto" />
                    </div>
                    <span className="text-sm text-muted-foreground">{t("storeOwnerDashboard.overview.inventoryDesc")}</span>
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="h-auto p-4 flex flex-col items-start gap-2"
                    onClick={() => setLocation('/store-owner/managers')}
                  >
                    <div className="flex items-center gap-2 w-full">
                      <Users className="h-5 w-5" />
                      <span className="font-semibold">{t("storeOwnerDashboard.overview.manageStaffTitle")}</span>
                      <ArrowRight className="h-4 w-4 ml-auto" />
                    </div>
                    <span className="text-sm text-muted-foreground">{t("storeOwnerDashboard.overview.manageStaffDesc")}</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>{t("storeOwnerDashboard.analytics.salesByDayTitle")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={salesTrendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" />
                      <YAxis tickFormatter={(value) => `€${value}`} />
                      <Tooltip formatter={(value) => `€${value}`} />
                      <Bar dataKey="sales" fill="#0088FE" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t("storeOwnerDashboard.analytics.transactionsByDayTitle")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={salesTrendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="transactions" fill="#00C49F" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>{t("storeOwnerDashboard.analytics.additionalStatsTitle")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <p className="text-sm text-muted-foreground">{t("storeOwnerDashboard.analytics.totalCustomers")}</p>
                    <p className="text-2xl font-bold">{store.customerCount || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t("storeOwnerDashboard.analytics.inventoryValue")}</p>
                    <p className="text-2xl font-bold">{formatCurrencyWithSymbol(totalInventoryValue)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t("storeOwnerDashboard.analytics.totalTransactions")}</p>
                    <p className="text-2xl font-bold">{sales.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Products Tab */}
          <TabsContent value="products" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{t("storeOwnerDashboard.productsTab.title")}</CardTitle>
                  <Button onClick={() => setLocation('/products')}>
                    {t("storeOwnerDashboard.productsTab.viewAll")}
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground">{t("storeOwnerDashboard.productsTab.totalProducts")}</p>
                    <p className="text-2xl font-bold">{products.length}</p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground">{t("storeOwnerDashboard.productsTab.lowStock")}</p>
                    <p className="text-2xl font-bold text-orange-500">{lowStockProducts}</p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground">{t("storeOwnerDashboard.productsTab.outOfStock")}</p>
                    <p className="text-2xl font-bold text-red-500">{outOfStockProducts}</p>
                  </div>
                </div>
                
                {productsLoading ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : products.length === 0 ? (
                  <div className="text-center py-8">
                    <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">{t("storeOwnerDashboard.productsTab.noProducts")}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {products.slice(0, 10).map((product) => (
                      <div key={product.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <p className="font-semibold">{product.name}</p>
                          <p className="text-sm text-muted-foreground">{product.category}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{formatCurrencyWithSymbol(parseFloat(product.price))}</p>
                          <Badge variant={product.stock === 0 ? 'destructive' : product.stock <= 10 ? 'secondary' : 'default'}>
                            Stock: {product.stock}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Staff Tab */}
          <TabsContent value="staff" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{t("storeOwnerDashboard.staffTab.title")}</CardTitle>
                  <Button onClick={() => setLocation('/store-owner/managers')}>
                    {t("storeOwnerDashboard.staffTab.manageStaff")}
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {managersLoading ? (
                  <div className="space-y-2">
                    {[...Array(3)].map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : managers.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">{t("storeOwnerDashboard.staffTab.noStaff")}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {managers.map((manager) => (
                      <div key={manager.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <p className="font-semibold">{manager.firstName} {manager.lastName}</p>
                          <p className="text-sm text-muted-foreground">{manager.email}</p>
                          {manager.phone && (
                            <p className="text-sm text-muted-foreground">{manager.phone}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant={manager.isActive ? 'default' : 'secondary'}>
                            {manager.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                          <Badge variant="outline">{manager.role}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

