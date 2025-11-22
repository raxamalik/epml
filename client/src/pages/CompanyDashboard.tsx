import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
}

const storeFormSchema = z.object({
  name: z.string().min(1, "Store name is required"),
  address: z.string().min(1, "Address is required"),
  phone: z.string().optional(),
  managerId: z.string().optional(),
  revenue: z.number().min(0, "Revenue must be non-negative"),
  customerCount: z.number().min(0, "Customer count must be non-negative"),
  productCount: z.number().min(0, "Product count must be non-negative"),
  isActive: z.boolean()
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
  const [stores, setStores] = useState<Store[]>([]);
  const [filteredStores, setFilteredStores] = useState<Store[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isStoreDialogOpen, setIsStoreDialogOpen] = useState(false);
  const [analytics, setAnalytics] = useState({
    totalStores: 0,
    activeStores: 0,
    totalRevenue: 0,
    totalProducts: 0,
    totalCustomers: 0,
    monthlyGrowth: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  
  // Manager Management State
  const [managers, setManagers] = useState<any[]>([]);
  const [selectedManager, setSelectedManager] = useState<any | null>(null);
  const [isManagerDialogOpen, setIsManagerDialogOpen] = useState(false);
  const [isManagerEditMode, setIsManagerEditMode] = useState(false);
  const [managerSearchTerm, setManagerSearchTerm] = useState("");
  
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
      isActive: true
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
      // Fetch stores data
      const storesResponse = await fetch('/api/company/stores');
      if (storesResponse.ok) {
        const storesData = await storesResponse.json();
        setStores(storesData);
      }

      // Fetch analytics data
      const analyticsResponse = await fetch('/api/company/analytics');
      if (analyticsResponse.ok) {
        const analyticsData = await analyticsResponse.json();
        setAnalytics(analyticsData);
      }

      // Fetch managers data
      const managersResponse = await fetch('/api/managers');
      if (managersResponse.ok) {
        const managersData = await managersResponse.json();
        setManagers(managersData);
      }

      // Fetch company data to get max branches limit
      const companyResponse = await fetch('/api/company/profile');
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

  const handleCreateStore = async (data: StoreFormData) => {
    if (stores.length >= maxBranches) {
      toast({
        title: "Limit Reached",
        description: `You have reached the maximum number of stores (${maxBranches}) allowed for your plan.`,
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch('/api/stores', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${document.cookie.split('sessionId=')[1]?.split(';')[0] || ''}`,
        },
        credentials: 'include',
        body: JSON.stringify({
          ...data,
          isActive: true,
          revenue: 0,
          customerCount: 0,
          productCount: 0
        }),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Store created successfully",
        });
        setIsStoreDialogOpen(false);
        form.reset();
        // Refresh the data to show the new store
        fetchCompanyData();
      } else {
        // Parse the error response to get the actual error message
        const errorData = await response.json();
        const errorMessage = errorData.message || 'Failed to create store';
        throw new Error(errorMessage);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create store",
        variant: "destructive",
      });
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
      const response = await fetch(`/api/stores/${selectedStore.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${document.cookie.split('sessionId=')[1]?.split(';')[0] || ''}`,
        },
        credentials: 'include',
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
        const errorMessage = errorData.message || 'Failed to update store';
        throw new Error(errorMessage);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update store",
        variant: "destructive",
      });
    }
  };

  // Manager Handler Functions
  const handleCreateManager = async (data: ManagerFormData) => {
    try {
      const response = await fetch('/api/managers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${document.cookie.split('sessionId=')[1]?.split(';')[0] || ''}`,
        },
        credentials: 'include',
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
        const errorMessage = errorData.message || 'Failed to create manager';
        throw new Error(errorMessage);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create manager",
        variant: "destructive",
      });
    }
  };

  const handleUpdateManager = async (data: ManagerFormData) => {
    if (!selectedManager) return;

    try {
      const response = await fetch(`/api/managers/${selectedManager.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
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

  const handleDeleteManager = async (manager: any) => {
    if (!confirm(`Are you sure you want to delete ${manager.firstName} ${manager.lastName}?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/managers/${manager.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setManagers(managers.filter(m => m.id !== manager.id));
        toast({
          title: "Success",
          description: "Manager deleted successfully",
        });
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
                  <h1 className="text-2xl font-bold">Company Dashboard</h1>
                  <p className="text-blue-100 text-sm">
                    Manage stores and view analytics
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-sm">System Active</span>
                </div>
                <div className="flex items-center gap-2">
                  <Store className="h-4 w-4" />
                  <span className="text-sm">{stores.length} Active Stores</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span className="text-sm">{managers.length} Managers</span>
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
                  onClick={() => setIsStoreDialogOpen(true)} 
                  className="bg-white/20 hover:bg-white/30 text-white font-semibold px-4 py-2 rounded-lg backdrop-blur-sm border border-white/30 transition-all duration-200 hover:scale-105"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Store ({stores.length}/{maxBranches})
                </Button>
              ) : (
                <div className="text-right">
                  <Button disabled className="bg-white/10 cursor-not-allowed text-white/60 px-4 py-2 rounded-lg backdrop-blur-sm">
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Limit Reached ({stores.length}/{maxBranches})
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
            <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-200">Total Stores</CardTitle>
            <div className="p-2 bg-blue-500 rounded-lg">
              <Store className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">{analytics.totalStores}</div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {analytics.activeStores} active stores
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm overflow-hidden hover:shadow-xl transition-all duration-200 hover:scale-105">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-gradient-to-r from-green-50 to-emerald-100 dark:from-green-900 dark:to-emerald-800">
            <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-200">Total Revenue</CardTitle>
            <div className="p-2 bg-green-500 rounded-lg">
              <DollarSign className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">€{analytics.totalRevenue.toLocaleString()}</div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              +{analytics.monthlyGrowth}% from last month
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm overflow-hidden hover:shadow-xl transition-all duration-200 hover:scale-105">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-gradient-to-r from-purple-50 to-pink-100 dark:from-purple-900 dark:to-pink-800">
            <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-200">Products</CardTitle>
            <div className="p-2 bg-purple-500 rounded-lg">
              <ShoppingCart className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">{analytics.totalProducts}</div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Across all stores
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm overflow-hidden hover:shadow-xl transition-all duration-200 hover:scale-105">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-gradient-to-r from-orange-50 to-red-100 dark:from-orange-900 dark:to-red-800">
            <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-200">Customers</CardTitle>
            <div className="p-2 bg-orange-500 rounded-lg">
              <Users className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">{analytics.totalCustomers}</div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Total customer base
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Charts Section */}
      <div className="space-y-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold">Analytics Overview</h2>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue Bar Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Store Revenue Comparison
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
                Customers & Products by Store
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
      <Tabs defaultValue="stores" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="stores">My Stores</TabsTrigger>
          <TabsTrigger value="managers">Managers</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Stores Tab */}
        <TabsContent value="stores" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Store className="h-5 w-5" />
                Store Locations
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Search Field */}
              <div className="mb-6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search stores by name, address, or manager..."
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
                      <div className="bg-primary/10 p-2 rounded-lg">
                        <Store className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{store.name}</h3>
                        <p className="text-sm text-slate-600 flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {store.address}
                        </p>
                        <p className="text-sm text-slate-600 flex items-center gap-1">
                          <UserCheck className="h-3 w-3" />
                          Manager: {store.manager}
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
                  Manager Management
                </CardTitle>
                <Button onClick={() => {
                  setSelectedManager(null);
                  setIsManagerEditMode(false);
                  setIsManagerDialogOpen(true);
                  managerForm.reset();
                }} className="bg-primary hover:bg-blue-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Manager
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Search Field */}
              <div className="mb-6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search managers by name, email, or role..."
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
                          {manager.isActive ? 'Active' : 'Inactive'}
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
                    <p>No managers found. Add your first manager to get started.</p>
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
                  Company Profile
                </CardTitle>
                <CardDescription>
                  Update your company information and contact details
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="company-name">Company Name</Label>
                  <Input id="company-name" defaultValue="Tech Solutions Ltd." />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="reg-number">Registration Number (IČO)</Label>
                    <Input id="reg-number" defaultValue="12345678" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vat-number">VAT Number (DIČ)</Label>
                    <Input id="vat-number" defaultValue="CZ12345678" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-email">Company Email</Label>
                  <Input id="company-email" type="email" defaultValue="info@techsolutions.cz" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-phone">Phone Number</Label>
                  <Input id="company-phone" defaultValue="+420 123 456 789" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-address">Business Address</Label>
                  <Textarea id="company-address" defaultValue="Wenceslas Square 1, 110 00 Prague 1, Czech Republic" />
                </div>
                <Button className="w-full">
                  <Save className="h-4 w-4 mr-2" />
                  Save Profile Changes
                </Button>
              </CardContent>
            </Card>

            {/* System Preferences */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  System Preferences
                </CardTitle>
                <CardDescription>
                  Configure system settings and notifications
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive email alerts for important events
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>SMS Alerts</Label>
                    <p className="text-sm text-muted-foreground">
                      Get SMS notifications for critical issues
                    </p>
                  </div>
                  <Switch />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Weekly Reports</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically generate weekly analytics reports
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select defaultValue="prague">
                    <SelectTrigger>
                      <SelectValue placeholder="Select timezone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="prague">Prague (UTC+1)</SelectItem>
                      <SelectItem value="london">London (UTC+0)</SelectItem>
                      <SelectItem value="berlin">Berlin (UTC+1)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="currency">Default Currency</Label>
                  <Select defaultValue="eur">
                    <SelectTrigger>
                      <SelectValue placeholder="Select currency" />
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
                  Update Preferences
                </Button>
              </CardContent>
            </Card>
            
            {/* Store Configuration */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Store className="h-5 w-5" />
                  Store Configuration
                </CardTitle>
                <CardDescription>
                  Manage store settings and operational hours
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Maximum Number of Stores</Label>
                  <div className="flex items-center gap-2">
                    <Input type="number" defaultValue="10" min="1" max="50" />
                    <span className="text-sm text-muted-foreground">stores allowed</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Current: {stores.length} / 10 stores used
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label>Default Operating Hours</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Opening Time</Label>
                      <Input type="time" defaultValue="08:00" />
                    </div>
                    <div>
                      <Label className="text-xs">Closing Time</Label>
                      <Input type="time" defaultValue="20:00" />
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Auto-sync Inventory</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically sync inventory across stores
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Centralized Pricing</Label>
                    <p className="text-sm text-muted-foreground">
                      Use unified pricing across all locations
                    </p>
                  </div>
                  <Switch />
                </div>
                
                <Button variant="outline" className="w-full">
                  <Store className="h-4 w-4 mr-2" />
                  Apply Store Settings
                </Button>
              </CardContent>
            </Card>

            {/* Security & Access */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Security & Access
                </CardTitle>
                <CardDescription>
                  Manage security settings and user permissions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Password Policy</Label>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox id="require-uppercase" defaultChecked />
                      <Label htmlFor="require-uppercase" className="text-sm">
                        Require uppercase letters
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="require-numbers" defaultChecked />
                      <Label htmlFor="require-numbers" className="text-sm">
                        Require numbers
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="require-symbols" />
                      <Label htmlFor="require-symbols" className="text-sm">
                        Require special characters
                      </Label>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="session-timeout">Session Timeout</Label>
                  <Select defaultValue="30">
                    <SelectTrigger>
                      <SelectValue placeholder="Select timeout" />
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
                    <Label>Two-Factor Authentication</Label>
                    <p className="text-sm text-muted-foreground">
                      Enable 2FA for enhanced security
                    </p>
                  </div>
                  <Switch />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Login Audit Trail</Label>
                    <p className="text-sm text-muted-foreground">
                      Track all user login activities
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                
                <Button variant="outline" className="w-full">
                  <Shield className="h-4 w-4 mr-2" />
                  Update Security Settings
                </Button>
              </CardContent>
            </Card>
          </div>
          
          {/* Danger Zone */}
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                Danger Zone
              </CardTitle>
              <CardDescription>
                These actions are permanent and cannot be undone
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border border-red-200 rounded-lg">
                <div>
                  <h4 className="font-semibold text-red-600">Export Company Data</h4>
                  <p className="text-sm text-slate-600">Download all your company and store data</p>
                </div>
                <Button variant="outline" className="border-red-200 text-red-600 hover:bg-red-50">
                  <Download className="h-4 w-4 mr-2" />
                  Export Data
                </Button>
              </div>
              
              <div className="flex items-center justify-between p-4 border border-red-200 rounded-lg">
                <div>
                  <h4 className="font-semibold text-red-600">Close Company Account</h4>
                  <p className="text-sm text-slate-600">Permanently close your company account and all associated data</p>
                </div>
                <Button variant="destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Close Account
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Store Dialog */}
      <Dialog open={isStoreDialogOpen} onOpenChange={setIsStoreDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add New Store</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleCreateStore)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Store Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter store name" {...field} data-testid="input-store-name" />
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
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter phone number" {...field} data-testid="input-store-phone" />
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
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter store address" {...field} data-testid="input-store-address" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="managerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assign Manager (Optional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-manager">
                          <SelectValue placeholder="Select a manager" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">No manager assigned</SelectItem>
                        {managers.map((manager) => (
                          <SelectItem key={manager.id} value={manager.id.toString()}>
                            {manager.firstName} {manager.lastName} - {manager.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsStoreDialogOpen(false)} data-testid="button-cancel-store">
                  Cancel
                </Button>
                <Button type="submit" data-testid="button-create-store">
                  Create Store
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* View Store Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Store Details</DialogTitle>
          </DialogHeader>
          {selectedStore && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Store Name</label>
                  <p className="text-lg font-semibold">{selectedStore.name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Status</label>
                  <div className="mt-1">
                    <Badge variant={selectedStore.status === 'active' ? 'default' : 'secondary'}>
                      {selectedStore.status}
                    </Badge>
                  </div>
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-500">Address</label>
                <p className="text-base">{selectedStore.address}</p>
              </div>

              {selectedStore.phone && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Phone</label>
                  <p className="text-base">{selectedStore.phone}</p>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-gray-500">Manager</label>
                <p className="text-base">{selectedStore.manager}</p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Revenue</label>
                  <p className="text-lg font-semibold">€{selectedStore.revenue.toLocaleString()}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Products</label>
                  <p className="text-lg font-semibold">{selectedStore.products}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Customers</label>
                  <p className="text-lg font-semibold">{selectedStore.customers}</p>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-500">Created</label>
                <p className="text-base">{selectedStore.createdAt}</p>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
                  Close
                </Button>
                <Button onClick={() => {
                  setIsViewDialogOpen(false);
                  handleEditStore(selectedStore);
                }}>
                  Edit Store
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
            <DialogTitle>Edit Store</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleUpdateStore)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Store Name</FormLabel>
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
                      <FormLabel>Phone</FormLabel>
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
                    <FormLabel>Address</FormLabel>
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
                      <FormLabel>Revenue</FormLabel>
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
                      <FormLabel>Customer Count</FormLabel>
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
                      <FormLabel>Product Count</FormLabel>
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
                  Cancel
                </Button>
                <Button type="submit">
                  Update Store
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
              {isManagerEditMode ? 'Edit Manager' : 'Add New Manager'}
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
                      <FormLabel>First Name</FormLabel>
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
                      <FormLabel>Last Name</FormLabel>
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
                      <FormLabel>Email</FormLabel>
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
                      <FormLabel>Phone</FormLabel>
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
                    <FormLabel>Password {isManagerEditMode && "(leave blank to keep current)"}</FormLabel>
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
                      <FormLabel>Role</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select role" />
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
                      <FormLabel>Assign to Store (Optional)</FormLabel>
                      <Select onValueChange={(value) => field.onChange(value ? Number(value) : undefined)} defaultValue={field.value?.toString()}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select store" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">No store assigned</SelectItem>
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
                      <FormLabel>Active Status</FormLabel>
                      <div className="text-sm text-muted-foreground">
                        Enable or disable this manager account
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
                  Cancel
                </Button>
                <Button type="submit">
                  {isManagerEditMode ? 'Update Manager' : 'Create Manager'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}