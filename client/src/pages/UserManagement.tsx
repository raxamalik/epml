import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { Edit, Download, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { SearchBar, Pagination, EmptyState, TableLoadingSkeleton } from "@/components/common";
import { usePagination } from "@/hooks/common/usePagination";
import { formatRelativeTime } from "@/lib/utils/date";
import { getRoleBadgeColor, getStatusBadgeVariant, getStatusText } from "@/lib/utils/status";

export default function UserManagement() {
  const [searchQuery, setSearchQuery] = useState("");
  const { currentPage: page, pageSize: limit, setPage, setPageSize } = usePagination({
    initialPage: 1,
    initialPageSize: 20,
  });
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["/api/users", page, limit],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/users?page=${page}&limit=${limit}`);
      return response.json();
    },
  });

  const users = data?.users || [];
  const pagination = data?.pagination || { page: 1, limit: 20, total: 0, totalPages: 1, hasNextPage: false, hasPreviousPage: false };

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      await apiRequest("PUT", `/api/users/${userId}/role`, { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics"] });
      toast({
        title: "User role updated",
        description: "The user's role has been successfully updated.",
      });
    },
    onError: () => {
      toast({
        title: "Error updating role",
        description: "There was an error updating the user's role.",
        variant: "destructive",
      });
    },
  });

  const filteredUsers = users?.filter((user: any) =>
    user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.lastName?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];


  const handleRoleUpdate = (userId: string, newRole: string) => {
    updateRoleMutation.mutate({ userId, role: newRole });
  };

  const handleExportUsers = async () => {
    try {
      // Fetch all users for export (without pagination)
      const allUsersResponse = await apiRequest("GET", `/api/users?page=1&limit=1000`);
      const allUsersData = await allUsersResponse.json();
      const allUsers = allUsersData?.users || users;
      
      // Convert users to CSV
      const headers = ["Email", "Name", "Role", "Store", "Status", "Joined"];
      const usersToExport = searchQuery 
        ? allUsers.filter((user: any) =>
            user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            user.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            user.lastName?.toLowerCase().includes(searchQuery.toLowerCase())
          )
        : allUsers;
      
      const rows = usersToExport.map((user: any) => [
        user.email,
        user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : '',
        user.role?.replace('_', ' '),
        user.store?.name || '',
        user.isActive ? 'Active' : 'Inactive',
        new Date(user.createdAt).toLocaleDateString()
      ]);
      
      const csvContent = [
        headers.join(','),
        ...rows.map((row: any[]) => row.map((cell: any) => `"${cell}"`).join(','))
      ].join('\n');
      
      // Download CSV file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `users_export_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: "Export successful",
        description: `Exported ${usersToExport.length} users to CSV`,
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: "There was an error exporting users",
        variant: "destructive",
      });
    }
  };

  const handleEditUser = (user: any) => {
    setSelectedUser(user);
    setIsEditDialogOpen(true);
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
          <h1 className="text-2xl font-bold text-slate-900">User Management</h1>
          <p className="mt-1 text-sm text-slate-600">
            Manage user accounts, roles, and permissions across your platform.
          </p>
        </div>

        {/* Search and Filters */}
        <Card className="mb-6 border-slate-200">
          <CardContent className="p-6">
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                return false;
              }}
              className="flex gap-4"
            >
              <div className="flex-1">
                <SearchBar
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder="Search users by name or email..."
                />
              </div>
              <Button 
                type="button"
                variant="outline"
                onClick={handleExportUsers}
                data-testid="button-export-users"
              >
                <Download className="h-4 w-4 mr-2" />
                Export Users
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-700 dark:to-slate-600 border-b border-slate-200 dark:border-slate-600">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-3 text-xl">
                <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg">
                  <Users className="h-6 w-6 text-white" />
                </div>
                <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent font-bold">
                  All Users ({pagination.total})
                </span>
              </CardTitle>
              <div className="flex items-center gap-2">
                <Label htmlFor="limit" className="text-sm text-slate-600 dark:text-slate-300">Items per page:</Label>
                <Select
                  value={limit.toString()}
                  onValueChange={(value) => {
                    setPageSize(parseInt(value));
                    setPage(1); // Reset to first page when changing limit
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
                  <TableHead className="font-semibold text-slate-700 dark:text-slate-200 py-4">User</TableHead>
                  <TableHead className="font-semibold text-slate-700 dark:text-slate-200 py-4">Role</TableHead>
                  <TableHead className="font-semibold text-slate-700 dark:text-slate-200 py-4">Store</TableHead>
                  <TableHead className="font-semibold text-slate-700 dark:text-slate-200 py-4">Status</TableHead>
                  <TableHead className="font-semibold text-slate-700 dark:text-slate-200 py-4">Joined</TableHead>
                  <TableHead className="w-[70px] font-semibold text-slate-700 dark:text-slate-200 py-4">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="p-0">
                      <EmptyState
                        title={searchQuery ? "No users found matching your search" : "No users found"}
                        description={searchQuery ? "Try adjusting your search query" : "No users have been created yet"}
                        icon={<Users className="h-12 w-12 mx-auto text-muted-foreground" />}
                        className="border-0"
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user: any, index: number) => (
                    <TableRow 
                      key={user.id}
                      className={`border-b border-slate-200 dark:border-slate-600 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 dark:hover:from-slate-700 dark:hover:to-slate-600 transition-all duration-200 ${index % 2 === 0 ? 'bg-slate-50/50 dark:bg-slate-800/50' : 'bg-white dark:bg-slate-800'}`}
                    >
                      <TableCell className="py-4">
                        <div className="flex items-center">
                          <ProfileAvatar
                            user={user}
                            size="lg"
                            showBorder={true}
                          />
                          <div className="ml-4">
                            <div className="font-semibold text-slate-900 dark:text-slate-100">
                              {user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user.email}
                            </div>
                            <div className="text-sm text-slate-500 dark:text-slate-400">{user.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <Select
                          value={user.role}
                          onValueChange={(newRole) => handleRoleUpdate(user.id, newRole)}
                          disabled={updateRoleMutation.isPending}
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="manager">Manager</SelectItem>
                            <SelectItem value="store_owner">Store Owner</SelectItem>
                            <SelectItem value="super_admin">Super Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="py-4 text-sm text-slate-900 dark:text-slate-300">
                        {user.store?.name || "No store assigned"}
                      </TableCell>
                      <TableCell className="py-4">
                        <Badge variant={getStatusBadgeVariant(user.isActive)}>
                          {getStatusText(user.isActive)}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-4 text-sm text-slate-500 dark:text-slate-400">
                        {formatRelativeTime(user.createdAt)}
                      </TableCell>
                      <TableCell className="py-4">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleEditUser(user)}
                          data-testid={`button-edit-user-${user.id}`}
                          className="h-8 w-8 p-0 hover:bg-gradient-to-r hover:from-blue-100 hover:to-purple-100 dark:hover:from-blue-900 dark:hover:to-purple-900 rounded-full transition-all duration-200"
                        >
                          <Edit className="h-4 w-4 text-slate-600 dark:text-slate-300" />
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

        {/* Edit User Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Edit User - {selectedUser?.email}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={selectedUser?.firstName || ''}
                    disabled
                    className="bg-slate-50"
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={selectedUser?.lastName || ''}
                    disabled
                    className="bg-slate-50"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  value={selectedUser?.email || ''}
                  disabled
                  className="bg-slate-50"
                />
              </div>

              <div>
                <Label htmlFor="editRole">Role</Label>
                <Select
                  value={selectedUser?.role}
                  onValueChange={(newRole) => {
                    if (selectedUser) {
                      handleRoleUpdate(selectedUser.id, newRole);
                      setSelectedUser({ ...selectedUser, role: newRole });
                    }
                  }}
                  disabled={updateRoleMutation.isPending}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="store_owner">Store Owner</SelectItem>
                    <SelectItem value="super_admin">Super Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Store</Label>
                <Input
                  value={selectedUser?.store?.name || 'No store assigned'}
                  disabled
                  className="bg-slate-50"
                />
              </div>

              <div>
                <Label>Status</Label>
                <div className="mt-2">
                  <Badge className={selectedUser?.isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                    {selectedUser?.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
  