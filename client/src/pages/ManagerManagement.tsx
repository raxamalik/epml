import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, User, MapPin, Phone, Mail, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { SearchBar, StatusFilter, StoreFilter, Pagination, TableActions, DeleteConfirmDialog, EmptyState } from "@/components/common";
import { ManagerForm } from "@/components/management/ManagerForm";
import { usePagination } from "@/hooks/common/usePagination";
import { useFilters } from "@/hooks/common/useFilters";
import { managerFormSchema, ManagerFormData } from "@/lib/utils/validation";
import { getStatusBadgeVariant, getStatusText } from "@/lib/utils/status";
import { useTranslation } from "@/hooks/useTranslation";

interface Manager {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role: string;
  isActive: boolean;
  companyId: number;
  storeId?: number;
  createdAt: string;
  updatedAt: string;
  store?: {
    id: number;
    name: string;
  };
}


export default function ManagerManagement() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedManager, setSelectedManager] = useState<Manager | null>(null);
  const [managerToDelete, setManagerToDelete] = useState<Manager | null>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { t } = useTranslation();
  
  // Use custom hooks for pagination and filters
  const { currentPage, pageSize, setPage, setPageSize } = usePagination({
    initialPage: 1,
    initialPageSize: 10,
  });
  
  const { search, debouncedSearch, status, store, setSearch, setStatus, setStore } = useFilters({
    initialStatus: "all",
    initialStore: "all",
    debounceMs: 500,
  });

  // Read store filter from URL query params
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const storeParam = urlParams.get('store');
    if (storeParam) {
      setStore(storeParam);
    }
  }, [setStore]);

  const createForm = useForm<ManagerFormData>({
    resolver: zodResolver(managerFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      role: "manager",
      isActive: true,
      password: "",
    },
  });

  const editForm = useForm<ManagerFormData>({
    resolver: zodResolver(managerFormSchema.omit({ password: true })),
  });

  // Fetch managers with backend filtering
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["/api/managers", currentPage, pageSize, store, debouncedSearch, status],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: pageSize.toString(),
      });
      
      if (store && store !== "all") {
        params.append("store", store);
      }
      
      if (debouncedSearch) {
        params.append("search", debouncedSearch);
      }
      
      if (status && status !== "all") {
        params.append("status", status);
      }
      
      const response = await apiRequest("GET", `/api/managers?${params.toString()}`);
      return response.json();
    },
  });

  const managers = data?.managers || [];
  const pagination = data?.pagination || { page: 1, limit: 20, total: 0, totalPages: 1, hasNextPage: false, hasPreviousPage: false };

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status, store, setPage]);

  // Update URL when store filter changes
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (store === "all") {
      urlParams.delete('store');
    } else {
      urlParams.set('store', store);
    }
    const newUrl = urlParams.toString() 
      ? `${window.location.pathname}?${urlParams.toString()}`
      : window.location.pathname;
    window.history.replaceState({}, '', newUrl);
  }, [store]);

  // Fetch stores for dropdown
  const { data: stores = [] } = useQuery({
    queryKey: ["/api/stores"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/stores");
      const data = await response.json();
      return Array.isArray(data) ? data : (data.data || data.stores || []);
    },
  });

  // Create manager mutation
  const createManagerMutation = useMutation({
    mutationFn: async (data: ManagerFormData) => {
      const managerData = {
        ...data,
      };
      const response = await apiRequest("POST", "/api/managers", managerData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/managers"] });
      setIsCreateDialogOpen(false);
      createForm.reset();
      toast({
        title: t("managerManagement.toasts.created"),
        description: t("managerManagement.toasts.createdDesc"),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t("managerManagement.toasts.error"),
        description: error.message || t("managerManagement.toasts.errorGeneric"),
        variant: "destructive",
      });
    },
  });

  // Update manager mutation
  const updateManagerMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ManagerFormData> }) => {
      const response = await apiRequest("PUT", `/api/managers/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/managers"] });
      setIsEditDialogOpen(false);
      setSelectedManager(null);
      editForm.reset();
      toast({
        title: t("managerManagement.toasts.updated"),
        description: t("managerManagement.toasts.updatedDesc"),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t("managerManagement.toasts.error"),
        description: error.message || t("managerManagement.toasts.errorGeneric"),
        variant: "destructive",
      });
    },
  });

  // Delete manager mutation
  const deleteManagerMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/managers/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/managers"] });
      setIsDeleteDialogOpen(false);
      setManagerToDelete(null);
      toast({
        title: t("managerManagement.toasts.deleted"),
        description: t("managerManagement.toasts.deletedDesc"),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t("managerManagement.toasts.error"),
        description: error.message || t("managerManagement.toasts.errorGeneric"),
        variant: "destructive",
      });
    },
  });

  // Toggle active status mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const response = await apiRequest("PUT", `/api/managers/${id}`, { isActive });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/managers"] });
      toast({
        title: t("managerManagement.toasts.statusUpdateSuccess"),
        description: t("managerManagement.toasts.statusUpdateDesc"),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t("managerManagement.toasts.error"),
        description: error.message || t("managerManagement.toasts.statusUpdateError"),
        variant: "destructive",
      });
    },
  });

  const handleCreateManager = (data: ManagerFormData) => {
    const managerData = {
      ...data,
      role: "manager" as const
    };
    createManagerMutation.mutate(managerData);
  };

  const handleEditManager = (manager: Manager) => {
    setSelectedManager(manager);
    editForm.reset({
      firstName: manager.firstName || "",
      lastName: manager.lastName || "",
      email: manager.email || "",
      phone: manager.phone || "",
      role: manager.role as "manager" | "store_owner",
      isActive: manager.isActive,
      storeId: manager.storeId || undefined,
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateManager = (data: ManagerFormData) => {
    if (selectedManager) {
      const updateData = {
        ...data,
        role: "manager" as const,
        companyId: selectedManager.companyId
      };
      updateManagerMutation.mutate({ id: selectedManager.id, data: updateData });
    }
  };

  const handleDeleteManager = (manager: Manager) => {
    setManagerToDelete(manager);
    setIsDeleteDialogOpen(true);
  };

  const handleToggleActive = (manager: Manager) => {
    toggleActiveMutation.mutate({ id: manager.id, isActive: !manager.isActive });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-slate-600">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <User className="h-12 w-12 text-slate-400" />
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          {t("common.errorLoading")}
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          {(error as Error).message || t("errors.generic")}
        </p>
        <Button onClick={() => refetch()} variant="outline">
          {t("common.retry")}
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
                    <User className="h-8 w-8" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold">{t("managerManagement.title")}</h1>
                    <p className="text-blue-100 text-lg mt-1">
                      {t("managerManagement.subtitle")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-6 mt-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-sm">{t("storeManagement.systemActive")}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span className="text-sm">{t("managerManagement.headerCount", { count: pagination.total })}</span>
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
                  placeholder={t("managerManagement.searchPlaceholder")}
                  className="h-12 text-lg"
                />
              </div>
              
              <StatusFilter
                value={status}
                onChange={setStatus}
                className="h-12"
              />

              <StoreFilter
                value={store}
                onChange={setStore}
                stores={stores}
                includeUnassigned={true}
                className="h-12"
              />
              
                <Button 
                type="button"
                onClick={() => setIsCreateDialogOpen(true)}
                className="h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold px-6 shadow-lg hover:shadow-xl transition-all duration-200 border-0"
              >
                  <Plus className="h-5 w-5 mr-2" />
                  {t("managerManagement.createButton")}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Managers Table */}
        <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-700 dark:to-slate-600 border-b border-slate-200 dark:border-slate-600">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-3 text-xl">
                <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg">
                  <User className="h-6 w-6 text-white" />
                </div>
                <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent font-bold">
                  {t("managerManagement.headerCount", { count: pagination.total })}
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
            {managers.length === 0 ? (
              <EmptyState
                title={debouncedSearch || status !== "all" || store !== "all"
                  ? t("managerManagement.empty.titleFiltered")
                  : t("managerManagement.empty.title")}
                description={!debouncedSearch && status === "all" && store === "all"
                  ? t("managerManagement.empty.description")
                  : t("managerManagement.empty.descriptionFiltered")}
                icon={<User className="h-12 w-12 mx-auto text-muted-foreground" />}
                action={!debouncedSearch && status === "all" && store === "all" ? (
                  <Button onClick={() => setIsCreateDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    {t("managerManagement.empty.createFirst")}
                  </Button>
                ) : undefined}
                className="border-0"
              />
            ) : (
              <>
                <Table>
                  <TableHeader>
                      <TableRow className="bg-gradient-to-r from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600 border-b-2 border-slate-300 dark:border-slate-500">
                      <TableHead className="font-semibold text-slate-700 dark:text-slate-200 py-4">{t("managerManagement.table.name")}</TableHead>
                      <TableHead className="font-semibold text-slate-700 dark:text-slate-200 py-4">{t("managerManagement.table.email")}</TableHead>
                      <TableHead className="font-semibold text-slate-700 dark:text-slate-200 py-4">{t("managerManagement.table.phone")}</TableHead>
                      <TableHead className="font-semibold text-slate-700 dark:text-slate-200 py-4">{t("managerManagement.table.store")}</TableHead>
                      <TableHead className="font-semibold text-slate-700 dark:text-slate-200 py-4">{t("managerManagement.table.status")}</TableHead>
                      <TableHead className="w-[70px] font-semibold text-slate-700 dark:text-slate-200 py-4">{t("managerManagement.table.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {managers.map((manager: Manager, index: number) => (
                      <TableRow 
                        key={manager.id}
                        className={`border-b border-slate-200 dark:border-slate-600 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 dark:hover:from-slate-700 dark:hover:to-slate-600 transition-all duration-200 ${index % 2 === 0 ? 'bg-slate-50/50 dark:bg-slate-800/50' : 'bg-white dark:bg-slate-800'}`}
                      >
                        <TableCell className="py-4">
                          <div className="font-semibold text-slate-900 dark:text-slate-100">
                            {manager.firstName} {manager.lastName}
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                            <Mail className="h-4 w-4" />
                            {manager.email}
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                            {manager.phone ? (
                              <>
                                <Phone className="h-3 w-3" />
                                {manager.phone}
                              </>
                            ) : (
                              "—"
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                            {manager.store ? (
                              <>
                                <MapPin className="h-3 w-3" />
                                {manager.store.name}
                              </>
                            ) : (
                              "—"
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <Badge variant={getStatusBadgeVariant(manager.isActive)}>
                            {manager.isActive ? t("common.active") : t("common.inactive")}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-4">
                          <TableActions
                            item={manager}
                            onEdit={handleEditManager}
                            onDelete={handleDeleteManager}
                            onToggleActive={handleToggleActive}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                
                {/* Pagination */}
                {pagination.totalPages > 1 && (
                  <div className="flex items-center justify-center px-6 py-4 border-t">
                    <Pagination
                      currentPage={currentPage}
                      totalPages={pagination.totalPages}
                      onPageChange={setPage}
                    />
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Create Manager Dialog */}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t("managerManagement.dialogs.createTitle")}</DialogTitle>
            </DialogHeader>
            <form onSubmit={createForm.handleSubmit(handleCreateManager)} className="space-y-4">
              <ManagerForm form={createForm} stores={stores} mode="create" />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit" disabled={createManagerMutation.isPending}>
                  {createManagerMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {t("managerManagement.dialogs.creating")}
                    </>
                  ) : (
                    t("managerManagement.dialogs.createTitle")
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit Manager Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t("managerManagement.dialogs.editTitle")}</DialogTitle>
            </DialogHeader>
            <form onSubmit={editForm.handleSubmit(handleUpdateManager)} className="space-y-4">
              <ManagerForm form={editForm} stores={stores} mode="edit" />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit" disabled={updateManagerMutation.isPending}>
                  {updateManagerMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {t("managerManagement.dialogs.updating")}
                    </>
                  ) : (
                    t("managerManagement.dialogs.editTitle")
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Manager Alert Dialog */}
        <DeleteConfirmDialog
          open={isDeleteDialogOpen}
          onOpenChange={(open) => {
            setIsDeleteDialogOpen(open);
            if (!open) setManagerToDelete(null);
          }}
          onConfirm={() => {
            if (managerToDelete) {
              deleteManagerMutation.mutate(managerToDelete.id);
            }
          }}
          title={t("managerManagement.dialogs.deleteTitle")}
          description={t("managerManagement.dialogs.deleteDesc")}
          itemName={managerToDelete ? `${managerToDelete.firstName} ${managerToDelete.lastName}` : undefined}
          isLoading={deleteManagerMutation.isPending}
        />
      </div>
    </div>
  );
}
