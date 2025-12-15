import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, FlaskConical, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { DeleteConfirmDialog, EmptyState, SearchBar, Pagination } from "@/components/common";
import { usePagination } from "@/hooks/common/usePagination";
import { useFilters } from "@/hooks/common/useFilters";
import { ActiveSubstanceForm } from "@/components/active-substance/ActiveSubstanceForm";
import { useTranslation } from "@/hooks/useTranslation";

interface ActiveSubstance {
  id: number;
  name: string;
  maxSingleDose: string | null;
  maxDailyDose: string | null;
  maxConcentration: string | null;
  createdAt: string;
}

export default function ActiveSubstances() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedSubstance, setSelectedSubstance] = useState<ActiveSubstance | null>(null);
  const [substanceToDelete, setSubstanceToDelete] = useState<ActiveSubstance | null>(null);

  // Check if user has permission (Super Admin and Portal Admin only)
  const canManage = user?.role === 'super_admin' || user?.role === 'portal_admin';

  // Use custom hooks for pagination and filters
  const { currentPage, pageSize, setPage, setPageSize, offset } = usePagination({
    initialPage: 1,
    initialPageSize: 10,
  });

  const { search, debouncedSearch, setSearch } = useFilters({
    debounceMs: 500,
  });

  // Fetch active substances with pagination
  const { data: substancesResponse, isLoading } = useQuery({
    queryKey: ['/api/active-substances', currentPage, pageSize, debouncedSearch],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: pageSize.toString(),
        offset: offset.toString(),
      });
      
      if (debouncedSearch) {
        params.append("search", debouncedSearch);
      }
      
      const response = await apiRequest('GET', `/api/active-substances?${params}`);
      const data = await response.json();
      
      return {
        data: data.data || [],
        total: data.total || 0,
        page: data.page || currentPage,
        limit: data.limit || pageSize,
        totalPages: data.totalPages || Math.ceil((data.total || 0) / pageSize),
      };
    },
    enabled: !!user && canManage,
  });

  const substances: ActiveSubstance[] = substancesResponse?.data || [];
  const total = substancesResponse?.total || 0;
  const totalPages = substancesResponse?.totalPages || 0;

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: { name: string; maxSingleDose: string | null; maxDailyDose: string | null; maxConcentration: string | null }) => {
      const response = await apiRequest('POST', '/api/active-substances', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/active-substances'] });
      setIsCreateDialogOpen(false);
      toast({
        title: t("activeSubstances.toasts.created"),
        description: t("activeSubstances.toasts.createdDesc"),
      });
    },
    onError: (error: any) => {
      toast({
        title: t("activeSubstances.toasts.error"),
        description: error.message || t("activeSubstances.toasts.errorCreate"),
        variant: "destructive",
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { name: string; maxSingleDose: string | null; maxDailyDose: string | null; maxConcentration: string | null } }) => {
      const response = await apiRequest('PUT', `/api/active-substances/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/active-substances'] });
      setIsEditDialogOpen(false);
      setSelectedSubstance(null);
      toast({
        title: t("activeSubstances.toasts.updated"),
        description: t("activeSubstances.toasts.updatedDesc"),
      });
    },
    onError: (error: any) => {
      toast({
        title: t("activeSubstances.toasts.error"),
        description: error.message || t("activeSubstances.toasts.errorUpdate"),
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('DELETE', `/api/active-substances/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/active-substances'] });
      setIsDeleteDialogOpen(false);
      setSubstanceToDelete(null);
      toast({
        title: t("activeSubstances.toasts.deleted"),
        description: t("activeSubstances.toasts.deletedDesc"),
      });
    },
    onError: (error: any) => {
      toast({
        title: t("activeSubstances.toasts.error"),
        description: error.message || t("activeSubstances.toasts.errorDelete"),
        variant: "destructive",
      });
    },
  });

  const handleCreateSubstance = (data: { name: string; maxSingleDose: string; maxDailyDose: string; maxConcentration: string }) => {
    createMutation.mutate({
      name: data.name,
      maxSingleDose: data.maxSingleDose || null,
      maxDailyDose: data.maxDailyDose || null,
      maxConcentration: data.maxConcentration || null,
    });
  };

  const handleEditSubstance = (substance: ActiveSubstance) => {
    setSelectedSubstance(substance);
    setIsEditDialogOpen(true);
  };

  const handleUpdateSubstance = (data: { name: string; maxSingleDose: string; maxDailyDose: string; maxConcentration: string }) => {
    if (selectedSubstance) {
      updateMutation.mutate({
        id: selectedSubstance.id,
        data: {
          name: data.name,
          maxSingleDose: data.maxSingleDose || null,
          maxDailyDose: data.maxDailyDose || null,
          maxConcentration: data.maxConcentration || null,
        }
      });
    }
  };

  const handleDeleteSubstance = (substance: ActiveSubstance) => {
    setSubstanceToDelete(substance);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteSubstance = () => {
    if (substanceToDelete) {
      deleteMutation.mutate(substanceToDelete.id);
    }
  };

  const formatNumber = (value: string | null) => {
    if (!value) return "—";
    return parseFloat(value).toFixed(3);
  };

  if (!canManage) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Card>
            <CardContent className="p-12 text-center">
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">{t("activeSubstances.accessDenied")}</h3>
              <p className="text-slate-500">{t("activeSubstances.accessDeniedDesc")}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-slate-600">{t("activeSubstances.loading")}</p>
        </div>
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
                    <FlaskConical className="h-8 w-8" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold">{t("activeSubstances.title")}</h1>
                    <p className="text-blue-100 text-lg mt-1">
                      {t("activeSubstances.description")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-6 mt-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-sm">{t("activeSubstances.systemActive")}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FlaskConical className="h-4 w-4" />
                    <span className="text-sm">{t("activeSubstances.substancesCount", { count: total })}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Create */}
        <Card className="mb-8 border-0 shadow-lg bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <SearchBar
                  value={search}
                  onChange={setSearch}
                  placeholder={t("activeSubstances.searchPlaceholder")}
                  className="h-12 text-lg"
                />
              </div>
              <Button
                onClick={() => setIsCreateDialogOpen(true)}
                className="h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold px-6 shadow-lg hover:shadow-xl transition-all duration-200 border-0"
              >
                <Plus className="h-5 w-5 mr-2" />
                {t("activeSubstances.createButton")}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Substances Table */}
        <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-700 dark:to-slate-600 border-b border-slate-200 dark:border-slate-600">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-3 text-xl">
                <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg">
                  <FlaskConical className="h-6 w-6 text-white" />
                </div>
                <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent font-bold">
                  {t("activeSubstances.table.title", { count: total })}
                </span>
              </CardTitle>
              <div className="flex items-center gap-2">
                <Label htmlFor="limit" className="text-sm text-slate-600 dark:text-slate-300">{t("common.itemsPerPage")}:</Label>
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
            {substances.length === 0 ? (
              <EmptyState
                title={t("activeSubstances.empty.title")}
                description={debouncedSearch ? t("activeSubstances.empty.descSearch") : t("activeSubstances.empty.desc")}
                icon={<FlaskConical className="h-12 w-12 mx-auto text-muted-foreground" />}
                action={
                  !debouncedSearch && (
                    <Button onClick={() => setIsCreateDialogOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      {t("activeSubstances.empty.createFirst")}
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
                      <TableHead className="font-semibold text-slate-700 dark:text-slate-200 py-4">{t("activeSubstances.table.name")}</TableHead>
                      <TableHead className="font-semibold text-slate-700 dark:text-slate-200 py-4">{t("activeSubstances.table.maxSingleDose")}</TableHead>
                      <TableHead className="font-semibold text-slate-700 dark:text-slate-200 py-4">{t("activeSubstances.table.maxDailyDose")}</TableHead>
                      <TableHead className="font-semibold text-slate-700 dark:text-slate-200 py-4">{t("activeSubstances.table.maxConcentration")}</TableHead>
                      <TableHead className="font-semibold text-slate-700 dark:text-slate-200 py-4">{t("activeSubstances.table.created")}</TableHead>
                      <TableHead className="w-[120px] font-semibold text-slate-700 dark:text-slate-200 py-4">{t("activeSubstances.table.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {substances.map((substance, index) => (
                      <TableRow
                        key={substance.id}
                        className={`border-b border-slate-200 dark:border-slate-600 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 dark:hover:from-slate-700 dark:hover:to-slate-600 transition-all duration-200 ${
                          index % 2 === 0 ? 'bg-slate-50/50 dark:bg-slate-800/50' : 'bg-white dark:bg-slate-800'
                        }`}
                      >
                        <TableCell className="py-4">
                          <div className="font-semibold text-slate-900 dark:text-slate-100">{substance.name}</div>
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="text-slate-600 dark:text-slate-400">
                            {formatNumber(substance.maxSingleDose)}
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="text-slate-600 dark:text-slate-400">
                            {formatNumber(substance.maxDailyDose)}
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="text-slate-600 dark:text-slate-400">
                            {formatNumber(substance.maxConcentration)}
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <span className="text-slate-600 dark:text-slate-400 text-sm">
                            {new Date(substance.createdAt).toLocaleDateString()}
                          </span>
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditSubstance(substance)}
                              className="h-8 w-8 p-0"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteSubstance(substance)}
                              className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
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
              </>
            )}
          </CardContent>
        </Card>

        {/* Create Dialog */}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t("activeSubstances.create.title")}</DialogTitle>
            </DialogHeader>
            <ActiveSubstanceForm
              onSubmit={handleCreateSubstance}
              onCancel={() => setIsCreateDialogOpen(false)}
              isLoading={createMutation.isPending}
            />
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) {
            setSelectedSubstance(null);
          }
        }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t("activeSubstances.edit.title")}</DialogTitle>
            </DialogHeader>
            {selectedSubstance && (
              <ActiveSubstanceForm
                initialData={{
                  name: selectedSubstance.name,
                  maxSingleDose: selectedSubstance.maxSingleDose || "",
                  maxDailyDose: selectedSubstance.maxDailyDose || "",
                  maxConcentration: selectedSubstance.maxConcentration || "",
                }}
                isEditMode={true}
                onSubmit={handleUpdateSubstance}
                onCancel={() => {
                  setIsEditDialogOpen(false);
                  setSelectedSubstance(null);
                }}
                isLoading={updateMutation.isPending}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <DeleteConfirmDialog
          open={isDeleteDialogOpen}
          onOpenChange={(open) => {
            setIsDeleteDialogOpen(open);
            if (!open) setSubstanceToDelete(null);
          }}
          onConfirm={confirmDeleteSubstance}
          title={t("activeSubstances.delete.title")}
          description={t("activeSubstances.delete.description")}
          itemName={substanceToDelete?.name}
          isLoading={deleteMutation.isPending}
        />
      </div>
    </div>
  );
}
