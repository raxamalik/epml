import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Users, Mail, Phone, Loader2, User, Plus } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { SearchBar, StatusFilter, Pagination, EmptyState, TableActions, DeleteConfirmDialog } from "@/components/common";
import { ManagerForm } from "@/components/management/ManagerForm";
import { usePagination } from "@/hooks/common/usePagination";
import { useFilters } from "@/hooks/common/useFilters";
import { managerFormSchema, ManagerFormData } from "@/lib/utils/validation";
import { getStatusBadgeVariant, getStatusText } from "@/lib/utils/status";
import { formatDate } from "@/lib/utils/date";
import { Skeleton } from "@/components/ui/skeleton";
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

export default function StoreOwnerManagers() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedManager, setSelectedManager] = useState<Manager | null>(null);
  const [managerToDelete, setManagerToDelete] = useState<Manager | null>(null);

  // Redirect if not a store owner
  if (user && user.role !== 'store_owner') {
    setLocation('/');
    return null;
  }

  // Use custom hooks for pagination and filters
  const { currentPage, pageSize, setPage, setPageSize } = usePagination({
    initialPage: 1,
    initialPageSize: 10,
  });

  const { search, debouncedSearch, status, setSearch, setStatus } = useFilters({
    initialStatus: "all",
    debounceMs: 500,
  });

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

  // Fetch managers for the store owner's store using the main managers endpoint
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["/api/managers", currentPage, pageSize, debouncedSearch, status],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: pageSize.toString(),
      });
      
      if (debouncedSearch) {
        params.append("search", debouncedSearch);
      }
      
      if (status && status !== "all") {
        params.append("status", status);
      }
      
      const response = await apiRequest("GET", `/api/managers?${params.toString()}`);
      return response.json();
    },
    enabled: !!user?.storeId && user?.role === 'store_owner',
  });

  const managers: Manager[] = data?.managers || [];
  const pagination = data?.pagination || { page: 1, limit: 20, total: 0, totalPages: 1, hasNextPage: false, hasPreviousPage: false };

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status, setPage]);

  // Create manager mutation
  const createManagerMutation = useMutation({
    mutationFn: async (data: ManagerFormData) => {
      const managerData = {
        ...data,
        storeId: user?.storeId, // Force to store owner's store
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
    mutationFn: async ({ id, data }: { id: number; data: Partial<ManagerFormData> }) => {
      const updateData = {
        ...data,
        storeId: user?.storeId, // Force to store owner's store
      };
      const response = await apiRequest("PUT", `/api/managers/${id}`, updateData);
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
    mutationFn: async (id: number) => {
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
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
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
        description: error.message || t("managerManagement.toasts.errorGeneric"),
        variant: "destructive",
      });
    },
  });

  const handleCreateManager = (data: ManagerFormData) => {
    const managerData = {
      ...data,
      role: "manager" as const,
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
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateManager = (data: ManagerFormData) => {
    if (selectedManager) {
      const updateData = {
        ...data,
        role: "manager" as const,
      };
      updateManagerMutation.mutate({ id: parseInt(selectedManager.id), data: updateData });
    }
  };

  const handleDeleteManager = (manager: Manager) => {
    setManagerToDelete(manager);
    setIsDeleteDialogOpen(true);
  };

  const handleToggleActive = (manager: Manager) => {
    toggleActiveMutation.mutate({ id: parseInt(manager.id), isActive: !manager.isActive });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="space-y-6">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">{t("storeOwnerManagers.errorTitle")}</h2>
              <p className="text-muted-foreground">
                {(error as Error)?.message || t("storeOwnerManagers.errorDescription")}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Card className="border-0 shadow-xl bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 text-white">
            <CardContent className="p-8">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-white/20 rounded-lg backdrop-blur-sm">
                      <Users className="h-8 w-8" />
                    </div>
                    <div>
                      <h1 className="text-3xl font-bold mb-2">{t("storeOwnerManagers.headerTitle")}</h1>
                      <p className="text-blue-100 text-lg">
                        {t("storeOwnerManagers.headerSubtitle")}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
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
                  <Users className="h-6 w-6 text-white" />
                </div>
                <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent font-bold">
                  {t("managerManagement.headerCount", { count: pagination.total })}
                </span>
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {managers.length === 0 ? (
              <EmptyState
                title={debouncedSearch || status !== "all"
                  ? t("managerManagement.empty.titleFiltered")
                  : t("managerManagement.empty.title")}
                description={!debouncedSearch && status === "all"
                  ? t("managerManagement.empty.description")
                  : t("managerManagement.empty.descriptionFiltered")}
                icon={<User className="h-12 w-12 mx-auto text-muted-foreground" />}
                action={!debouncedSearch && status === "all" ? (
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
                          <Badge variant={getStatusBadgeVariant(manager.isActive)}>
                            {getStatusText(manager.isActive)}
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
              <ManagerForm form={createForm} stores={[]} mode="create" hideStoreSelect={true} />

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
                    t("managerManagement.createButton")
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
              <ManagerForm form={editForm} stores={[]} mode="edit" hideStoreSelect={true} />

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
                    t("managerManagement.updateButton")
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
              deleteManagerMutation.mutate(parseInt(managerToDelete.id));
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

