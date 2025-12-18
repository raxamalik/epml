import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Plus, 
  Minus, 
  ShoppingCart, 
  CreditCard, 
  Banknote, 
  Receipt, 
  Search,
  Trash2,
  Package,
  ArrowLeft,
  Calculator,
  Users,
  Clock,
  Filter,
  Star,
  Grid,
  List
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/hooks/useTranslation";
import { apiRequest } from "@/lib/queryClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface Product {
  id: number;
  name: string;
  price: number;
  vatRate: number;
  category: string;
  stock: number;
  barcode?: string;
  imageUrl?: string;
  storeId: number;
}

interface CartItem {
  product: Product;
  quantity: number;
}

interface Sale {
  id: string;
  items: CartItem[];
  total: number;
  paymentMethod: 'cash' | 'card';
  timestamp: Date;
  storeId: number;
}

export default function POS() {
  const { user } = useAuth();
  const { storeSlug } = useParams<{ storeSlug?: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [cashReceived, setCashReceived] = useState("");
  const [showManualItem, setShowManualItem] = useState(false);
  const [manualItem, setManualItem] = useState({ name: "", price: "", vatRate: "21" });
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [customerInfo, setCustomerInfo] = useState({
    name: "",
    phone: "",
    email: ""
  });
  const [showCustomerInfo, setShowCustomerInfo] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);
  const [quantityInputs, setQuantityInputs] = useState<{ [productId: number]: string }>({});
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);
  const [lastSaleId, setLastSaleId] = useState<string | null>(null);

  // Determine the storeId to use
  // For managers: use their assigned storeId
  // For company admins: allow them to select from their company's stores
  const isCompanyAdmin = user?.role === 'company_admin' || user?.role === 'store_owner';
  const storeId = isCompanyAdmin ? selectedStoreId : user?.storeId;

  // Fetch user settings to get timezone
  const { data: settings } = useQuery({
    queryKey: ["/api/settings"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/settings");
      return response.json();
    },
  });

  const timezone = settings?.timezone || 'Europe/Prague';

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Local state for manual items (temporary items not in database)
  const [manualCartItems, setManualCartItems] = useState<CartItem[]>([]);

  // Fetch cart from backend
  const { data: cartData = [], isLoading: cartLoading } = useQuery({
    queryKey: ['/api/cart', storeId],
    queryFn: async () => {
      if (!storeId) return [];
      const response = await apiRequest('GET', `/api/cart?storeId=${storeId}`);
      return response.json();
    },
    enabled: !!storeId,
  });

  // Convert backend cart format to frontend format and merge with manual items
  const backendCart: CartItem[] = cartData.map((item: any) => ({
    product: item.product,
    quantity: item.quantity,
  }));

  // Combined cart: backend items + manual items
  const cart: CartItem[] = [...backendCart, ...manualCartItems];

  // Fetch stores for company admins
  const { data: storesResponse, isLoading: storesLoading } = useQuery({
    queryKey: ['/api/stores'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/stores?limit=1000'); // Get all stores (high limit for company admins)
      const data = await res.json();
      // Extract the data array from the paginated response
      return data.data || [];
    },
    enabled: isCompanyAdmin,
  });

  // Extract stores array from response
  const stores = storesResponse || [];

  // Auto-select store from URL slug if provided
  useEffect(() => {
    if (storeSlug && stores.length > 0 && isCompanyAdmin && !selectedStoreId) {
      // Find store by slug (convert store name to slug format)
      const matchingStore = stores.find((store: any) => 
        store.name.toLowerCase().replace(/\s+/g, '-') === storeSlug.toLowerCase()
      );
      if (matchingStore) {
        setSelectedStoreId(matchingStore.id);
      }
    }
  }, [storeSlug, stores, isCompanyAdmin, selectedStoreId]);

  // Fetch products for the store
  const { data: productsResponse, isLoading: productsLoading } = useQuery({
    queryKey: [`/api/stores/${storeId}/products`],
    queryFn: async () => {
      if (!storeId) return { data: [], total: 0 };
      const res = await apiRequest('GET', `/api/stores/${storeId}/products`);
      const data = await res.json();
      // Handle both paginated response and array response (for backward compatibility)
      if (Array.isArray(data)) {
        return { data, total: data.length };
      }
      return { data: data.data || [], total: data.total || 0 };
    },
    enabled: !!storeId,
  });

  // Extract products array from response
  const products: Product[] = productsResponse?.data || [];

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ['/api/categories'],
    queryFn: () => apiRequest('GET', '/api/categories').then(res => res.json()),
  });

  // Add to cart mutation
  const addToCartMutation = useMutation({
    mutationFn: async ({ productId, quantity }: { productId: number; quantity: number }) => {
      const response = await apiRequest('POST', '/api/cart', {
        productId,
        quantity,
        storeId,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cart', storeId] });
      toast({ title: t("pos.toasts.itemAdded") });
    },
    onError: (error: any) => {
      toast({ 
        title: t("pos.toasts.addErrorTitle"), 
        description: error.message || t("pos.toasts.addErrorDesc"),
        variant: "destructive" 
      });
    },
  });

  // Update quantity mutation
  const updateQuantityMutation = useMutation({
    mutationFn: async ({ cartId, quantity }: { cartId: number; quantity: number }) => {
      const response = await apiRequest('PUT', `/api/cart/${cartId}`, {
        quantity,
        storeId,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cart', storeId] });
    },
    onError: (error: any) => {
      toast({ 
        title: t("pos.toasts.updateErrorTitle"), 
        description: error.message || t("pos.toasts.updateErrorDesc"),
        variant: "destructive" 
      });
    },
  });

  // Remove from cart mutation
  const removeFromCartMutation = useMutation({
    mutationFn: async (cartId: number) => {
      const response = await apiRequest('DELETE', `/api/cart/${cartId}?storeId=${storeId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cart', storeId] });
      toast({ title: t("pos.toasts.itemRemoved") });
    },
    onError: (error: any) => {
      toast({ 
        title: t("pos.toasts.removeErrorTitle"), 
        description: error.message || t("pos.toasts.removeErrorDesc"),
        variant: "destructive" 
      });
    },
  });

  // Process sale mutation
  const processSaleMutation = useMutation({
    mutationFn: async (saleData: any) => {
      const response = await apiRequest('POST', `/api/stores/${storeId}/sales`, saleData);
      return response.json();
    },
    onSuccess: async (sale) => {
      // Clear cart from backend after successful sale
      if (storeId) {
        try {
          await apiRequest('DELETE', `/api/cart?storeId=${storeId}`);
        } catch (error) {
          console.error("Error clearing cart:", error);
        }
      }
      // Clear manual items
      setManualCartItems([]);
      queryClient.invalidateQueries({ queryKey: ['/api/cart', storeId] });
      setIsCheckoutOpen(false);
      setCashReceived("");
      setCustomerInfo({ name: "", phone: "", email: "" });
      setShowCustomerInfo(false);
      toast({ title: t("pos.toasts.saleSuccess") });
      
      // Store sale ID and show receipt dialog
      if (sale && sale.id) {
        setLastSaleId(sale.id);
        setShowReceiptDialog(true);
      }
      
      // Invalidate all related queries to update dashboard in real-time
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${storeId}/products`] });
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${storeId}/sales`] });
      queryClient.invalidateQueries({ queryKey: ['/api/stores', storeId, 'products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stores', storeId, 'sales'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stores', storeId] });
      queryClient.invalidateQueries({ queryKey: ['/api/stores'] });
    },
    onError: (error: any) => {
      toast({ 
        title: t("pos.toasts.saleErrorTitle"), 
        description: error.message || t("pos.toasts.saleErrorDesc"),
        variant: "destructive" 
      });
    },
  });

  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
      toast({ title: t("pos.errors.productOutOfStock"), variant: "destructive" });
      return;
    }
    addToCartMutation.mutate({ productId: product.id, quantity: 1 });
  };

  const removeFromCart = (productId: number) => {
    // Check if it's a manual item (temporary ID)
    const isManualItem = productId > 1000000000000; // Manual items use Date.now() as ID
    
    if (isManualItem) {
      // Remove from local manual items
      setManualCartItems(prev => prev.filter(item => item.product.id !== productId));
    } else {
      // Remove from backend cart
      const cartItem = cartData.find((item: any) => item.product.id === productId);
      if (cartItem) {
        removeFromCartMutation.mutate(cartItem.id);
      }
    }
  };

  const updateQuantity = (productId: number, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }

    // Check if it's a manual item
    const isManualItem = productId > 1000000000000;
    
    if (isManualItem) {
      // Update local manual item
      setManualCartItems(prev =>
        prev.map(item =>
          item.product.id === productId
            ? { ...item, quantity }
            : item
        )
      );
    } else {
      // Update backend cart item
      const product = products.find((p: Product) => p.id === productId);
      if (product && quantity > product.stock) {
        toast({ title: t("pos.errors.stockLimitExceeded"), variant: "destructive" });
        return;
      }

      const cartItem = cartData.find((item: any) => item.product.id === productId);
      if (cartItem) {
        updateQuantityMutation.mutate({ cartId: cartItem.id, quantity });
      }
    }
  };

  const addManualItem = () => {
    if (!manualItem.name || !manualItem.price || !manualItem.vatRate) {
      toast({ title: "Please fill in all fields including VAT rate", variant: "destructive" });
      return;
    }

    const manualProduct: Product = {
      id: Date.now(), // Temporary ID for manual items
      name: manualItem.name,
      price: parseFloat(manualItem.price),
      vatRate: parseFloat(manualItem.vatRate),
      category: "Manual Item",
      stock: 999,
      storeId: storeId || 0,
    };

    // Add manual item to local state (not backend)
    setManualCartItems(prev => {
      const existingItem = prev.find(item => item.product.id === manualProduct.id);
      if (existingItem) {
        return prev.map(item =>
          item.product.id === manualProduct.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product: manualProduct, quantity: 1 }];
    });
    setManualItem({ name: "", price: "", vatRate: "21" });
    setShowManualItem(false);
  };

  const getTotalAmount = () => {
    return cart.reduce((total, item) => total + (item.product.price * item.quantity), 0);
  };

  // VAT calculation functions
  const getNetAmount = () => {
    return cart.reduce((total, item) => {
      const netPrice = item.product.price / (1 + item.product.vatRate / 100);
      return total + (netPrice * item.quantity);
    }, 0);
  };

  const getTotalVAT = () => {
    return cart.reduce((total, item) => {
      const netPrice = item.product.price / (1 + item.product.vatRate / 100);
      const vatAmount = netPrice * (item.product.vatRate / 100);
      return total + (vatAmount * item.quantity);
    }, 0);
  };

  const getVATBreakdown = () => {
    const breakdown: { [key: string]: { net: number; vat: number; rate: number } } = {};
    
    cart.forEach(item => {
      const rateKey = item.product.vatRate.toString();
      const netPrice = item.product.price / (1 + item.product.vatRate / 100);
      const vatAmount = netPrice * (item.product.vatRate / 100);
      const totalNet = netPrice * item.quantity;
      const totalVat = vatAmount * item.quantity;
      
      if (!breakdown[rateKey]) {
        breakdown[rateKey] = { net: 0, vat: 0, rate: item.product.vatRate };
      }
      
      breakdown[rateKey].net += totalNet;
      breakdown[rateKey].vat += totalVat;
    });
    
    return breakdown;
  };

  const getChange = () => {
    const received = parseFloat(cashReceived) || 0;
    const total = getTotalAmount();
    return received - total;
  };

  // Validate cart for stock limits
  const validateCartStock = (): { isValid: boolean; errorMessage?: string } => {
    for (const item of cart) {
      // Skip validation for manual items (they don't have real stock)
      const isManualItem = item.product.id > 1000000000000;
      if (isManualItem) {
        continue;
      }

      // Check if quantity exceeds available stock
      const product = products.find((p: Product) => p.id === item.product.id);
      if (product && item.quantity > product.stock) {
        return {
          isValid: false,
          errorMessage: `"${item.product.name}" quantity (${item.quantity}) exceeds available stock (${product.stock})`
        };
      }
    }
    return { isValid: true };
  };

  const handleCheckoutClick = () => {
    const validation = validateCartStock();
    if (!validation.isValid) {
      toast({
        title: "Stock limit exceeded",
        description: validation.errorMessage,
        variant: "destructive"
      });
      return;
    }
    setIsCheckoutOpen(true);
  };

  const processSale = () => {
    // Validate stock limits before processing
    const validation = validateCartStock();
    if (!validation.isValid) {
      toast({
        title: "Stock limit exceeded",
        description: validation.errorMessage,
        variant: "destructive"
      });
      setIsCheckoutOpen(false);
      return;
    }

    const total = getTotalAmount();

    if (paymentMethod === 'cash') {
      const received = parseFloat(cashReceived) || 0;
      if (received < total) {
        toast({ title: "Insufficient cash received", variant: "destructive" });
        return;
      }
    }

    const hasCustomerInfo = customerInfo.name || customerInfo.phone || customerInfo.email;
    const vatBreakdown = getVATBreakdown();

    const saleData = {
      items: cart.map(item => ({
        productId: item.product.id,
        quantity: item.quantity,
        price: item.product.price,
        vatRate: item.product.vatRate,
        name: item.product.name
      })),
      total,
      netAmount: getNetAmount(),
      totalVAT: getTotalVAT(),
      vatBreakdown: vatBreakdown,
      paymentMethod,
      storeId: storeId,
      customerInfo: hasCustomerInfo ? customerInfo : null
    };

    processSaleMutation.mutate(saleData);
  };

  // Function to print receipt
  const printReceipt = (receiptText: string, companyLogo?: string | null) => {
    // Replace [LOGO] placeholder with actual image if logo exists
    let receiptHtml = receiptText.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    if (companyLogo && receiptText.includes('[LOGO]')) {
      const logoHtml = `<div style="text-align: center; margin: 10px 0;"><img src="${companyLogo}" alt="Company Logo" style="max-width: 200px; max-height: 80px; object-fit: contain;" /></div>`;
      receiptHtml = receiptHtml.replace(/\[LOGO\]/g, logoHtml);
    } else if (receiptText.includes('[LOGO]')) {
      // Remove [LOGO] placeholder if no logo
      receiptHtml = receiptHtml.replace(/\[LOGO\]/g, '');
    }
    
    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({
        title: "Print blocked",
        description: "Please allow pop-ups to print receipts",
        variant: "destructive"
      });
      return;
    }

    // Write the receipt content with proper formatting
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt</title>
          <style>
            @media print {
              @page {
                margin: 0;
                size: 80mm auto;
              }
              body {
                margin: 0;
                padding: 10mm;
              }
            }
            body {
              font-family: 'Courier New', monospace;
              font-size: 12px;
              line-height: 1.4;
              white-space: pre-wrap;
              word-wrap: break-word;
              max-width: 80mm;
              margin: 0 auto;
              padding: 20px;
            }
            img {
              display: block;
              margin: 0 auto;
            }
          </style>
        </head>
        <body>
          <pre>${receiptHtml}</pre>
          <script>
            window.onload = function() {
              window.print();
              // Close window after printing (optional)
              // window.onafterprint = function() { window.close(); };
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Filter products based on search and category
  const filteredProducts = products.filter((product: Product) => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.barcode?.includes(searchTerm);
    const matchesCategory = selectedCategory === "all" || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getProductImage = (product: Product) => {
    return product.imageUrl || "/api/placeholder/150/150";
  };

  if (!storeId) {
    if (isCompanyAdmin && storesLoading) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4 animate-pulse" />
            <h3 className="text-lg font-semibold">{t("pos.storeSelection.loading")}</h3>
          </div>
        </div>
      );
    }
    
    if (isCompanyAdmin && stores.length > 0) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
          <Card className="w-full max-w-md shadow-lg">
            <CardHeader>
              <CardTitle className="text-center">
                {t("pos.storeSelection.title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center text-sm text-muted-foreground mb-4">
                {t("pos.storeSelection.description")}
              </div>
              <div className="space-y-2">
                {stores.map((store: any) => (
                  <Button
                    key={store.id}
                    data-testid={`button-select-store-${store.id}`}
                    onClick={() => setSelectedStoreId(store.id)}
                    variant="outline"
                    className="w-full h-auto py-4 px-6 justify-start hover:bg-blue-50 hover:border-blue-500"
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
          <h3 className="text-lg font-semibold">{t("pos.noStoreAssigned.title")}</h3>
          <p className="text-muted-foreground">
            {t("pos.noStoreAssigned.description")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-blue-950">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                  {t("pos.header.title")}
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {t("pos.header.storeLabel", { id: storeId })}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                <Clock className="h-3 w-3 mr-1" />
                {currentTime.toLocaleTimeString('en-US', { 
                  timeZone: timezone,
                  hour12: false,
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit'
                })}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Products Section */}
          <div className="lg:col-span-2 space-y-6">
            {/* Search and Filters */}
            <Card className="shadow-sm border-slate-200 dark:border-slate-800">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder={t("pos.products.searchPlaceholder")}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                    />
                  </div>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="w-full sm:w-48 bg-slate-50 dark:bg-slate-800">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder={t("pos.products.categoryPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("pos.products.allCategories")}</SelectItem>
                      {categories.map((category: any) => (
                        <SelectItem key={category.id} value={category.name}>
                          {category.name}
                        </SelectItem>
                      ))}
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
                      variant={viewMode === 'list' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('list')}
                      className="rounded-none"
                    >
                      <List className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Products Grid */}
            {productsLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="p-4">
                      <div className="h-32 bg-slate-200 dark:bg-slate-700 rounded mb-3"></div>
                      <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded mb-2"></div>
                      <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-2/3"></div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className={viewMode === 'grid' 
                ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" 
                : "space-y-3"
              }>
                {filteredProducts.map((product: Product) => (
                  <Card
                    key={product.id}
                    className={`group cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] border-slate-200 dark:border-slate-800 ${
                      product.stock <= 0 ? 'opacity-50' : ''
                    } ${viewMode === 'list' ? 'flex-row' : ''}`}
                    onClick={() => addToCart(product)}
                  >
                    <CardContent className={`p-4 ${viewMode === 'list' ? 'flex items-center space-x-4' : ''}`}>
                      {viewMode === 'grid' ? (
                        <>
                          <div className="relative mb-3">
                            <Avatar className="w-full h-32 rounded-lg">
                              <AvatarImage 
                                src={getProductImage(product)} 
                                alt={product.name}
                                className="object-cover"
                              />
                              <AvatarFallback className="rounded-lg bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900">
                                <Package className="h-8 w-8 text-slate-500" />
                              </AvatarFallback>
                            </Avatar>
                            {product.stock <= 5 && product.stock > 0 && (
                              <Badge variant="destructive" className="absolute top-2 right-2 text-xs">
                                {t("pos.products.lowStock")}
                              </Badge>
                            )}
                            {product.stock <= 0 && (
                              <Badge variant="secondary" className="absolute top-2 right-2 text-xs">
                                {t("pos.products.outOfStock")}
                              </Badge>
                            )}
                          </div>
                          <div className="space-y-1">
                            <h3 className="font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                              {product.name}
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">{product.category}</p>
                            <div className="flex items-center justify-between pt-2">
                              <span className="text-lg font-bold text-green-600 dark:text-green-400">
                                ${parseFloat(product.price.toString()).toFixed(2)}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {t("pos.products.inStockLabel", { count: product.stock })}
                              </Badge>
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <Avatar className="w-16 h-16 rounded-lg">
                            <AvatarImage 
                              src={getProductImage(product)} 
                              alt={product.name}
                              className="object-cover"
                            />
                            <AvatarFallback className="rounded-lg bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900">
                              <Package className="h-6 w-6 text-slate-500" />
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                              {product.name}
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">{product.category}</p>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-green-600 dark:text-green-400">
                              ${parseFloat(product.price.toString()).toFixed(2)}
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {t("pos.products.inStockLabel", { count: product.stock })}
                            </Badge>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Manual Item Button */}
            <Card className="border-dashed border-2 border-slate-300 dark:border-slate-700">
              <CardContent className="p-4">
                <Button
                  variant="ghost"
                  onClick={() => setShowManualItem(true)}
                  className="w-full h-16 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                >
                  <Plus className="h-6 w-6 mr-2" />
                  Add Manual Item
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Cart Section */}
          <div className="space-y-6">
            <Card className="shadow-lg border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <CardHeader className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-t-lg">
                <CardTitle className="flex items-center">
                  <ShoppingCart className="h-5 w-5 mr-2" />
                  {t("pos.cart.title", { count: cart.length })}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {cart.length === 0 ? (
                  <div className="text-center py-12">
                    <ShoppingCart className="h-12 w-12 mx-auto text-slate-400 mb-4" />
                    <p className="text-slate-500 dark:text-slate-400">
                      {t("pos.cart.emptyTitle")}
                    </p>
                    <p className="text-sm text-slate-400 dark:text-slate-500">
                      {t("pos.cart.emptyDescription")}
                    </p>
                  </div>
                ) : (
                  <div className="max-h-96 overflow-y-auto">
                    {cart.map((item) => (
                      <div key={item.product.id} className="flex items-center p-4 border-b border-slate-100 dark:border-slate-800 last:border-b-0">
                        <Avatar className="w-12 h-12 rounded-lg mr-3">
                          <AvatarImage 
                            src={getProductImage(item.product)} 
                            alt={item.product.name}
                            className="object-cover"
                          />
                          <AvatarFallback className="rounded-lg bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900">
                            <Package className="h-4 w-4 text-slate-500" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-slate-900 dark:text-white truncate">
                            {item.product.name}
                          </h4>
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            ${parseFloat(item.product.price.toString()).toFixed(2)}{" "}
                            {t("pos.cart.each")}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                            className="h-8 w-8 p-0"
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <Input
                            type="number"
                            min="1"
                            value={quantityInputs[item.product.id] !== undefined 
                              ? quantityInputs[item.product.id] 
                              : item.quantity.toString()}
                            onChange={(e) => {
                              const value = e.target.value;
                              // Update local state for immediate UI feedback
                              setQuantityInputs(prev => ({
                                ...prev,
                                [item.product.id]: value
                              }));
                            }}
                            onBlur={(e) => {
                              const value = e.target.value;
                              const numValue = parseInt(value, 10);
                              
                              // Clear the local input state
                              setQuantityInputs(prev => {
                                const newState = { ...prev };
                                delete newState[item.product.id];
                                return newState;
                              });
                              
                              // Validate and update quantity
                              if (value === '' || isNaN(numValue) || numValue <= 0) {
                                // Reset to current quantity if invalid
                                return;
                              }
                              
                              // Check stock limit for backend cart items (not manual items)
                              const isManualItem = item.product.id > 1000000000000;
                              if (!isManualItem) {
                                const product = products.find((p: Product) => p.id === item.product.id);
                                if (product && numValue > product.stock) {
                                  toast({ 
                                    title: "Cannot exceed available stock", 
                                    description: `Only ${product.stock} units available`,
                                    variant: "destructive" 
                                  });
                                  return;
                                }
                              }
                              
                              // Update quantity if it's different
                              if (numValue !== item.quantity) {
                                updateQuantity(item.product.id, numValue);
                              }
                            }}
                            onKeyDown={(e) => {
                              // Update on Enter key as well
                              if (e.key === 'Enter') {
                                e.currentTarget.blur();
                              }
                            }}
                            className="w-16 h-8 text-center font-medium p-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                            style={{ MozAppearance: 'textfield' }}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                            className="h-8 w-8 p-0"
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFromCart(item.product.id)}
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>

              {cart.length > 0 && (
                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-b-lg">
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-sm">
                      <span>{t("pos.summary.netAmount")}</span>
                      <span>${getNetAmount().toFixed(2)}</span>
                    </div>
                    
                    {/* VAT Breakdown by Rate */}
                    {Object.entries(getVATBreakdown()).map(([rate, breakdown]) => (
                      <div key={rate} className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                        <span>
                          {t("pos.summary.vatRateLabel", { rate: breakdown.rate })}
                        </span>
                        <span>${breakdown.vat.toFixed(2)}</span>
                      </div>
                    ))}
                    
                    <div className="flex justify-between text-sm font-medium">
                      <span>{t("pos.summary.totalVat")}</span>
                      <span>${getTotalVAT().toFixed(2)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-lg font-bold">
                      <span>{t("pos.summary.total")}</span>
                      <span className="text-green-600 dark:text-green-400">
                        ${getTotalAmount().toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <Button
                    onClick={handleCheckoutClick}
                    className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold py-3"
                    size="lg"
                  >
                    <CreditCard className="h-5 w-5 mr-2" />
                    {t("pos.cart.checkoutButton")}
                  </Button>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>

      {/* Manual Item Dialog */}
      <Dialog open={showManualItem} onOpenChange={setShowManualItem}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("pos.manualItem.title")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="manual-name">{t("pos.manualItem.nameLabel")}</Label>
              <Input
                id="manual-name"
                value={manualItem.name}
                onChange={(e) => setManualItem({ ...manualItem, name: e.target.value })}
                placeholder={t("pos.manualItem.namePlaceholder")}
              />
            </div>
            <div>
              <Label htmlFor="manual-price">{t("pos.manualItem.priceLabel")}</Label>
              <Input
                id="manual-price"
                type="number"
                step="0.01"
                value={manualItem.price}
                onChange={(e) => setManualItem({ ...manualItem, price: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label htmlFor="manual-vatRate">{t("pos.manualItem.vatLabel")}</Label>
              <Input
                id="manual-vatRate"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={manualItem.vatRate}
                onChange={(e) => setManualItem({ ...manualItem, vatRate: e.target.value })}
                placeholder="21"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t("pos.manualItem.vatHint")}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowManualItem(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={addManualItem}>{t("pos.manualItem.addButton")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Checkout Dialog */}
      <Dialog open={isCheckoutOpen} onOpenChange={setIsCheckoutOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Receipt className="h-5 w-5 mr-2" />
              Complete Sale
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
              <div className="text-center mb-4">
                <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                  ${getTotalAmount().toFixed(2)}
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  Total Amount
                </div>
              </div>
              
              {/* VAT Breakdown in Checkout */}
              <div className="space-y-1 pt-3 border-t border-slate-200 dark:border-slate-600">
                <div className="flex justify-between text-sm">
                  <span>Net Amount:</span>
                  <span>${getNetAmount().toFixed(2)}</span>
                </div>
                
                {Object.entries(getVATBreakdown()).map(([rate, breakdown]) => (
                  <div key={rate} className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                    <span>VAT {breakdown.rate}%:</span>
                    <span>${breakdown.vat.toFixed(2)}</span>
                  </div>
                ))}
                
                <div className="flex justify-between text-sm font-medium pt-1 border-t border-slate-200 dark:border-slate-600">
                  <span>Total VAT:</span>
                  <span>${getTotalVAT().toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Customer Information Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Customer Information (Optional)</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCustomerInfo(!showCustomerInfo)}
                  className="text-blue-600 hover:text-blue-700"
                >
                  {showCustomerInfo ? 'Hide' : 'Add Customer'}
                </Button>
              </div>
              
              {showCustomerInfo && (
                <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border">
                  <div>
                    <Label htmlFor="customer-name" className="text-xs">Customer Name</Label>
                    <Input
                      id="customer-name"
                      placeholder="Enter customer name"
                      value={customerInfo.name}
                      onChange={(e) => setCustomerInfo(prev => ({ ...prev, name: e.target.value }))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="customer-phone" className="text-xs">Phone Number</Label>
                    <Input
                      id="customer-phone"
                      placeholder="Enter phone number"
                      value={customerInfo.phone}
                      onChange={(e) => setCustomerInfo(prev => ({ ...prev, phone: e.target.value }))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="customer-email" className="text-xs">Email Address</Label>
                    <Input
                      id="customer-email"
                      type="email"
                      placeholder="Enter email address"
                      value={customerInfo.email}
                      onChange={(e) => setCustomerInfo(prev => ({ ...prev, email: e.target.value }))}
                      className="mt-1"
                    />
                  </div>
                </div>
              )}
            </div>

            <div>
              <Label>Payment Method</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <Button
                  variant={paymentMethod === 'cash' ? 'default' : 'outline'}
                  onClick={() => setPaymentMethod('cash')}
                  className="h-12"
                >
                  <Banknote className="h-4 w-4 mr-2" />
                  Cash
                </Button>
                <Button
                  variant={paymentMethod === 'card' ? 'default' : 'outline'}
                  onClick={() => setPaymentMethod('card')}
                  className="h-12"
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  Card
                </Button>
              </div>
            </div>

            {paymentMethod === 'cash' && (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="cash-received">Cash Received</Label>
                  <Input
                    id="cash-received"
                    type="number"
                    step="0.01"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                    placeholder="0.00"
                    className="text-lg font-semibold"
                  />
                </div>
                {cashReceived && (
                  <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Change:</span>
                      <span className={`text-lg font-bold ${getChange() >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        ${Math.abs(getChange()).toFixed(2)}
                      </span>
                    </div>
                    {getChange() < 0 && (
                      <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                        Insufficient payment
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCheckoutOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={processSale}
              disabled={processSaleMutation.isPending}
              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
            >
              {processSaleMutation.isPending ? (
                <>Processing...</>
              ) : (
                <>
                  <Receipt className="h-4 w-4 mr-2" />
                  Complete Sale
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt Printing Dialog */}
      <Dialog open={showReceiptDialog} onOpenChange={setShowReceiptDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Receipt className="h-5 w-5 mr-2" />
              {t("receipt.printReceipt")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              {t("receipt.selectReceiptType")}
            </p>
            <div className="grid grid-cols-1 gap-3">
              <Button
                variant="outline"
                className="h-auto py-4 flex flex-col items-start"
                onClick={async () => {
                  if (lastSaleId) {
                    try {
                      const response = await apiRequest(
                        'GET',
                        `/api/sales/${lastSaleId}/receipt?language=en&mode=live&paymentMethod=${paymentMethod}&format=json`
                      );
                      const data = await response.json();
                      printReceipt(data.receipt, data.companyLogo);
                    } catch (error: any) {
                      toast({
                        title: "Error loading receipt",
                        description: error.message || "Failed to load receipt",
                        variant: "destructive"
                      });
                    }
                  }
                  setShowReceiptDialog(false);
                }}
              >
                <span className="font-semibold">{t("receipt.englishReceipt")}</span>
                <span className="text-xs text-muted-foreground mt-1">
                  English receipt with real data
                </span>
              </Button>
              <Button
                variant="outline"
                className="h-auto py-4 flex flex-col items-start"
                onClick={async () => {
                  if (lastSaleId) {
                    try {
                      const response = await apiRequest(
                        'GET',
                        `/api/sales/${lastSaleId}/receipt?language=cz&mode=live&paymentMethod=${paymentMethod}&format=json`
                      );
                      const data = await response.json();
                      printReceipt(data.receipt, data.companyLogo);
                    } catch (error: any) {
                      toast({
                        title: "Error loading receipt",
                        description: error.message || "Failed to load receipt",
                        variant: "destructive"
                      });
                    }
                  }
                  setShowReceiptDialog(false);
                }}
              >
                <span className="font-semibold">{t("receipt.czechReceipt")}</span>
                <span className="text-xs text-muted-foreground mt-1">
                  Český doklad s reálnými údaji
                </span>
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReceiptDialog(false)}>
              {t("receipt.close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}