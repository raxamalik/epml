import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
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
  History,
  Search,
  Filter,
  DollarSign,
  ShoppingCart,
  Calendar,
  Receipt,
  CreditCard,
  Banknote,
  Eye,
  TrendingUp,
  TrendingDown,
  Clock,
  User,
  Package,
  ArrowUpDown,
  FileText,
  BarChart3,
  AlertCircle,
  CheckCircle,
  RotateCcw,
  X
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { format, isToday, isYesterday, differenceInDays } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { usePagination } from "@/hooks/common/usePagination";
import { Pagination } from "@/components/common";

interface Sale {
  id: string;
  total: string;
  netAmount?: string;
  totalVAT?: string;
  vatBreakdown?: { [key: string]: { net: number; vat: number; rate: number } };
  paymentMethod: string;
  items: any;
  salesItems?: Array<{
    id: number;
    productId: number;
    quantity: string;
    unitPrice: string;
    vatRate: string;
    product?: {
      id: number;
      name: string;
      price: string;
    };
  }>;
  customerInfo?: {
    name?: string;
    phone?: string;
    email?: string;
  } | null;
  createdAt: string;
  storeId: number;
  userId?: string;
}

interface ReturnItem {
  saleItemId: number;
  productId: number;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  refundAmount: number;
  reason?: string;
}

