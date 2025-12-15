import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Plus, Building2, Users, BarChart3, MapPin, Mail, Phone, MoreHorizontal, Eye, Edit, Settings, Send, Power, Trash2, Ban, CheckCircle } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CompanyEditDialog, EditableCompany } from "@/components/company/CompanyEditDialog";
import { SearchBar, StatusFilter, Pagination, DeleteConfirmDialog, ActivateDeactivateDialog, SendInvitationDialog } from "@/components/common";
import { CreateCompanyDialog } from "@/components/management/CreateCompanyDialog";
import { usePagination } from "@/hooks/common/usePagination";
import { useFilters } from "@/hooks/common/useFilters";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { companyFormSchema, CompanyFormData } from "@/lib/utils/validation";

type Company = EditableCompany & {
  isActive: boolean;
  licenseStatus: string;
  branchCount: number;
  userCount: number;
  createdAt: string;
};

export default function CompanyManagement() {
  const [, setLocation] = useLocation();
  
  // Use custom hooks for pagination and filters
  const { currentPage, pageSize, setPage, setPageSize, offset } = usePagination({
    initialPage: 1,
    initialPageSize: 10,
  });
  
  const { search, debouncedSearch, status, setSearch, setStatus } = useFilters({
    initialStatus: "all",
    debounceMs: 500,
  });
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isActivateDialogOpen, setIsActivateDialogOpen] = useState(false);
  const [isSuspendDialogOpen, setIsSuspendDialogOpen] = useState(false);
  const [isUnsuspendDialogOpen, setIsUnsuspendDialogOpen] = useState(false);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [companyToAction, setCompanyToAction] = useState<Company | null>(null);

  const { toast } = useToast();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin' || user?.role === 'portal_admin';

  const createCompanyForm = useForm<CompanyFormData>({
    resolver: zodResolver(companyFormSchema),
    defaultValues: {
      name: "",
      registrationNumber: "",
      vatNumber: "",
      address: "",
      email: "",
      phone: "",
      contactPerson: "",
      password: "",
      maxBranches: 1,
    },
  });

  const { data: companiesResponse, isLoading, error, refetch } = useQuery({
    queryKey: ["companies", currentPage, pageSize, debouncedSearch, status],
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
      
      const response = await fetchWithAuth(`/api/companies?${params}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: '' }));
        throw new Error(errorData.message || '');
      }
      return response.json();
    },
  });

  const companies = companiesResponse?.data || [];
  const total = companiesResponse?.total || 0;
  const totalPages = companiesResponse?.totalPages || 0;

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status, setPage]);

  const createCompanyMutation = useMutation({
    mutationFn: async (companyData: CompanyFormData) => {
      const response = await fetchWithAuth('/api/companies', {
        method: 'POST',
        body: JSON.stringify(companyData),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: '' }));
        throw new Error(errorData.message || '');
      }
      
      return response.json();
    },
    onSuccess: () => {
      refetch();
      toast({
        title: "Success", 
        description: "Company created successfully!",
      });
      setIsCreateDialogOpen(false);
      createCompanyForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  const handleCreateCompany = (data: CompanyFormData) => {
    createCompanyMutation.mutate(data);
  };

  const handleViewDetails = (company: Company) => {
    setLocation(`/companies/${company.id}`);
  };

  const handleEditCompany = (company: Company) => {
    setSelectedCompany(company);
    setIsEditDialogOpen(true);
  };

  const handleDeactivateCompany = (company: Company) => {
    setCompanyToAction(company);
    setIsActivateDialogOpen(true);
  };

  const handleSuspendCompany = (company: Company) => {
    setCompanyToAction(company);
    setIsSuspendDialogOpen(true);
  };

  const confirmSuspendCompany = () => {
    if (companyToAction) {
      suspendCompanyMutation.mutate(companyToAction.id);
    }
  };

  const handleUnsuspendCompany = (company: Company) => {
    setCompanyToAction(company);
    setIsUnsuspendDialogOpen(true);
  };

  const confirmUnsuspendCompany = () => {
    if (companyToAction) {
      unsuspendCompanyMutation.mutate(companyToAction.id);
    }
  };

  const confirmActivateDeactivate = async () => {
    if (!companyToAction) return;
    
    try {
      const response = await fetchWithAuth(`/api/companies/${companyToAction.id}`, {
        method: 'PUT',
        body: JSON.stringify({ isActive: !companyToAction.isActive }),
      });
      
      if (response.ok) {
        refetch();
        toast({
          title: "Success",
          description: `Company ${companyToAction.isActive ? 'deactivated' : 'activated'} successfully!`,
        });
        setIsActivateDialogOpen(false);
        setCompanyToAction(null);
      } else {
        const errorData = await response.json().catch(() => ({ message: '' }));
        throw new Error(errorData.message || '');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "An error occurred",
        variant: "destructive",
      });
    }
  };

  const inviteCompanyMutation = useMutation({
    mutationFn: async (companyId: number) => {
      const response = await apiRequest("POST", `/api/companies/${companyId}/invite`);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Invitation Sent!",
        description: `Company activation invitation sent successfully`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  const suspendCompanyMutation = useMutation({
    mutationFn: async (companyId: number) => {
      const response = await fetchWithAuth(`/api/companies/${companyId}/suspend`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: '' }));
        throw new Error(errorData.message || '');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      refetch();
      toast({
        title: "Company Suspended",
        description: `Company suspended successfully. ${data.suspendedStores} stores and ${data.suspendedUsers} users were also suspended.`,
      });
      setIsSuspendDialogOpen(false);
      setCompanyToAction(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  const unsuspendCompanyMutation = useMutation({
    mutationFn: async (companyId: number) => {
      const response = await fetchWithAuth(`/api/companies/${companyId}/unsuspend`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: '' }));
        throw new Error(errorData.message || '');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      refetch();
      toast({
        title: "Company Unsuspended",
        description: `Company unsuspended successfully. ${data.reactivatedStores} stores and ${data.reactivatedUsers} users were also reactivated.`,
      });
      setIsUnsuspendDialogOpen(false);
      setCompanyToAction(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  const deleteCompanyMutation = useMutation({
    mutationFn: async (companyId: number) => {
      const response = await fetchWithAuth(`/api/companies/${companyId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: '' }));
        throw new Error(errorData.message || '');
      }
      
      return response.json();
    },
    onSuccess: (_, deletedCompanyId) => {
      refetch();
      toast({
        title: "Success", 
        description: "Company deleted successfully!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  const handleSendInvitation = (company: Company) => {
    setCompanyToAction(company);
    setIsInviteDialogOpen(true);
  };

  const confirmSendInvitation = () => {
    if (companyToAction) {
      inviteCompanyMutation.mutate(companyToAction.id);
      setIsInviteDialogOpen(false);
      setCompanyToAction(null);
    }
  };

  const handleDeleteCompany = (company: Company) => {
    setCompanyToAction(company);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteCompany = () => {
    if (companyToAction) {
      deleteCompanyMutation.mutate(companyToAction.id);
      setIsDeleteDialogOpen(false);
      setCompanyToAction(null);
    }
  };

  const handleManageBranches = (company: Company) => {
    setLocation(`/companies/${company.id}/stores`);
  };

  const getStatusBadge = (company: Company) => {
    if (!company.isActive) {
      return (
        <Badge className="bg-gradient-to-r from-red-100 to-pink-100 dark:from-red-900 dark:to-pink-900 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700 hover:from-red-200 hover:to-pink-200">
          Inactive
        </Badge>
      );
    }
    
    switch (company.licenseStatus) {
      case "active":
        return (
          <Badge className="bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900 dark:to-emerald-900 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700 hover:from-green-200 hover:to-emerald-200">
            Active
          </Badge>
        );
      case "suspended":
        return (
          <Badge className="bg-gradient-to-r from-yellow-100 to-orange-100 dark:from-yellow-900 dark:to-orange-900 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-700 hover:from-yellow-200 hover:to-orange-200">
            Suspended
          </Badge>
        );
      default:
        return (
          <Badge className="bg-gradient-to-r from-slate-100 to-gray-100 dark:from-slate-700 dark:to-gray-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600">
            {company.licenseStatus}
          </Badge>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Modern Page Header with Gradient */}
        <div className="mb-8 relative">
          <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 rounded-2xl p-8 text-white shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                    <Building2 className="h-8 w-8" />
                  </div>
                  <h1 className="text-3xl font-bold">Company Management</h1>
                </div>
                <p className="text-blue-100 text-lg">
                  Manage companies, licenses, and company settings with enterprise-grade controls
                </p>
                <div className="flex items-center gap-6 mt-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-sm">System Active</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span className="text-sm">{companies.length} Companies</span>
                  </div>
                </div>
              </div>
              <div className="hidden lg:block">
                <div className="relative">
                  <div className="absolute inset-0 bg-white/10 rounded-full blur-xl"></div>
                  <div className="relative bg-white/20 backdrop-blur-sm rounded-2xl p-6">
                    <BarChart3 className="h-12 w-12 text-white/80" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modern Search and Filters Card */}
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
                  placeholder="Search companies by name, IČO, or DIČ..."
                  className="h-12 text-lg"
                />
              </div>
              
              <StatusFilter
                value={status}
                onChange={setStatus}
                className="h-12"
              />
              
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button 
                    type="button"
                    className="h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold px-6 shadow-lg hover:shadow-xl transition-all duration-200 border-0"
                  >
                    <Plus className="h-5 w-5 mr-2" />
                    Create Company
                  </Button>
                </DialogTrigger>
              </Dialog>
            </form>
          </CardContent>
        </Card>

        {/* Create Company Dialog */}
        <CreateCompanyDialog
          open={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
          form={createCompanyForm}
          onSubmit={handleCreateCompany}
          isLoading={createCompanyMutation.isPending}
        />


        {/* Edit Company Dialog */}
        <CompanyEditDialog
          isOpen={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          company={selectedCompany ? {
            id: selectedCompany.id,
            name: selectedCompany.name,
            registrationNumber: selectedCompany.registrationNumber,
            vatNumber: selectedCompany.vatNumber,
            address: selectedCompany.address,
            email: selectedCompany.email,
            phone: selectedCompany.phone,
            contactPerson: selectedCompany.contactPerson,
            maxBranches: selectedCompany.maxBranches,
          } : null}
          onUpdated={() => refetch()}
        />

        {/* Modern Companies Table */}
        <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-700 dark:to-slate-600 border-b border-slate-200 dark:border-slate-600">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-3 text-xl">
                <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg">
                  <Building2 className="h-6 w-6 text-white" />
                </div>
                <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent font-bold">
                  Companies ({total})
                </span>
              </CardTitle>
              <div className="flex items-center gap-2">
                <Label htmlFor="limit" className="text-sm text-slate-600 dark:text-slate-300">Items per page:</Label>
                <Select
                  value={pageSize.toString()}
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
                  <TableHead className="font-semibold text-slate-700 dark:text-slate-200 py-4">Company</TableHead>
                  <TableHead className="font-semibold text-slate-700 dark:text-slate-200 py-4">Registration</TableHead>
                  <TableHead className="font-semibold text-slate-700 dark:text-slate-200 py-4">Contact</TableHead>
                  <TableHead className="font-semibold text-slate-700 dark:text-slate-200 py-4">Status</TableHead>
                  <TableHead className="font-semibold text-slate-700 dark:text-slate-200 py-4">Branches</TableHead>
                  <TableHead className="font-semibold text-slate-700 dark:text-slate-200 py-4">Users</TableHead>
                  <TableHead className="w-[70px] font-semibold text-slate-700 dark:text-slate-200 py-4">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.map((company: Company, index: number) => (
                  <TableRow 
                    key={company.id} 
                    className={`border-b border-slate-200 dark:border-slate-600 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 dark:hover:from-slate-700 dark:hover:to-slate-600 transition-all duration-200 ${index % 2 === 0 ? 'bg-slate-50/50 dark:bg-slate-800/50' : 'bg-white dark:bg-slate-800'}`}
                  >
                    <TableCell className="py-4">
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-slate-100">{company.name}</div>
                        <div className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-1 whitespace-nowrap">
                          <MapPin className="h-3 w-3 text-blue-500 shrink-0" />
                          {company.address.split(',')[0]}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <div>
                        <div className="text-sm font-medium text-slate-700 dark:text-slate-300">IČO: {company.registrationNumber}</div>
                        {company.vatNumber && (
                          <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">DIČ: {company.vatNumber}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <div>
                        <div className="text-sm flex items-center gap-1 text-slate-700 dark:text-slate-300">
                          <Mail className="h-3 w-3 text-purple-500" />
                          {company.email}
                        </div>
                        <div className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-1">
                          <Phone className="h-3 w-3 text-green-500" />
                          {company.phone}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      {getStatusBadge(company)}
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex items-center gap-2">
                        <div className="bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900 px-2 py-1 rounded-full">
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            {company.branchCount}/{company.maxBranches}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex items-center gap-2">
                        <div className="p-1 bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900 dark:to-emerald-900 rounded-full">
                          <Users className="h-3 w-3 text-green-600 dark:text-green-400" />
                        </div>
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{company.userCount}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-gradient-to-r hover:from-blue-100 hover:to-purple-100 dark:hover:from-blue-900 dark:hover:to-purple-900 rounded-full transition-all duration-200">
                            <MoreHorizontal className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleViewDetails(company)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEditCompany(company)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Company
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleManageBranches(company)}>
                            <Settings className="h-4 w-4 mr-2" />
                            View Branches
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleSendInvitation(company)}>
                            <Send className="h-4 w-4 mr-2" />
                            Send Invitation
                          </DropdownMenuItem>
                          {isSuperAdmin && (
                            <>
                              <DropdownMenuSeparator />
                              {company.licenseStatus === "suspended" ? (
                                <DropdownMenuItem 
                                  onClick={() => handleUnsuspendCompany(company)}
                                  className="text-green-600 dark:text-green-400 focus:text-green-700 dark:focus:text-green-300"
                                >
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  Unsuspend Company
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem 
                                  onClick={() => handleSuspendCompany(company)}
                                  className="text-orange-600 dark:text-orange-400 focus:text-orange-700 dark:focus:text-orange-300"
                                >
                                  <Ban className="h-4 w-4 mr-2" />
                                  Suspend Company
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem 
                                onClick={() => handleDeactivateCompany(company)}
                                disabled={false}
                              >
                                <Power className="h-4 w-4 mr-2" />
                                {company.isActive ? 'Deactivate' : 'Activate'} Company
                              </DropdownMenuItem>
                            </>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => handleDeleteCompany(company)}
                            className="text-red-600 dark:text-red-400 focus:text-red-700 dark:focus:text-red-300"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Company
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
          </CardContent>
        </Card>

        {/* Suspend Company Dialog */}
        <ActivateDeactivateDialog
          open={isSuspendDialogOpen}
          onOpenChange={(open) => {
            setIsSuspendDialogOpen(open);
            if (!open) setCompanyToAction(null);
          }}
          onConfirm={confirmSuspendCompany}
          title="Suspend Company"
          description="Are you sure you want to suspend"
          itemName={companyToAction?.name}
          isActive={true}
          isLoading={suspendCompanyMutation.isPending}
          actionType="suspend"
        />

        {/* Unsuspend Company Dialog */}
        <ActivateDeactivateDialog
          open={isUnsuspendDialogOpen}
          onOpenChange={(open) => {
            setIsUnsuspendDialogOpen(open);
            if (!open) setCompanyToAction(null);
          }}
          onConfirm={confirmUnsuspendCompany}
          title="Unsuspend Company"
          description="Are you sure you want to unsuspend"
          itemName={companyToAction?.name}
          isActive={false}
          isLoading={unsuspendCompanyMutation.isPending}
          actionType="activate"
        />

        {/* Activate/Deactivate Company Dialog */}
        <ActivateDeactivateDialog
          open={isActivateDialogOpen}
          onOpenChange={(open) => {
            setIsActivateDialogOpen(open);
            if (!open) setCompanyToAction(null);
          }}
          onConfirm={confirmActivateDeactivate}
          title={`${companyToAction?.isActive ? 'Deactivate' : 'Activate'} Company`}
          description="Are you sure you want to"
          itemName={companyToAction?.name}
          isActive={companyToAction?.isActive ?? false}
        />

        {/* Send Invitation Dialog */}
        <SendInvitationDialog
          open={isInviteDialogOpen}
          onOpenChange={(open) => {
            setIsInviteDialogOpen(open);
            if (!open) setCompanyToAction(null);
          }}
          onConfirm={confirmSendInvitation}
          itemName={companyToAction?.name}
          itemEmail={companyToAction?.email}
          isLoading={inviteCompanyMutation.isPending}
        />

        {/* Delete Company Dialog */}
        <DeleteConfirmDialog
          open={isDeleteDialogOpen}
          onOpenChange={(open) => {
            setIsDeleteDialogOpen(open);
            if (!open) setCompanyToAction(null);
          }}
          onConfirm={confirmDeleteCompany}
          title="Delete Company"
          description="Are you sure you want to delete"
          itemName={companyToAction?.name}
          isLoading={deleteCompanyMutation.isPending}
        />

      </div>
    </div>
  );
}