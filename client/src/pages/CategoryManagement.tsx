import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Edit, Trash2, Tag, Loader2, Search, Store } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { DeleteConfirmDialog, EmptyState, SearchBar, Pagination } from "@/components/common";
import { usePagination } from "@/hooks/common/usePagination";
import { useFilters } from "@/hooks/common/useFilters";
import { useTranslation } from "@/hooks/useTranslation";

interface ProductCategory {
  id: number;
  name: string;
  description: string | null;
  companyId: number | null;
  storeId: number | null; // null = company-wide, set = store-specific (legacy)
  storeIds?: number[]; // Array of store IDs (new multi-store support)
  userId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const categorySchema = z.object({
  name: z.string().min(1, "Category name is required").max(100, "Category name must be less than 100 characters"),
  description: z.string().optional(),
});

type CategoryFormData = z.infer<typeof categorySchema>;

export default function CategoryManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<ProductCategory | null>(null);
  const [selectedStoreIds, setSelectedStoreIds] = useState<number[]>([]);
  const [selectAllStores, setSelectAllStores] = useState(true);

  // Check if user is company admin
  const isCompanyAdmin = user?.role === 'company_admin' || user?.type === 'company';

  // Fetch stores for company admins
  const { data: storesResponse } = useQuery({
    queryKey: ['/api/stores'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/stores?limit=1000');
      const data = await res.json();
      return data.data || data || [];
    },
    enabled: isCompanyAdmin,
  });

  const stores = storesResponse || [];
  const companyStores = stores.filter((store: any) => store.companyId === user?.companyId);

  // Use custom hooks for pagination and filters
  const { currentPage, pageSize, setPage, setPageSize, offset } = usePagination({
    initialPage: 1,
    initialPageSize: 10,
  });

  const { search, debouncedSearch, setSearch } = useFilters({
    debounceMs: 500,
  });

