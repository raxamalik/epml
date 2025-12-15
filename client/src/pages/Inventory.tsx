import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { usePagination } from "@/hooks/common/usePagination";
import { useFilters } from "@/hooks/common/useFilters";
import { Pagination } from "@/components/common";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
  Package2,
  Search,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Plus,
  Minus,
  Edit3
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/hooks/useTranslation";

interface Product {
  id: number;
  name: string;
  price: string | number;
  category: string;
  stock: number;
  barcode?: string;
  description?: string;
  storeId: number;
}

function Inventory() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isAdjustDialogOpen, setIsAdjustDialogOpen] = useState(false);
  const [adjustmentType, setAdjustmentType] = useState<'add' | 'remove'>('add');
  const [adjustmentQuantity, setAdjustmentQuantity] = useState("");
  const [adjustmentReason, setAdjustmentReason] = useState("");

  const storeId = user?.storeId;

  // Use custom hooks for pagination and filters
  const { currentPage, pageSize, setPage, setPageSize, offset } = usePagination({
    initialPage: 1,
    initialPageSize: 10,
  });

  const { search, debouncedSearch, setSearch } = useFilters({
    debounceMs: 500,
  });

  // Fetch products for the store with pagination
  const { data: productsResponse, isLoading } = useQuery({
    queryKey: ['/api/stores', storeId, 'products', currentPage, pageSize, debouncedSearch],
    queryFn: async () => {
      if (!storeId) return { data: [], total: 0, page: 1, limit: pageSize, totalPages: 0 };
      
      const params = new URLSearchParams({
        limit: pageSize.toString(),
        offset: offset.toString(),
      });
      
      if (debouncedSearch) {
        params.append("search", debouncedSearch);
      }
      
      const res = await apiRequest('GET', `/api/stores/${storeId}/products?${params}`);
      const data = await res.json();
      
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
    enabled: !!storeId
  });

  const products: Product[] = productsResponse?.data || [];
  const total = productsResponse?.total || 0;
  const totalPages = productsResponse?.totalPages || 0;

  // Update product stock mutation
  const updateStockMutation = useMutation({
    mutationFn: async ({ id, newStock }: { id: number, newStock: number }) => {
      const res = await apiRequest('PUT', `/api/products/${id}`, { stock: newStock });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: t("inventoryPage.toasts.stockUpdatedTitle"),
        description: t("inventoryPage.toasts.stockUpdatedDesc"),
      });
      queryClient.invalidateQueries({ queryKey: ['/api/stores', storeId, 'products'] });
      setIsAdjustDialogOpen(false);
      setSelectedProduct(null);
      setAdjustmentQuantity("");
      setAdjustmentReason("");
    },
    onError: (error) => {
      toast({
        title: t("inventoryPage.toasts.updateErrorTitle"),
        description: t("inventoryPage.toasts.updateErrorDesc"),
        variant: "destructive",
      });
    }
  });

  const handleStockAdjustment = (product: Product, type: 'add' | 'remove') => {
    setSelectedProduct(product);
    setAdjustmentType(type);
    setIsAdjustDialogOpen(true);
  };

  const processStockAdjustment = () => {
    if (!selectedProduct || !adjustmentQuantity) return;

    const quantity = parseInt(adjustmentQuantity);
    const newStock = adjustmentType === 'add' 
      ? selectedProduct.stock + quantity 
      : Math.max(0, selectedProduct.stock - quantity);

    updateStockMutation.mutate({
      id: selectedProduct.id,
      newStock
    });
  };

  const getStockStatus = (stock: number) => {
    if (stock === 0)
      return {
        status: "out",
        color: "destructive",
        label: t("inventoryPage.status.outOfStock"),
      };
    if (stock <= 5)
      return {
        status: "low",
        color: "secondary",
        label: t("inventoryPage.status.lowStock"),
      };
    if (stock <= 20)
      return {
        status: "medium",
        color: "default",
        label: t("inventoryPage.status.mediumStock"),
      };
    return {
      status: "good",
      color: "default",
      label: t("inventoryPage.status.inStock"),
    };
  };

  // Calculate statistics from current page products
  // Note: These are calculated from the current page, not all products
  // For accurate analytics across all products, we might need a separate analytics endpoint
  const lowStockProducts = products.filter((product: Product) => product.stock <= 5);
  const outOfStockProducts = products.filter((product: Product) => product.stock === 0);
  const totalValue = products.reduce((sum: number, product: Product) => 
    sum + (parseFloat(product.price) * product.stock), 0
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            {t("inventoryPage.header.title")}
          </h1>
          <p className="text-muted-foreground">
            {t("inventoryPage.header.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Package2 className="h-5 w-5" />
          <span className="font-medium">
            {t("inventoryPage.header.stockOverview")}
          </span>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("inventoryPage.cards.totalProducts")}
            </CardTitle>
            <Package2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("inventoryPage.cards.lowStockItems")}
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">{lowStockProducts.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("inventoryPage.cards.outOfStock")}
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{outOfStockProducts.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("inventoryPage.cards.totalValue")}
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalValue.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 max-w-sm">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t("inventoryPage.search.placeholder")}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1); // Reset to first page on search
          }}
        />
      </div>

      {/* Inventory Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              {t("inventoryPage.table.title", { count: total })}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Label htmlFor="limit" className="text-sm text-muted-foreground">
                {t("inventoryPage.table.itemsPerPage")}
              </Label>
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
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  {t("inventoryPage.table.headers.productName")}
                </TableHead>
                <TableHead>{t("inventoryPage.table.headers.category")}</TableHead>
                <TableHead>
                  {t("inventoryPage.table.headers.currentStock")}
                </TableHead>
                <TableHead>
                  {t("inventoryPage.table.headers.unitPrice")}
                </TableHead>
                <TableHead>
                  {t("inventoryPage.table.headers.totalValue")}
                </TableHead>
                <TableHead>{t("inventoryPage.table.headers.status")}</TableHead>
                <TableHead>{t("inventoryPage.table.headers.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product: Product) => {
                const stockInfo = getStockStatus(product.stock);
                const productValue = parseFloat(product.price) * product.stock;
                
                return (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell>{product.category}</TableCell>
                    <TableCell className="font-mono">{product.stock}</TableCell>
                    <TableCell>
                      ${parseFloat(product.price).toFixed(2)}
                    </TableCell>
                    <TableCell>${productValue.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={stockInfo.color as any}>
                        {stockInfo.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleStockAdjustment(product, 'add')}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleStockAdjustment(product, 'remove')}
                          disabled={product.stock === 0}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                      </div>
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

      {/* Stock Adjustment Dialog */}
      <Dialog open={isAdjustDialogOpen} onOpenChange={setIsAdjustDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {adjustmentType === "add"
                ? t("inventoryPage.dialog.addTitle")
                : t("inventoryPage.dialog.removeTitle")}
            </DialogTitle>
            <DialogDescription>
              {adjustmentType === "add"
                ? t("inventoryPage.dialog.addDescription", {
                    name: selectedProduct?.name,
                  })
                : t("inventoryPage.dialog.removeDescription", {
                    name: selectedProduct?.name,
                  })}
              <br />
              {t("inventoryPage.dialog.currentStock", {
                stock: selectedProduct?.stock ?? 0,
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="quantity">
                {t("inventoryPage.dialog.quantityLabel")}
              </Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                value={adjustmentQuantity}
                onChange={(e) => setAdjustmentQuantity(e.target.value)}
                placeholder={t("inventoryPage.dialog.quantityPlaceholder")}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="reason">
                {t("inventoryPage.dialog.reasonLabel")}
              </Label>
              <Input
                id="reason"
                value={adjustmentReason}
                onChange={(e) => setAdjustmentReason(e.target.value)}
                placeholder={t("inventoryPage.dialog.reasonPlaceholder")}
              />
            </div>
            {adjustmentQuantity && selectedProduct && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm">
                  <strong>{t("inventoryPage.dialog.previewLabel")}</strong>{" "}
                  {selectedProduct.stock} →
                  {adjustmentType === "add"
                    ? selectedProduct.stock + parseInt(adjustmentQuantity)
                    : Math.max(
                        0,
                        selectedProduct.stock - parseInt(adjustmentQuantity),
                      )}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAdjustDialogOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button 
              onClick={processStockAdjustment} 
              disabled={updateStockMutation.isPending || !adjustmentQuantity}
            >
              {updateStockMutation.isPending
                ? t("inventoryPage.dialog.updating")
                : t("inventoryPage.dialog.updateButton")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default Inventory;