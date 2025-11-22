import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Package,
  Search,
  TrendingUp,
  Store,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Tag,
  DollarSign,
  BarChart3,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ProductWithStores {
  id: number;
  name: string;
  description: string;
  price: number;
  categoryName: string;
  barcode?: string;
  imageUrl?: string;
  stores: Array<{
    storeId: number;
    storeName: string;
    stock: number;
    totalSales: number;
    revenue: number;
  }>;
  totalStock: number;
  totalSales: number;
  totalRevenue: number;
}

interface Category {
  id: number;
  name: string;
  productCount: number;
}

export default function CompanyProducts() {
  const [products, setProducts] = useState<ProductWithStores[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedStore, setSelectedStore] = useState("all");
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch company stores
      const storesResponse = await fetch('/api/company/stores');
      if (storesResponse.ok) {
        const storesData = await storesResponse.json();
        setStores(storesData);
      }

      // Fetch categories
      const categoriesResponse = await fetch('/api/categories');
      if (categoriesResponse.ok) {
        const categoriesData = await categoriesResponse.json();
        setCategories(categoriesData);
      }

      // Fetch all products with store data
      const productsResponse = await fetch('/api/company/products-overview');
      if (productsResponse.ok) {
        const productsData = await productsResponse.json();
        setProducts(productsData);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to load products data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = 
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.barcode?.includes(searchTerm);
    
    const matchesCategory = selectedCategory === "all" || product.categoryName === selectedCategory;
    
    const matchesStore = selectedStore === "all" || 
      product.stores.some(s => s.storeId.toString() === selectedStore);
    
    return matchesSearch && matchesCategory && matchesStore;
  });

  const getStockStatus = (totalStock: number) => {
    if (totalStock === 0) return { icon: XCircle, color: "text-red-500", label: "Out of Stock", variant: "destructive" as const };
    if (totalStock < 10) return { icon: AlertTriangle, color: "text-yellow-500", label: "Low Stock", variant: "secondary" as const };
    return { icon: CheckCircle, color: "text-green-500", label: "In Stock", variant: "default" as const };
  };

  const totalProducts = products.length;
  const totalStockAcrossAll = products.reduce((sum, p) => sum + p.totalStock, 0);
  const totalRevenue = products.reduce((sum, p) => sum + p.totalRevenue, 0);
  const totalSales = products.reduce((sum, p) => sum + p.totalSales, 0);
  const lowStockProducts = products.filter(p => p.totalStock > 0 && p.totalStock < 10).length;
  const outOfStockProducts = products.filter(p => p.totalStock === 0).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-slate-600">Loading products data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Company Products Overview</h1>
        <p className="text-slate-600 mt-2">View all products, stock levels by branch, and sales performance</p>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Products</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalProducts}</div>
            <p className="text-xs text-muted-foreground">Across {stores.length} stores</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Stock</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStockAcrossAll.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {lowStockProducts} low stock • {outOfStockProducts} out of stock
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSales.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Units sold</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{totalRevenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">From all products</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search by name, description, or barcode..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search-products"
              />
            </div>

            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger data-testid="select-category-filter">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.name}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedStore} onValueChange={setSelectedStore}>
              <SelectTrigger data-testid="select-store-filter">
                <SelectValue placeholder="Filter by store" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stores</SelectItem>
                {stores.map((store) => (
                  <SelectItem key={store.id} value={store.id.toString()}>
                    {store.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Products Inventory ({filteredProducts.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Total Stock</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Stock by Store</TableHead>
                  <TableHead className="text-right">Sales</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No products found matching your filters
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts.map((product) => {
                    const stockStatus = getStockStatus(product.totalStock);
                    const StockIcon = stockStatus.icon;
                    
                    return (
                      <TableRow key={product.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {product.imageUrl ? (
                              <img 
                                src={product.imageUrl} 
                                alt={product.name}
                                className="w-10 h-10 rounded object-cover"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded bg-slate-100 flex items-center justify-center">
                                <Package className="h-5 w-5 text-slate-400" />
                              </div>
                            )}
                            <div>
                              <p className="font-medium">{product.name}</p>
                              {product.barcode && (
                                <p className="text-xs text-slate-500">{product.barcode}</p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="flex items-center gap-1 w-fit">
                            <Tag className="h-3 w-3" />
                            {product.categoryName || 'Uncategorized'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">€{product.price.toFixed(2)}</span>
                        </TableCell>
                        <TableCell>
                          <span className="font-semibold text-lg">{product.totalStock}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={stockStatus.variant} className="flex items-center gap-1 w-fit">
                            <StockIcon className="h-3 w-3" />
                            {stockStatus.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1 min-w-[200px]">
                            {product.stores.map((store) => (
                              <div key={store.storeId} className="flex items-center justify-between text-xs border-b pb-1 last:border-b-0">
                                <span className="flex items-center gap-1">
                                  <Store className="h-3 w-3 text-slate-400" />
                                  {store.storeName}
                                </span>
                                <span className={`font-medium ${
                                  store.stock === 0 ? 'text-red-500' : 
                                  store.stock < 5 ? 'text-yellow-600' : 
                                  'text-green-600'
                                }`}>
                                  {store.stock} units
                                </span>
                              </div>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div>
                            <p className="font-medium">{product.totalSales}</p>
                            <p className="text-xs text-slate-500">units</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div>
                            <p className="font-medium text-green-600">€{product.totalRevenue.toLocaleString()}</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Products by Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {categories.map((category) => {
                const categoryProducts = products.filter(p => p.categoryName === category.name);
                const categoryRevenue = categoryProducts.reduce((sum, p) => sum + p.totalRevenue, 0);
                const categoryStock = categoryProducts.reduce((sum, p) => sum + p.totalStock, 0);
                
                return (
                  <div key={category.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 transition-colors">
                    <div>
                      <p className="font-medium">{category.name}</p>
                      <p className="text-sm text-slate-600">{categoryProducts.length} products • {categoryStock} units in stock</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-green-600">€{categoryRevenue.toLocaleString()}</p>
                      <p className="text-xs text-slate-500">revenue</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              Stock by Store
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stores.map((store) => {
                const storeProducts = products.flatMap(p => 
                  p.stores.filter(s => s.storeId === store.id)
                );
                const storeStock = storeProducts.reduce((sum, s) => sum + s.stock, 0);
                const storeRevenue = storeProducts.reduce((sum, s) => sum + s.revenue, 0);
                const storeSales = storeProducts.reduce((sum, s) => sum + s.totalSales, 0);
                
                return (
                  <div key={store.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 transition-colors">
                    <div>
                      <p className="font-medium">{store.name}</p>
                      <p className="text-sm text-slate-600">{storeStock} units • {storeSales} sales</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-green-600">€{storeRevenue.toLocaleString()}</p>
                      <p className="text-xs text-slate-500">revenue</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
