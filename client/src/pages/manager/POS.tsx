import { useState, useEffect } from "react";
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
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [cart, setCart] = useState<CartItem[]>([]);
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

  // Fetch products for the store
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: [`/api/stores/${storeId}/products`],
    queryFn: () => apiRequest('GET', `/api/stores/${storeId}/products`).then(res => res.json()),
    enabled: !!storeId,
  });

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ['/api/categories'],
    queryFn: () => apiRequest('GET', '/api/categories').then(res => res.json()),
  });

  // Process sale mutation
  const processSaleMutation = useMutation({
    mutationFn: async (saleData: any) => {
      const response = await apiRequest('POST', `/api/stores/${storeId}/sales`, saleData);
      return response.json();
    },
    onSuccess: () => {
      setCart([]);
      setIsCheckoutOpen(false);
      setCashReceived("");
      setCustomerInfo({ name: "", phone: "", email: "" });
      setShowCustomerInfo(false);
      toast({ title: "Sale processed successfully!" });
      
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
        title: "Error processing sale", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
      toast({ title: "Product out of stock", variant: "destructive" });
      return;
    }

    setCart(prev => {
      const existingItem = prev.find(item => item.product.id === product.id);
      if (existingItem) {
        if (existingItem.quantity >= product.stock) {
          toast({ title: "Cannot add more items than available stock", variant: "destructive" });
          return prev;
        }
        return prev.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: number) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const updateQuantity = (productId: number, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }

    const product = products.find((p: Product) => p.id === productId);
    if (product && quantity > product.stock) {
      toast({ title: "Cannot exceed available stock", variant: "destructive" });
      return;
    }

    setCart(prev =>
      prev.map(item =>
        item.product.id === productId
          ? { ...item, quantity }
          : item
      )
    );
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

    addToCart(manualProduct);
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

  const processSale = () => {
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
    if (isCompanyAdmin && stores.length > 0) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
          <Card className="w-full max-w-md shadow-lg">
            <CardHeader>
              <CardTitle className="text-center">Select Store for POS</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center text-sm text-muted-foreground mb-4">
                Choose which store you want to operate the Point of Sale for
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
          <h3 className="text-lg font-semibold">No store assigned</h3>
          <p className="text-muted-foreground">Please contact your administrator to assign a store.</p>
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
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">Point of Sale</h1>
                <p className="text-sm text-slate-600 dark:text-slate-400">Store #{storeId}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                <Clock className="h-3 w-3 mr-1" />
                {new Date().toLocaleTimeString()}
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
                      placeholder="Search products or scan barcode..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                    />
                  </div>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="w-full sm:w-48 bg-slate-50 dark:bg-slate-800">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
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
                                Low Stock
                              </Badge>
                            )}
                            {product.stock <= 0 && (
                              <Badge variant="secondary" className="absolute top-2 right-2 text-xs">
                                Out of Stock
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
                                {product.stock} in stock
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
                              {product.stock} in stock
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
                  Cart ({cart.length} items)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {cart.length === 0 ? (
                  <div className="text-center py-12">
                    <ShoppingCart className="h-12 w-12 mx-auto text-slate-400 mb-4" />
                    <p className="text-slate-500 dark:text-slate-400">Your cart is empty</p>
                    <p className="text-sm text-slate-400 dark:text-slate-500">Add products to start a sale</p>
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
                            ${parseFloat(item.product.price.toString()).toFixed(2)} each
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
                          <span className="w-8 text-center font-medium">{item.quantity}</span>
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
                      <span>Net Amount:</span>
                      <span>${getNetAmount().toFixed(2)}</span>
                    </div>
                    
                    {/* VAT Breakdown by Rate */}
                    {Object.entries(getVATBreakdown()).map(([rate, breakdown]) => (
                      <div key={rate} className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                        <span>VAT {breakdown.rate}%:</span>
                        <span>${breakdown.vat.toFixed(2)}</span>
                      </div>
                    ))}
                    
                    <div className="flex justify-between text-sm font-medium">
                      <span>Total VAT:</span>
                      <span>${getTotalVAT().toFixed(2)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total:</span>
                      <span className="text-green-600 dark:text-green-400">
                        ${getTotalAmount().toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <Button
                    onClick={() => setIsCheckoutOpen(true)}
                    className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold py-3"
                    size="lg"
                  >
                    <CreditCard className="h-5 w-5 mr-2" />
                    Checkout
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
            <DialogTitle>Add Manual Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="manual-name">Item Name</Label>
              <Input
                id="manual-name"
                value={manualItem.name}
                onChange={(e) => setManualItem({ ...manualItem, name: e.target.value })}
                placeholder="Enter item name"
              />
            </div>
            <div>
              <Label htmlFor="manual-price">Price</Label>
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
              <Label htmlFor="manual-vatRate">VAT Rate (%)</Label>
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
                Enter percentage (e.g., 21 for 21%)
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowManualItem(false)}>
              Cancel
            </Button>
            <Button onClick={addManualItem}>Add Item</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Checkout Dialog */}
      <Dialog open={isCheckoutOpen} onOpenChange={setIsCheckoutOpen}>
        <DialogContent className="sm:max-w-lg">
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
    </div>
  );
}