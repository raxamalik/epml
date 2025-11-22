import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { 
  Store, 
  ShoppingCart, 
  Package, 
  BarChart3, 
  Users, 
  TrendingUp, 
  DollarSign,
  Search,
  Plus,
  Edit,
  Trash2,
  Eye,
  Calculator,
  Minus,
  X,
  AlertCircle,
  Settings,
  Zap
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, subDays, isToday, isYesterday, startOfDay, endOfDay } from "date-fns";

interface Product {
  id: number;
  name: string;
  price: number;
  category: string;
  stock: number;
  barcode?: string;
  description?: string;
  storeId: number;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface CartItem {
  product: Product;
  quantity: number;
}

interface Sale {
  id: string;
  items: any;
  total: string;
  paymentMethod: 'cash' | 'card';
  createdAt: string;
  storeId: number;
}

interface Store {
  id: number;
  name: string;
  address: string;
  phone?: string;
  managerId?: string;
  isActive: boolean;
}

export default function ManagerDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Get tab from URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const initialTab = urlParams.get('tab') || 'analytics';
  
  // State for active tab
  const [activeTab, setActiveTab] = useState(initialTab);

  // Function to change tabs
  const switchToTab = (tabValue: string) => {
    setActiveTab(tabValue);
    // Update URL parameter to reflect the tab change
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('tab', tabValue);
    window.history.pushState({}, '', newUrl.toString());
  };

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

