import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { Trash2, UserPlus, Shield } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { SearchBar, Pagination, EmptyState, TableLoadingSkeleton } from "@/components/common";
import { usePagination } from "@/hooks/common/usePagination";
import { formatRelativeTime } from "@/lib/utils/date";
import { getStatusBadgeVariant, getStatusText } from "@/lib/utils/status";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/hooks/useTranslation";

export default function PortalAdminManagement() {
  const { user: currentUser } = useAuth();
  const { t, currentLanguage } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const { currentPage: page, pageSize: limit, setPage, setPageSize } = usePagination({
    initialPage: 1,
    initialPageSize: 20,
  });
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedPortalAdmin, setSelectedPortalAdmin] = useState<any>(null);
  const [newPortalAdmin, setNewPortalAdmin] = useState({
    email: "",
    firstName: "",
    lastName: "",
    password: "",
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Only allow super_admin to access this page
  if (currentUser?.role !== "super_admin") {
    return (
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <h2 className="text-xl font-semibold text-slate-900 mb-2">{t("portalAdmin.accessDeniedTitle")}</h2>
                <p className="text-slate-600">{t("portalAdmin.accessDeniedDesc")}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const { data, isLoading } = useQuery({
    queryKey: ["/api/portal-admins", page, limit, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (searchQuery) {
        params.append("search", searchQuery);
      }
      const response = await apiRequest("GET", `/api/portal-admins?${params.toString()}`);
      return response.json();
    },
  });

  const portalAdmins = data?.portalAdmins || [];
  const pagination = data?.pagination || { page: 1, limit: 20, total: 0, totalPages: 1, hasNextPage: false, hasPreviousPage: false };

  const createPortalAdminMutation = useMutation({
    mutationFn: async (portalAdminData: { email: string; firstName: string; lastName: string; password: string }) => {
      await apiRequest("POST", "/api/portal-admins", portalAdminData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portal-admins"] });
      setIsCreateDialogOpen(false);
      setNewPortalAdmin({ email: "", firstName: "", lastName: "", password: "" });
      toast({
        title: t("portalAdmin.create.success"),
        description: t("portalAdmin.create.successDesc"),
      });
    },
    onError: (error: any) => {
      const errorMessage = error?.message || "There was an error creating the portal admin.";
      toast({
        title: t("portalAdmin.create.error"),
        description: errorMessage || t("portalAdmin.create.errorDesc"),
        variant: "destructive",
      });
    },
  });

  const deletePortalAdminMutation = useMutation({
    mutationFn: async (portalAdminId: string) => {
      await apiRequest("DELETE", `/api/portal-admins/${portalAdminId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portal-admins"] });
      setIsDeleteDialogOpen(false);
      setSelectedPortalAdmin(null);
      toast({
        title: t("portalAdmin.delete.success"),
        description: t("portalAdmin.delete.successDesc"),
      });
    },
    onError: () => {
      toast({
        title: t("portalAdmin.delete.error"),
        description: t("portalAdmin.delete.errorDesc"),
        variant: "destructive",
      });
    },
  });

  const handleCreatePortalAdmin = () => {
    if (!newPortalAdmin.email || !newPortalAdmin.firstName || !newPortalAdmin.lastName || !newPortalAdmin.password) {
      toast({
        title: t("errors.validationError"),
        description: t("portalAdmin.create.validationError"),
        variant: "destructive",
      });
      return;
    }
    createPortalAdminMutation.mutate(newPortalAdmin);
  };

  const handleDeleteClick = (portalAdmin: any) => {
    setSelectedPortalAdmin(portalAdmin);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (selectedPortalAdmin) {
      deletePortalAdminMutation.mutate(selectedPortalAdmin.id);
    }
  };

  if (isLoading) {
    return (
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-96" />
          </div>
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">{t("portalAdmin.title")}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {t("portalAdmin.description")}
          </p>
        </div>

        {/* Search and Actions */}
        <Card className="mb-6 border-slate-200">
          <CardContent className="p-6">
            <div className="flex gap-4 items-center">
              <div className="flex-1">
                <SearchBar
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder={t("portalAdmin.searchPlaceholder")}
                />
              </div>
              <Button 
                onClick={() => setIsCreateDialogOpen(true)}
                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                {t("portalAdmin.createButton")}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Portal Admins Table */}
        <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-700 dark:to-slate-600 border-b border-slate-200 dark:border-slate-600">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-3 text-xl">
                <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg">
                  <Shield className="h-6 w-6 text-white" />
                </div>
                <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent font-bold">
                  {t("portalAdmin.table.title", { count: pagination.total })}
                </span>
              </CardTitle>
              <div className="flex items-center gap-2">
                <Label htmlFor="limit" className="text-sm text-slate-600 dark:text-slate-300">{t("common.itemsPerPage")}:</Label>
                <Select
                  value={limit.toString()}
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
            <Table>
              <TableHeader>
                <TableRow className="bg-gradient-to-r from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600 border-b-2 border-slate-300 dark:border-slate-500">
                  <TableHead className="font-semibold text-slate-700 dark:text-slate-200 py-4">{t("portalAdmin.table.portalAdmin")}</TableHead>
                  <TableHead className="font-semibold text-slate-700 dark:text-slate-200 py-4">{t("portalAdmin.table.status")}</TableHead>
                  <TableHead className="font-semibold text-slate-700 dark:text-slate-200 py-4">{t("portalAdmin.table.created")}</TableHead>
                  <TableHead className="w-[100px] font-semibold text-slate-700 dark:text-slate-200 py-4">{t("portalAdmin.table.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {portalAdmins.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="p-0">
                      <EmptyState
                        title={searchQuery ? t("portalAdmin.table.emptyTitleSearch") : t("portalAdmin.table.emptyTitle")}
                        description={searchQuery ? t("portalAdmin.table.emptyDescSearch") : t("portalAdmin.table.emptyDesc")}
                        icon={<Shield className="h-12 w-12 mx-auto text-muted-foreground" />}
                        className="border-0"
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  portalAdmins.map((portalAdmin: any, index: number) => (
                    <TableRow 
                      key={portalAdmin.id}
                      className={`border-b border-slate-200 dark:border-slate-600 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 dark:hover:from-slate-700 dark:hover:to-slate-600 transition-all duration-200 ${index % 2 === 0 ? 'bg-slate-50/50 dark:bg-slate-800/50' : 'bg-white dark:bg-slate-800'}`}
                    >
                      <TableCell className="py-4">
                        <div className="flex items-center">
                          <ProfileAvatar
                            user={portalAdmin}
                            size="lg"
                            showBorder={true}
                          />
                          <div className="ml-4">
                            <div className="font-semibold text-slate-900 dark:text-slate-100">
                              {portalAdmin.firstName ? `${portalAdmin.firstName} ${portalAdmin.lastName || ''}`.trim() : portalAdmin.email}
                            </div>
                            <div className="text-sm text-slate-500 dark:text-slate-400">{portalAdmin.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <Badge variant={getStatusBadgeVariant(portalAdmin.isActive)}>
                          {getStatusText(portalAdmin.isActive)}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-4 text-sm text-slate-500 dark:text-slate-400">
                        {formatRelativeTime(portalAdmin.createdAt, currentLanguage)}
                      </TableCell>
                      <TableCell className="py-4">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleDeleteClick(portalAdmin)}
                          disabled={deletePortalAdminMutation.isPending}
                          className="h-8 w-8 p-0 hover:bg-red-100 dark:hover:bg-red-900 rounded-full transition-all duration-200 text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            
            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-center px-6 py-4 border-t">
                <Pagination
                  currentPage={page}
                  totalPages={pagination.totalPages}
                  onPageChange={setPage}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create Portal Admin Dialog */}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{t("portalAdmin.create.title")}</DialogTitle>
              <DialogDescription>
                {t("portalAdmin.create.description")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">{t("portalAdmin.create.firstName")}</Label>
                  <Input
                    id="firstName"
                    value={newPortalAdmin.firstName}
                    onChange={(e) => setNewPortalAdmin({ ...newPortalAdmin, firstName: e.target.value })}
                    placeholder={t("portalAdmin.create.firstNamePlaceholder")}
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">{t("portalAdmin.create.lastName")}</Label>
                  <Input
                    id="lastName"
                    value={newPortalAdmin.lastName}
                    onChange={(e) => setNewPortalAdmin({ ...newPortalAdmin, lastName: e.target.value })}
                    placeholder={t("portalAdmin.create.lastNamePlaceholder")}
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="email">{t("portalAdmin.create.email")}</Label>
                <Input
                  id="email"
                  type="email"
                  value={newPortalAdmin.email}
                  onChange={(e) => setNewPortalAdmin({ ...newPortalAdmin, email: e.target.value })}
                  placeholder={t("portalAdmin.create.emailPlaceholder")}
                />
              </div>

              <div>
                <Label htmlFor="password">{t("portalAdmin.create.password")}</Label>
                <Input
                  id="password"
                  type="password"
                  value={newPortalAdmin.password}
                  onChange={(e) => setNewPortalAdmin({ ...newPortalAdmin, password: e.target.value })}
                  placeholder={t("portalAdmin.create.passwordPlaceholder")}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  {t("common.cancel")}
                </Button>
                <Button 
                  onClick={handleCreatePortalAdmin}
                  disabled={createPortalAdminMutation.isPending}
                  className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                >
                  {createPortalAdminMutation.isPending ? t("portalAdmin.create.creating") : t("portalAdmin.create.createButton")}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{t("portalAdmin.delete.title")}</DialogTitle>
              <DialogDescription>
                {t("portalAdmin.delete.description")}
              </DialogDescription>
            </DialogHeader>
            {selectedPortalAdmin && (
              <div className="py-4">
                <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg">
                  <div className="font-semibold text-slate-900 dark:text-slate-100">
                    {selectedPortalAdmin.firstName ? `${selectedPortalAdmin.firstName} ${selectedPortalAdmin.lastName || ''}`.trim() : selectedPortalAdmin.email}
                  </div>
                  <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    {selectedPortalAdmin.email}
                  </div>
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button 
                variant="destructive"
                onClick={handleDeleteConfirm}
                disabled={deletePortalAdminMutation.isPending}
              >
                {deletePortalAdminMutation.isPending ? t("portalAdmin.delete.deleting") : t("portalAdmin.delete.deleteButton")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

