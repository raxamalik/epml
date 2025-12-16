import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { usePagination } from "@/hooks/common/usePagination";
import { useFilters } from "@/hooks/common/useFilters";
import { Pagination } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
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
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { useTranslation } from "@/hooks/useTranslation";

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
  storeId: number | null;
  storeName?: string | null;
  // Regulatory compliance fields
  substanceName?: string;
  form?: string;
  subtype?: string;
  packageSize?: string;
  receivedDate?: string;
  batchNumber?: string;
  quantityUnit?: string;
  // Psychomodulatory substance compliance fields
  recommendedDoseSingle?: string;
  recommendedDoseDaily?: string;
  dosageInfo?: string;
  warningUnder18?: string;
  warningHealth?: string;
  minAge?: number;
  adultOnly?: boolean;
  consumerInfo?: string;
  activeSubstancesComposition?: any;
  isActive?: boolean;
}

interface ProductCategory {
  id: number;
  name: string;
  description?: string;
  companyId?: number;
  storeId?: number | null; // null = company-wide, set = store-specific
  userId?: string;
}

function Products() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);
  const [isDeleteProductDialogOpen, setIsDeleteProductDialogOpen] = useState<boolean>(false);
  const [productToDelete, setProductToDelete] = useState<number | null>(null);

  // Use custom hooks for pagination and filters
  const { currentPage, pageSize, setPage, setPageSize, offset } = usePagination({
    initialPage: 1,
    initialPageSize: 10,
  });

  const { search, debouncedSearch, setSearch } = useFilters({
    debounceMs: 500,
  });
  
  const [formData, setFormData] = useState({
    name: "",
    price: "",
    vatRate: "21.00",
    category: "",
    categoryId: "",
    stock: "",
    barcode: "",
    description: "",
    imageUrl: "",
    // Regulatory compliance fields
    substanceName: "",
    form: "",
    subtype: "",
    packageSize: "",
    receivedDate: "",
    batchNumber: "",
    quantityUnit: "",
    // Psychomodulatory substance compliance fields
    recommendedDoseSingle: "",
    recommendedDoseDaily: "",
    dosageInfo: "",
    warningUnder18: "",
    warningHealth: "",
    minAge: "",
    adultOnly: false,
    consumerInfo: "",
    activeSubstancesComposition: ""
  });
  
  const [uploadedImageUrl, setUploadedImageUrl] = useState("");
  const [isImageGalleryOpen, setIsImageGalleryOpen] = useState(false);
  const [selectedImageFromGallery, setSelectedImageFromGallery] = useState("");
  
  // Fetch all uploaded images for the gallery
  const { data: uploadedImagesResponse } = useQuery<string[] | null>({
    queryKey: ["/api/uploaded-images"],
    enabled: !!user,
  });
  const uploadedImages: string[] = uploadedImagesResponse ?? [];

  // Determine the storeId to use
  // For managers and store owners: use their assigned storeId (only their own store)
  // For company admins: allow them to select from their company's stores
  const isCompanyAdmin = user?.role === 'company_admin';
  const storeId = isCompanyAdmin ? selectedStoreId : user?.storeId;

  // Fetch stores for company admins only (store owners manage only their own store)
  const { data: storesResponse } = useQuery({
    queryKey: ['/api/stores'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/stores');
      const data = await res.json();
      // Handle both paginated response and array response
      if (Array.isArray(data)) {
        return data;
      }
      return data.data || [];
    },
    enabled: isCompanyAdmin,
  });
  
  const stores = Array.isArray(storesResponse) ? storesResponse : [];

  // Fetch products with pagination
  // For company admins: fetch all products across all stores
  // For store owners/managers: fetch products for their store
  const { data: productsResponse, isLoading } = useQuery({
    queryKey: isCompanyAdmin 
      ? [`/api/company/products`, currentPage, pageSize, debouncedSearch, selectedCategory]
      : [`/api/stores/${storeId}/products`, currentPage, pageSize, debouncedSearch, selectedCategory],
    queryFn: async () => {
      // For company admins, use company-wide endpoint
      if (isCompanyAdmin) {
        const params = new URLSearchParams({
          limit: pageSize.toString(),
          offset: offset.toString(),
        });
        
        if (debouncedSearch) {
          params.append("search", debouncedSearch);
        }
        
        // Get categoryId if a specific category is selected
        if (selectedCategory !== "all") {
          const selectedCat = categories.find(cat => cat.name === selectedCategory);
          if (selectedCat?.id) {
            params.append("categoryId", selectedCat.id.toString());
          }
        }
        
        const response = await apiRequest('GET', `/api/company/products?${params}`);
        const data = await response.json();
        
        // Handle both paginated response and array response (for backward compatibility)
        if (Array.isArray(data)) {
          return {
            data,
            total: data.length,
            page: currentPage,
            limit: pageSize,
            totalPages: Math.ceil(data.length / pageSize),
          };
        }
        
        return {
          data: data.data || [],
          total: data.total || 0,
          page: data.page || currentPage,
          limit: data.limit || pageSize,
          totalPages: data.totalPages || Math.ceil((data.total || 0) / pageSize),
        };
      }
      
      // For store owners/managers, use store-specific endpoint
      if (!storeId && !isCompanyAdmin) return { data: [], total: 0, page: 1, limit: pageSize, totalPages: 0 };
      
      const params = new URLSearchParams({
        limit: pageSize.toString(),
        offset: offset.toString(),
      });
      
      if (debouncedSearch) {
        params.append("search", debouncedSearch);
      }
      
      // Get categoryId if a specific category is selected
      if (selectedCategory !== "all") {
        const selectedCat = categories.find(cat => cat.name === selectedCategory);
        if (selectedCat?.id) {
          params.append("categoryId", selectedCat.id.toString());
        }
      }
      
      const response = await apiRequest('GET', `/api/stores/${storeId}/products?${params}`);
      const data = await response.json();
      
      // Handle both paginated response and array response (for backward compatibility)
      if (Array.isArray(data)) {
        return {
          data,
          total: data.length,
          page: currentPage,
          limit: pageSize,
          totalPages: Math.ceil(data.length / pageSize),
        };
      }
      
      return {
        data: data.data || [],
        total: data.total || 0,
        page: data.page || currentPage,
        limit: data.limit || pageSize,
        totalPages: data.totalPages || Math.ceil((data.total || 0) / pageSize),
      };
    },
    enabled: isCompanyAdmin || !!storeId, // Enable for company admins or when storeId exists
  });

  const products: Product[] = productsResponse?.data || [];
  const total = productsResponse?.total || 0;
  const totalPages = productsResponse?.totalPages || 0;

  // Fetch categories (ensure we always have an array, even if API returns null)
  const { data: categoriesResponse } = useQuery<ProductCategory[] | null>({
    queryKey: ["/api/categories"],
    enabled: !!user,
  });
  const categories: ProductCategory[] = categoriesResponse ?? [];


  // Calculate analytics (using all products from paginated response)
  // Note: These are calculated from the current page, not all products
  // For accurate analytics, we might need a separate analytics endpoint
  const lowStockProducts = products.filter(p => p.stock <= 10 && p.stock > 0).length;
  const outOfStockProducts = products.filter(p => p.stock === 0).length;
  const totalValue = products.reduce((sum, product) => sum + (parseFloat(product.price) * product.stock), 0);

  // Filter products client-side for stock filter (category filter is now server-side)
  const filteredProducts = products.filter((product: Product) => {
    const matchesStock = stockFilter === 'all' || 
                        (stockFilter === 'low' && product.stock <= 10 && product.stock > 0) ||
                        (stockFilter === 'out' && product.stock === 0);
    
    return matchesStock;
  });

  // Mutations
  const createProductMutation = useMutation({
    mutationFn: async (productData: any) => {
      const response = await apiRequest('POST', `/api/stores/${storeId}/products`, productData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${storeId}/products`] });
      toast({ title: t("products.toasts.created") });
      resetForm();
      setIsCreateDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ title: t("common.error"), description: error.message || t("products.toasts.errorGeneric"), variant: "destructive" });
    }
  });

  const updateProductMutation = useMutation({
    mutationFn: async ({ id, productData }: { id: number; productData: any }) => {
      const response = await apiRequest('PUT', `/api/stores/${storeId}/products/${id}`, productData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${storeId}/products`] });
      toast({ title: t("products.toasts.updated") });
      resetForm();
      setIsCreateDialogOpen(false);
      setIsEditMode(false);
      setEditingProduct(null);
    },
    onError: (error: any) => {
      toast({ title: t("common.error"), description: error.message || t("products.toasts.errorGeneric"), variant: "destructive" });
    }
  });


  const deleteProductMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/stores/${storeId}/products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${storeId}/products`] });
      toast({ title: t("products.toasts.deleted") });
    },
    onError: (error: any) => {
      toast({ title: t("common.error"), description: error.message || t("products.toasts.errorGeneric"), variant: "destructive" });
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
      imageUrl: "",
      // Regulatory compliance fields
      substanceName: "",
      form: "",
      subtype: "",
      packageSize: "",
      receivedDate: "",
      batchNumber: "",
      quantityUnit: "",
      // Psychomodulatory substance compliance fields
      recommendedDoseSingle: "",
      recommendedDoseDaily: "",
      dosageInfo: "",
      warningUnder18: "",
      warningHealth: "",
      minAge: "",
      adultOnly: false,
      consumerInfo: "",
      activeSubstancesComposition: ""
    });
    setUploadedImageUrl("");
    setSelectedImageFromGallery("");
    setIsEditMode(false);
    setEditingProduct(null);
  };

  const handleEditProduct = (product: Product) => {
    setLocation(`/products/edit/${product.id}`);
  };

  const handleCreateProduct = () => {
    if (!formData.name || !formData.price || !formData.categoryId) {
      toast({ title: t("products.toasts.fillRequiredFields"), variant: "destructive" });
      return;
    }

    const imageUrl = uploadedImageUrl || selectedImageFromGallery;
    
    // Prepare product data with all fields
    const productData: any = {
      name: formData.name,
      categoryId: parseInt(formData.categoryId),
      price: parseFloat(formData.price),
      vatRate: parseFloat(formData.vatRate),
      stock: parseInt(formData.stock) || 0,
      barcode: formData.barcode || undefined,
      description: formData.description || undefined,
      imageUrl: imageUrl || undefined,
      // Regulatory compliance fields
      substanceName: formData.substanceName || undefined,
      form: formData.form || undefined,
      subtype: formData.subtype || undefined,
      packageSize: formData.packageSize || undefined,
      receivedDate: formData.receivedDate ? new Date(formData.receivedDate).toISOString() : undefined,
      batchNumber: formData.batchNumber || undefined,
      quantityUnit: formData.quantityUnit || undefined,
      // Psychomodulatory substance compliance fields
      recommendedDoseSingle: formData.recommendedDoseSingle || undefined,
      recommendedDoseDaily: formData.recommendedDoseDaily || undefined,
      dosageInfo: formData.dosageInfo || undefined,
      warningUnder18: formData.warningUnder18 || undefined,
      warningHealth: formData.warningHealth || undefined,
      minAge: formData.minAge ? parseInt(formData.minAge) : undefined,
      adultOnly: formData.adultOnly,
      consumerInfo: formData.consumerInfo || undefined,
      activeSubstancesComposition: formData.activeSubstancesComposition ? 
        (typeof formData.activeSubstancesComposition === 'string' ? 
          JSON.parse(formData.activeSubstancesComposition) : 
          formData.activeSubstancesComposition) : undefined
    };
    
    if (isEditMode && editingProduct) {
      // Update existing product
      updateProductMutation.mutate({
        id: editingProduct.id,
        productData: productData
      });
    } else {
      // Create new product
      createProductMutation.mutate({
        ...productData,
        storeId: storeId
      });
    }
  };


  const handleDeleteProduct = (id: number) => {
    setProductToDelete(id);
    setIsDeleteProductDialogOpen(true);
  };

  const confirmDeleteProduct = () => {
    if (productToDelete !== null) {
      deleteProductMutation.mutate(productToDelete);
      setIsDeleteProductDialogOpen(false);
      setProductToDelete(null);
    }
  };


  const handleImageUpload = async (file: File) => {
    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await fetchWithAuth('/api/upload-image', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        // Try to extract error message from response
        const errorData = await response.json().catch(() => ({ 
          error: 'Upload failed', 
          message: 'Failed to upload image. Please try again.' 
        }));
        throw new Error(errorData.message || errorData.error || 'Upload failed');
      }
      
      const data = await response.json();
      setUploadedImageUrl(data.imageUrl || data.url);
      setSelectedImageFromGallery('');
      toast({ title: t("products.toasts.imageUploadedSuccess") });
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({ 
        title: t("products.toasts.imageUploadFailed"), 
        description: error.message || t("products.toasts.imageUploadErrorDesc"),
        variant: "destructive" 
      });
    }
  };

  const selectImageFromGallery = (imageUrl: string) => {
    setSelectedImageFromGallery(imageUrl);
    setUploadedImageUrl('');
    setIsImageGalleryOpen(false);
  };

  const getStockStatus = (stock: number) => {
    if (stock === 0) return { label: t("products.stockStatus.outOfStock"), variant: 'destructive' as const, icon: AlertTriangle };
    if (stock <= 10) return { label: t("products.stockStatus.lowStock"), variant: 'secondary' as const, icon: Clock };
    return { label: t("products.stockStatus.inStock"), variant: 'default' as const, icon: CheckCircle };
  };

  const getProductImage = (product: Product) => {
    return product.imageUrl || "/api/placeholder/150/150";
  };

  // For store owners/managers, require storeId
  // Company admins can see all products without store selection
  if (!isCompanyAdmin && !storeId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">{t("products.empty.noStoreAssignedTitle")}</h3>
          <p className="text-muted-foreground">{t("products.empty.noStoreAssignedDesc")}</p>
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
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">{t("products.title")}</h1>
                <p className="text-sm text-slate-600 dark:text-slate-400">{t("products.description")}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Button
                onClick={() => setLocation('/products/create')}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                {t("products.addProduct")}
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
              <CardTitle className="text-sm font-medium text-blue-900 dark:text-blue-100">{t("products.cards.totalProducts")}</CardTitle>
              <div className="p-2 bg-blue-500 rounded-lg">
                <Package className="h-4 w-4 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-900 dark:text-blue-100">{total}</div>
              <p className="text-sm text-blue-700 dark:text-blue-300">{t("products.cards.itemsInCatalog")}</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 dark:border-slate-800 bg-gradient-to-br from-amber-50 to-orange-100 dark:from-amber-950 dark:to-orange-900 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-amber-900 dark:text-amber-100">{t("products.cards.lowStockItems")}</CardTitle>
              <div className="p-2 bg-amber-500 rounded-lg">
                <Clock className="h-4 w-4 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-amber-900 dark:text-amber-100">{lowStockProducts}</div>
              <p className="text-sm text-amber-700 dark:text-amber-300">{t("products.cards.needRestocking")}</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 dark:border-slate-800 bg-gradient-to-br from-red-50 to-rose-100 dark:from-red-950 dark:to-rose-900 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-red-900 dark:text-red-100">{t("products.cards.outOfStock")}</CardTitle>
              <div className="p-2 bg-red-500 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-900 dark:text-red-100">{outOfStockProducts}</div>
              <p className="text-sm text-red-700 dark:text-red-300">{t("products.cards.unavailable")}</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 dark:border-slate-800 bg-gradient-to-br from-emerald-50 to-green-100 dark:from-emerald-950 dark:to-green-900 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-emerald-900 dark:text-emerald-100">{t("products.cards.totalValue")}</CardTitle>
              <div className="p-2 bg-emerald-500 rounded-lg">
                <DollarSign className="h-4 w-4 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-emerald-900 dark:text-emerald-100">${totalValue.toFixed(2)}</div>
              <p className="text-sm text-emerald-700 dark:text-emerald-300">{t("products.cards.inventoryValue")}</p>
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
                  placeholder={t("products.filters.searchPlaceholder")}
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1); // Reset to first page on search
                  }}
                  className="pl-10 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                />
              </div>
              
              <div className="flex gap-3">
                <Select value={selectedCategory} onValueChange={(value) => {
                  setSelectedCategory(value);
                  setPage(1); // Reset to first page on category change
                }}>
                  <SelectTrigger className="w-48 bg-slate-50 dark:bg-slate-800">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder={t("products.filters.category")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("products.filters.allCategories")}</SelectItem>
                    {categories.map((category: ProductCategory) => (
                      <SelectItem key={category.id} value={category.name}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={stockFilter} onValueChange={(value) => setStockFilter(value as 'all' | 'low' | 'out')}>
                  <SelectTrigger className="w-40 bg-slate-50 dark:bg-slate-800">
                    <SelectValue placeholder={t("products.filters.stock")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("products.filters.allStock")}</SelectItem>
                    <SelectItem value="low">{t("products.filters.lowStock")}</SelectItem>
                    <SelectItem value="out">{t("products.filters.outOfStock")}</SelectItem>
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
            <p className="text-slate-500">{t("common.loading")}</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <Card className="shadow-lg border-slate-200 dark:border-slate-800">
            <CardContent className="p-12 text-center">
              <Package className="h-16 w-16 mx-auto text-slate-400 mb-4" />
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">{t("products.empty.title")}</h3>
              <p className="text-slate-500 mb-6">{t("products.empty.description")}</p>
              <Button
                onClick={() => setLocation('/products/create')}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                {t("products.empty.createFirst")}
              </Button>
            </CardContent>
          </Card>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map((product: Product) => {
              const stockStatus = getStockStatus(product.stock);
              const StatusIcon = stockStatus.icon;
              
              return (
                <Card 
                  key={product.id} 
                  className="group hover:shadow-xl transition-all duration-300 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden cursor-pointer"
                  onClick={() => setLocation(`/products/${product.id}`)}
                >
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
                            onClick={() => setLocation(`/products/${product.id}`)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            {t("products.dropdownActions.viewDetails")}
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleEditProduct(product)}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            {t("products.dropdownActions.edit")}
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDeleteProduct(product.id)}
                            className="text-red-600 dark:text-red-400"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            {t("products.dropdownActions.delete")}
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
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Layers className="h-5 w-5" />
                  Product Catalog ({total})
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Label htmlFor="limit" className="text-sm text-slate-600 dark:text-slate-300">{t("common.itemsPerPage")}</Label>
                  <Select
                    value={pageSize.toString()}
                    onValueChange={(value) => {
                      setPageSize(parseInt(value));
                      setPage(1);
                    }}
                  >
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">{t("products.table.image")}</TableHead>
                    <TableHead>{t("products.table.name")}</TableHead>
                    <TableHead>{t("products.table.category")}</TableHead>
                    <TableHead>{t("products.table.store")}</TableHead>
                    <TableHead>{t("products.table.price")}</TableHead>
                    <TableHead>{t("products.table.stock")}</TableHead>
                    <TableHead>{t("products.table.status")}</TableHead>
                    <TableHead>{t("products.table.barcode")}</TableHead>
                    <TableHead className="text-right">{t("products.table.actions")}</TableHead>
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
                          <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            {product.storeName || t("products.table.allStores")}
                          </div>
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
                                onClick={() => setLocation(`/products/${product.id}`)}
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                {t("products.dropdownActions.viewDetails")}
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleEditProduct(product)}
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                {t("products.dropdownActions.edit")}
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleDeleteProduct(product.id)}
                                className="text-red-600 dark:text-red-400"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                {t("products.dropdownActions.delete")}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  </TableBody>
                </Table>
                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="p-4 border-t border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-800/50">
                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      onPageChange={setPage}
                      pageSize={pageSize}
                      onPageSizeChange={setPageSize}
                    />
                  </div>
                )}
            </CardContent>
          </Card>
        )}
        
        {/* Pagination for Grid View */}
        {viewMode === 'grid' && totalPages > 1 && (
          <div className="mt-6 flex justify-center">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 shadow-lg">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setPage}
                pageSize={pageSize}
                onPageSizeChange={setPageSize}
              />
            </div>
          </div>
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
              {t("products.dialogs.createTitle")}
            </DialogTitle>
            <DialogDescription>
              {isCompanyAdmin 
                ? t("products.dialogs.createDescriptionCompany")
                : t("products.dialogs.createDescriptionStore")
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Product Image */}
            <div className="space-y-4">
              <Label className="text-base font-medium">{t("products.dialogs.productImage")}</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <Label className="text-sm">{t("products.dialogs.uploadNewImage")}</Label>
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
                      <span className="text-sm text-slate-500">{t("products.dialogs.clickToUpload")}</span>
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <Label className="text-sm">{t("products.dialogs.orSelectFromGallery")}</Label>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsImageGalleryOpen(true)}
                    className="w-full h-32 border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-purple-400 dark:hover:border-purple-500"
                  >
                    <div className="flex flex-col items-center">
                      <Palette className="h-8 w-8 text-slate-400 mb-2" />
                      <span className="text-sm text-slate-500">{t("products.dialogs.browseGallery")}</span>
                    </div>
                  </Button>
                </div>
              </div>
              
              {(uploadedImageUrl || selectedImageFromGallery) && (
                <div className="space-y-2">
                  <Label className="text-sm">{t("products.dialogs.selectedImagePreview")}</Label>
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
                <Label htmlFor="name">{t("products.dialogs.productName")} *</Label>
                <Input
                  id="name"
                  placeholder={t("products.dialogs.enterProductName")}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="bg-slate-50 dark:bg-slate-800"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">{t("products.dialogs.category")} *</Label>
                <Select value={formData.categoryId} onValueChange={(value) => {
                  setFormData({ ...formData, categoryId: value });
                  const selectedCat = categories.find(cat => cat.id.toString() === value);
                  if (selectedCat) {
                    setFormData(prev => ({ ...prev, category: selectedCat.name }));
                  }
                }}>
                  <SelectTrigger className="bg-slate-50 dark:bg-slate-800">
                    <SelectValue placeholder={t("products.dialogs.selectCategory")} />
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
                <Label htmlFor="price">{t("products.dialogs.price")} *</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  placeholder={t("products.dialogs.pricePlaceholder")}
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="bg-slate-50 dark:bg-slate-800"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="vatRate">{t("products.dialogs.vatRate")} *</Label>
                <Input
                  id="vatRate"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={formData.vatRate}
                  onChange={(e) => setFormData({ ...formData, vatRate: e.target.value })}
                  placeholder={t("products.dialogs.enterVatRate")}
                  className="bg-slate-50 dark:bg-slate-800"
                />
                <p className="text-xs text-muted-foreground">
                  {t("products.dialogs.vatRateHint")}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="stock">{t("products.dialogs.stockQuantity")}</Label>
                <Input
                  id="stock"
                  type="number"
                  placeholder={t("products.dialogs.stockPlaceholder")}
                  value={formData.stock}
                  onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                  className="bg-slate-50 dark:bg-slate-800"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="barcode">{t("products.dialogs.barcode")}</Label>
                <Input
                  id="barcode"
                  placeholder={t("products.dialogs.enterBarcode")}
                  value={formData.barcode}
                  onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                  className="bg-slate-50 dark:bg-slate-800"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="description">{t("products.dialogs.description")}</Label>
                <Textarea
                  id="description"
                  placeholder={t("products.dialogs.enterDescription")}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="bg-slate-50 dark:bg-slate-800"
                  rows={3}
                />
              </div>
            </div>

            <Separator />

            {/* Regulatory Compliance Fields */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{t("products.dialogs.regulatoryCompliance")}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="substanceName">{t("products.dialogs.substanceName")}</Label>
                  <Input
                    id="substanceName"
                    placeholder={t("products.dialogs.substanceNamePlaceholder")}
                    value={formData.substanceName}
                    onChange={(e) => setFormData({ ...formData, substanceName: e.target.value })}
                    className="bg-slate-50 dark:bg-slate-800"
                  />
          </div>

                <div className="space-y-2">
                  <Label htmlFor="form">{t("products.dialogs.productForm")}</Label>
                  <Select value={formData.form} onValueChange={(value) => setFormData({ ...formData, form: value })}>
                    <SelectTrigger className="bg-slate-50 dark:bg-slate-800">
                      <SelectValue placeholder={t("products.dialogs.selectForm")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="liquid">{t("products.dialogs.formOptions.liquid")}</SelectItem>
                      <SelectItem value="tablet">{t("products.dialogs.formOptions.tablet")}</SelectItem>
                      <SelectItem value="powder">{t("products.dialogs.formOptions.powder")}</SelectItem>
                      <SelectItem value="capsule">{t("products.dialogs.formOptions.capsule")}</SelectItem>
                      <SelectItem value="other">{t("products.dialogs.formOptions.other")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subtype">{t("products.dialogs.subtype")}</Label>
                  <Input
                    id="subtype"
                    placeholder={t("products.dialogs.subtypePlaceholder")}
                    value={formData.subtype}
                    onChange={(e) => setFormData({ ...formData, subtype: e.target.value })}
                    className="bg-slate-50 dark:bg-slate-800"
                  />
              </div>

            <div className="space-y-2">
                  <Label htmlFor="packageSize">{t("products.dialogs.packageSize")}</Label>
              <Input
                    id="packageSize"
                    placeholder={t("products.dialogs.packageSizePlaceholder")}
                    value={formData.packageSize}
                    onChange={(e) => setFormData({ ...formData, packageSize: e.target.value })}
                className="bg-slate-50 dark:bg-slate-800"
              />
            </div>

            <div className="space-y-2">
                  <Label htmlFor="receivedDate">{t("products.dialogs.receivedDate")}</Label>
                  <Input
                    id="receivedDate"
                    type="date"
                    value={formData.receivedDate}
                    onChange={(e) => setFormData({ ...formData, receivedDate: e.target.value })}
                    className="bg-slate-50 dark:bg-slate-800"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="batchNumber">{t("products.dialogs.batchNumber")}</Label>
                  <Input
                    id="batchNumber"
                    placeholder={t("products.dialogs.batchNumberPlaceholder")}
                    value={formData.batchNumber}
                    onChange={(e) => setFormData({ ...formData, batchNumber: e.target.value })}
                    className="bg-slate-50 dark:bg-slate-800"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quantityUnit">{t("products.dialogs.quantityUnit")}</Label>
                  <Select value={formData.quantityUnit} onValueChange={(value) => setFormData({ ...formData, quantityUnit: value })}>
                    <SelectTrigger className="bg-slate-50 dark:bg-slate-800">
                      <SelectValue placeholder={t("products.dialogs.selectUnit")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pcs">{t("products.dialogs.unitOptions.pcs")}</SelectItem>
                      <SelectItem value="ml">{t("products.dialogs.unitOptions.ml")}</SelectItem>
                      <SelectItem value="g">{t("products.dialogs.unitOptions.g")}</SelectItem>
                      <SelectItem value="kg">{t("products.dialogs.unitOptions.kg")}</SelectItem>
                      <SelectItem value="l">{t("products.dialogs.unitOptions.l")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Separator />

            {/* Psychomodulatory Substance Compliance Fields */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{t("products.dialogs.dosageInformation")}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="recommendedDoseSingle">{t("products.dialogs.recommendedSingleDose")}</Label>
                  <Input
                    id="recommendedDoseSingle"
                    placeholder={t("products.dialogs.recommendedDoseSinglePlaceholder")}
                    value={formData.recommendedDoseSingle}
                    onChange={(e) => setFormData({ ...formData, recommendedDoseSingle: e.target.value })}
                    className="bg-slate-50 dark:bg-slate-800"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="recommendedDoseDaily">{t("products.dialogs.recommendedDailyDose")}</Label>
                  <Input
                    id="recommendedDoseDaily"
                    placeholder={t("products.dialogs.recommendedDoseDailyPlaceholder")}
                    value={formData.recommendedDoseDaily}
                    onChange={(e) => setFormData({ ...formData, recommendedDoseDaily: e.target.value })}
                    className="bg-slate-50 dark:bg-slate-800"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="dosageInfo">{t("products.dialogs.dosageInfo")}</Label>
              <Textarea
                    id="dosageInfo"
                    placeholder={t("products.dialogs.dosageInfoPlaceholder")}
                    value={formData.dosageInfo}
                    onChange={(e) => setFormData({ ...formData, dosageInfo: e.target.value })}
                className="bg-slate-50 dark:bg-slate-800"
                    rows={2}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Warnings and Age Restrictions */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{t("products.dialogs.warningsAgeRestrictions")}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="warningUnder18">{t("products.dialogs.warningUnder18")}</Label>
                  <Textarea
                    id="warningUnder18"
                    placeholder={t("products.dialogs.warningUnder18Placeholder")}
                    value={formData.warningUnder18}
                    onChange={(e) => setFormData({ ...formData, warningUnder18: e.target.value })}
                    className="bg-slate-50 dark:bg-slate-800"
                    rows={2}
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="warningHealth">{t("products.dialogs.healthWarning")}</Label>
                  <Textarea
                    id="warningHealth"
                    placeholder={t("products.dialogs.healthWarningPlaceholder")}
                    value={formData.warningHealth}
                    onChange={(e) => setFormData({ ...formData, warningHealth: e.target.value })}
                    className="bg-slate-50 dark:bg-slate-800"
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="minAge">{t("products.dialogs.minAge")}</Label>
                  <Input
                    id="minAge"
                    type="number"
                    min="0"
                    max="100"
                    placeholder={t("products.dialogs.minAgePlaceholder")}
                    value={formData.minAge}
                    onChange={(e) => setFormData({ ...formData, minAge: e.target.value })}
                    className="bg-slate-50 dark:bg-slate-800"
                  />
                </div>

                <div className="space-y-2 flex items-end">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="adultOnly"
                      checked={formData.adultOnly}
                      onCheckedChange={(checked) => setFormData({ ...formData, adultOnly: checked === true })}
                    />
                    <Label htmlFor="adultOnly" className="cursor-pointer">
                      {t("products.dialogs.adultOnlyProduct")}
                    </Label>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Consumer Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{t("products.dialogs.consumerInformation")}</h3>
              <div className="space-y-2">
                <Label htmlFor="consumerInfo">{t("products.dialogs.consumerInfo")}</Label>
                <Textarea
                  id="consumerInfo"
                  placeholder={t("products.dialogs.consumerInfoPlaceholder")}
                  value={formData.consumerInfo}
                  onChange={(e) => setFormData({ ...formData, consumerInfo: e.target.value })}
                  className="bg-slate-50 dark:bg-slate-800"
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="activeSubstancesComposition">{t("products.dialogs.activeSubstancesComposition")}</Label>
                <Textarea
                  id="activeSubstancesComposition"
                  placeholder={t("products.dialogs.activeSubstancesCompositionPlaceholder")}
                  value={formData.activeSubstancesComposition}
                  onChange={(e) => setFormData({ ...formData, activeSubstancesComposition: e.target.value })}
                  className="bg-slate-50 dark:bg-slate-800 font-mono text-sm"
                rows={3}
              />
                <p className="text-xs text-muted-foreground">
                  {t("products.dialogs.activeSubstancesCompositionHint")}
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsCreateDialogOpen(false);
              resetForm();
            }}>
              {t("products.dialogs.cancel")}
            </Button>
            <Button
              onClick={handleCreateProduct}
              disabled={createProductMutation.isPending || updateProductMutation.isPending}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            >
              {(createProductMutation.isPending || updateProductMutation.isPending) ? (
                <>{isEditMode ? t("products.dialogs.updating") : t("products.dialogs.creating")}</>
              ) : (
                <>
                  {isEditMode ? (
                    <>
                      <Edit className="h-4 w-4 mr-2" />
                      {t("products.dialogs.updateProduct")}
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      {t("products.dialogs.createProduct")}
                    </>
                  )}
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

      {/* Delete Product Dialog */}
      <AlertDialog open={isDeleteProductDialogOpen} onOpenChange={setIsDeleteProductDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("products.dialogs.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("products.dialogs.deleteDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setIsDeleteProductDialogOpen(false);
              setProductToDelete(null);
            }}>
              {t("products.dialogs.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteProduct}
              disabled={deleteProductMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteProductMutation.isPending ? t("dialogs.deleting") : t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default Products;