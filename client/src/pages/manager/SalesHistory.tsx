import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  CheckCircle
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { format, isToday, isYesterday, differenceInDays } from "date-fns";

interface Sale {
  id: string;
  total: string;
  netAmount?: string;
  totalVAT?: string;
  vatBreakdown?: { [key: string]: { net: number; vat: number; rate: number } };
  paymentMethod: string;
  items: any;
  customerInfo?: {
    name?: string;
    phone?: string;
    email?: string;
  } | null;
  createdAt: string;
  storeId: number;
  userId?: string;
}

function SalesHistory() {
  const { user } = useAuth();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState("");
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'cash' | 'card'>('all');

  const storeId = user?.storeId;

  // Fetch sales for the store with automatic refresh
  const { data: sales = [], isLoading } = useQuery({
    queryKey: ['/api/stores', storeId, 'sales'],
    queryFn: async () => {
      if (!storeId) return [];
      const res = await apiRequest('GET', `/api/stores/${storeId}/sales`);
      return await res.json();
    },
    enabled: !!storeId,
    refetchInterval: 30000, // Refresh every 30 seconds
    refetchOnWindowFocus: true,
  });

  const handleViewDetails = (sale: Sale) => {
    setSelectedSale(sale);
    setIsDetailsDialogOpen(true);
  };

  // Sort sales by date (newest first by default)
  const sortedSales = [...sales].sort((a, b) => {
    const dateA = new Date(a.createdAt).getTime();
    const dateB = new Date(b.createdAt).getTime();
    return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
  });

  const filteredSales = sortedSales.filter((sale: Sale) => {
    const matchesSearch = sale.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         sale.paymentMethod.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesDate = !dateFilter || 
                       format(new Date(sale.createdAt), 'yyyy-MM-dd') === dateFilter;
    
    const matchesPayment = paymentFilter === 'all' || sale.paymentMethod === paymentFilter;
    
    return matchesSearch && matchesDate && matchesPayment;
  });

  // Calculate analytics
  const todaysSales = sales.filter((sale: Sale) => 
    isToday(new Date(sale.createdAt))
  );
  
  const yesterdaysSales = sales.filter((sale: Sale) => 
    isYesterday(new Date(sale.createdAt))
  );
  
  const totalRevenue = sales.reduce((sum: number, sale: Sale) => sum + parseFloat(sale.total), 0);
  const todaysRevenue = todaysSales.reduce((sum: number, sale: Sale) => sum + parseFloat(sale.total), 0);
  const yesterdaysRevenue = yesterdaysSales.reduce((sum: number, sale: Sale) => sum + parseFloat(sale.total), 0);
  const averageOrderValue = sales.length > 0 ? totalRevenue / sales.length : 0;

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
              <div className="text-3xl font-bold text-blue-900 dark:text-blue-100">{sales.length}</div>
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

                <Button
                  variant="outline"
                  onClick={() => setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest')}
                  className="flex items-center gap-2"
                >
                  <ArrowUpDown className="h-4 w-4" />
                  {sortOrder === 'newest' ? 'Newest First' : 'Oldest First'}
                </Button>

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
              Transaction History ({filteredSales.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-slate-500">Loading sales history...</p>
              </div>
            ) : filteredSales.length === 0 ? (
              <div className="p-12 text-center">
                <Receipt className="h-12 w-12 mx-auto text-slate-400 mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">No sales found</h3>
                <p className="text-slate-500">No transactions match your current filters.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredSales.map((sale: Sale, index: number) => {
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
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default SalesHistory;