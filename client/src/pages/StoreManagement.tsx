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
import { Plus, Store, MapPin, Phone, Loader2, Building2 } from "lucide-react";
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
import { useTranslation } from "@/hooks/useTranslation";

interface Store {
  id: number;
  name: string;
  address: string;
  phone?: string;
  managerId?: string;
  companyId: number;
  companyLogo?: string | null;
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
  const { t } = useTranslation();

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
                    <h1 className="text-3xl font-bold">{t("storeManagement.title")}</h1>
                    <p className="text-blue-100 text-lg mt-1">
                      {t("storeManagement.subtitle")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-6 mt-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-sm">{t("companyDashboard.systemActive")}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Store className="h-4 w-4" />
                    <span className="text-sm">{t("storeManagement.headerCount", { count: total })}</span>
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
                  placeholder={t("storeManagement.searchPlaceholder")}
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
                {t("storeManagement.createButton")}
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
                  {t("storeManagement.headerCount", { count: total })}
                </span>
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
            {stores.length === 0 ? (
              <EmptyState
                title={debouncedSearch ? t("storeManagement.empty.titleSearch") : t("storeManagement.empty.title")}
                description={debouncedSearch ? t("storeManagement.empty.descriptionSearch") : t("storeManagement.empty.description")}
                icon={<Store className="h-12 w-12 mx-auto text-muted-foreground" />}
                action={
                  !debouncedSearch && (
                    <Button onClick={() => setIsCreateDialogOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      {t("storeManagement.empty.createFirst")}
                    </Button>
                  )
                }
                className="border-0"
              />
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gradient-to-r from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600 border-b-2 border-slate-300 dark:border-slate-500">
                      <TableHead className="font-semibold text-slate-700 dark:text-slate-200 py-4">{t("storeManagement.table.storeName")}</TableHead>
                      <TableHead className="font-semibold text-slate-700 dark:text-slate-200 py-4">{t("storeManagement.table.address")}</TableHead>
                      <TableHead className="font-semibold text-slate-700 dark:text-slate-200 py-4">{t("storeManagement.table.phone")}</TableHead>
                      <TableHead className="font-semibold text-slate-700 dark:text-slate-200 py-4">{t("storeManagement.table.status")}</TableHead>
                      <TableHead className="font-semibold text-slate-700 dark:text-slate-200 py-4">{t("storeManagement.table.revenue")}</TableHead>
                      <TableHead className="font-semibold text-slate-700 dark:text-slate-200 py-4">{t("storeManagement.table.products")}</TableHead>
                      <TableHead className="w-[70px] font-semibold text-slate-700 dark:text-slate-200 py-4">{t("storeManagement.table.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stores.map((store: Store, index: number) => (
                      <TableRow 
                        key={store.id} 
                        className={`border-b border-slate-200 dark:border-slate-600 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 dark:hover:from-slate-700 dark:hover:to-slate-600 transition-all duration-200 ${index % 2 === 0 ? 'bg-slate-50/50 dark:bg-slate-800/50' : 'bg-white dark:bg-slate-800'}`}
                      >
                        <TableCell className="py-4">
                          <div className="flex items-center gap-3">
                            {store.companyLogo ? (
                              <img 
                                src={store.companyLogo} 
                                alt={`${store.name} company logo`}
                                className="w-10 h-10 object-cover rounded-lg border border-slate-200 dark:border-slate-600"
                                onError={(e) => {
                                  // Hide image on error
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <div className="w-10 h-10 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center">
                                <Building2 className="h-5 w-5 text-slate-400" />
                              </div>
                            )}
                            <div className="font-semibold text-slate-900 dark:text-slate-100">{store.name}</div>
                          </div>
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
                          {store.isActive ? t("storeManagement.statusActive") : t("storeManagement.statusInactive")}
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
              <DialogTitle>{t("storeManagement.dialogs.createTitle")}</DialogTitle>
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
                <Label htmlFor="isActive">{t("storeManagement.dialogs.activeLabel")}</Label>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit" disabled={createStoreMutation.isPending}>
                  {createStoreMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {t("storeManagement.dialogs.creating")}
                    </>
                  ) : (
                    t("storeManagement.dialogs.create")
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
              <DialogTitle>{t("storeManagement.dialogs.editTitle")}</DialogTitle>
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
                <Label htmlFor="edit-isActive">{t("storeManagement.dialogs.activeLabel")}</Label>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit" disabled={updateStoreMutation.isPending}>
                  {updateStoreMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {t("storeManagement.dialogs.updating")}
                    </>
                  ) : (
                    t("storeManagement.dialogs.update")
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
          title={t("storeManagement.dialogs.deleteTitle")}
          description={t("storeManagement.dialogs.deleteDesc")}
          itemName={storeToDelete?.name}
          isLoading={deleteStoreMutation.isPending}
        />
      </div>
    </div>
  );
}
