import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Search, 
  Plus, 
  Edit, 
  Trash2, 
  MoreHorizontal,
  Package,
  DollarSign,
  Box,
  ImageIcon,
  Tag,
  Barcode,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  Grid,
  List,
  Filter,
  Eye,
  Star,
  Palette,
  Layers
} from "lucide-react";

interface Product {
  id: number;
  name: string;
  price: string;
  vatRate: string;
  category: string;
  categoryId?: number;
  stock: number;
  barcode?: string;
  description?: string;
  imageUrl?: string;
  storeId: number;
}

interface ProductCategory {
  id: number;
  name: string;
  description?: string;
  companyId?: number;
  userId?: string;
}

function Products() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    price: "",
    vatRate: "21.00",
    category: "",
    categoryId: "",
    stock: "",
    barcode: "",
    description: "",
    imageUrl: ""
  });
  
  const [uploadedImageUrl, setUploadedImageUrl] = useState("");
  const [isImageGalleryOpen, setIsImageGalleryOpen] = useState(false);
  const [selectedImageFromGallery, setSelectedImageFromGallery] = useState("");
  
  // Fetch all uploaded images for the gallery
  const { data: uploadedImages = [] } = useQuery<string[]>({
    queryKey: ["/api/uploaded-images"],
    enabled: !!user,
  });

  // Determine the storeId to use
  // For managers: use their assigned storeId
  // For company admins: allow them to select from their company's stores
  const isCompanyAdmin = user?.role === 'company_admin' || user?.role === 'store_owner';
  const storeId = isCompanyAdmin ? selectedStoreId : user?.storeId;

  // Fetch stores for company admins
  const { data: stores = [] } = useQuery({
    queryKey: ['/api/stores'],
    queryFn: () => apiRequest('GET', '/api/stores').then(res => res.json()),
    enabled: isCompanyAdmin,
  });

  // Fetch products
  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: [`/api/stores/${storeId}/products`],
    enabled: !!storeId,
  });

  // Fetch categories
  const { data: categories = [] } = useQuery<ProductCategory[]>({
    queryKey: ["/api/categories"],
    enabled: !!user,
  });

  // Category management states
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [categoryFormData, setCategoryFormData] = useState({
    name: "",
    description: "",
  });

  // Calculate analytics
  const totalProducts = products.length;
  const lowStockProducts = products.filter(p => p.stock <= 10 && p.stock > 0).length;
  const outOfStockProducts = products.filter(p => p.stock === 0).length;
  const totalValue = products.reduce((sum, product) => sum + (parseFloat(product.price) * product.stock), 0);

  // Filter products
  const filteredProducts = products.filter((product: Product) => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.barcode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.category.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = selectedCategory === "all" || product.category === selectedCategory;
    
    const matchesStock = stockFilter === 'all' || 
                        (stockFilter === 'low' && product.stock <= 10 && product.stock > 0) ||
                        (stockFilter === 'out' && product.stock === 0);
    
    return matchesSearch && matchesCategory && matchesStock;
  });

  // Mutations
  const createProductMutation = useMutation({
    mutationFn: async (productData: any) => {
      const response = await apiRequest('POST', `/api/stores/${storeId}/products`, productData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${storeId}/products`] });
      toast({ title: "Product created successfully!" });
      resetForm();
      setIsCreateDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Error creating product", description: error.message, variant: "destructive" });
    }
  });


  const deleteProductMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/stores/${storeId}/products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${storeId}/products`] });
      toast({ title: "Product deleted successfully!" });
    },
    onError: (error: any) => {
      toast({ title: "Error deleting product", description: error.message, variant: "destructive" });
    }
  });

  const createCategoryMutation = useMutation({
    mutationFn: async (categoryData: any) => {
      const response = await apiRequest('POST', '/api/categories', categoryData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
      toast({ title: "Category created successfully!" });
      setCategoryFormData({ name: "", description: "" });
      setIsCategoryDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Error creating category", description: error.message, variant: "destructive" });
    }
  });

  const resetForm = () => {
    setFormData({
      name: "",
      price: "",
      vatRate: "21.00",
      category: "",
      categoryId: "",
      stock: "",
      barcode: "",
      description: "",
      imageUrl: ""
    });
    setUploadedImageUrl("");
    setSelectedImageFromGallery("");
  };

  const handleCreateProduct = () => {
    if (!formData.name || !formData.price || !formData.categoryId) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }

    const imageUrl = uploadedImageUrl || selectedImageFromGallery;
    
    createProductMutation.mutate({
      ...formData,
      categoryId: parseInt(formData.categoryId),
      price: parseFloat(formData.price),
      vatRate: parseFloat(formData.vatRate),
      stock: parseInt(formData.stock) || 0,
      storeId: storeId,
      imageUrl: imageUrl
    });
  };


  const handleDeleteProduct = (id: number) => {
    if (confirm("Are you sure you want to delete this product?")) {
      deleteProductMutation.mutate(id);
    }
  };

  const handleCreateCategory = () => {
    if (!categoryFormData.name) {
      toast({ title: "Please enter a category name", variant: "destructive" });
      return;
    }
    createCategoryMutation.mutate(categoryFormData);
  };

  const handleImageUpload = async (file: File) => {
    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Upload failed');
      }
      
      const data = await response.json();
      setUploadedImageUrl(data.imageUrl);
      setSelectedImageFromGallery('');
      toast({ title: "Image uploaded successfully!" });
    } catch (error) {
      console.error('Upload error:', error);
      toast({ title: "Failed to upload image", variant: "destructive" });
    }
  };

  const selectImageFromGallery = (imageUrl: string) => {
    setSelectedImageFromGallery(imageUrl);
    setUploadedImageUrl('');
    setIsImageGalleryOpen(false);
  };

  const getStockStatus = (stock: number) => {
    if (stock === 0) return { label: 'Out of Stock', variant: 'destructive' as const, icon: AlertTriangle };
    if (stock <= 10) return { label: 'Low Stock', variant: 'secondary' as const, icon: Clock };
    return { label: 'In Stock', variant: 'default' as const, icon: CheckCircle };
  };

  const getProductImage = (product: Product) => {
    return product.imageUrl || "/api/placeholder/150/150";
  };

  if (!storeId) {
    if (isCompanyAdmin && stores.length > 0) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
          <Card className="w-full max-w-md shadow-lg">
            <CardHeader>
              <CardTitle className="text-center">Select Store for Products</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center text-sm text-muted-foreground mb-4">
                Choose which store you want to manage products for
              </div>
              <div className="space-y-2">
                {stores.map((store: any) => (
                  <Button
                    key={store.id}
                    data-testid={`button-select-store-${store.id}`}
                    onClick={() => setSelectedStoreId(store.id)}
                    variant="outline"
                    className="w-full h-auto py-4 px-6 justify-start hover:bg-purple-50 hover:border-purple-500"
                  >
                    <div className="flex flex-col items-start w-full">
                      <div className="font-semibold text-base">{store.name}</div>
                      <div className="text-sm text-muted-foreground">{store.address}</div>
                    </div>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }
    
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">No store assigned</h3>
          <p className="text-muted-foreground">Please contact your administrator to assign a store.</p>
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
                <Package className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">Products</h1>
                <p className="text-sm text-slate-600 dark:text-slate-400">Manage your store's product catalog</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Button
                onClick={() => setIsCategoryDialogOpen(true)}
                variant="outline"
                className="hidden sm:flex"
              >
                <Tag className="h-4 w-4 mr-2" />
                Manage Categories
              </Button>
              <Button
                onClick={() => setIsCreateDialogOpen(true)}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Product
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Analytics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="border-slate-200 dark:border-slate-800 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-950 dark:to-indigo-900 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-blue-900 dark:text-blue-100">Total Products</CardTitle>
              <div className="p-2 bg-blue-500 rounded-lg">
                <Package className="h-4 w-4 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-900 dark:text-blue-100">{totalProducts}</div>
              <p className="text-sm text-blue-700 dark:text-blue-300">Items in catalog</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 dark:border-slate-800 bg-gradient-to-br from-amber-50 to-orange-100 dark:from-amber-950 dark:to-orange-900 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-amber-900 dark:text-amber-100">Low Stock Items</CardTitle>
              <div className="p-2 bg-amber-500 rounded-lg">
                <Clock className="h-4 w-4 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-amber-900 dark:text-amber-100">{lowStockProducts}</div>
              <p className="text-sm text-amber-700 dark:text-amber-300">Need restocking</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 dark:border-slate-800 bg-gradient-to-br from-red-50 to-rose-100 dark:from-red-950 dark:to-rose-900 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-red-900 dark:text-red-100">Out of Stock</CardTitle>
              <div className="p-2 bg-red-500 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-900 dark:text-red-100">{outOfStockProducts}</div>
              <p className="text-sm text-red-700 dark:text-red-300">Unavailable items</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 dark:border-slate-800 bg-gradient-to-br from-emerald-50 to-green-100 dark:from-emerald-950 dark:to-green-900 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-emerald-900 dark:text-emerald-100">Total Value</CardTitle>
              <div className="p-2 bg-emerald-500 rounded-lg">
                <DollarSign className="h-4 w-4 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-emerald-900 dark:text-emerald-100">${totalValue.toFixed(2)}</div>
              <p className="text-sm text-emerald-700 dark:text-emerald-300">Inventory value</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Controls */}
        <Card className="mb-6 border-slate-200 dark:border-slate-800 shadow-lg">
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search products, categories, or barcodes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                />
              </div>
              
              <div className="flex gap-3">
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-48 bg-slate-50 dark:bg-slate-800">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((category: ProductCategory) => (
                      <SelectItem key={category.id} value={category.name}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={stockFilter} onValueChange={setStockFilter}>
                  <SelectTrigger className="w-40 bg-slate-50 dark:bg-slate-800">
                    <SelectValue placeholder="Stock" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Stock</SelectItem>
                    <SelectItem value="low">Low Stock</SelectItem>
                    <SelectItem value="out">Out of Stock</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex border rounded-lg overflow-hidden bg-slate-50 dark:bg-slate-800">
                  <Button
                    variant={viewMode === 'grid' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('grid')}
                    className="rounded-none"
                  >
                    <Grid className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'table' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('table')}
                    className="rounded-none"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Products Display */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-slate-500">Loading products...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <Card className="shadow-lg border-slate-200 dark:border-slate-800">
            <CardContent className="p-12 text-center">
              <Package className="h-16 w-16 mx-auto text-slate-400 mb-4" />
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">No products found</h3>
              <p className="text-slate-500 mb-6">Get started by adding your first product to the catalog.</p>
              <Button
                onClick={() => setIsCreateDialogOpen(true)}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Product
              </Button>
            </CardContent>
          </Card>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map((product: Product) => {
              const stockStatus = getStockStatus(product.stock);
              const StatusIcon = stockStatus.icon;
              
              return (
                <Card key={product.id} className="group hover:shadow-xl transition-all duration-300 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
                  <div className="relative">
                    <div className="aspect-square bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700">
                      <img
                        src={getProductImage(product)}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          e.currentTarget.src = "/api/placeholder/300/300";
                        }}
                      />
                    </div>
                    <div className="absolute top-3 left-3">
                      <Badge variant={stockStatus.variant} className="flex items-center gap-1">
                        <StatusIcon className="h-3 w-3" />
                        {stockStatus.label}
                      </Badge>
                    </div>
                    <div className="absolute top-3 right-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="secondary" size="sm" className="bg-white/90 hover:bg-white">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                            onClick={() => handleDeleteProduct(product.id)}
                            className="text-red-600 dark:text-red-400"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div>
                        <h3 className="font-semibold text-slate-900 dark:text-white line-clamp-2 mb-1">
                          {product.name}
                        </h3>
                        <Badge variant="outline" className="text-xs">
                          {product.category}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                          ${parseFloat(product.price).toFixed(2)}
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium text-slate-900 dark:text-white">
                            Stock: {product.stock}
                          </div>
                          {product.barcode && (
                            <div className="text-xs text-slate-500 font-mono">
                              {product.barcode}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {product.description && (
                        <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
                          {product.description}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="shadow-lg border-slate-200 dark:border-slate-800">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900">
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5" />
                Product Catalog ({filteredProducts.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Image</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Barcode</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product: Product) => {
                    const stockStatus = getStockStatus(product.stock);
                    const StatusIcon = stockStatus.icon;
                    
                    return (
                      <TableRow key={product.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <TableCell>
                          <Avatar className="h-12 w-12 rounded-lg">
                            <AvatarImage 
                              src={getProductImage(product)} 
                              alt={product.name}
                              className="object-cover"
                            />
                            <AvatarFallback className="rounded-lg bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900 dark:to-pink-900">
                              <Package className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                            </AvatarFallback>
                          </Avatar>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium text-slate-900 dark:text-white">
                              {product.name}
                            </div>
                            {product.description && (
                              <div className="text-sm text-slate-500 line-clamp-1">
                                {product.description}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{product.category}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="font-bold text-purple-600 dark:text-purple-400">
                            ${parseFloat(product.price).toFixed(2)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{product.stock}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={stockStatus.variant} className="flex items-center gap-1 w-fit">
                            <StatusIcon className="h-3 w-3" />
                            {stockStatus.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {product.barcode ? (
                            <div className="font-mono text-sm">{product.barcode}</div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem 
                                onClick={() => handleDeleteProduct(product.id)}
                                className="text-red-600 dark:text-red-400"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create Product Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
                <Plus className="h-4 w-4 text-white" />
              </div>
              Add New Product
            </DialogTitle>
            <DialogDescription>
              Create a new product for your store catalog
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Product Image */}
            <div className="space-y-4">
              <Label className="text-base font-medium">Product Image</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <Label className="text-sm">Upload New Image</Label>
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleImageUpload(file);
                        }
                      }}
                      className="hidden"
                      id="create-image-upload"
                    />
                    <Button 
                      type="button"
                      variant="outline" 
                      onClick={() => document.getElementById('create-image-upload')?.click()}
                      className="w-full h-32 border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-purple-400 dark:hover:border-purple-500 bg-slate-50 dark:bg-slate-800 flex flex-col items-center justify-center"
                    >
                      <ImageIcon className="h-8 w-8 text-slate-400 mb-2" />
                      <span className="text-sm text-slate-500">Click to upload image</span>
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <Label className="text-sm">Or Select from Gallery</Label>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsImageGalleryOpen(true)}
                    className="w-full h-32 border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-purple-400 dark:hover:border-purple-500"
                  >
                    <div className="flex flex-col items-center">
                      <Palette className="h-8 w-8 text-slate-400 mb-2" />
                      <span className="text-sm text-slate-500">Browse Gallery</span>
                    </div>
                  </Button>
                </div>
              </div>
              
              {(uploadedImageUrl || selectedImageFromGallery) && (
                <div className="space-y-2">
                  <Label className="text-sm">Selected Image Preview</Label>
                  <div className="w-32 h-32 rounded-lg overflow-hidden border">
                    <img
                      src={uploadedImageUrl || selectedImageFromGallery}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Product Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Product Name *</Label>
                <Input
                  id="name"
                  placeholder="Enter product name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="bg-slate-50 dark:bg-slate-800"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select value={formData.categoryId} onValueChange={(value) => {
                  setFormData({ ...formData, categoryId: value });
                  const selectedCat = categories.find(cat => cat.id.toString() === value);
                  if (selectedCat) {
                    setFormData(prev => ({ ...prev, category: selectedCat.name }));
                  }
                }}>
                  <SelectTrigger className="bg-slate-50 dark:bg-slate-800">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category: ProductCategory) => (
                      <SelectItem key={category.id} value={category.id.toString()}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="price">Price *</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="bg-slate-50 dark:bg-slate-800"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="vatRate">VAT Rate (%) *</Label>
                <Input
                  id="vatRate"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={formData.vatRate}
                  onChange={(e) => setFormData({ ...formData, vatRate: e.target.value })}
                  placeholder="Enter VAT rate (e.g., 6 for 6%, 21 for 21%)"
                  className="bg-slate-50 dark:bg-slate-800"
                />
                <p className="text-xs text-muted-foreground">
                  Enter percentage (e.g., 6 for 6%, 21 for 21%)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="stock">Stock Quantity</Label>
                <Input
                  id="stock"
                  type="number"
                  placeholder="0"
                  value={formData.stock}
                  onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                  className="bg-slate-50 dark:bg-slate-800"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="barcode">Barcode</Label>
                <Input
                  id="barcode"
                  placeholder="Enter barcode"
                  value={formData.barcode}
                  onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                  className="bg-slate-50 dark:bg-slate-800"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Enter product description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="bg-slate-50 dark:bg-slate-800"
                  rows={3}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsCreateDialogOpen(false);
              resetForm();
            }}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateProduct}
              disabled={createProductMutation.isPending}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            >
              {createProductMutation.isPending ? (
                <>Creating...</>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Product
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category Management Dialog */}
      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-2 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg">
                <Tag className="h-4 w-4 text-white" />
              </div>
              Add New Category
            </DialogTitle>
            <DialogDescription>
              Create a new product category for better organization
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="category-name">Category Name *</Label>
              <Input
                id="category-name"
                placeholder="Enter category name"
                value={categoryFormData.name}
                onChange={(e) => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
                className="bg-slate-50 dark:bg-slate-800"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category-description">Description</Label>
              <Textarea
                id="category-description"
                placeholder="Enter category description"
                value={categoryFormData.description}
                onChange={(e) => setCategoryFormData({ ...categoryFormData, description: e.target.value })}
                className="bg-slate-50 dark:bg-slate-800"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsCategoryDialogOpen(false);
              setCategoryFormData({ name: "", description: "" });
            }}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateCategory}
              disabled={createCategoryMutation.isPending}
              className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700"
            >
              {createCategoryMutation.isPending ? (
                <>Creating...</>
              ) : (
                <>
                  <Tag className="h-4 w-4 mr-2" />
                  Create Category
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Gallery Dialog */}
      <Dialog open={isImageGalleryOpen} onOpenChange={setIsImageGalleryOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-2 bg-gradient-to-br from-pink-500 to-purple-500 rounded-lg">
                <Palette className="h-4 w-4 text-white" />
              </div>
              Image Gallery
            </DialogTitle>
            <DialogDescription>
              Select an image from your uploaded images
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            {uploadedImages.length === 0 ? (
              <div className="text-center py-12">
                <ImageIcon className="h-16 w-16 mx-auto text-slate-400 mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">No images uploaded</h3>
                <p className="text-slate-500">Upload some images first to see them in the gallery.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {uploadedImages.map((imageUrl: string, index: number) => (
                  <div
                    key={index}
                    onClick={() => selectImageFromGallery(imageUrl)}
                    className="relative group cursor-pointer rounded-lg overflow-hidden border-2 border-transparent hover:border-purple-500 transition-colors"
                  >
                    <img
                      src={imageUrl}
                      alt={`Gallery image ${index + 1}`}
                      className="w-full h-32 object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <Eye className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsImageGalleryOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default Products;