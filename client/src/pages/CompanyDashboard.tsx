import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Store, 
  Users, 
  TrendingUp, 
  Settings,
  MapPin,
  DollarSign,
  ShoppingCart,
  UserCheck,
  Plus,
  Eye,
  Edit,
  Search,
  BarChart3,
  PieChart,
  Building,
  Building2,
  Save,
  Shield,
  AlertTriangle,
  Download,
  Trash2
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell } from 'recharts';
import { useToast } from "@/hooks/use-toast";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { useTranslation } from "@/hooks/useTranslation";

interface Store {
  id: number;
  name: string;
  address: string;
  phone?: string;
  manager: string;
  status: 'active' | 'inactive';
  revenue: number;
  products: number;
  customers: number;
  createdAt: string;
  companyLogo?: string | null;
}

const storeFormSchema = z.object({
  name: z.string().min(1, "Store name is required"),
  address: z.string().min(1, "Address is required"),
  phone: z.string().optional(),
  managerId: z.string().optional(),
  revenue: z.number().min(0, "Revenue must be non-negative"),
  customerCount: z.number().min(0, "Customer count must be non-negative"),
  productCount: z.number().min(0, "Product count must be non-negative"),
  isActive: z.boolean(),
});

const managerFormSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email format"),
  phone: z.string().optional(),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["manager", "store_owner"]).default("manager"),
  storeId: z.number().optional(),
  isActive: z.boolean().default(true)
});

type StoreFormData = z.infer<typeof storeFormSchema>;
type ManagerFormData = z.infer<typeof managerFormSchema>;