function SalesHistory() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [isReturnDialogOpen, setIsReturnDialogOpen] = useState(false);
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [returnReason, setReturnReason] = useState("");
  const [refundMethod, setRefundMethod] = useState<'cash' | 'card'>('cash');
  const [dateFilter, setDateFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'cash' | 'card'>('all');

  const storeId = user?.storeId;
  // Note: Backend handles the 14-day restriction for managers automatically
  // Frontend doesn't need to set dateFilter - backend will apply it when no search is active

  // Use pagination hook
  const { currentPage, pageSize, setPage, setPageSize, offset } = usePagination({
    initialPage: 1,
    initialPageSize: 10,
  });

  // Fetch all sales for analytics (without pagination)
  // Backend handles 14-day restriction for managers automatically
  const { data: allSalesData = [] } = useQuery({
    queryKey: ['/api/stores', storeId, 'sales', 'all', searchTerm],
    queryFn: async () => {
      if (!storeId) return [];
      const params = new URLSearchParams({
        limit: '10000',
      });
      // Include search if provided (this allows managers to access older data)
      if (searchTerm) {
        params.append("search", searchTerm);
      }
      const res = await apiRequest('GET', `/api/stores/${storeId}/sales?${params}`);
      const data = await res.json();
      return Array.isArray(data) ? data : data.data || [];
    },
    enabled: !!storeId,
  });

  // Fetch paginated sales for the store
  const { data: salesResponse, isLoading } = useQuery({
    queryKey: ['/api/stores', storeId, 'sales', currentPage, pageSize, searchTerm, dateFilter, paymentFilter],
    queryFn: async () => {
      if (!storeId) return { data: [], total: 0, page: 1, limit: pageSize, totalPages: 0 };
      
      const params = new URLSearchParams({
        limit: pageSize.toString(),
        offset: offset.toString(),
      });
      
      if (searchTerm) {
        params.append("search", searchTerm);
      }
      
      if (dateFilter) {
        params.append("startDate", dateFilter);
        // Don't set endDate when dateFilter is used - this allows showing all data from that date onwards
        // For managers, the backend will handle the 14-day restriction
      }
      
      const res = await apiRequest('GET', `/api/stores/${storeId}/sales?${params}`);
      const data = await res.json();
      
      // Handle paginated response
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
    enabled: !!storeId,
    refetchInterval: 30000, // Refresh every 30 seconds
    refetchOnWindowFocus: true,
  });

  const sales = salesResponse?.data || [];
  const totalSales = salesResponse?.total || 0;
  const totalPages = salesResponse?.totalPages || 0;

  const handleViewDetails = async (sale: Sale) => {
    setSelectedSale(sale);
    setIsDetailsDialogOpen(true);
    
    // Fetch sale details with salesItems
    try {
      const res = await apiRequest('GET', `/api/sales/${sale.id}`);
      const saleDetails = await res.json();
      setSelectedSale(saleDetails);
    } catch (error) {
      console.error("Error fetching sale details:", error);
    }
  };

  const handleOpenReturn = async () => {
    if (!selectedSale) return;
    
    // Ensure we have salesItems - fetch sale details if not already fetched
    if (!selectedSale.salesItems || selectedSale.salesItems.length === 0) {
      try {
        const res = await apiRequest('GET', `/api/sales/${selectedSale.id}`);
        const saleDetails = await res.json();
        if (!saleDetails.salesItems || saleDetails.salesItems.length === 0) {
          toast({
            title: "Cannot process return",
            description: "This sale does not have item details. Returns are only available for sales with item records.",
            variant: "destructive"
          });
          return;
        }
        setSelectedSale(saleDetails);
      } catch (error) {
        toast({
          title: "Error fetching sale details",
          description: "Failed to fetch sale details for return",
          variant: "destructive"
        });
        return;
      }
    }
    
    setReturnItems([]);
    setReturnReason("");
    setRefundMethod('cash');
    setIsReturnDialogOpen(true);
  };

  const handleAddReturnItem = (saleItem: any, quantity: number) => {
    if (!selectedSale) return;
    
    // Ensure we have a valid saleItemId from sales_items table
    if (!saleItem.id || typeof saleItem.id !== 'number') {
      toast({
        title: "Invalid item",
        description: "This item cannot be returned. Please ensure the sale has proper item records.",
        variant: "destructive"
      });
      return;
    }
    
    const existingIndex = returnItems.findIndex(item => item.saleItemId === saleItem.id);
    
    // Get available quantity (accounting for already returned items)
    const availableQty = saleItem.availableQuantity !== undefined 
      ? saleItem.availableQuantity 
      : parseFloat(saleItem.quantity?.toString() || '0') - (saleItem.returnedQuantity || 0);
    
    if (quantity > availableQty || quantity <= 0) {
      toast({
        title: "Invalid quantity",
        description: `Please enter a quantity between 0 and ${availableQty} (available after previous returns)`,
        variant: "destructive"
      });
      return;
    }

    const unitPrice = parseFloat(saleItem.unitPrice?.toString() || '0');
    const vatRate = parseFloat(saleItem.vatRate?.toString() || '0');
    const productId = saleItem.productId || saleItem.product?.id;
    
    if (!productId) {
      toast({
        title: "Invalid item",
        description: "Product ID is missing for this item",
        variant: "destructive"
      });
      return;
    }

    const netAmount = unitPrice * quantity;
    const vatAmount = netAmount * (vatRate / 100);
    const refundAmount = netAmount + vatAmount;

    const returnItem: ReturnItem = {
      saleItemId: saleItem.id, // This must be the ID from sales_items table
      productId: productId,
      quantity,
      unitPrice,
      vatRate,
      refundAmount
    };

    if (existingIndex >= 0) {
      const updated = [...returnItems];
      updated[existingIndex] = returnItem;
      setReturnItems(updated);
    } else {
      setReturnItems([...returnItems, returnItem]);
    }
  };

  const handleRemoveReturnItem = (saleItemId: number) => {
    setReturnItems(returnItems.filter(item => item.saleItemId !== saleItemId));
  };

  const createReturnMutation = useMutation({
    mutationFn: async (returnData: any) => {
      const response = await apiRequest('POST', '/api/returns', returnData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Return processed successfully",
        description: "Items have been returned and stock has been updated"
      });
      setIsReturnDialogOpen(false);
      setReturnItems([]);
      setReturnReason("");
      queryClient.invalidateQueries({ queryKey: ['/api/stores', storeId, 'sales'] });
      queryClient.invalidateQueries({ queryKey: ['/api/returns'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error processing return",
        description: error.message || "Failed to process return",
        variant: "destructive"
      });
    }
  });

  const handleProcessReturn = () => {
    if (!selectedSale || returnItems.length === 0) {
      toast({
        title: "Invalid return",
        description: "Please select at least one item to return",
        variant: "destructive"
      });
      return;
    }

    // Validate all return items have valid saleItemIds
    const invalidItems = returnItems.filter(item => !item.saleItemId || typeof item.saleItemId !== 'number');
    if (invalidItems.length > 0) {
      toast({
        title: "Invalid return items",
        description: "Some items are missing required information. Please try again.",
        variant: "destructive"
      });
      return;
    }

    const totalRefund = returnItems.reduce((sum, item) => sum + item.refundAmount, 0);

    const returnData = {
      returnData: {
        saleId: selectedSale.id,
        storeId: selectedSale.storeId,
        userId: user?.id,
        totalRefund: totalRefund.toFixed(2),
        refundMethod: refundMethod,
        reason: returnReason || null,
        status: 'completed'
      },
      returnItems: returnItems.map(item => ({
        saleItemId: item.saleItemId, // Must be a number (ID from sales_items table)
        productId: item.productId,
        quantity: item.quantity.toString(),
        unitPrice: item.unitPrice.toFixed(2),
        vatRate: item.vatRate.toFixed(2),
        refundAmount: item.refundAmount.toFixed(2),
        reason: item.reason || null
      }))
    };

    createReturnMutation.mutate(returnData);
  };

  // Calculate analytics from all sales (for accurate metrics)
  const allSales = Array.isArray(allSalesData) ? allSalesData : [];
  const todaysSales = allSales.filter((sale: Sale) => 
    isToday(new Date(sale.createdAt))
  );
  
  const yesterdaysSales = allSales.filter((sale: Sale) => 
    isYesterday(new Date(sale.createdAt))
  );
  
  const totalRevenue = allSales.reduce((sum: number, sale: Sale) => sum + parseFloat(sale.total), 0);
  const todaysRevenue = todaysSales.reduce((sum: number, sale: Sale) => sum + parseFloat(sale.total), 0);
  const yesterdaysRevenue = yesterdaysSales.reduce((sum: number, sale: Sale) => sum + parseFloat(sale.total), 0);
  const averageOrderValue = allSales.length > 0 ? totalRevenue / allSales.length : 0;

  // Calculate growth
  const revenueGrowth = yesterdaysRevenue > 0 
    ? ((todaysRevenue - yesterdaysRevenue) / yesterdaysRevenue) * 100 
    : todaysRevenue > 0 ? 100 : 0;

  const getPaymentMethodIcon = (method: string) => {
    return method === 'cash' ? <Banknote className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />;
  };

  const getPaymentMethodColor = (method: string) => {
    return method === 'cash' ? 'default' : 'secondary';
  };

  const getRelativeTime = (date: string) => {
    const saleDate = new Date(date);
    if (isToday(saleDate)) {
      return `Today, ${format(saleDate, 'HH:mm')}`;
    } else if (isYesterday(saleDate)) {
      return `Yesterday, ${format(saleDate, 'HH:mm')}`;
    } else {
      const daysDiff = differenceInDays(new Date(), saleDate);
      if (daysDiff <= 7) {
        return `${daysDiff} days ago`;
      }
      return format(saleDate, 'MMM dd, yyyy');
    }
  };

  const parseSaleItems = (items: any) => {
    try {
      const saleData = typeof items === 'string' ? JSON.parse(items) : items;
      return saleData?.items || saleData || [];
    } catch {
      return [];
    }
  };

  const getCustomerInfo = (items: any) => {
    try {
      const saleData = typeof items === 'string' ? JSON.parse(items) : items;
      return saleData?.customerInfo || null;
    } catch {
      return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-blue-950">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">Sales History</h1>
                <p className="text-sm text-slate-600 dark:text-slate-400">Transaction analytics and history</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                <Clock className="h-3 w-3 mr-1" />
                Real-time updates
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="border-slate-200 dark:border-slate-800 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-blue-900 dark:text-blue-100">Total Sales</CardTitle>
              <div className="p-2 bg-blue-500 rounded-lg">
                <ShoppingCart className="h-4 w-4 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-900 dark:text-blue-100">{totalSales}</div>
              <p className="text-sm text-blue-700 dark:text-blue-300">All time transactions</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 dark:border-slate-800 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-green-900 dark:text-green-100">Total Revenue</CardTitle>
              <div className="p-2 bg-green-500 rounded-lg">
                <DollarSign className="h-4 w-4 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-900 dark:text-green-100">${totalRevenue.toFixed(2)}</div>
              <p className="text-sm text-green-700 dark:text-green-300">Lifetime earnings</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 dark:border-slate-800 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-purple-900 dark:text-purple-100">Today's Revenue</CardTitle>
              <div className="p-2 bg-purple-500 rounded-lg">
                <Calendar className="h-4 w-4 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-900 dark:text-purple-100">${todaysRevenue.toFixed(2)}</div>
              <div className="flex items-center text-sm">
                {revenueGrowth > 0 ? (
                  <>
                    <TrendingUp className="h-3 w-3 text-green-600 mr-1" />
                    <span className="text-green-600">+{revenueGrowth.toFixed(1)}%</span>
                  </>
                ) : revenueGrowth < 0 ? (
                  <>
                    <TrendingDown className="h-3 w-3 text-red-600 mr-1" />
                    <span className="text-red-600">{revenueGrowth.toFixed(1)}%</span>
                  </>
                ) : (
                  <span className="text-purple-700 dark:text-purple-300">No change</span>
                )}
                <span className="text-purple-700 dark:text-purple-300 ml-1">vs yesterday</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 dark:border-slate-800 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-orange-900 dark:text-orange-100">Avg. Order Value</CardTitle>
              <div className="p-2 bg-orange-500 rounded-lg">
                <BarChart3 className="h-4 w-4 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-900 dark:text-orange-100">${averageOrderValue.toFixed(2)}</div>
              <p className="text-sm text-orange-700 dark:text-orange-300">Per transaction</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Controls */}
        <Card className="mb-6 border-slate-200 dark:border-slate-800">
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search by sale ID or payment method..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-slate-50 dark:bg-slate-800"
                />
              </div>
              
              <div className="flex gap-3">
                <div className="flex items-center space-x-2">
                  <Label>Date:</Label>
                  <Input
                    type="date"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="w-auto bg-slate-50 dark:bg-slate-800"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Label>Payment:</Label>
                  <select
                    value={paymentFilter}
                    onChange={(e) => setPaymentFilter(e.target.value as any)}
                    className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-md bg-slate-50 dark:bg-slate-800 text-sm"
                  >
                    <option value="all">All Methods</option>
                    <option value="cash">Cash Only</option>
                    <option value="card">Card Only</option>
                  </select>
                </div>

                {(dateFilter || paymentFilter !== 'all') && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDateFilter("");
                      setPaymentFilter('all');
                    }}
                  >
                    Clear Filters
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sales List */}
        <Card className="shadow-lg border-slate-200 dark:border-slate-800">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900">
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Transaction History ({totalSales})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-slate-500">Loading sales history...</p>
              </div>
            ) : sales.length === 0 ? (
              <div className="p-12 text-center">
                <Receipt className="h-12 w-12 mx-auto text-slate-400 mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">No sales found</h3>
                <p className="text-slate-500">No transactions match your current filters.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {sales.map((sale: Sale, index: number) => {
                  const saleItems = parseSaleItems(sale.items);
                  const customerInfo = getCustomerInfo(sale.items);
                  const isRecent = index < 3; // Highlight first 3 as recent
                  
                  return (
                    <div
                      key={sale.id}
                      className={`p-6 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
                        isRecent ? 'bg-blue-50/50 dark:bg-blue-950/20 border-l-4 border-l-blue-500' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4 flex-1">
                          {/* Sale ID and Status */}
                          <div className="flex items-center space-x-3">
                            <div className="p-3 bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900 rounded-lg">
                              <Receipt className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                              <p className="font-mono text-sm font-medium text-slate-900 dark:text-white">
                                {sale.id.slice(-8)}
                              </p>
                              {isRecent && (
                                <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">
                                  Recent
                                </Badge>
                              )}
                            </div>
                          </div>

                          {/* Date and Time */}
                          <div className="hidden sm:block">
                            <p className="text-sm font-medium text-slate-900 dark:text-white">
                              {getRelativeTime(sale.createdAt)}
                            </p>
                            <p className="text-xs text-slate-500">
                              {format(new Date(sale.createdAt), 'MMM dd, yyyy HH:mm:ss')}
                            </p>
                          </div>

                          {/* Customer Info */}
                          <div className="hidden md:flex items-center space-x-2">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800">
                                <User className="h-4 w-4 text-slate-500" />
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              {customerInfo ? (
                                <>
                                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                                    {customerInfo.name || 'Customer'}
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    {customerInfo.phone || customerInfo.email || 'No contact info'}
                                  </p>
                                </>
                              ) : (
                                <p className="text-sm text-slate-500">Walk-in customer</p>
                              )}
                            </div>
                          </div>

                          {/* Items Summary */}
                          <div className="hidden lg:flex items-center space-x-2">
                            <Package className="h-4 w-4 text-slate-400" />
                            <span className="text-sm text-slate-600 dark:text-slate-400">
                              {saleItems.length} item{saleItems.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>

                        {/* Payment and Total */}
                        <div className="flex items-center space-x-4">
                          <Badge 
                            variant={getPaymentMethodColor(sale.paymentMethod) as any} 
                            className="flex items-center gap-1"
                          >
                            {getPaymentMethodIcon(sale.paymentMethod)}
                            {sale.paymentMethod.charAt(0).toUpperCase() + sale.paymentMethod.slice(1)}
                          </Badge>

                          <div className="text-right">
                            <p className="text-lg font-bold text-green-600 dark:text-green-400">
                              ${parseFloat(sale.total).toFixed(2)}
                            </p>
                          </div>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewDetails(sale)}
                            className="ml-4"
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Details
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
          {sales.length > 0 && (
            <div className="p-4 border-t flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label>Items per page:</Label>
                <Select
                  value={pageSize.toString()}
                  onValueChange={(value) => setPageSize(parseInt(value))}
                >
                  <SelectTrigger className="w-[80px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setPage}
              />
            </div>
          )}
        </Card>
      </div>

      {/* Enhanced Sale Details Dialog */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Sale Details
            </DialogTitle>
            <DialogDescription>
              Complete transaction information and receipt
            </DialogDescription>
          </DialogHeader>
          
          {selectedSale && (
            <div className="space-y-6">
              {/* Header Info */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 p-4 rounded-lg">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-slate-500">Sale ID</Label>
                    <p className="font-mono font-medium">{selectedSale.id}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">Date & Time</Label>
                    <p className="font-medium">
                      {format(new Date(selectedSale.createdAt), 'MMM dd, yyyy')}
                    </p>
                    <p className="text-sm text-slate-600">
                      {format(new Date(selectedSale.createdAt), 'HH:mm:ss')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Customer Information */}
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Customer Information
                </h4>
                <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg">
                  {(() => {
                    const customerInfo = getCustomerInfo(selectedSale.items);
                    if (customerInfo) {
                      return (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {customerInfo.name && (
                            <div>
                              <Label className="text-xs text-slate-500">Name</Label>
                              <p className="font-medium">{customerInfo.name}</p>
                            </div>
                          )}
                          {customerInfo.phone && (
                            <div>
                              <Label className="text-xs text-slate-500">Phone</Label>
                              <p className="font-medium">{customerInfo.phone}</p>
                            </div>
                          )}
                          {customerInfo.email && (
                            <div>
                              <Label className="text-xs text-slate-500">Email</Label>
                              <p className="font-medium">{customerInfo.email}</p>
                            </div>
                          )}
                        </div>
                      );
                    } else {
                      return (
                        <div className="flex items-center gap-2 text-slate-500">
                          <AlertCircle className="h-4 w-4" />
                          <span>Walk-in customer (No contact information provided)</span>
                        </div>
                      );
                    }
                  })()}
                </div>
              </div>

              {/* Items Purchased */}
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Items Purchased
                </h4>
                <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-center">Qty</TableHead>
                        <TableHead className="text-right">Unit Price</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        const items = parseSaleItems(selectedSale.items);
                        if (items.length === 0) {
                          return (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center text-slate-500 py-8">
                                <AlertCircle className="h-6 w-6 mx-auto mb-2" />
                                No item details available
                              </TableCell>
                            </TableRow>
                          );
                        }
                        return items.map((item: any, index: number) => (
                          <TableRow key={index}>
                            <TableCell>
                              <div className="font-medium">
                                {item.name || item.productName || `Product ${item.productId}`}
                              </div>
                              {item.barcode && (
                                <div className="text-xs text-slate-500 font-mono">
                                  {item.barcode}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-center font-medium">
                              {item.quantity}
                            </TableCell>
                            <TableCell className="text-right">
                              ${parseFloat(item.price || 0).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              ${(parseFloat(item.price || 0) * item.quantity).toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ));
                      })()}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Payment Summary */}
              <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Payment Summary
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>Payment Method:</span>
                    <Badge variant={getPaymentMethodColor(selectedSale.paymentMethod) as any} className="flex items-center gap-1">
                      {getPaymentMethodIcon(selectedSale.paymentMethod)}
                      {selectedSale.paymentMethod.charAt(0).toUpperCase() + selectedSale.paymentMethod.slice(1)}
                    </Badge>
                  </div>
                  
                  {/* VAT Breakdown Section */}
                  {selectedSale.netAmount && selectedSale.totalVAT && selectedSale.vatBreakdown && (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        <h5 className="font-medium text-sm">VAT Breakdown</h5>
                        
                        <div className="flex justify-between text-sm">
                          <span>Net Amount:</span>
                          <span>${parseFloat(selectedSale.netAmount).toFixed(2)}</span>
                        </div>
                        
                        {Object.entries(selectedSale.vatBreakdown).map(([rate, breakdown]) => (
                          <div key={rate} className="space-y-1">
                            <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                              <span>VAT {breakdown.rate}% (Net: ${breakdown.net.toFixed(2)}):</span>
                              <span>${breakdown.vat.toFixed(2)}</span>
                            </div>
                          </div>
                        ))}
                        
                        <div className="flex justify-between text-sm font-medium pt-1 border-t border-slate-200 dark:border-slate-600">
                          <span>Total VAT:</span>
                          <span>${parseFloat(selectedSale.totalVAT).toFixed(2)}</span>
                        </div>
                      </div>
                    </>
                  )}
                  
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold">Total Amount:</span>
                    <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                      ${parseFloat(selectedSale.total).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    <span>Transaction completed successfully</span>
                  </div>
                </div>
              </div>

              {/* Receipt Footer */}
              <div className="text-center text-xs text-slate-500 border-t pt-4">
                <p>Transaction processed on {format(new Date(selectedSale.createdAt), 'PPPP')}</p>
                <p>Store ID: {selectedSale.storeId} | Sale ID: {selectedSale.id}</p>
              </div>

              {/* Return Button */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={handleOpenReturn}
                  className="flex items-center gap-2"
                >
                  <RotateCcw className="h-4 w-4" />
                  Process Return
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Return Dialog */}
      <Dialog open={isReturnDialogOpen} onOpenChange={setIsReturnDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5" />
              Process Return
            </DialogTitle>
            <DialogDescription>
              Select items to return and specify refund method
            </DialogDescription>
          </DialogHeader>

          {selectedSale && (
            <div className="space-y-6">
              {/* Sale Items List */}
              <div>
                <Label className="text-sm font-semibold mb-3 block">Select Items to Return</Label>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {(() => {
                    // Only show items that have salesItems (from sales_items table)
                    // Legacy sales without salesItems cannot be returned
                    if (!selectedSale.salesItems || selectedSale.salesItems.length === 0) {
                      return (
                        <div className="text-center py-8 text-slate-500">
                          <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                          <p>This sale does not have item records available for return processing.</p>
                          <p className="text-sm mt-2">Returns are only available for sales with proper item tracking.</p>
                        </div>
                      );
                    }

                    return selectedSale.salesItems.map((item: any, index: number) => {
                      // Must have a valid ID from sales_items table
                      if (!item.id || typeof item.id !== 'number') {
                        return null;
                      }

                      const saleItemId = item.id;
                      const productId = item.productId || item.product?.id;
                      const productName = item.product?.name || item.name || 'Unknown Product';
                      const quantity = parseFloat(item.quantity?.toString() || '0');
                      const unitPrice = parseFloat(item.unitPrice?.toString() || '0');
                      const vatRate = parseFloat(item.vatRate?.toString() || '0');
                      
                      // Get already returned quantity from the sale data
                      const alreadyReturnedQty = item.returnedQuantity || 0;
                      const availableQty = item.availableQuantity !== undefined 
                        ? item.availableQuantity 
                        : quantity - alreadyReturnedQty;
                      
                      // Get quantity currently being returned in this dialog
                      const returnItem = returnItems.find(ri => ri.saleItemId === saleItemId);
                      const currentReturnQty = returnItem?.quantity || 0;
                      
                      // Remaining quantity after current return
                      const remainingQty = availableQty - currentReturnQty;

                      if (availableQty <= 0) return null;

                      return (
                        <Card key={saleItemId} className="p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <p className="font-medium">{productName}</p>
                              <p className="text-sm text-slate-600">
                                Original Qty: {quantity} | Available: {availableQty} | Price: ${unitPrice.toFixed(2)} | VAT: {vatRate}%
                              </p>
                              {alreadyReturnedQty > 0 && (
                                <p className="text-sm text-orange-600 mt-1">
                                  Already Returned: {alreadyReturnedQty}
                                </p>
                              )}
                              {returnItem && (
                                <p className="text-sm text-green-600 mt-1">
                                  Returning: {returnItem.quantity} (Refund: ${returnItem.refundAmount.toFixed(2)})
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                min="0"
                                max={availableQty}
                                step="0.01"
                                placeholder="Qty"
                                className="w-20"
                                defaultValue={currentReturnQty || ''}
                                onChange={(e) => {
                                  const qty = parseFloat(e.target.value) || 0;
                                  if (qty > 0 && qty <= availableQty) {
                                    handleAddReturnItem(item, qty);
                                  } else if (qty === 0) {
                                    handleRemoveReturnItem(saleItemId);
                                  }
                                }}
                              />
                              {returnItem && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveReturnItem(saleItemId)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </Card>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* Return Items Summary */}
              {returnItems.length > 0 && (
                <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg">
                  <Label className="text-sm font-semibold mb-3 block">Return Summary</Label>
                  <div className="space-y-2">
                    {returnItems.map((item, index) => (
                      <div key={index} className="flex justify-between text-sm">
                        <span>Item {index + 1}</span>
                        <span>${item.refundAmount.toFixed(2)}</span>
                      </div>
                    ))}
                    <Separator />
                    <div className="flex justify-between font-semibold">
                      <span>Total Refund:</span>
                      <span className="text-lg">
                        ${returnItems.reduce((sum, item) => sum + item.refundAmount, 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Refund Method */}
              <div>
                <Label htmlFor="refundMethod">Refund Method</Label>
                <Select value={refundMethod} onValueChange={(value: any) => setRefundMethod(value)}>
                  <SelectTrigger id="refundMethod">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Return Reason */}
              <div>
                <Label htmlFor="returnReason">Return Reason (Optional)</Label>
                <Textarea
                  id="returnReason"
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  placeholder="Enter reason for return..."
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsReturnDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleProcessReturn}
              disabled={returnItems.length === 0 || createReturnMutation.isPending}
            >
              {createReturnMutation.isPending ? "Processing..." : "Process Return"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default SalesHistory;