  // Calculate sales by category data
  const getSalesByCategoryData = () => {
    const categoryData: { [key: string]: { sales: number; count: number } } = {};
    
    sales.forEach((sale: Sale) => {
      if (sale.items && typeof sale.items === 'object' && sale.items.items) {
        sale.items.items.forEach((item: any) => {
          const category = item.product?.category || item.category || 'Other';
          const itemTotal = (parseFloat(item.price) || 0) * (item.quantity || 1);
          
          if (!categoryData[category]) {
            categoryData[category] = { sales: 0, count: 0 };
          }
          
          categoryData[category].sales += itemTotal;
          categoryData[category].count += item.quantity || 1;
        });
      }
    });
    
    return Object.entries(categoryData)
      .map(([category, data]) => ({
        category,
        sales: Math.round(data.sales),
        count: data.count
      }))
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 5); // Top 5 categories
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
      card: { revenue: cardRevenue, percentage: cardPercentage },
      cash: { revenue: cashRevenue, percentage: cashPercentage }
    };
  };

  // Force refresh when component mounts (e.g., coming back from POS)
  useEffect(() => {
    const storeId = user?.storeId;
    if (storeId) {
      queryClient.invalidateQueries({ queryKey: ['/api/stores', storeId, 'sales'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stores', storeId, 'products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stores', storeId] });
    }
  }, [user?.storeId, queryClient]);
  
  // POS State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');
  const [customProductDialog, setCustomProductDialog] = useState(false);
  
  // Product Management State
  const [productSearchTerm, setProductSearchTerm] = useState("");
  const [productDialog, setProductDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [newProduct, setNewProduct] = useState({
    name: "",
    price: 0,
    category: "",
    stock: 0,
    barcode: "",
    description: "",
    vatRate: 21.00
  });

  // Get manager's assigned store
  const storeId = user?.storeId;

  // Fetch store details
  const { data: store, isLoading: storeLoading, error: storeError } = useQuery({
    queryKey: ['/api/stores', storeId],
    queryFn: async () => {
      if (!storeId) {
        throw new Error("No store assigned to manager");
      }
      const res = await apiRequest('GET', `/api/stores/${storeId}`);
      return await res.json();
    },
    enabled: !!storeId,
    refetchOnWindowFocus: true, // Refetch when window gets focus
  });

  // Fetch products for the store
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['/api/stores', storeId, 'products'],
    queryFn: async () => {
      if (!storeId) return [];
      const res = await apiRequest('GET', `/api/stores/${storeId}/products`);
      return await res.json();
    },
    enabled: !!storeId,
    refetchInterval: 60000, // Refetch every 60 seconds for inventory updates
    refetchOnWindowFocus: true, // Refetch when window gets focus
  });

  // Fetch sales for the store
  const { data: sales = [], isLoading: salesLoading } = useQuery({
    queryKey: ['/api/stores', storeId, 'sales'],
    queryFn: async () => {
      if (!storeId) return [];
      const res = await apiRequest('GET', `/api/stores/${storeId}/sales`);
      return await res.json();
    },
    enabled: !!storeId,
    refetchInterval: 30000, // Refetch every 30 seconds for real-time updates
    refetchOnWindowFocus: true, // Refetch when window gets focus
  });

  // Create product mutation
  const createProductMutation = useMutation({
    mutationFn: async (productData: any) => {
      const res = await apiRequest('POST', `/api/stores/${storeId}/products`, productData);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/stores', storeId, 'products'] });
      toast({ title: "Product created successfully!" });
      setProductDialog(false);
      setNewProduct({ name: "", price: 0, category: "", stock: 0, barcode: "", description: "", vatRate: 21.00 });
    },
    onError: (error: any) => {
      toast({ title: "Error creating product", description: error.message, variant: "destructive" });
    }
  });

  // Create sale mutation
  const createSaleMutation = useMutation({
    mutationFn: async (saleData: any) => {
      const res = await apiRequest('POST', '/api/sales', saleData);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/stores', storeId, 'sales'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stores', storeId, 'products'] });
      toast({ title: "Sale completed successfully!" });
      setCart([]);
    },
    onError: (error: any) => {
      toast({ title: "Error processing sale", description: error.message, variant: "destructive" });
    }
  });

  // POS Functions
  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
      toast({ title: "Out of stock", description: "This product is not available", variant: "destructive" });
      return;
    }

    const existingItem = cart.find(item => item.product.id === product.id);
    if (existingItem) {
      if (existingItem.quantity >= product.stock) {
        toast({ title: "Insufficient stock", variant: "destructive" });
        return;
      }
      setCart(cart.map(item => 
        item.product.id === product.id 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, { product, quantity: 1 }]);
    }
  };

  const removeFromCart = (productId: number) => {
    setCart(cart.filter(item => item.product.id !== productId));
  };

  const updateQuantity = (productId: number, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }
    
    const product = products.find((p: Product) => p.id === productId);
    if (product && newQuantity > product.stock) {
      toast({ title: "Insufficient stock", variant: "destructive" });
      return;
    }

    setCart(cart.map(item => 
      item.product.id === productId 
        ? { ...item, quantity: newQuantity }
        : item
    ));
  };

  const getTotalAmount = () => {
    return cart.reduce((total, item) => total + (item.product.price * item.quantity), 0);
  };

  // Get VAT breakdown for cart
  const getVATBreakdown = () => {
    const breakdown = {
      netAmount: 0,
      totalVAT: 0,
      vatByRate: {} as Record<string, number>
    };

    cart.forEach((item) => {
      const price = parseFloat(item.product.price.toString()) || 0;
      const quantity = item.quantity;
      const vatRate = parseFloat((item.product as any).vatRate?.toString() || '21') / 100 || 0;
      
      const totalPrice = price * quantity;
      const netPrice = totalPrice / (1 + vatRate);
      const vatAmount = totalPrice - netPrice;
      
      breakdown.netAmount += netPrice;
      breakdown.totalVAT += vatAmount;
      
      const rateKey = vatRate.toString();
      if (!breakdown.vatByRate[rateKey]) {
        breakdown.vatByRate[rateKey] = 0;
      }
      breakdown.vatByRate[rateKey] += vatAmount;
    });

    return breakdown;
  };

  const processSale = () => {
    if (cart.length === 0) {
      toast({ title: "Cart is empty", variant: "destructive" });
      return;
    }

    const saleData = {
      id: `sale_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      total: getTotalAmount(),
      paymentMethod,
      items: cart,
      storeId,
      userId: user?.id
    };

    createSaleMutation.mutate(saleData);
  };

  const handleCreateProduct = () => {
    if (!newProduct.name || !newProduct.price || !newProduct.category) {
      toast({ title: "Please fill all required fields", variant: "destructive" });
      return;
    }
    createProductMutation.mutate(newProduct);
  };

  // Filter products for POS
  const filteredProducts = products.filter((product: Product) =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (product.barcode && product.barcode.includes(searchTerm))
  );

  // Filter products for management
  const filteredProductsManagement = products.filter((product: Product) =>
    product.name.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
    product.category.toLowerCase().includes(productSearchTerm.toLowerCase())
  );

  // Ensure data is properly loaded before rendering analytics

  if (storeLoading || productsLoading || salesLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  if (storeError || !store) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Store className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Store Access Error</h3>
          <p className="text-muted-foreground mb-4">
            {storeError ? "Unable to load store information" : "No store assigned to your account"}
          </p>
          <p className="text-sm text-muted-foreground">
            Please contact your administrator to assign a store to your account.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-slate-950 dark:via-purple-950 dark:to-slate-900">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
                <BarChart3 className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">Manager Dashboard</h1>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Managing {store.name} • {store.address}
                </p>
              </div>
            </div>
            <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white border-none">
              <Store className="h-4 w-4 mr-1" />
              Store Active
            </Badge>
          </div>
        </div>
      </div>

      <div className="w-full px-4 sm:px-6 lg:px-8 py-8">

        {/* Analytics Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="border-slate-200 dark:border-slate-800 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-950 dark:to-indigo-900 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-blue-900 dark:text-blue-100">Total Products</CardTitle>
              <div className="p-2 bg-blue-500 rounded-lg">
                <Package className="h-4 w-4 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-900 dark:text-blue-100">{Array.isArray(products) ? products.length : 0}</div>
              <p className="text-sm text-blue-700 dark:text-blue-300">Items in catalog</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 dark:border-slate-800 bg-gradient-to-br from-amber-50 to-orange-100 dark:from-amber-950 dark:to-orange-900 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-amber-900 dark:text-amber-100">Low Stock Items</CardTitle>
              <div className="p-2 bg-amber-500 rounded-lg">
                <AlertCircle className="h-4 w-4 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-amber-900 dark:text-amber-100">
                {Array.isArray(products) ? products.filter((p: Product) => p.stock <= 10 && p.stock > 0).length : 0}
              </div>
              <p className="text-sm text-amber-700 dark:text-amber-300">Need restocking</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 dark:border-slate-800 bg-gradient-to-br from-purple-50 to-pink-100 dark:from-purple-950 dark:to-pink-900 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-purple-900 dark:text-purple-100">Today's Sales</CardTitle>
              <div className="p-2 bg-purple-500 rounded-lg">
                <ShoppingCart className="h-4 w-4 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-900 dark:text-purple-100">
                {Array.isArray(sales) ? sales.filter((sale: Sale) => {
                  const today = new Date().toDateString();
                  const saleDate = new Date(sale.createdAt).toDateString();
                  return saleDate === today;
                }).length : 0}
              </div>
              <p className="text-sm text-purple-700 dark:text-purple-300">Transactions today</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 dark:border-slate-800 bg-gradient-to-br from-emerald-50 to-green-100 dark:from-emerald-950 dark:to-green-900 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-emerald-900 dark:text-emerald-100">Revenue Today</CardTitle>
              <div className="p-2 bg-emerald-500 rounded-lg">
                <DollarSign className="h-4 w-4 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-emerald-900 dark:text-emerald-100">
                ${Array.isArray(sales) ? sales.reduce((sum: number, sale: Sale) => {
                  const today = new Date().toDateString();
                  const saleDate = new Date(sale.createdAt).toDateString();
                  return saleDate === today ? sum + (parseFloat(sale.total) || 0) : sum;
                }, 0).toFixed(2) : '0.00'}
              </div>
              <p className="text-sm text-emerald-700 dark:text-emerald-300">Daily earnings</p>
            </CardContent>
          </Card>
        </div>

        {/* Navigation Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-8">
          <TabsList className="grid w-full grid-cols-5 h-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl rounded-xl p-1 gap-1 mb-8">
            <TabsTrigger 
              value="analytics" 
              className="tabs-trigger-analytics w-full h-full flex items-center justify-center gap-2 px-2 py-0 text-sm font-medium rounded-lg transition-all duration-200 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <BarChart3 className="h-4 w-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger 
              value="pos" 
              className="tabs-trigger-pos w-full h-full flex items-center justify-center gap-2 px-2 py-0 text-sm font-medium rounded-lg transition-all duration-200 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Calculator className="h-4 w-4" />
              POS
            </TabsTrigger>
            <TabsTrigger 
              value="products" 
              className="tabs-trigger-products w-full h-full flex items-center justify-center gap-2 px-2 py-0 text-sm font-medium rounded-lg transition-all duration-200 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Package className="h-4 w-4" />
              Products
            </TabsTrigger>
            <TabsTrigger 
              value="inventory" 
              className="tabs-trigger-inventory w-full h-full flex items-center justify-center gap-2 px-2 py-0 text-sm font-medium rounded-lg transition-all duration-200 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <TrendingUp className="h-4 w-4" />
              Inventory
            </TabsTrigger>
            <TabsTrigger 
              value="sales" 
              className="tabs-trigger-sales w-full h-full flex items-center justify-center gap-2 px-2 py-0 text-sm font-medium rounded-lg transition-all duration-200 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <DollarSign className="h-4 w-4" />
              Sales History
            </TabsTrigger>
          </TabsList>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="w-full space-y-8">
          {/* Secondary Analytics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="border-slate-200 dark:border-slate-800 bg-gradient-to-br from-cyan-50 to-blue-100 dark:from-cyan-950 dark:to-blue-900 shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-cyan-900 dark:text-cyan-100">Monthly Revenue</CardTitle>
                <div className="p-2 bg-cyan-500 rounded-lg">
                  <TrendingUp className="h-4 w-4 text-white" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-cyan-900 dark:text-cyan-100">
                  ${sales.reduce((sum: number, sale: Sale) => sum + (parseFloat(sale.total) || 0), 0).toFixed(2)}
                </div>
                <p className="text-sm text-cyan-700 dark:text-cyan-300">+8% from last month</p>
              </CardContent>
            </Card>

            <Card className="border-slate-200 dark:border-slate-800 bg-gradient-to-br from-rose-50 to-pink-100 dark:from-rose-950 dark:to-pink-900 shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-rose-900 dark:text-rose-100">Average Sale</CardTitle>
                <div className="p-2 bg-rose-500 rounded-lg">
                  <BarChart3 className="h-4 w-4 text-white" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-rose-900 dark:text-rose-100">
                  ${sales.length > 0 ? (sales.reduce((sum: number, sale: Sale) => sum + (parseFloat(sale.total) || 0), 0) / sales.length).toFixed(2) : '0.00'}
                </div>
                <p className="text-sm text-rose-700 dark:text-rose-300">Per transaction</p>
              </CardContent>
            </Card>

            <Card className="border-slate-200 dark:border-slate-800 bg-gradient-to-br from-violet-50 to-purple-100 dark:from-violet-950 dark:to-purple-900 shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-violet-900 dark:text-violet-100">Customer Transactions</CardTitle>
                <div className="p-2 bg-violet-500 rounded-lg">
                  <Users className="h-4 w-4 text-white" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-violet-900 dark:text-violet-100">{sales.length}</div>
                <p className="text-sm text-violet-700 dark:text-violet-300">Total sales</p>
              </CardContent>
            </Card>
          </div>

          {/* Charts Section */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Sales Trend Chart */}
            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-100 dark:from-blue-950 dark:to-indigo-900 rounded-t-lg">
                <CardTitle className="flex items-center gap-2 text-blue-900 dark:text-blue-100">
                  <BarChart3 className="h-5 w-5" />
                  Sales Trend (Last 7 Days)
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={getSalesTrendData()}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="day" className="text-slate-600 dark:text-slate-400" />
                    <YAxis className="text-slate-600 dark:text-slate-400" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        border: '1px solid #e2e8f0', 
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                      }} 
                    />
                    <Line 
                      type="monotone" 
                      dataKey="sales" 
                      stroke="url(#salesGradient)" 
                      strokeWidth={3}
                      dot={{ fill: '#6366f1', strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6, fill: '#4f46e5' }}
                    />
                    <defs>
                      <linearGradient id="salesGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#6366f1" />
                        <stop offset="100%" stopColor="#8b5cf6" />
                      </linearGradient>
                    </defs>
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Category Sales Chart */}
            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-100 dark:from-purple-950 dark:to-pink-900 rounded-t-lg">
                <CardTitle className="flex items-center gap-2 text-purple-900 dark:text-purple-100">
                  <Package className="h-5 w-5" />
                  Sales by Category
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={getSalesByCategoryData()}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="category" className="text-slate-600 dark:text-slate-400" />
                    <YAxis className="text-slate-600 dark:text-slate-400" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        border: '1px solid #e2e8f0', 
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                      }} 
                    />
                    <Bar 
                      dataKey="sales" 
                      fill="url(#categoryGradient)" 
                      radius={[4, 4, 0, 0]}
                    />
                    <defs>
                      <linearGradient id="categoryGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#8b5cf6" />
                        <stop offset="100%" stopColor="#ec4899" />
                      </linearGradient>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Payment Methods */}
            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-emerald-50 to-green-100 dark:from-emerald-950 dark:to-green-900 rounded-t-lg">
                <CardTitle className="flex items-center gap-2 text-emerald-900 dark:text-emerald-100">
                  <DollarSign className="h-5 w-5" />
                  Payment Methods
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {(() => {
                    const paymentStats = getPaymentMethodStats();
                    return (
                      <>
                        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                            <span className="font-medium text-blue-900 dark:text-blue-100">Card Payments</span>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">{paymentStats.card.percentage}%</div>
                            <div className="text-sm text-blue-700 dark:text-blue-300">${paymentStats.card.revenue.toFixed(2)}</div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                            <span className="font-medium text-green-900 dark:text-green-100">Cash Payments</span>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-green-900 dark:text-green-100">{paymentStats.cash.percentage}%</div>
                            <div className="text-sm text-green-700 dark:text-green-300">${paymentStats.cash.revenue.toFixed(2)}</div>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </CardContent>
            </Card>

            {/* Recent Sales */}
            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-orange-50 to-red-100 dark:from-orange-950 dark:to-red-900 rounded-t-lg">
                <CardTitle className="flex items-center gap-2 text-orange-900 dark:text-orange-100">
                  <ShoppingCart className="h-5 w-5" />
                  Recent Sales
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {sales.length === 0 ? (
                    <div className="text-center py-8">
                      <ShoppingCart className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                      <p className="text-slate-500">No recent sales</p>
                    </div>
                  ) : (
                    sales
                      .sort((a: Sale, b: Sale) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .slice(0, 5)
                      .map((sale: Sale, index: number) => (
                      <div key={sale.id} className="flex items-center justify-between p-3 bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-800 dark:to-gray-800 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-500 rounded-full flex items-center justify-center">
                            <span className="text-sm font-medium text-white">{index + 1}</span>
                          </div>
                          <div>
                            <p className="font-medium text-slate-900 dark:text-slate-100">Sale #{sale.id.slice(-6)}</p>
                            <p className="text-sm text-slate-600 dark:text-slate-400">{typeof sale.items === 'object' && sale.items.items ? sale.items.items.length : 0} items • {sale.paymentMethod}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg text-slate-900 dark:text-slate-100">${(parseFloat(sale.total) || 0).toFixed(2)}</p>
                          <p className="text-sm text-slate-600 dark:text-slate-400">{new Date(sale.createdAt).toLocaleTimeString()}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card className="border-slate-200 dark:border-slate-800 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-100 dark:from-indigo-950 dark:to-purple-900 rounded-t-lg">
              <CardTitle className="flex items-center gap-2 text-indigo-900 dark:text-indigo-100">
                <Zap className="h-5 w-5" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid gap-4 md:grid-cols-4">
                <Button 
                  onClick={() => switchToTab('pos')}
                  className="h-20 flex flex-col gap-2 bg-gradient-to-br from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white border-0 shadow-lg transform hover:scale-105 transition-all duration-200"
                >
                  <ShoppingCart className="h-6 w-6" />
                  <span className="font-medium">New Sale</span>
                </Button>
                <Button 
                  onClick={() => switchToTab('products')}
                  className="h-20 flex flex-col gap-2 bg-gradient-to-br from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white border-0 shadow-lg transform hover:scale-105 transition-all duration-200"
                >
                  <Package className="h-6 w-6" />
                  <span className="font-medium">Manage Products</span>
                </Button>
                <Button 
                  onClick={() => switchToTab('inventory')}
                  className="h-20 flex flex-col gap-2 bg-gradient-to-br from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white border-0 shadow-lg transform hover:scale-105 transition-all duration-200"
                >
                  <TrendingUp className="h-6 w-6" />
                  <span className="font-medium">Check Inventory</span>
                </Button>
                <Button 
                  onClick={() => switchToTab('sales')}
                  className="h-20 flex flex-col gap-2 bg-gradient-to-br from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white border-0 shadow-lg transform hover:scale-105 transition-all duration-200"
                >
                  <BarChart3 className="h-6 w-6" />
                  <span className="font-medium">Sales History</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* POS Tab */}
        <TabsContent value="pos" className="w-full">
          <Card className="w-full border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-100 dark:from-green-950 dark:to-emerald-900 rounded-t-lg">
              <CardTitle className="flex items-center gap-2 text-green-900 dark:text-green-100">
                <Calculator className="h-5 w-5" />
                Point of Sale - {store.name}
              </CardTitle>
              <CardDescription className="text-green-700 dark:text-green-300">
                Process sales and manage transactions
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Product Selection */}
                <div className="lg:col-span-2 space-y-4">
                  <div className="flex gap-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <Input
                        placeholder="Search products by name, category, or barcode..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 max-h-[500px] overflow-y-auto p-2 border rounded-lg bg-slate-50 dark:bg-slate-800/50">
                    {filteredProducts.map((product: Product) => (
                      <Card 
                        key={product.id} 
                        className={`cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-lg border-slate-200 dark:border-slate-700 ${
                          product.stock <= 0 ? 'opacity-50 bg-gray-100 dark:bg-gray-800' : 'bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 hover:from-green-50 hover:to-emerald-50 dark:hover:from-green-950 dark:hover:to-emerald-950'
                        }`}
                        onClick={() => addToCart(product)}
                      >
                        <CardContent className="p-4">
                          <div className="space-y-2">
                            <h3 className="font-medium text-sm text-slate-900 dark:text-slate-100">{product.name}</h3>
                            <p className="text-xs text-slate-600 dark:text-slate-400">{product.category}</p>
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-lg text-green-700 dark:text-green-400">${(parseFloat(product.price.toString()) || 0).toFixed(2)}</span>
                              <Badge 
                                variant={product.stock > 10 ? "default" : product.stock > 0 ? "secondary" : "destructive"}
                                className={product.stock > 10 ? "bg-green-500" : product.stock > 0 ? "bg-yellow-500" : "bg-red-500"}
                              >
                                {product.stock} left
                              </Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                {/* Cart */}
                <div className="space-y-4">
                  <Card className="border-slate-200 dark:border-slate-800 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-950 dark:to-indigo-900 shadow-lg">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2 text-blue-900 dark:text-blue-100">
                        <ShoppingCart className="h-5 w-5" />
                        Shopping Cart
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {cart.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">Cart is empty</p>
                      ) : (
                        <div className="space-y-3">
                          {cart.map((item) => (
                            <div key={item.product.id} className="flex items-center justify-between p-3 border rounded">
                              <div className="flex-1">
                                <h4 className="font-medium text-sm">{item.product.name}</h4>
                                <p className="text-xs text-muted-foreground">${(parseFloat(item.product.price.toString()) || 0).toFixed(2)} each</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <span className="w-8 text-center">{item.quantity}</span>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="destructive"
                                  onClick={() => removeFromCart(item.product.id)}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {cart.length > 0 && (
                        <div className="space-y-4 pt-4 border-t">
                          {/* VAT Breakdown */}
                          <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                            <h4 className="font-medium text-sm text-slate-700 dark:text-slate-300">Price Breakdown</h4>
                            {(() => {
                              const breakdown = getVATBreakdown();
                              return (
                                <div className="space-y-1 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-slate-600 dark:text-slate-400">Net Amount:</span>
                                    <span className="font-medium">${breakdown.netAmount.toFixed(2)}</span>
                                  </div>
                                  {Object.entries(breakdown.vatByRate).map(([rate, amount]) => (
                                    <div key={rate} className="flex justify-between">
                                      <span className="text-slate-600 dark:text-slate-400">VAT ({(parseFloat(rate) * 100).toFixed(0)}%):</span>
                                      <span className="font-medium">${amount.toFixed(2)}</span>
                                    </div>
                                  ))}
                                  <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-slate-600">
                                    <span className="text-slate-600 dark:text-slate-400">Total VAT:</span>
                                    <span className="font-medium">${breakdown.totalVAT.toFixed(2)}</span>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                          
                          <div className="flex justify-between items-center font-bold text-lg">
                            <span>Total:</span>
                            <span>${getTotalAmount().toFixed(2)}</span>
                          </div>
                          
                          <div className="space-y-2">
                            <Label>Payment Method</Label>
                            <div className="flex gap-2">
                              <Button 
                                variant={paymentMethod === 'cash' ? 'default' : 'outline'}
                                onClick={() => setPaymentMethod('cash')}
                                className="flex-1"
                              >
                                Cash
                              </Button>
                              <Button 
                                variant={paymentMethod === 'card' ? 'default' : 'outline'}
                                onClick={() => setPaymentMethod('card')}
                                className="flex-1"
                              >
                                Card
                              </Button>
                            </div>
                          </div>

                          <Button 
                            onClick={processSale} 
                            className="w-full"
                            disabled={createSaleMutation.isPending}
                          >
                            {createSaleMutation.isPending ? 'Processing...' : 'Complete Sale'}
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Products Tab */}
        <TabsContent value="products" className="w-full">
          <Card className="w-full border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-100 dark:from-purple-950 dark:to-pink-900 rounded-t-lg">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="flex items-center gap-2 text-purple-900 dark:text-purple-100">
                    <Package className="h-5 w-5" />
                    Product Management
                  </CardTitle>
                  <CardDescription className="text-purple-700 dark:text-purple-300">Manage your store's product catalog</CardDescription>
                </div>
                <Dialog open={productDialog} onOpenChange={setProductDialog}>
                  <DialogTrigger asChild>
                    <Button className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white border-none shadow-lg">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Product
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Product</DialogTitle>
                      <DialogDescription>
                        Add a new product to your store inventory
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="name">Product Name *</Label>
                        <Input
                          id="name"
                          value={newProduct.name}
                          onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                          placeholder="Enter product name"
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <Label htmlFor="price">Price *</Label>
                          <Input
                            id="price"
                            type="number"
                            step="0.01"
                            value={newProduct.price}
                            onChange={(e) => setNewProduct({ ...newProduct, price: parseFloat(e.target.value) || 0 })}
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <Label htmlFor="stock">Stock Quantity *</Label>
                          <Input
                            id="stock"
                            type="number"
                            value={newProduct.stock}
                            onChange={(e) => setNewProduct({ ...newProduct, stock: parseInt(e.target.value) || 0 })}
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <Label htmlFor="vatRate">VAT Rate (%) *</Label>
                          <Input
                            id="vatRate"
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            value={newProduct.vatRate}
                            onChange={(e) => setNewProduct({ ...newProduct, vatRate: parseFloat(e.target.value) || 0 })}
                            placeholder="Enter VAT rate (e.g., 21 for 21%)"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Enter percentage (e.g., 6 for 6%, 21 for 21%)
                          </p>
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="category">Category *</Label>
                        <Input
                          id="category"
                          value={newProduct.category}
                          onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                          placeholder="e.g., Beverages, Food, Electronics"
                        />
                      </div>
                      <div>
                        <Label htmlFor="barcode">Barcode</Label>
                        <Input
                          id="barcode"
                          value={newProduct.barcode}
                          onChange={(e) => setNewProduct({ ...newProduct, barcode: e.target.value })}
                          placeholder="Product barcode"
                        />
                      </div>
                      <div>
                        <Label htmlFor="description">Description</Label>
                        <Input
                          id="description"
                          value={newProduct.description}
                          onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                          placeholder="Product description"
                        />
                      </div>
                      <Button 
                        onClick={handleCreateProduct} 
                        className="w-full"
                        disabled={createProductMutation.isPending}
                      >
                        {createProductMutation.isPending ? 'Creating...' : 'Create Product'}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search products..."
                    value={productSearchTerm}
                    onChange={(e) => setProductSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Price (Inc. VAT)</TableHead>
                      <TableHead>VAT Rate</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProductsManagement.map((product: Product) => (
                      <TableRow key={product.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{product.name}</div>
                            {product.barcode && (
                              <div className="text-sm text-muted-foreground">{product.barcode}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{product.category}</TableCell>
                        <TableCell>${(parseFloat(product.price.toString()) || 0).toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {((parseFloat(product.vatRate) || 0) * 100).toFixed(0)}%
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={product.stock > 10 ? "default" : product.stock > 0 ? "secondary" : "destructive"}>
                            {product.stock}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={product.stock > 0 ? "default" : "destructive"}>
                            {product.stock > 0 ? "In Stock" : "Out of Stock"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="outline">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Inventory Tab */}
        <TabsContent value="inventory" className="w-full">
          <Card className="w-full border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-orange-50 to-red-100 dark:from-orange-950 dark:to-red-900 rounded-t-lg">
              <CardTitle className="flex items-center gap-2 text-orange-900 dark:text-orange-100">
                <TrendingUp className="h-5 w-5" />
                Inventory Management
              </CardTitle>
              <CardDescription className="text-orange-700 dark:text-orange-300">Monitor stock levels and inventory status</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-950 dark:to-emerald-900 border-green-200 dark:border-green-800 shadow-lg">
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-green-700 dark:text-green-300">
                          {products.filter((p: Product) => p.stock > 10).length}
                        </div>
                        <p className="text-sm text-green-600 dark:text-green-400 font-medium">Well Stocked</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-gradient-to-br from-amber-50 to-orange-100 dark:from-amber-950 dark:to-orange-900 border-amber-200 dark:border-amber-800 shadow-lg">
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-amber-700 dark:text-amber-300">
                          {products.filter((p: Product) => p.stock > 0 && p.stock <= 10).length}
                        </div>
                        <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">Low Stock</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-gradient-to-br from-red-50 to-rose-100 dark:from-red-950 dark:to-rose-900 border-red-200 dark:border-red-800 shadow-lg">
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-red-700 dark:text-red-300">
                          {products.filter((p: Product) => p.stock === 0).length}
                        </div>
                        <p className="text-sm text-red-600 dark:text-red-400 font-medium">Out of Stock</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Current Stock</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Updated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products
                      .sort((a: Product, b: Product) => a.stock - b.stock)
                      .map((product: Product) => (
                        <TableRow key={product.id}>
                          <TableCell>{product.name}</TableCell>
                          <TableCell>
                            <Badge 
                              variant={
                                product.stock > 10 ? "default" : 
                                product.stock > 0 ? "secondary" : "destructive"
                              }
                            >
                              {product.stock} units
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {product.stock > 10 ? (
                              <span className="text-green-600">Well Stocked</span>
                            ) : product.stock > 0 ? (
                              <span className="text-orange-600">Low Stock</span>
                            ) : (
                              <span className="text-red-600">Out of Stock</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {product.updatedAt ? new Date(product.updatedAt).toLocaleDateString() : 'N/A'}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sales History Tab */}
        <TabsContent value="sales" className="w-full">
          <Card className="w-full border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-teal-50 to-cyan-100 dark:from-teal-950 dark:to-cyan-900 rounded-t-lg">
              <CardTitle className="flex items-center gap-2 text-teal-900 dark:text-teal-100">
                <BarChart3 className="h-5 w-5" />
                Sales History
              </CardTitle>
              <CardDescription className="text-teal-700 dark:text-teal-300">View transaction history and sales data</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              {sales.length === 0 ? (
                <div className="text-center py-8">
                  <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No sales recorded yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sale ID</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Payment Method</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sales.map((sale: Sale) => (
                      <TableRow key={sale.id}>
                        <TableCell className="font-mono text-sm">{sale.id}</TableCell>
                        <TableCell className="font-semibold">${(parseFloat(sale.total) || 0).toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant={sale.paymentMethod === 'cash' ? 'default' : 'secondary'}>
                            {sale.paymentMethod.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {sale.items && typeof sale.items === 'object' && sale.items.items ? sale.items.items.length : 0} items
                        </TableCell>
                        <TableCell>
                          {new Date(sale.createdAt).toLocaleDateString()} {new Date(sale.createdAt).toLocaleTimeString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}