import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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
  Package,
  Search,
  Filter,
  TrendingUp,
  TrendingDown,
  Clock,
  User,
  ArrowUpDown,
  FileText,
  ShoppingCart,
  RotateCcw,
  Settings,
  Calendar,
  ArrowUp,
  ArrowDown,
  Minus
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { format, isToday, isYesterday, differenceInDays } from "date-fns";
import { usePagination } from "@/hooks/common/usePagination";
import { Pagination } from "@/components/common";
import { useTranslation } from "@/hooks/useTranslation";

interface StockTransaction {
  id: number;
  productId: number;
  storeId: number;
  batchId?: number | null;
  transactionType: string;
  quantityChange: number;
  quantityBefore: number;
  quantityAfter: number;
  saleId?: string | null;
  saleItemId?: number | null;
  returnId?: number | null;
  returnItemId?: number | null;
  reason?: string | null;
  notes?: string | null;
  userId?: string | null;
  userName?: string | null;
  userEmail?: string | null;
  createdAt: string;
  productName?: string;
  productBarcode?: string;
}

function StockTransactionsHistory() {
  const { user } = useAuth();
  const { t } = useTranslation();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [transactionTypeFilter, setTransactionTypeFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState("");

  const storeId = user?.storeId;

  // Use pagination hook
  const { currentPage, pageSize, setPage, setPageSize, offset } = usePagination({
    initialPage: 1,
    initialPageSize: 20,
  });

  // Fetch stock transactions
  const { data: transactionsResponse, isLoading } = useQuery({
    queryKey: ['/api/stores', storeId, 'stock-transactions', currentPage, pageSize, transactionTypeFilter, dateFilter],
    queryFn: async () => {
      if (!storeId) return { data: [], total: 0, page: 1, limit: pageSize, totalPages: 0 };
      
      const params = new URLSearchParams({
        limit: pageSize.toString(),
        offset: offset.toString(),
      });
      
      if (transactionTypeFilter && transactionTypeFilter !== 'all') {
        params.append("transactionType", transactionTypeFilter);
      }
      
      if (dateFilter) {
        params.append("startDate", dateFilter);
        params.append("endDate", dateFilter);
      }
      
      const res = await apiRequest('GET', `/api/stores/${storeId}/stock-transactions?${params}`);
      const data = await res.json();
      
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

  const transactions = transactionsResponse?.data || [];
  const totalTransactions = transactionsResponse?.total || 0;
  const totalPages = transactionsResponse?.totalPages || 0;

  // Filter transactions by search term (client-side for product name/barcode)
  const filteredTransactions = transactions.filter((transaction: StockTransaction) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      transaction.productName?.toLowerCase().includes(searchLower) ||
      transaction.productBarcode?.toLowerCase().includes(searchLower) ||
      transaction.reason?.toLowerCase().includes(searchLower)
    );
  });

  const getTransactionTypeIcon = (type: string) => {
    switch (type) {
      case 'sale':
        return <ShoppingCart className="h-4 w-4" />;
      case 'return':
        return <RotateCcw className="h-4 w-4" />;
      case 'adjustment':
        return <Settings className="h-4 w-4" />;
      default:
        return <Package className="h-4 w-4" />;
    }
  };

  const getTransactionTypeColor = (type: string) => {
    switch (type) {
      case 'sale':
        return 'destructive';
      case 'return':
        return 'default';
      case 'adjustment':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getTransactionTypeLabel = (type: string) => {
    switch (type) {
      case 'sale':
        return 'Sale';
      case 'return':
        return 'Return';
      case 'adjustment':
        return 'Adjustment';
      case 'transfer_in':
        return 'Transfer In';
      case 'transfer_out':
        return 'Transfer Out';
      case 'received':
        return 'Received';
      case 'damaged':
        return 'Damaged';
      case 'expired':
        return 'Expired';
      default:
        return type;
    }
  };

  const getQuantityChangeIcon = (change: number) => {
    if (change > 0) {
      return <ArrowUp className="h-4 w-4 text-green-600" />;
    } else if (change < 0) {
      return <ArrowDown className="h-4 w-4 text-red-600" />;
    }
    return <Minus className="h-4 w-4 text-gray-400" />;
  };

  const getRelativeTime = (date: string) => {
    const transactionDate = new Date(date);
    if (isToday(transactionDate)) {
      return t("stockTransactions.list.relativeTime.today", {
        time: format(transactionDate, "HH:mm"),
      });
    } else if (isYesterday(transactionDate)) {
      return t("stockTransactions.list.relativeTime.yesterday", {
        time: format(transactionDate, "HH:mm"),
      });
    } else {
      const daysDiff = differenceInDays(new Date(), transactionDate);
      if (daysDiff <= 7) {
        return t("stockTransactions.list.relativeTime.daysAgo", { count: daysDiff });
      }
      return format(transactionDate, 'MMM dd, yyyy HH:mm');
    }
  };

  // Calculate statistics
  const totalIncreases = filteredTransactions.filter(t => t.quantityChange > 0).length;
  const totalDecreases = filteredTransactions.filter(t => t.quantityChange < 0).length;
  const totalAdjustments = filteredTransactions.filter(t => t.transactionType === 'adjustment').length;
  const netChange = filteredTransactions.reduce((sum, t) => sum + t.quantityChange, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-blue-950">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                  {t("stockTransactions.header.title")}
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {t("stockTransactions.header.subtitle")}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                <Clock className="h-3 w-3 mr-1" />
                {t("stockTransactions.header.realtime")}
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
              <CardTitle className="text-sm font-medium text-blue-900 dark:text-blue-100">
                {t("stockTransactions.cards.totalTransactions")}
              </CardTitle>
              <div className="p-2 bg-blue-500 rounded-lg">
                <FileText className="h-4 w-4 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-900 dark:text-blue-100">
                {totalTransactions}
              </div>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                {t("stockTransactions.cards.allTimeMovements")}
              </p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 dark:border-slate-800 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-green-900 dark:text-green-100">
                {t("stockTransactions.cards.increases")}
              </CardTitle>
              <div className="p-2 bg-green-500 rounded-lg">
                <TrendingUp className="h-4 w-4 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-900 dark:text-green-100">
                {totalIncreases}
              </div>
              <p className="text-sm text-green-700 dark:text-green-300">
                {t("stockTransactions.cards.increasesDesc")}
              </p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 dark:border-slate-800 bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-red-900 dark:text-red-100">
                {t("stockTransactions.cards.decreases")}
              </CardTitle>
              <div className="p-2 bg-red-500 rounded-lg">
                <TrendingDown className="h-4 w-4 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-900 dark:text-red-100">
                {totalDecreases}
              </div>
              <p className="text-sm text-red-700 dark:text-red-300">
                {t("stockTransactions.cards.decreasesDesc")}
              </p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 dark:border-slate-800 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-purple-900 dark:text-purple-100">
                {t("stockTransactions.cards.netChange")}
              </CardTitle>
              <div className="p-2 bg-purple-500 rounded-lg">
                <ArrowUpDown className="h-4 w-4 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${netChange >= 0 ? 'text-green-900 dark:text-green-100' : 'text-red-900 dark:text-red-100'}`}>
                {netChange >= 0 ? '+' : ''}{netChange}
              </div>
              <p className="text-sm text-purple-700 dark:text-purple-300">
                {t("stockTransactions.cards.netChangeDesc")}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6 border-slate-200 dark:border-slate-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              {t("stockTransactions.filters.title")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="search">{t("stockTransactions.filters.searchLabel")}</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="search"
                    placeholder={t("stockTransactions.filters.searchPlaceholder")}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="transactionType">
                  {t("stockTransactions.filters.transactionType")}
                </Label>
                <Select value={transactionTypeFilter} onValueChange={setTransactionTypeFilter}>
                  <SelectTrigger id="transactionType">
                    <SelectValue placeholder={t("stockTransactions.filters.allTypes")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("stockTransactions.filters.allTypes")}</SelectItem>
                    <SelectItem value="sale">{t("stockTransactions.types.sale")}</SelectItem>
                    <SelectItem value="return">{t("stockTransactions.types.return")}</SelectItem>
                    <SelectItem value="adjustment">
                      {t("stockTransactions.types.adjustment")}
                    </SelectItem>
                    <SelectItem value="transfer_in">
                      {t("stockTransactions.types.transfer_in")}
                    </SelectItem>
                    <SelectItem value="transfer_out">
                      {t("stockTransactions.types.transfer_out")}
                    </SelectItem>
                    <SelectItem value="received">{t("stockTransactions.types.received")}</SelectItem>
                    <SelectItem value="damaged">{t("stockTransactions.types.damaged")}</SelectItem>
                    <SelectItem value="expired">{t("stockTransactions.types.expired")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="date">{t("stockTransactions.filters.date")}</Label>
                <Input
                  id="date"
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Transactions Table */}
        <Card className="border-slate-200 dark:border-slate-800">
          <CardHeader>
            <CardTitle>{t("stockTransactions.list.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <Clock className="h-8 w-8 animate-spin mx-auto text-slate-400 mb-2" />
                <p className="text-slate-600 dark:text-slate-400">
                  {t("stockTransactions.list.loading")}
                </p>
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="text-center py-8">
                <Package className="h-12 w-12 mx-auto text-slate-400 mb-4" />
                <p className="text-slate-600 dark:text-slate-400">
                  {t("stockTransactions.list.empty")}
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("stockTransactions.list.headers.dateTime")}</TableHead>
                        <TableHead>{t("stockTransactions.list.headers.product")}</TableHead>
                        <TableHead>{t("stockTransactions.list.headers.type")}</TableHead>
                        <TableHead>
                          {t("stockTransactions.list.headers.quantityChange")}
                        </TableHead>
                        <TableHead>{t("stockTransactions.list.headers.before")}</TableHead>
                        <TableHead>{t("stockTransactions.list.headers.after")}</TableHead>
                        <TableHead>{t("stockTransactions.list.headers.reason")}</TableHead>
                        <TableHead>{t("stockTransactions.list.headers.user")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTransactions.map((transaction: StockTransaction) => (
                        <TableRow key={transaction.id}>
                          <TableCell className="font-medium">
                            <div className="flex flex-col">
                              <span>
                                {format(new Date(transaction.createdAt), "MMM dd, yyyy")}
                              </span>
                              <span className="text-xs text-slate-500">
                                {getRelativeTime(transaction.createdAt)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">
                                {transaction.productName ||
                                  t("stockTransactions.list.productFallback", {
                                    id: transaction.productId,
                                  })}
                              </span>
                              {transaction.productBarcode && (
                                <span className="text-xs text-slate-500">
                                  {t("stockTransactions.list.barcode", {
                                    barcode: transaction.productBarcode,
                                  })}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={getTransactionTypeColor(transaction.transactionType) as any}
                            >
                              <span className="mr-1">
                                {getTransactionTypeIcon(transaction.transactionType)}
                              </span>
                              {t(`stockTransactions.types.${transaction.transactionType}`, {
                                defaultValue: getTransactionTypeLabel(transaction.transactionType),
                              })}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getQuantityChangeIcon(transaction.quantityChange)}
                              <span
                                className={`font-semibold ${
                                  transaction.quantityChange > 0
                                    ? "text-green-600"
                                    : transaction.quantityChange < 0
                                      ? "text-red-600"
                                      : "text-gray-600"
                                }`}
                              >
                                {transaction.quantityChange > 0 ? "+" : ""}
                                {transaction.quantityChange}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>{transaction.quantityBefore}</TableCell>
                          <TableCell className="font-semibold">
                            {transaction.quantityAfter}
                          </TableCell>
                          <TableCell>
                            {transaction.reason ? (
                              <span className="text-sm text-slate-600 dark:text-slate-400">
                                {transaction.reason}
                              </span>
                            ) : (
                              <span className="text-sm text-slate-400">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {transaction.userName ? (
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-slate-400" />
                                <div className="flex flex-col">
                                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                    {transaction.userName}
                                  </span>
                                  {transaction.userEmail &&
                                    transaction.userName !== transaction.userEmail && (
                                      <span className="text-xs text-slate-500 dark:text-slate-400">
                                        {transaction.userEmail}
                                      </span>
                                    )}
                                </div>
                              </div>
                            ) : (
                              <span className="text-sm text-slate-400">
                                {t("stockTransactions.list.systemUser")}
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-6">
                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      onPageChange={setPage}
                      pageSize={pageSize}
                      onPageSizeChange={setPageSize}
                      totalItems={totalTransactions}
                    />
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default StockTransactionsHistory;