export default function CompanyDashboard() {
  const [, setLocation] = useLocation();
  const { t } = useTranslation();
  const [stores, setStores] = useState<Store[]>([]);
  const [filteredStores, setFilteredStores] = useState<Store[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [analytics, setAnalytics] = useState({
    totalStores: 0,
    activeStores: 0,
    totalRevenue: 0,
    totalProducts: 0,
    totalCustomers: 0,
    monthlyGrowth: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('stores');
  
  // Manager Management State
  const [managers, setManagers] = useState<any[]>([]);
  const [selectedManager, setSelectedManager] = useState<any | null>(null);
  const [isManagerDialogOpen, setIsManagerDialogOpen] = useState(false);
  const [isManagerEditMode, setIsManagerEditMode] = useState(false);
  const [managerSearchTerm, setManagerSearchTerm] = useState("");
  const [isDeleteManagerDialogOpen, setIsDeleteManagerDialogOpen] = useState(false);
  const [managerToDelete, setManagerToDelete] = useState<any | null>(null);
  
  // Company limits
  const [companyData, setCompanyData] = useState<any>(null);
  const [maxBranches, setMaxBranches] = useState(5);

  // Chart colors
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

  // Prepare chart data
  const revenueChartData = filteredStores.map(store => ({
    name: store.name.length > 15 ? store.name.substring(0, 15) + '...' : store.name,
    revenue: store.revenue,
    customers: store.customers,
    products: store.products
  }));

  const statusPieData = [
    { name: 'Active Stores', value: analytics.activeStores, color: '#0088FE' },
    { name: 'Inactive Stores', value: analytics.totalStores - analytics.activeStores, color: '#FF8042' }
  ];
  const { toast } = useToast();

  const form = useForm<StoreFormData>({
    resolver: zodResolver(storeFormSchema),
    defaultValues: {
      name: "",
      address: "",
      phone: "",
      revenue: 0,
      customerCount: 0,
      productCount: 0,
      isActive: true,
    }
  });

  const managerForm = useForm<ManagerFormData>({
    resolver: zodResolver(managerFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      password: "",
      role: "manager",
      storeId: undefined,
      isActive: true
    }
  });

  useEffect(() => {
    fetchCompanyData();
  }, []);

  // Filter stores based on search term
  useEffect(() => {
    if (!searchTerm) {
      setFilteredStores(stores);
    } else {
      const filtered = stores.filter(store =>
        store.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        store.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
        store.manager.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredStores(filtered);
    }
  }, [stores, searchTerm]);

  const fetchCompanyData = async () => {
    try {
      // Fetch all stores
      const storesResponse = await fetchWithAuth('/api/company/stores');
      if (storesResponse.ok) {
        const storesData = await storesResponse.json();
        setStores(storesData);
      }

      // Fetch analytics data
      const analyticsResponse = await fetchWithAuth('/api/company/analytics');
      if (analyticsResponse.ok) {
        const analyticsData = await analyticsResponse.json();
        setAnalytics(analyticsData);
      }

      // Fetch managers data
      const managersResponse = await fetchWithAuth('/api/managers');
      if (managersResponse.ok) {
        const managersData = await managersResponse.json();
        setManagers(managersData?.managers);
      }

      // Fetch company data to get max branches limit
      const companyResponse = await fetchWithAuth('/api/company/profile');
      if (companyResponse.ok) {
        const companyData = await companyResponse.json();
        setCompanyData(companyData);
        setMaxBranches(companyData.maxBranches || 5);
      }
    } catch (error) {
      console.error('Error fetching company data:', error);
    } finally {
      setIsLoading(false);
    }
  };


  const handleViewStore = (store: Store) => {
    setSelectedStore(store);
    setIsViewDialogOpen(true);
  };

  const handleEditStore = (store: Store) => {
    setSelectedStore(store);
    form.reset({
      name: store.name,
      address: store.address,
      phone: store.phone || "",
      revenue: store.revenue,
      customerCount: store.customers,
      productCount: store.products,
      isActive: store.status === 'active'
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateStore = async (data: StoreFormData) => {
    if (!selectedStore) return;

    try {
      const response = await fetchWithAuth(`/api/stores/${selectedStore.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...data,
          customerCount: data.customerCount,
          productCount: data.productCount
        }),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Store updated successfully",
        });
        setIsEditDialogOpen(false);
        fetchCompanyData(); // Refresh the data
      } else {
        const errorData = await response.json();
        const errorMessage = errorData.message || errorData.error || 'An error occurred';
        throw new Error(errorMessage);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || 'An error occurred',
        variant: "destructive",
      });
    }
  };

  // Manager Handler Functions
  const handleCreateManager = async (data: ManagerFormData) => {
    try {
      const response = await fetchWithAuth('/api/managers', {
        method: 'POST',
        body: JSON.stringify(data),
      });

      if (response.ok) {
        setIsManagerDialogOpen(false);
        managerForm.reset();
        toast({
          title: "Success",
          description: "Manager created successfully",
        });
        // Refresh managers list to get full manager data with store info
        fetchCompanyData();
      } else {
        const errorData = await response.json();
        const errorMessage = errorData.message || errorData.error || 'An error occurred';
        throw new Error(errorMessage);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || 'An error occurred',
        variant: "destructive",
      });
    }
  };

  const handleUpdateManager = async (data: ManagerFormData) => {
    if (!selectedManager) return;

    try {
      const response = await fetchWithAuth(`/api/managers/${selectedManager.id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });

      if (response.ok) {
        const updatedManager = await response.json();
        setManagers(managers.map(manager => 
          manager.id === selectedManager.id ? updatedManager : manager
        ));
        setIsManagerDialogOpen(false);
        managerForm.reset();
        toast({
          title: "Success",
          description: "Manager updated successfully",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update manager",
        variant: "destructive",
      });
    }
  };

  const handleDeleteManager = (manager: any) => {
    setManagerToDelete(manager);
    setIsDeleteManagerDialogOpen(true);
  };

  const confirmDeleteManager = async () => {
    if (!managerToDelete) return;

    try {
      const response = await fetchWithAuth(`/api/managers/${managerToDelete.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setManagers(managers.filter(m => m.id !== managerToDelete.id));
        toast({
          title: "Success",
          description: "Manager deleted successfully",
        });
        setIsDeleteManagerDialogOpen(false);
        setManagerToDelete(null);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete manager",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-slate-600">Loading your company dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-6 space-y-8">
      {/* Compact Modern Header with Gradient */}
      <div className="relative">
        <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 rounded-xl p-6 text-white shadow-xl">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                  <Building2 className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">{t("companyDashboard.title")}</h1>
                  <p className="text-blue-100 text-sm">
                    {t("companyDashboard.subtitle")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-sm">{t("companyDashboard.systemActive")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Store className="h-4 w-4" />
                  <span className="text-sm">{t("companyDashboard.activeStores", { count: stores.length })}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span className="text-sm">{t("companyDashboard.managersCount", { count: managers.length })}</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="hidden lg:block">
                <div className="relative">
                  <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
                    <BarChart3 className="h-8 w-8 text-white/80" />
                  </div>
                </div>
              </div>
              
              {/* Action Button */}
              {stores.length < maxBranches ? (
                <Button 
                  onClick={() => {
                    setActiveTab('stores');
                    setLocation('/stores');
                  }} 
                  className="bg-white/20 hover:bg-white/30 text-white font-semibold px-4 py-2 rounded-lg backdrop-blur-sm border border-white/30 transition-all duration-200 hover:scale-105"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {t("companyDashboard.stores.addStore", { used: stores.length, limit: maxBranches })}
                </Button>
              ) : (
                <div className="text-right">
                  <Button disabled className="bg-white/10 cursor-not-allowed text-white/60 px-4 py-2 rounded-lg backdrop-blur-sm">
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    {t("companyDashboard.stores.limitReached", { used: stores.length, limit: maxBranches })}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modern Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-0 shadow-lg bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm overflow-hidden hover:shadow-xl transition-all duration-200 hover:scale-105">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900 dark:to-blue-800">
            <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t("companyDashboard.cards.totalStores")}</CardTitle>
            <div className="p-2 bg-blue-500 rounded-lg">
              <Store className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">{analytics.totalStores}</div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {t("companyDashboard.cards.activeStores", { count: analytics.activeStores })}
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm overflow-hidden hover:shadow-xl transition-all duration-200 hover:scale-105">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-gradient-to-r from-green-50 to-emerald-100 dark:from-green-900 dark:to-emerald-800">
            <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t("companyDashboard.cards.totalRevenue")}</CardTitle>
            <div className="p-2 bg-green-500 rounded-lg">
              <DollarSign className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">€{analytics.totalRevenue.toLocaleString()}</div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {t("companyDashboard.cards.monthlyGrowth", { percent: analytics.monthlyGrowth })}
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm overflow-hidden hover:shadow-xl transition-all duration-200 hover:scale-105">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-gradient-to-r from-purple-50 to-pink-100 dark:from-purple-900 dark:to-pink-800">
            <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t("companyDashboard.cards.products")}</CardTitle>
            <div className="p-2 bg-purple-500 rounded-lg">
              <ShoppingCart className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">{analytics.totalProducts}</div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {t("companyDashboard.cards.productsDesc")}
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm overflow-hidden hover:shadow-xl transition-all duration-200 hover:scale-105">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-gradient-to-r from-orange-50 to-red-100 dark:from-orange-900 dark:to-red-800">
            <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t("companyDashboard.cards.customers")}</CardTitle>
            <div className="p-2 bg-orange-500 rounded-lg">
              <Users className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">{analytics.totalCustomers}</div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {t("companyDashboard.cards.customersDesc")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Charts Section */}
      <div className="space-y-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold">{t("companyDashboard.analytics.title")}</h2>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue Bar Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                {t("companyDashboard.analytics.revenueComparison")}
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

          {/* Customer vs Products Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                {t("companyDashboard.analytics.customersProducts")}
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
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="stores">{t("companyDashboard.tabs.stores")}</TabsTrigger>
          <TabsTrigger value="managers">{t("companyDashboard.tabs.managers")}</TabsTrigger>
          <TabsTrigger value="settings">{t("companyDashboard.tabs.settings")}</TabsTrigger>
        </TabsList>

        {/* Stores Tab */}
        <TabsContent value="stores" className="space-y-4">
          <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                <Store className="h-5 w-5" />
                {t("companyDashboard.stores.title")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Search Field */}
              <div className="mb-6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder={t("companyDashboard.stores.searchPlaceholder")}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="grid gap-4">
                {filteredStores.map((store) => (
                  <div key={store.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      {store.companyLogo ? (
                        <img 
                          src={store.companyLogo} 
                          alt={`${store.name} company logo`}
                          className="w-12 h-12 object-cover rounded-lg border border-slate-200"
                          onError={(e) => {
                            // Hide image on error and show fallback
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : null}
                      {!store.companyLogo && (
                        <div className="bg-primary/10 p-2 rounded-lg">
                          <Store className="h-6 w-6 text-primary" />
                        </div>
                      )}
                      <div>
                        <h3 className="font-semibold">{store.name}</h3>
                        <p className="text-sm text-slate-600 flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {store.address}
                        </p>
                        <p className="text-sm text-slate-600 flex items-center gap-1">
                          <UserCheck className="h-3 w-3" />
                          {t("companyDashboard.stores.managerLabel")}: {store.manager}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className="font-semibold">€{store.revenue.toLocaleString()}</p>
                        <p className="text-xs text-slate-600">{store.products} products</p>
                      </div>
                      <Badge variant={store.status === 'active' ? 'default' : 'secondary'}>
                        {store.status}
                      </Badge>
                      <div className="flex space-x-2">
                        <Button size="sm" variant="outline" onClick={() => handleViewStore(store)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleEditStore(store)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Managers Tab */}
        <TabsContent value="managers" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  {t("companyDashboard.managers.title")}
                </CardTitle>
                <Button onClick={() => {
                  setSelectedManager(null);
                  setIsManagerEditMode(false);
                  setIsManagerDialogOpen(true);
                  managerForm.reset();
                }} className="bg-primary hover:bg-blue-700">
                  <Plus className="h-4 w-4 mr-2" />
                  {t("companyDashboard.managers.addManager")}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Search Field */}
              <div className="mb-6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder={t("companyDashboard.managers.searchPlaceholder")}
                    value={managerSearchTerm}
                    onChange={(e) => setManagerSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="grid gap-4">
                {managers.filter(manager => 
                  manager.firstName.toLowerCase().includes(managerSearchTerm.toLowerCase()) ||
                  manager.lastName.toLowerCase().includes(managerSearchTerm.toLowerCase()) ||
                  manager.email.toLowerCase().includes(managerSearchTerm.toLowerCase()) ||
                  manager.role.toLowerCase().includes(managerSearchTerm.toLowerCase())
                ).map((manager) => (
                  <div key={manager.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="bg-accent/10 p-2 rounded-lg">
                        <UserCheck className="h-6 w-6 text-accent" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{manager.firstName} {manager.lastName}</h3>
                        <p className="text-sm text-slate-600">{manager.email}</p>
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          <Shield className="h-3 w-3" />
                          {manager.role.replace('_', ' ').toUpperCase()}
                          {manager.store && ` • ${manager.store.name}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <Badge variant={manager.isActive ? 'default' : 'secondary'}>
                          {manager.isActive ? t("companyDashboard.managers.active") : t("companyDashboard.managers.inactive")}
                        </Badge>
                      </div>
                      <div className="flex space-x-2">
                        <Button size="sm" variant="outline" onClick={() => {
                          setSelectedManager(manager);
                          setIsManagerEditMode(true);
                          setIsManagerDialogOpen(true);
                          managerForm.reset({
                            firstName: manager.firstName,
                            lastName: manager.lastName,
                            email: manager.email,
                            phone: manager.phone || "",
                            password: "",
                            role: manager.role,
                            storeId: manager.storeId || undefined,
                            isActive: manager.isActive
                          });
                        }}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleDeleteManager(manager)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                
                {managers.length === 0 && (
                  <div className="text-center py-8 text-slate-600">
                    <Users className="h-12 w-12 mx-auto mb-4 text-slate-400" />
                    <p>{t("companyDashboard.managers.noManagers")}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>



        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Company Profile Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  {t("companyDashboard.settings.title")}
                </CardTitle>
                <CardDescription>
                  {t("companyDashboard.settings.description")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="company-name">{t("companyDashboard.settings.companyName")}</Label>
                  <Input id="company-name" defaultValue="Tech Solutions Ltd." />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                  <Label htmlFor="reg-number">{t("companyDashboard.settings.registrationNumber")}</Label>
                    <Input id="reg-number" defaultValue="12345678" />
                  </div>
                  <div className="space-y-2">
                  <Label htmlFor="vat-number">{t("companyDashboard.settings.vatNumber")}</Label>
                    <Input id="vat-number" defaultValue="CZ12345678" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-email">{t("companyDashboard.settings.email")}</Label>
                  <Input id="company-email" type="email" defaultValue="info@techsolutions.cz" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-phone">{t("companyDashboard.settings.phone")}</Label>
                  <Input id="company-phone" defaultValue="+420 123 456 789" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-address">{t("companyDashboard.settings.address")}</Label>
                  <Textarea id="company-address" defaultValue="Wenceslas Square 1, 110 00 Prague 1, Czech Republic" />
                </div>
                <Button className="w-full">
                  <Save className="h-4 w-4 mr-2" />
                  {t("companyDashboard.settings.saveProfile")}
                </Button>
              </CardContent>
            </Card>

            {/* System Preferences */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  {t("companyDashboard.settings.systemPreferences")}
                </CardTitle>
                <CardDescription>
                  {t("companyDashboard.settings.systemPreferencesDesc")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>{t("companyDashboard.settings.emailNotifications")}</Label>
                    <p className="text-sm text-muted-foreground">
                      {t("companyDashboard.settings.emailNotificationsDesc")}
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>{t("companyDashboard.settings.smsAlerts")}</Label>
                    <p className="text-sm text-muted-foreground">
                      {t("companyDashboard.settings.smsAlertsDesc")}
                    </p>
                  </div>
                  <Switch />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>{t("companyDashboard.settings.weeklyReports")}</Label>
                    <p className="text-sm text-muted-foreground">
                      {t("companyDashboard.settings.weeklyReportsDesc")}
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="timezone">{t("companyDashboard.settings.timezone")}</Label>
                  <Select defaultValue="prague">
                    <SelectTrigger>
                      <SelectValue placeholder={t("companyDashboard.settings.selectTimezone")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="prague">Prague (UTC+1)</SelectItem>
                      <SelectItem value="london">London (UTC+0)</SelectItem>
                      <SelectItem value="berlin">Berlin (UTC+1)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="currency">{t("companyDashboard.settings.currency")}</Label>
                  <Select defaultValue="eur">
                    <SelectTrigger>
                      <SelectValue placeholder={t("companyDashboard.settings.selectCurrency")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="eur">Euro (EUR)</SelectItem>
                      <SelectItem value="czk">Czech Koruna (CZK)</SelectItem>
                      <SelectItem value="usd">US Dollar (USD)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <Button variant="outline" className="w-full">
                  <Settings className="h-4 w-4 mr-2" />
                  {t("companyDashboard.settings.updatePreferences")}
                </Button>
              </CardContent>
            </Card>
            
            {/* Store Configuration */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Store className="h-5 w-5" />
                  {t("companyDashboard.settings.storeConfiguration")}
                </CardTitle>
                <CardDescription>
                  {t("companyDashboard.settings.storeConfigurationDesc")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>{t("companyDashboard.settings.maxStores")}</Label>
                  <div className="flex items-center gap-2">
                    <Input type="number" defaultValue="10" min="1" max="50" />
                    <span className="text-sm text-muted-foreground">{t("companyDashboard.settings.storesAllowed")}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("companyDashboard.settings.currentStores", { used: stores.length, limit: 10 })}
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label>{t("companyDashboard.settings.defaultOperatingHours")}</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">{t("companyDashboard.settings.openingTime")}</Label>
                      <Input type="time" defaultValue="08:00" />
                    </div>
                    <div>
                      <Label className="text-xs">{t("companyDashboard.settings.closingTime")}</Label>
                      <Input type="time" defaultValue="20:00" />
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>{t("companyDashboard.settings.autoSyncInventory")}</Label>
                    <p className="text-sm text-muted-foreground">
                      {t("companyDashboard.settings.autoSyncInventoryDesc")}
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>{t("companyDashboard.settings.centralizedPricing")}</Label>
                    <p className="text-sm text-muted-foreground">
                      {t("companyDashboard.settings.centralizedPricingDesc")}
                    </p>
                  </div>
                  <Switch />
                </div>
                
                <Button variant="outline" className="w-full">
                  <Store className="h-4 w-4 mr-2" />
                  {t("companyDashboard.settings.applyStoreSettings")}
                </Button>
              </CardContent>
            </Card>

            {/* Security & Access */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  {t("companyDashboard.settings.securityAccess")}
                </CardTitle>
                <CardDescription>
                  {t("companyDashboard.settings.securityAccessDesc")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>{t("companyDashboard.settings.passwordPolicy")}</Label>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox id="require-uppercase" defaultChecked />
                      <Label htmlFor="require-uppercase" className="text-sm">
                        {t("companyDashboard.settings.requireUppercase")}
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="require-numbers" defaultChecked />
                      <Label htmlFor="require-numbers" className="text-sm">
                        {t("companyDashboard.settings.requireNumbers")}
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="require-symbols" />
                      <Label htmlFor="require-symbols" className="text-sm">
                        {t("companyDashboard.settings.requireSymbols")}
                      </Label>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="session-timeout">{t("companyDashboard.settings.sessionTimeout")}</Label>
                  <Select defaultValue="30">
                    <SelectTrigger>
                      <SelectValue placeholder={t("companyDashboard.settings.selectTimeout")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 minutes</SelectItem>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="60">1 hour</SelectItem>
                      <SelectItem value="240">4 hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>{t("companyDashboard.settings.twoFactor")}</Label>
                    <p className="text-sm text-muted-foreground">
                      {t("companyDashboard.settings.twoFactorDesc")}
                    </p>
                  </div>
                  <Switch />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>{t("companyDashboard.settings.loginAuditTrail")}</Label>
                    <p className="text-sm text-muted-foreground">
                      {t("companyDashboard.settings.loginAuditTrailDesc")}
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                
                <Button variant="outline" className="w-full">
                  <Shield className="h-4 w-4 mr-2" />
                  {t("companyDashboard.settings.updateSecurity")}
                </Button>
              </CardContent>
            </Card>
          </div>
          
          {/* Danger Zone */}
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                {t("companyDashboard.settings.dangerZone")}
              </CardTitle>
              <CardDescription>
                {t("companyDashboard.settings.dangerZoneDesc")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border border-red-200 rounded-lg">
                <div>
                  <h4 className="font-semibold text-red-600">{t("companyDashboard.settings.exportData")}</h4>
                  <p className="text-sm text-slate-600">{t("companyDashboard.settings.exportDataDesc")}</p>
                </div>
                <Button variant="outline" className="border-red-200 text-red-600 hover:bg-red-50">
                  <Download className="h-4 w-4 mr-2" />
                  {t("companyDashboard.settings.exportData")}
                </Button>
              </div>
              
              <div className="flex items-center justify-between p-4 border border-red-200 rounded-lg">
                <div>
                  <h4 className="font-semibold text-red-600">{t("companyDashboard.settings.closeAccount")}</h4>
                  <p className="text-sm text-slate-600">{t("companyDashboard.settings.closeAccountDesc")}</p>
                </div>
                <Button variant="destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t("companyDashboard.settings.closeAccount")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* View Store Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("companyDashboard.dialogs.viewStore.title")}</DialogTitle>
          </DialogHeader>
          {selectedStore && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">{t("companyDashboard.dialogs.viewStore.storeName")}</label>
                  <p className="text-lg font-semibold">{selectedStore.name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">{t("companyDashboard.dialogs.viewStore.status")}</label>
                  <div className="mt-1">
                    <Badge variant={selectedStore.status === 'active' ? 'default' : 'secondary'}>
                      {selectedStore.status}
                    </Badge>
                  </div>
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-500">{t("companyDashboard.dialogs.viewStore.address")}</label>
                <p className="text-base">{selectedStore.address}</p>
              </div>

              {selectedStore.phone && (
                <div>
                  <label className="text-sm font-medium text-gray-500">{t("companyDashboard.dialogs.viewStore.phone")}</label>
                  <p className="text-base">{selectedStore.phone}</p>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-gray-500">{t("companyDashboard.dialogs.viewStore.manager")}</label>
                <p className="text-base">{selectedStore.manager}</p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">{t("companyDashboard.dialogs.viewStore.revenue")}</label>
                  <p className="text-lg font-semibold">€{selectedStore.revenue.toLocaleString()}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">{t("companyDashboard.dialogs.viewStore.products")}</label>
                  <p className="text-lg font-semibold">{selectedStore.products}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">{t("companyDashboard.dialogs.viewStore.customers")}</label>
                  <p className="text-lg font-semibold">{selectedStore.customers}</p>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-500">{t("companyDashboard.dialogs.viewStore.created")}</label>
                <p className="text-base">{selectedStore.createdAt}</p>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
                  {t("companyDashboard.dialogs.viewStore.close")}
                </Button>
                <Button onClick={() => {
                  setIsViewDialogOpen(false);
                  handleEditStore(selectedStore);
                }}>
                  {t("companyDashboard.dialogs.viewStore.editStore")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Store Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("companyDashboard.dialogs.editStore.title")}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleUpdateStore)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("companyDashboard.dialogs.editStore.storeName")}</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter store name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("companyDashboard.dialogs.editStore.phone")}</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter phone number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("companyDashboard.dialogs.editStore.address")}</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter store address" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="revenue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("companyDashboard.dialogs.editStore.revenue")}</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="0" 
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="customerCount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("companyDashboard.dialogs.editStore.customerCount")}</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="0" 
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="productCount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("companyDashboard.dialogs.editStore.productCount")}</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="0" 
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit">
                  {t("companyDashboard.dialogs.editStore.update")}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Manager Dialog */}
      <Dialog open={isManagerDialogOpen} onOpenChange={setIsManagerDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {isManagerEditMode ? t("companyDashboard.managers.updateManager") : t("companyDashboard.managers.createManager")}
            </DialogTitle>
          </DialogHeader>
          <Form {...managerForm}>
            <form onSubmit={managerForm.handleSubmit(isManagerEditMode ? handleUpdateManager : handleCreateManager)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={managerForm.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("companyDashboard.dialogs.managerForm.firstName")}</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter first name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={managerForm.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("companyDashboard.dialogs.managerForm.lastName")}</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter last name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={managerForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("companyDashboard.dialogs.managerForm.email")}</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter email address" type="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={managerForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("companyDashboard.dialogs.managerForm.phone")}</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter phone number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={managerForm.control}
                name="password"
                render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("companyDashboard.dialogs.managerForm.password")} {isManagerEditMode && "(leave blank to keep current)"}</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter password" type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={managerForm.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("companyDashboard.dialogs.managerForm.role")}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                          <SelectValue placeholder={t("companyDashboard.dialogs.managerForm.role")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="manager">Store Manager (Full store access including POS & inventory)</SelectItem>
                          <SelectItem value="store_owner">Store Owner</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={managerForm.control}
                  name="storeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("companyDashboard.dialogs.managerForm.store")}</FormLabel>
                      <Select onValueChange={(value) => field.onChange(value ? Number(value) : undefined)} defaultValue={field.value?.toString()}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t("companyDashboard.dialogs.managerForm.store")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">{t("companyDashboard.dialogs.managerForm.noStore")}</SelectItem>
                          {stores.map((store) => (
                            <SelectItem key={store.id} value={store.id.toString()}>
                              {store.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={managerForm.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>{t("companyDashboard.dialogs.managerForm.activeStatus")}</FormLabel>
                      <div className="text-sm text-muted-foreground">
                        {t("companyDashboard.dialogs.managerForm.activeStatusDesc")}
                      </div>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsManagerDialogOpen(false)}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit">
                  {isManagerEditMode ? t("companyDashboard.managers.updateManager") : t("companyDashboard.managers.createManager")}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Manager Dialog */}
      <AlertDialog open={isDeleteManagerDialogOpen} onOpenChange={setIsDeleteManagerDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("companyDashboard.managers.deleteManager")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("companyDashboard.managers.deleteManagerConfirm", {
                name: `${managerToDelete?.firstName || ""} ${managerToDelete?.lastName || ""}`.trim()
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setIsDeleteManagerDialogOpen(false);
              setManagerToDelete(null);
            }}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteManager}
              className="bg-red-600 hover:bg-red-700"
            >
              {t("dialogs.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}