  const createForm = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  const editForm = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
  });

  // Fetch categories with pagination
  const { data: categoriesResponse, isLoading } = useQuery({
    queryKey: ['/api/categories', currentPage, pageSize, debouncedSearch],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: pageSize.toString(),
        offset: offset.toString(),
      });
      
      if (debouncedSearch) {
        params.append("search", debouncedSearch);
      }
      
      const response = await apiRequest('GET', `/api/categories?${params}`);
      const data = await response.json();
      
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
  });

  const categories: ProductCategory[] = categoriesResponse?.data || [];
  const total = categoriesResponse?.total || 0;
  const totalPages = categoriesResponse?.totalPages || 0;

  // Create category mutation
  const createCategoryMutation = useMutation({
    mutationFn: async (data: CategoryFormData & { storeIds?: number[] }) => {
      const response = await apiRequest('POST', '/api/categories', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
      setIsCreateDialogOpen(false);
      createForm.reset();
      setSelectedStoreIds([]);
      setSelectAllStores(true);
      toast({
        title: t("categoryManagement.toasts.created"),
        description: t("categoryManagement.toasts.createdDesc"),
      });
    },
    onError: (error: any) => {
      toast({
        title: t("categoryManagement.toasts.error"),
        description: error.message || t("categoryManagement.toasts.errorGeneric"),
        variant: "destructive",
      });
    },
  });

  // Update category mutation
  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: CategoryFormData & { storeIds?: number[] } }) => {
      const response = await apiRequest('PUT', `/api/categories/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
      setIsEditDialogOpen(false);
      setSelectedCategory(null);
      editForm.reset();
      setSelectedStoreIds([]);
      setSelectAllStores(true);
      toast({
        title: t("categoryManagement.toasts.updated"),
        description: t("categoryManagement.toasts.updatedDesc"),
      });
    },
    onError: (error: any) => {
      toast({
        title: t("categoryManagement.toasts.error"),
        description: error.message || t("categoryManagement.toasts.errorGeneric"),
        variant: "destructive",
      });
    },
  });

  // Delete category mutation
  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('DELETE', `/api/categories/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
      setIsDeleteDialogOpen(false);
      setCategoryToDelete(null);
      toast({
        title: t("categoryManagement.toasts.deleted"),
        description: t("categoryManagement.toasts.deletedDesc"),
      });
    },
    onError: (error: any) => {
      toast({
        title: t("categoryManagement.toasts.error"),
        description: error.message || t("categoryManagement.toasts.errorGeneric"),
        variant: "destructive",
      });
    },
  });

  const handleCreateCategory = (data: CategoryFormData) => {
    const payload: any = { ...data };
    
    // For company admins, include storeIds
    if (isCompanyAdmin) {
      if (selectAllStores || selectedStoreIds.length === companyStores.length) {
        // All stores selected - don't send storeIds (company-wide)
        payload.storeIds = undefined;
      } else if (selectedStoreIds.length > 0) {
        // Specific stores selected
        payload.storeIds = selectedStoreIds;
      } else {
        // No stores selected - default to all stores (company-wide)
        payload.storeIds = undefined;
      }
    }
    
    createCategoryMutation.mutate(payload);
  };

  const handleEditCategory = (category: ProductCategory) => {
    setSelectedCategory(category);
    
    // Set storeIds for company admins
    if (isCompanyAdmin) {
      if (category.storeIds && category.storeIds.length > 0) {
        setSelectedStoreIds(category.storeIds);
        setSelectAllStores(category.storeIds.length === companyStores.length);
      } else {
        // Company-wide (all stores)
        setSelectedStoreIds(companyStores.map((s: any) => s.id));
        setSelectAllStores(true);
      }
    }
    
    editForm.reset({
      name: category.name,
      description: category.description || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateCategory = (data: CategoryFormData) => {
    if (selectedCategory) {
      const payload: any = { ...data };
      
      // For company admins, include storeIds
      if (isCompanyAdmin) {
        if (selectAllStores || selectedStoreIds.length === companyStores.length) {
          // All stores selected - send empty array to make it company-wide
          payload.storeIds = [];
        } else if (selectedStoreIds.length > 0) {
          // Specific stores selected
          payload.storeIds = selectedStoreIds;
        } else {
          // No stores selected - default to all stores (company-wide)
          payload.storeIds = [];
        }
      }
      
      updateCategoryMutation.mutate({ id: selectedCategory.id, data: payload });
    }
  };

  const toggleStoreSelection = (storeId: number) => {
    if (selectedStoreIds.includes(storeId)) {
      const newSelection = selectedStoreIds.filter(id => id !== storeId);
      setSelectedStoreIds(newSelection);
      setSelectAllStores(newSelection.length === companyStores.length);
    } else {
      const newSelection = [...selectedStoreIds, storeId];
      setSelectedStoreIds(newSelection);
      // Auto-check "all stores" if all stores are selected
      setSelectAllStores(newSelection.length === companyStores.length);
    }
  };

  const handleSelectAllStores = (checked: boolean) => {
    setSelectAllStores(checked);
    if (checked) {
      setSelectedStoreIds(companyStores.map((store: any) => store.id));
    } else {
      setSelectedStoreIds([]);
    }
  };

  const handleDeleteCategory = (category: ProductCategory) => {
    setCategoryToDelete(category);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteCategory = () => {
    if (categoryToDelete) {
      deleteCategoryMutation.mutate(categoryToDelete.id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Loading categories...</p>
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
                    <Tag className="h-8 w-8" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold">{t("categoryManagement.title")}</h1>
                    <p className="text-blue-100 text-lg mt-1">
                      {t("categoryManagement.subtitle")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-6 mt-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-sm">{t("companyDashboard.systemActive")}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Tag className="h-4 w-4" />
                    <span className="text-sm">{t("categoryManagement.headerCount", { count: total })}</span>
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
                  placeholder={t("categoryManagement.searchPlaceholder")}
                  className="h-12 text-lg"
                />
              </div>
              <Button
                onClick={() => setIsCreateDialogOpen(true)}
                className="h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold px-6 shadow-lg hover:shadow-xl transition-all duration-200 border-0"
              >
                <Plus className="h-5 w-5 mr-2" />
                {t("categoryManagement.createButton")}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Categories Table */}
        <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-700 dark:to-slate-600 border-b border-slate-200 dark:border-slate-600">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-3 text-xl">
                <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg">
                  <Tag className="h-6 w-6 text-white" />
                </div>
                <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent font-bold">
                  {t("categoryManagement.headerCount", { count: total })}
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
                {categories.length === 0 ? (
                  <EmptyState
                    title={debouncedSearch ? t("categoryManagement.empty.titleSearch") : t("categoryManagement.empty.title")}
                    description={debouncedSearch ? t("categoryManagement.empty.descriptionSearch") : t("categoryManagement.empty.description")}
                    icon={<Tag className="h-12 w-12 mx-auto text-muted-foreground" />}
                    action={
                      !debouncedSearch && (
                        <Button onClick={() => setIsCreateDialogOpen(true)}>
                          <Plus className="h-4 w-4 mr-2" />
                          {t("categoryManagement.empty.createFirst")}
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
                      <TableHead className="font-semibold text-slate-700 dark:text-slate-200 py-4">{t("categoryManagement.table.name")}</TableHead>
                      <TableHead className="font-semibold text-slate-700 dark:text-slate-200 py-4">{t("categoryManagement.table.description")}</TableHead>
                      {isCompanyAdmin && <TableHead className="font-semibold text-slate-700 dark:text-slate-200 py-4">{t("categoryManagement.table.stores")}</TableHead>}
                      <TableHead className="font-semibold text-slate-700 dark:text-slate-200 py-4">{t("categoryManagement.table.status")}</TableHead>
                      <TableHead className="font-semibold text-slate-700 dark:text-slate-200 py-4">{t("categoryManagement.table.created")}</TableHead>
                      <TableHead className="w-[120px] font-semibold text-slate-700 dark:text-slate-200 py-4">{t("categoryManagement.table.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categories.map((category, index) => (
                    <TableRow
                      key={category.id}
                      className={`border-b border-slate-200 dark:border-slate-600 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 dark:hover:from-slate-700 dark:hover:to-slate-600 transition-all duration-200 ${
                        index % 2 === 0 ? 'bg-slate-50/50 dark:bg-slate-800/50' : 'bg-white dark:bg-slate-800'
                      }`}
                    >
                      <TableCell className="py-4">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">{category.name}</div>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="text-slate-600 dark:text-slate-400">
                          {category.description || "—"}
                        </div>
                      </TableCell>
                      {isCompanyAdmin && (
                        <TableCell className="py-4">
                          <div className="flex flex-wrap gap-1">
                            {category.storeIds && category.storeIds.length > 0 ? (
                              category.storeIds.map((storeId: number) => {
                                const store = companyStores.find((s: any) => s.id === storeId);
                                return store ? (
                                  <Badge key={storeId} variant="outline" className="text-xs">
                                    {store.name}
                                  </Badge>
                                ) : null;
                              })
                            ) : (
                              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                                All Stores
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                      )}
                      <TableCell className="py-4">
                        <Badge variant={category.isActive ? "default" : "secondary"}>
                          {category.isActive ? t("categoryManagement.status.active") : t("categoryManagement.status.inactive")}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-4">
                        <span className="text-slate-600 dark:text-slate-400 text-sm">
                          {new Date(category.createdAt).toLocaleDateString()}
                        </span>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditCategory(category)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteCategory(category)}
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

        {/* Create Category Dialog */}
        <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
          setIsCreateDialogOpen(open);
          if (!open) {
            setSelectedStoreIds([]);
            setSelectAllStores(true);
          }
        }}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t("categoryManagement.dialogs.createTitle")}</DialogTitle>
            </DialogHeader>
            <form onSubmit={createForm.handleSubmit(handleCreateCategory)} className="space-y-4">
              <div>
                <Label htmlFor="create-name">{t("categoryManagement.table.name")} *</Label>
                <Input
                  id="create-name"
                  {...createForm.register("name")}
                  placeholder="Enter category name"
                  className="mt-1"
                />
                {createForm.formState.errors.name && (
                  <p className="text-sm text-red-500 mt-1">{createForm.formState.errors.name.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="create-description">{t("categoryManagement.table.description")}</Label>
                <Input
                  id="create-description"
                  {...createForm.register("description")}
                  placeholder="Enter category description (optional)"
                  className="mt-1"
                />
              </div>
              
              {/* Store Selection for Company Admins */}
              {isCompanyAdmin && companyStores.length > 0 && (
                <div className="space-y-3 border rounded-lg p-4 bg-slate-50 dark:bg-slate-800">
                  <div className="flex items-center gap-2">
                    <Store className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                    <Label className="text-base font-semibold">{t("categoryManagement.dialogs.storesLabel")}</Label>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer">
                      <Checkbox
                        id="select-all-stores"
                        checked={selectAllStores}
                        onCheckedChange={handleSelectAllStores}
                      />
                      <Label
                        htmlFor="select-all-stores"
                        className="text-sm font-medium cursor-pointer flex-1"
                      >
                        {t("categoryManagement.dialogs.allStores")}
                      </Label>
                    </div>
                    <div className="border-t border-slate-200 dark:border-slate-600 pt-2 space-y-2 max-h-48 overflow-y-auto">
                      {companyStores.map((store: any) => (
                        <div
                          key={store.id}
                          className="flex items-center space-x-2 p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                        >
                          <Checkbox
                            id={`store-${store.id}`}
                            checked={selectedStoreIds.includes(store.id)}
                            onCheckedChange={() => toggleStoreSelection(store.id)}
                            disabled={selectAllStores}
                          />
                          <Label
                            htmlFor={`store-${store.id}`}
                            className="text-sm cursor-pointer flex-1"
                          >
                            {store.name}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {selectAllStores
                      ? t("categoryManagement.dialogs.allStores")
                      : selectedStoreIds.length > 0
                      ? t("categoryManagement.headerCount", { count: selectedStoreIds.length })
                      : t("categoryManagement.dialogs.allStores")}
                  </p>
                </div>
              )}
              
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => {
                  setIsCreateDialogOpen(false);
                  setSelectedStoreIds([]);
                  setSelectAllStores(true);
                }}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit" disabled={createCategoryMutation.isPending}>
                  {createCategoryMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {t("categoryManagement.dialogs.creating")}
                    </>
                  ) : (
                    t("categoryManagement.dialogs.create")
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit Category Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) {
            setSelectedCategory(null);
            setSelectedStoreIds([]);
            setSelectAllStores(true);
          }
        }}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t("categoryManagement.dialogs.editTitle")}</DialogTitle>
            </DialogHeader>
            <form onSubmit={editForm.handleSubmit(handleUpdateCategory)} className="space-y-4">
              <div>
                <Label htmlFor="edit-name">{t("categoryManagement.table.name")} *</Label>
                <Input
                  id="edit-name"
                  {...editForm.register("name")}
                  placeholder="Enter category name"
                  className="mt-1"
                />
                {editForm.formState.errors.name && (
                  <p className="text-sm text-red-500 mt-1">{editForm.formState.errors.name.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="edit-description">{t("categoryManagement.table.description")}</Label>
                <Input
                  id="edit-description"
                  {...editForm.register("description")}
                  placeholder="Enter category description (optional)"
                  className="mt-1"
                />
              </div>
              
              {/* Store Selection for Company Admins */}
              {isCompanyAdmin && companyStores.length > 0 && (
                <div className="space-y-3 border rounded-lg p-4 bg-slate-50 dark:bg-slate-800">
                  <div className="flex items-center gap-2">
                    <Store className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                    <Label className="text-base font-semibold">{t("categoryManagement.dialogs.storesLabel")}</Label>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer">
                      <Checkbox
                        id="edit-select-all-stores"
                        checked={selectAllStores}
                        onCheckedChange={handleSelectAllStores}
                      />
                      <Label
                        htmlFor="edit-select-all-stores"
                        className="text-sm font-medium cursor-pointer flex-1"
                      >
                        {t("categoryManagement.dialogs.allStores")}
                      </Label>
                    </div>
                    <div className="border-t border-slate-200 dark:border-slate-600 pt-2 space-y-2 max-h-48 overflow-y-auto">
                      {companyStores.map((store: any) => (
                        <div
                          key={store.id}
                          className="flex items-center space-x-2 p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                        >
                          <Checkbox
                            id={`edit-store-${store.id}`}
                            checked={selectedStoreIds.includes(store.id)}
                            onCheckedChange={() => toggleStoreSelection(store.id)}
                            disabled={selectAllStores}
                          />
                          <Label
                            htmlFor={`edit-store-${store.id}`}
                            className="text-sm cursor-pointer flex-1"
                          >
                            {store.name}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {selectAllStores
                      ? "Category will be available to all stores in your company"
                      : selectedStoreIds.length > 0
                      ? `Category will be available to ${selectedStoreIds.length} selected store(s)`
                      : "Select stores or choose 'All Stores' for company-wide category"}
                  </p>
                </div>
              )}
              
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => {
                  setIsEditDialogOpen(false);
                  setSelectedCategory(null);
                  setSelectedStoreIds([]);
                  setSelectAllStores(true);
                }}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit" disabled={updateCategoryMutation.isPending}>
                  {updateCategoryMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {t("categoryManagement.dialogs.updating")}
                    </>
                  ) : (
                    t("categoryManagement.dialogs.update")
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Category Dialog */}
        <DeleteConfirmDialog
          open={isDeleteDialogOpen}
          onOpenChange={(open) => {
            setIsDeleteDialogOpen(open);
            if (!open) setCategoryToDelete(null);
          }}
          onConfirm={confirmDeleteCategory}
          title={t("categoryManagement.dialogs.deleteTitle")}
          description={t("categoryManagement.dialogs.deleteDesc")}
          itemName={categoryToDelete?.name}
          isLoading={deleteCategoryMutation.isPending}
        />
      </div>
    </div>
  );
}

