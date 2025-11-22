import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
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

interface Product {
  id: number;
  name: string;
  price: number;
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
  
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isAdjustDialogOpen, setIsAdjustDialogOpen] = useState(false);
  const [adjustmentType, setAdjustmentType] = useState<'add' | 'remove'>('add');
  const [adjustmentQuantity, setAdjustmentQuantity] = useState("");
  const [adjustmentReason, setAdjustmentReason] = useState("");

  const storeId = user?.storeId;

  // Fetch products for the store
  const { data: products = [], isLoading } = useQuery({
    queryKey: ['/api/stores', storeId, 'products'],
    queryFn: async () => {
      if (!storeId) return [];
      const res = await apiRequest('GET', `/api/stores/${storeId}/products`);
      return await res.json();
    },
    enabled: !!storeId
  });

  // Update product stock mutation
  const updateStockMutation = useMutation({
    mutationFn: async ({ id, newStock }: { id: number, newStock: number }) => {
      const res = await apiRequest('PUT', `/api/products/${id}`, { stock: newStock });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Stock Updated",
        description: "Product stock has been updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/stores', storeId, 'products'] });
      setIsAdjustDialogOpen(false);
      setSelectedProduct(null);
      setAdjustmentQuantity("");
      setAdjustmentReason("");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update stock",
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
    if (stock === 0) return { status: 'out', color: 'destructive', label: 'Out of Stock' };
    if (stock <= 5) return { status: 'low', color: 'secondary', label: 'Low Stock' };
    if (stock <= 20) return { status: 'medium', color: 'default', label: 'Medium Stock' };
    return { status: 'good', color: 'default', label: 'In Stock' };
  };

  const filteredProducts = products.filter((product: Product) =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
          <h1 className="text-3xl font-bold">Inventory Management</h1>
          <p className="text-muted-foreground">Track and manage your store inventory</p>
        </div>
        <div className="flex items-center gap-2">
          <Package2 className="h-5 w-5" />
          <span className="font-medium">Stock Overview</span>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Products</CardTitle>
            <Package2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{products.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">{lowStockProducts.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Out of Stock</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{outOfStockProducts.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
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
          placeholder="Search inventory..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Inventory Table */}
      <Card>
        <CardHeader>
          <CardTitle>Inventory Details</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Current Stock</TableHead>
                <TableHead>Unit Price</TableHead>
                <TableHead>Total Value</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((product: Product) => {
                const stockInfo = getStockStatus(product.stock);
                const productValue = parseFloat(product.price) * product.stock;
                
                return (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell>{product.category}</TableCell>
                    <TableCell className="font-mono">{product.stock}</TableCell>
                    <TableCell>${parseFloat(product.price).toFixed(2)}</TableCell>
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
        </CardContent>
      </Card>

      {/* Stock Adjustment Dialog */}
      <Dialog open={isAdjustDialogOpen} onOpenChange={setIsAdjustDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {adjustmentType === 'add' ? 'Add Stock' : 'Remove Stock'}
            </DialogTitle>
            <DialogDescription>
              {adjustmentType === 'add' 
                ? `Add stock to ${selectedProduct?.name}`
                : `Remove stock from ${selectedProduct?.name}`
              }
              <br />
              Current stock: {selectedProduct?.stock}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                value={adjustmentQuantity}
                onChange={(e) => setAdjustmentQuantity(e.target.value)}
                placeholder="Enter quantity"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="reason">Reason (Optional)</Label>
              <Input
                id="reason"
                value={adjustmentReason}
                onChange={(e) => setAdjustmentReason(e.target.value)}
                placeholder="Reason for adjustment"
              />
            </div>
            {adjustmentQuantity && selectedProduct && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm">
                  <strong>Preview:</strong> {selectedProduct.stock} → {
                    adjustmentType === 'add' 
                      ? selectedProduct.stock + parseInt(adjustmentQuantity)
                      : Math.max(0, selectedProduct.stock - parseInt(adjustmentQuantity))
                  }
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAdjustDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={processStockAdjustment} 
              disabled={updateStockMutation.isPending || !adjustmentQuantity}
            >
              {updateStockMutation.isPending ? "Updating..." : "Update Stock"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default Inventory;