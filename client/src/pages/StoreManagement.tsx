import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Store, MapPin, Phone, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest } from "@/lib/queryClient";
import { SearchBar, StatusFilter, Pagination, TableActions, DeleteConfirmDialog, EmptyState } from "@/components/common";
import { StoreForm } from "@/components/management/StoreForm";
import { usePagination } from "@/hooks/common/usePagination";
import { useFilters } from "@/hooks/common/useFilters";
import { storeFormSchema, StoreFormData } from "@/lib/utils/validation";
import { getStatusBadgeVariant, getStatusText } from "@/lib/utils/status";
import { formatCurrencyWithSymbol } from "@/lib/utils/currency";

interface Store {
  id: number;
  name: string;
  address: string;
  phone?: string;
  managerId?: string;
  companyId: number;
  isActive: boolean;
  revenue: number;
  customerCount: number;
  productCount: number;
  createdAt: string;
  updatedAt: string;
}

export default function StoreManagement() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  // Redirect store owners to their store detail page
  useEffect(() => {
    if (user?.role === 'store_owner') {
      setLocation('/store-owner/store');
    }
  }, [user, setLocation]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [storeToDelete, setStoreToDelete] = useState<Store | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Use custom hooks for pagination and filters
  const { currentPage, pageSize, setPage, setPageSize, offset } = usePagination({
    initialPage: 1,
    initialPageSize: 10,
  });
  
  const { search, debouncedSearch, status, setSearch, setStatus } = useFilters({
    initialStatus: "all",
    debounceMs: 500,
  });

  const createForm = useForm<StoreFormData>({
    resolver: zodResolver(storeFormSchema),
    defaultValues: {
      name: "",
      address: "",
      phone: "",
      isActive: true,
      ownerEmail: "",
      ownerPassword: "",
    },
  });

  const editForm = useForm<StoreFormData>({
    resolver: zodResolver(storeFormSchema),
  });

  // Fetch stores with pagination and filters
  const { data: storesResponse, isLoading, error, refetch } = useQuery({
    queryKey: ["/api/stores", currentPage, pageSize, debouncedSearch, status],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: pageSize.toString(),
        offset: offset.toString(),
      });
      
      if (debouncedSearch) {
        params.append("search", debouncedSearch);
      }
      if (status && status !== "all") {
        params.append("status", status);
      }
      
      const response = await apiRequest("GET", `/api/stores?${params}`);
      const data = await response.json();
      
      // Handle both paginated response and array response
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
        data: data.data || data.stores || [],
        total: data.total || (data.data || data.stores || []).length,
        page: data.page || currentPage,
        limit: data.limit || pageSize,
        totalPages: data.totalPages || Math.ceil((data.total || (data.data || data.stores || []).length) / pageSize),
      };
    },
  });

  const stores: Store[] = storesResponse?.data || [];
  const total = storesResponse?.total || 0;
  const totalPages = storesResponse?.totalPages || 0;

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status, setPage]);

  // Create store mutation
  const createStoreMutation = useMutation({
    mutationFn: async (data: StoreFormData) => {
      const storeData = {
        ...data,
        companyId: user?.companyId || user?.id, // Use companyId from user or fallback to user id
        revenue: 0,
        customerCount: 0,
        productCount: 0,
      };
      const response = await apiRequest("POST", "/api/stores", storeData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stores"] });
      setIsCreateDialogOpen(false);
      createForm.reset();
      toast({
        title: "Store Created",
        description: "Store has been created successfully.",
      });
    },
    onError: (error: Error) => {
      // Use the error message from backend, or fallback to generic message
      const errorMessage = error.message || (error as any).errorData?.message || 'An error occurred';
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // Update store mutation
  const updateStoreMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<StoreFormData> }) => {
      const response = await apiRequest("PUT", `/api/stores/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stores"] });
      setIsEditDialogOpen(false);
      setSelectedStore(null);
      editForm.reset();
      toast({
        title: "Store Updated",
        description: "Store has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete store mutation
  const deleteStoreMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/stores/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stores"] });
      setIsDeleteDialogOpen(false);
      setStoreToDelete(null);
      toast({
        title: "Store Deleted",
        description: "Store has been deleted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreateStore = (data: StoreFormData) => {
    createStoreMutation.mutate(data);
  };

  const handleEditStore = (store: Store) => {
    setSelectedStore(store);
    editForm.reset({
      name: store.name,
      address: store.address,
      phone: store.phone || "",
      isActive: store.isActive,
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateStore = (data: StoreFormData) => {
    if (selectedStore) {
      updateStoreMutation.mutate({ id: selectedStore.id, data });
    }
  };

  const handleDeleteStore = (store: Store) => {
    setStoreToDelete(store);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteStore = () => {
    if (storeToDelete) {
      deleteStoreMutation.mutate(storeToDelete.id);
    }
  };

  const handleViewDetails = (store: Store) => {
    setLocation(`/stores/${store.id}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Loading stores...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Store className="h-12 w-12 text-slate-400" />
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          Error Loading Stores
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          {(error as Error).message || "An error occurred"}
        </p>
        <Button onClick={() => refetch()} variant="outline">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 relative">
          <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 rounded-2xl p-8 text-white shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                    <Store className="h-8 w-8" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold">Store Management</h1>
                    <p className="text-blue-100 text-lg mt-1">
                      Manage your store locations and settings
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-6 mt-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-sm">System Active</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Store className="h-4 w-4" />
                    <span className="text-sm">{total} Stores</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <Card className="mb-8 border-0 shadow-lg bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
          <CardContent className="p-6">
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                return false;
              }}
              className="flex flex-col sm:flex-row gap-4"
            >
              <div className="flex-1">
                <SearchBar
                  value={search}
                  onChange={setSearch}
                  placeholder="Search stores by name, address, or phone..."
                  className="h-12 text-lg"
                />
              </div>
              
              <StatusFilter
                value={status}
                onChange={setStatus}
                className="h-12"
              />
              
              <Button 
                type="button"
                onClick={() => setIsCreateDialogOpen(true)}
                className="h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold px-6 shadow-lg hover:shadow-xl transition-all duration-200 border-0"
              >
                <Plus className="h-5 w-5 mr-2" />
                Create Store
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Stores Table */}
        <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-700 dark:to-slate-600 border-b border-slate-200 dark:border-slate-600">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-3 text-xl">
                <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg">
                  <Store className="h-6 w-6 text-white" />
                </div>
                <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent font-bold">
                  Stores ({total})
                </span>
              </CardTitle>
              <div className="flex items-center gap-2">
                <Label htmlFor="limit" className="text-sm text-slate-600 dark:text-slate-300">Items per page:</Label>
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
            {stores.length === 0 ? (
              <EmptyState
                title="No stores found"
                description="Get started by creating your first store"
                icon={<Store className="h-12 w-12 mx-auto text-muted-foreground" />}
                action={
                  <Button onClick={() => setIsCreateDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Store
                  </Button>
                }
                className="border-0"
              />
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gradient-to-r from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600 border-b-2 border-slate-300 dark:border-slate-500">
                      <TableHead className="font-semibold text-slate-700 dark:text-slate-200 py-4">Store Name</TableHead>
                      <TableHead className="font-semibold text-slate-700 dark:text-slate-200 py-4">Address</TableHead>
                      <TableHead className="font-semibold text-slate-700 dark:text-slate-200 py-4">Phone</TableHead>
                      <TableHead className="font-semibold text-slate-700 dark:text-slate-200 py-4">Status</TableHead>
                      <TableHead className="font-semibold text-slate-700 dark:text-slate-200 py-4">Revenue</TableHead>
                      <TableHead className="font-semibold text-slate-700 dark:text-slate-200 py-4">Products</TableHead>
                      <TableHead className="w-[70px] font-semibold text-slate-700 dark:text-slate-200 py-4">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stores.map((store: Store, index: number) => (
                      <TableRow 
                        key={store.id} 
                        className={`border-b border-slate-200 dark:border-slate-600 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 dark:hover:from-slate-700 dark:hover:to-slate-600 transition-all duration-200 ${index % 2 === 0 ? 'bg-slate-50/50 dark:bg-slate-800/50' : 'bg-white dark:bg-slate-800'}`}
                      >
                        <TableCell className="py-4">
                          <div className="font-semibold text-slate-900 dark:text-slate-100">{store.name}</div>
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                            <MapPin className="h-3 w-3" />
                            {store.address || "—"}
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                            <Phone className="h-3 w-3" />
                            {store.phone || "—"}
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <Badge variant={getStatusBadgeVariant(store.isActive)}>
                            {getStatusText(store.isActive)}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-4">
                          <span className="font-medium text-slate-900 dark:text-slate-100">
                            {formatCurrencyWithSymbol(store.revenue)}
                          </span>
                        </TableCell>
                        <TableCell className="py-4">
                          <span className="text-slate-600 dark:text-slate-400">{store.productCount}</span>
                        </TableCell>
                        <TableCell className="py-4">
                          <TableActions
                            item={store}
                            onView={handleViewDetails}
                            onEdit={handleEditStore}
                            onDelete={handleDeleteStore}
                            showToggleActive={false}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                
                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center px-6 py-4 border-t">
                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      onPageChange={setPage}
                    />
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Create Store Dialog */}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Store</DialogTitle>
            </DialogHeader>
            <form onSubmit={createForm.handleSubmit(handleCreateStore)} className="space-y-4">
              <StoreForm form={createForm} mode="create" />
              
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isActive"
                  {...createForm.register("isActive")}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="isActive">Store is active</Label>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createStoreMutation.isPending}>
                  {createStoreMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Store"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit Store Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Store</DialogTitle>
            </DialogHeader>
            <form onSubmit={editForm.handleSubmit(handleUpdateStore)} className="space-y-4">
              <StoreForm form={editForm} mode="edit" />
              
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="edit-isActive"
                  {...editForm.register("isActive")}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="edit-isActive">Store is active</Label>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateStoreMutation.isPending}>
                  {updateStoreMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update Store"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Store Dialog */}
        <DeleteConfirmDialog
          open={isDeleteDialogOpen}
          onOpenChange={(open) => {
            setIsDeleteDialogOpen(open);
            if (!open) setStoreToDelete(null);
          }}
          onConfirm={confirmDeleteStore}
          title="Delete Store"
          description="Are you sure you want to delete"
          itemName={storeToDelete?.name}
          isLoading={deleteStoreMutation.isPending}
        />
      </div>
    </div>
  );
}
