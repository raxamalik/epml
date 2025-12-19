import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  RotateCcw,
  Search,
  Filter,
  DollarSign,
  Calendar,
  Receipt,
  CreditCard,
  Banknote,
  Eye,
  TrendingUp,
  TrendingDown,
  Clock,
  Package,
  ArrowUpDown,
  FileText,
  BarChart3,
  AlertCircle,
  CheckCircle,
  XCircle
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { format, isToday, isYesterday, differenceInDays } from "date-fns";
import { usePagination } from "@/hooks/common/usePagination";
import { Pagination } from "@/components/common";
import { useTranslation } from "@/hooks/useTranslation";

interface Return {
  id: number;
  saleId: string;
  returnDate: string;
  reason?: string;
  totalRefund: string;
  refundMethod: string;
  status: string;
  storeId: number;
  userId?: string;
  processedBy?: string;
  processedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  returnItems?: ReturnItem[];
}

interface ReturnItem {
  id: number;
  returnId: number;
  saleItemId: number;
  productId: number;
  batchId?: number;
  quantity: string;
  unitPrice: string;
  vatRate: string;
  refundAmount: string;
  reason?: string;
  condition?: string;
  createdAt: string;
  product?: {
    id: number;
    name: string;
    price: string;
  };
}

function ReturnsHistory() {
  const { user } = useAuth();
  const { t } = useTranslation();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedReturn, setSelectedReturn] = useState<Return | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed' | 'rejected'>('all');
  const [refundMethodFilter, setRefundMethodFilter] = useState<'all' | 'cash' | 'card'>('all');

  const storeId = user?.storeId;
  const isManager = user?.role === 'manager';

  // Note: Backend handles the 14-day restriction for managers automatically
  // Frontend doesn't need to set dateFilter - backend will apply it when no search is active

  // Use pagination hook
  const { currentPage, pageSize, setPage, setPageSize, offset } = usePagination({
    initialPage: 1,
    initialPageSize: 10,
  });

  // Fetch all returns for analytics (without pagination)
  // Backend handles 14-day restriction for managers automatically
  const { data: allReturnsData = [] } = useQuery({
    queryKey: ['/api/returns', storeId, 'all', searchTerm],
    queryFn: async () => {
      if (!storeId) return [];
      const params = new URLSearchParams({
        storeId: storeId.toString(),
        limit: '10000',
      });
      // Include search if provided (this allows managers to access older data)
      if (searchTerm) {
        params.append("search", searchTerm);
      }
      const res = await apiRequest('GET', `/api/returns?${params}`);
      const data = await res.json();
      return Array.isArray(data) ? data : data.data || [];
    },
    enabled: !!storeId,
  });

  // Fetch paginated returns for the store
  const { data: returnsResponse, isLoading } = useQuery({
    queryKey: ['/api/returns', storeId, currentPage, pageSize, searchTerm, dateFilter, statusFilter, refundMethodFilter],
    queryFn: async () => {
      if (!storeId) return { data: [], total: 0, page: 1, limit: pageSize, totalPages: 0 };
      
      const params = new URLSearchParams({
        storeId: storeId.toString(),
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
      
      if (statusFilter && statusFilter !== 'all') {
        params.append("status", statusFilter);
      }
      
      if (refundMethodFilter && refundMethodFilter !== 'all') {
        params.append("refundMethod", refundMethodFilter);
      }
      
      const res = await apiRequest('GET', `/api/returns?${params}`);
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

  const returns = returnsResponse?.data || [];
  const totalReturns = returnsResponse?.total || 0;
  const totalPages = returnsResponse?.totalPages || 0;

  const handleViewDetails = async (returnRecord: Return) => {
    setSelectedReturn(returnRecord);
    setIsDetailsDialogOpen(true);
    
    // Fetch return details with returnItems
    try {
      const res = await apiRequest('GET', `/api/returns/${returnRecord.id}`);
      const returnDetails = await res.json();
      setSelectedReturn(returnDetails);
    } catch (error) {
      console.error("Error fetching return details:", error);
    }
  };

  // Calculate analytics from all returns (for accurate metrics)
  const allReturns = Array.isArray(allReturnsData) ? allReturnsData : [];
  const todaysReturns = allReturns.filter((returnRecord: Return) => 
    isToday(new Date(returnRecord.returnDate || returnRecord.createdAt))
  );
  
  const yesterdaysReturns = allReturns.filter((returnRecord: Return) => 
    isYesterday(new Date(returnRecord.returnDate || returnRecord.createdAt))
  );
  
  const totalRefunds = allReturns.reduce((sum: number, returnRecord: Return) => sum + parseFloat(returnRecord.totalRefund), 0);
  const todaysRefunds = todaysReturns.reduce((sum: number, returnRecord: Return) => sum + parseFloat(returnRecord.totalRefund), 0);
  const yesterdaysRefunds = yesterdaysReturns.reduce((sum: number, returnRecord: Return) => sum + parseFloat(returnRecord.totalRefund), 0);
  const averageRefundValue = allReturns.length > 0 ? totalRefunds / allReturns.length : 0;

  // Calculate growth
  const refundGrowth = yesterdaysRefunds > 0 
    ? ((todaysRefunds - yesterdaysRefunds) / yesterdaysRefunds) * 100 
    : todaysRefunds > 0 ? 100 : 0;

  const getRefundMethodIcon = (method: string) => {
    switch (method) {
      case 'cash':
        return <Banknote className="h-4 w-4" />;
      case 'card':
        return <CreditCard className="h-4 w-4" />;
      default:
        return <DollarSign className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>;
      case 'pending':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getRefundMethodBadge = (method: string) => {
    const color = method === 'cash' ? 'default' : method === 'card' ? 'secondary' : 'outline';
    return (
      <Badge variant={color as any} className="flex items-center gap-1">
        {getRefundMethodIcon(method)}
        {method.charAt(0).toUpperCase() + method.slice(1).replace('_', ' ')}
      </Badge>
    );
  };

  const getRelativeTime = (date: string) => {
    const returnDate = new Date(date);
    if (isToday(returnDate)) {
      return t("returnsHistory.list.relativeTime.today", { time: format(returnDate, "HH:mm") });
    } else if (isYesterday(returnDate)) {
      return t("returnsHistory.list.relativeTime.yesterday", { time: format(returnDate, "HH:mm") });
    } else {
      const daysDiff = differenceInDays(new Date(), returnDate);
      if (daysDiff <= 7) {
        return t("returnsHistory.list.relativeTime.daysAgo", { count: daysDiff });
      }
      return format(returnDate, 'MMM dd, yyyy');
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
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                  {t("returnsHistory.header.title")}
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {t("returnsHistory.header.subtitle")}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                <Clock className="h-3 w-3 mr-1" />
                {t("returnsHistory.header.autoRefresh")}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Analytics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                {t("returnsHistory.cards.totalReturns")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{returns.length}</div>
              <p className="text-xs text-slate-500 mt-1">
                {t("returnsHistory.cards.allTime")}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                {t("returnsHistory.cards.totalRefunds")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                ${totalRefunds.toFixed(2)}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {t("returnsHistory.cards.allTime")}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                {t("returnsHistory.cards.todaysRefunds")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${todaysRefunds.toFixed(2)}</div>
              <div className="flex items-center text-xs mt-1">
                {refundGrowth >= 0 ? (
                  <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-500 mr-1" />
                )}
                <span className={refundGrowth >= 0 ? "text-green-500" : "text-red-500"}>
                  {t("returnsHistory.cards.vsYesterday", {
                    value: Math.abs(refundGrowth).toFixed(1),
                  })}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                {t("returnsHistory.cards.averageRefund")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${averageRefundValue.toFixed(2)}</div>
              <p className="text-xs text-slate-500 mt-1">
                {t("returnsHistory.cards.perReturn")}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                {t("returnsHistory.filters.title")}
              </CardTitle>
            </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="search">{t("returnsHistory.filters.searchLabel")}</Label>
                <Input
                  id="search"
                  placeholder={t("returnsHistory.filters.searchPlaceholder")}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="date">{t("returnsHistory.filters.date")}</Label>
                <Input
                  id="date"
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="status">{t("returnsHistory.filters.status")}</Label>
                <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
                  <SelectTrigger id="status" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("returnsHistory.filters.allStatuses")}</SelectItem>
                    <SelectItem value="pending">{t("returnsHistory.status.pending")}</SelectItem>
                    <SelectItem value="completed">{t("returnsHistory.status.completed")}</SelectItem>
                    <SelectItem value="rejected">{t("returnsHistory.status.rejected")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="refundMethod">
                  {t("returnsHistory.filters.refundMethod")}
                </Label>
                <Select value={refundMethodFilter} onValueChange={(value: any) => setRefundMethodFilter(value)}>
                  <SelectTrigger id="refundMethod" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("returnsHistory.filters.allMethods")}</SelectItem>
                    <SelectItem value="cash">{t("returnsHistory.filters.cash")}</SelectItem>
                    <SelectItem value="card">{t("returnsHistory.filters.card")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between mt-4">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchTerm("");
                    setDateFilter("");
                    setStatusFilter('all');
                    setRefundMethodFilter('all');
                  }}
                >
                  {t("returnsHistory.filters.clear")}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Returns List */}
        <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RotateCcw className="h-5 w-5" />
                {t("returnsHistory.list.title", { count: totalReturns })}
              </CardTitle>
            </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-12">
                <BarChart3 className="h-12 w-12 mx-auto text-slate-400 mb-4 animate-pulse" />
                <p className="text-slate-500">{t("returnsHistory.list.loading")}</p>
              </div>
            ) : returns.length === 0 ? (
              <div className="text-center py-12">
                <RotateCcw className="h-12 w-12 mx-auto text-slate-400 mb-4" />
                <p className="text-slate-500">{t("returnsHistory.list.emptyTitle")}</p>
                <p className="text-sm text-slate-400 mt-2">
                  {t("returnsHistory.list.emptyDesc")}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {returns.map((returnRecord: Return, index: number) => {
                  const isRecent = index < 3;
                  
                  return (
                    <div
                      key={returnRecord.id}
                      className={`p-6 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
                        isRecent ? 'bg-blue-50/50 dark:bg-blue-950/20 border-l-4 border-l-blue-500' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4 flex-1">
                          {/* Return ID and Status */}
                          <div className="flex items-center space-x-3">
                            <div className="p-3 bg-gradient-to-br from-orange-100 to-red-100 dark:from-orange-900 dark:to-red-900 rounded-lg">
                              <RotateCcw className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                            </div>
                            <div>
                              <p className="font-mono text-sm font-medium text-slate-900 dark:text-white">
                                {t("returnsHistory.list.returnId", { id: returnRecord.id })}
                              </p>
                              <p className="text-xs text-slate-500">
                                {t("returnsHistory.list.saleIdShort", {
                                  id: returnRecord.saleId.slice(-8),
                                })}
                              </p>
                              {isRecent && (
                                <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700 mt-1">
                                  {t("returnsHistory.list.recentBadge")}
                                </Badge>
                              )}
                            </div>
                          </div>

                          {/* Date and Time */}
                          <div className="hidden sm:block">
                            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                              <Calendar className="h-4 w-4" />
                              <span>{getRelativeTime(returnRecord.returnDate || returnRecord.createdAt)}</span>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                              {format(new Date(returnRecord.returnDate || returnRecord.createdAt), 'MMM dd, yyyy HH:mm')}
                            </p>
                          </div>

                          {/* Refund Amount */}
                          <div className="hidden md:block">
                            <div className="text-lg font-bold text-green-600 dark:text-green-400">
                              ${parseFloat(returnRecord.totalRefund).toFixed(2)}
                            </div>
                            <div className="flex items-center gap-1 mt-1">
                              {getRefundMethodBadge(returnRecord.refundMethod)}
                            </div>
                          </div>

                          {/* Status */}
                          <div>
                            {getStatusBadge(returnRecord.status)}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewDetails(returnRecord)}
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
          {returns.length > 0 && (
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

      {/* Return Details Dialog */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5" />
              {t("returnsHistory.details.title")}
            </DialogTitle>
            <DialogDescription>
              {t("returnsHistory.details.description")}
            </DialogDescription>
          </DialogHeader>
          
          {selectedReturn && (
            <div className="space-y-6">
              {/* Header Info */}
              <div className="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-950 dark:to-red-950 p-4 rounded-lg">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-slate-500">
                      {t("returnsHistory.details.header.returnId")}
                    </Label>
                    <p className="font-mono font-medium">#{selectedReturn.id}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">
                      {t("returnsHistory.details.header.saleId")}
                    </Label>
                    <p className="font-mono font-medium">{selectedReturn.saleId}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">
                      {t("returnsHistory.details.header.dateTime")}
                    </Label>
                    <p className="font-medium">
                      {format(new Date(selectedReturn.returnDate || selectedReturn.createdAt), 'MMM dd, yyyy')}
                    </p>
                    <p className="text-sm text-slate-600">
                      {format(new Date(selectedReturn.returnDate || selectedReturn.createdAt), 'HH:mm:ss')}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">
                      {t("returnsHistory.details.header.status")}
                    </Label>
                    <div className="mt-1">{getStatusBadge(selectedReturn.status)}</div>
                  </div>
                </div>
              </div>

              {/* Returned Items */}
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  {t("returnsHistory.details.itemsTitle")}
                </h4>
                <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("returnsHistory.details.itemsHeader.item")}</TableHead>
                        <TableHead className="text-center">
                          {t("returnsHistory.details.itemsHeader.qty")}
                        </TableHead>
                        <TableHead className="text-right">
                          {t("returnsHistory.details.itemsHeader.unitPrice")}
                        </TableHead>
                        <TableHead className="text-right">
                          {t("returnsHistory.details.itemsHeader.vatRate")}
                        </TableHead>
                        <TableHead className="text-right">
                          {t("returnsHistory.details.itemsHeader.refundAmount")}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedReturn.returnItems && selectedReturn.returnItems.length > 0 ? (
                        selectedReturn.returnItems.map((item: ReturnItem) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <div className="font-medium">
                                {item.product?.name || `Product ID: ${item.productId}`}
                              </div>
                              {item.condition && (
                                <div className="text-xs text-slate-500">
                                  Condition: {item.condition}
                                </div>
                              )}
                              {item.reason && (
                                <div className="text-xs text-slate-500">
                                  Reason: {item.reason}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-center font-medium">
                              {parseFloat(item.quantity).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right">
                              ${parseFloat(item.unitPrice).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right">
                              {parseFloat(item.vatRate).toFixed(2)}%
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              ${parseFloat(item.refundAmount).toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-slate-500 py-8">
                            <AlertCircle className="h-6 w-6 mx-auto mb-2" />
                            {t("returnsHistory.details.noItems")}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Refund Summary */}
              <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  {t("returnsHistory.details.refundSummaryTitle")}
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>{t("returnsHistory.details.refundMethodLabel")}</span>
                    {getRefundMethodBadge(selectedReturn.refundMethod)}
                  </div>
                  
                  {selectedReturn.reason && (
                    <>
                      <Separator />
                      <div>
                        <Label className="text-sm font-medium">
                          {t("returnsHistory.details.reasonLabel")}
                        </Label>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                          {selectedReturn.reason}
                        </p>
                      </div>
                    </>
                  )}

                  {selectedReturn.notes && (
                    <>
                      <Separator />
                      <div>
                        <Label className="text-sm font-medium">
                          {t("returnsHistory.details.notesLabel")}
                        </Label>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                          {selectedReturn.notes}
                        </p>
                      </div>
                    </>
                  )}
                  
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold">
                      {t("returnsHistory.details.totalRefund")}
                    </span>
                    <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                      ${parseFloat(selectedReturn.totalRefund).toFixed(2)}
                    </span>
                  </div>
                  
                  {selectedReturn.processedBy && (
                            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 pt-2 border-t">
                      <CheckCircle className="h-4 w-4" />
                      <span>
                        {t("returnsHistory.details.processedBy", {
                          date:
                            selectedReturn.processedAt &&
                            format(new Date(selectedReturn.processedAt), "MMM dd, yyyy HH:mm"),
                        })}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="text-center text-xs text-slate-500 border-t pt-4">
                <p>
                  {t("returnsHistory.details.footerProcessedOn", {
                    date: format(
                      new Date(selectedReturn.returnDate || selectedReturn.createdAt),
                      "PPPP",
                    ),
                  })}
                </p>
                <p>
                  {t("returnsHistory.details.footerIds", {
                    storeId: selectedReturn.storeId,
                    id: selectedReturn.id,
                  })}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ReturnsHistory

