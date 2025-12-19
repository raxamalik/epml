import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { ArrowLeft, Building2, Mail, Phone, MapPin, User, Calendar, Users, Store, Edit, Send, Power } from "lucide-react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { MoreHorizontal, Eye } from "lucide-react";
import { CompanyEditDialog } from "@/components/company/CompanyEditDialog";
import { SendInvitationDialog } from "@/components/common";

interface Company {
  id: number;
  name: string;
  registrationNumber: string;
  vatNumber: string;
  address: string;
  email: string;
  phone: string;
  contactPerson: string;
  companyLogo?: string | null;
  isActive: boolean;
  licenseStatus: string;
  maxBranches: number;
  branchCount: number;
  userCount: number;
  createdAt: string;
  companyAdminEmail?: string | null;
}

interface StoreBranch {
  id: number;
  name: string;
  address: string | null;
  phone: string | null;
  createdAt: string;
}

import { formatDate } from "@/lib/utils/date";

// Helper function to convert R2 direct URLs to proxy URLs
const normalizeR2Url = (url: string | null | undefined): string | null => {
  if (!url) return null;
  
  // If it's already a proxy URL, return as is
  if (url.startsWith('/api/r2-image/')) {
    return url;
  }
  
  // If it's a direct R2 URL, convert to proxy URL
  // Format: https://{account-id}.r2.cloudflarestorage.com/{bucket}/{key}
  const r2UrlPattern = /https:\/\/[\w-]+\.r2\.cloudflarestorage\.com\/[^\/]+\/(.+)/;
  const match = url.match(r2UrlPattern);
  
  if (match) {
    return `/api/r2-image/${match[1]}`;
  }
  
  // If it's a local upload URL, return as is
  if (url.startsWith('/uploads/')) {
    return url;
  }
  
  // Return as is if we can't determine the format
  return url;
};

export default function CompanyDetails() {
  const [, params] = useRoute("/companies/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const companyId = params?.id ? parseInt(params.id) : null;
  const isSuperAdmin = user?.role === 'super_admin' || user?.role === 'portal_admin';

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isActivateDialogOpen, setIsActivateDialogOpen] = useState(false);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);

  const { data: company, isLoading, error, refetch } = useQuery<Company>({
    queryKey: ["company", companyId],
    queryFn: async () => {
      if (!companyId) throw new Error("Company ID is required");
      const response = await fetchWithAuth(`/api/companies/${companyId}`);
      if (!response.ok) {
        // Try to get the actual error message from the API
        let errorMessage = '';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || '';
        } catch {
          // If JSON parsing fails, use status text
          errorMessage = response.statusText || '';
        }
        throw new Error(errorMessage);
      }
      return response.json();
    },
    enabled: !!companyId,
  });

  const {
    data: branches = [],
    isLoading: branchesLoading,
    error: branchesError,
  } = useQuery<StoreBranch[]>({
    queryKey: ["company-branches", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      // Request sorted data from backend (newest first, limit to 5)
      const response = await fetchWithAuth(`/api/companies/${companyId}/stores?sortBy=createdAt&sortOrder=desc&limit=5&offset=0`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "" }));
        throw new Error(errorData.message || errorData.error || "An error occurred");
      }
      const result = await response.json();
      // Handle both paginated response and array response for backward compatibility
      const allBranches = Array.isArray(result) ? result : (result.data || []);
      return allBranches as StoreBranch[];
    },
    enabled: !!companyId,
  });

  // Activate/Deactivate company mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async (isActive: boolean) => {
      if (!companyId) throw new Error("Company ID is required");
      const response = await fetchWithAuth(`/api/companies/${companyId}`, {
        method: "PUT",
        body: JSON.stringify({ isActive }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "" }));
        throw new Error(errorData.message || errorData.error || "An error occurred");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company", companyId] });
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      toast({
        title: "Success",
        description: `Company ${company?.isActive ? 'deactivated' : 'activated'} successfully`,
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

  const handleToggleActive = () => {
    setIsActivateDialogOpen(true);
  };

  const confirmToggleActive = () => {
    if (company) {
      toggleActiveMutation.mutate(!company.isActive);
      setIsActivateDialogOpen(false);
    }
  };

  // Send invitation mutation
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
      setIsInviteDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  const handleSendInvitation = () => {
    setIsInviteDialogOpen(true);
  };

  const confirmSendInvitation = () => {
    if (companyId) {
      inviteCompanyMutation.mutate(companyId);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-8 w-48" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-6 w-full" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !company) {
    const errorMessage = error instanceof Error ? error.message : '';
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Building2 className="h-12 w-12 text-slate-400" />
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          {errorMessage ? "Error" : "Company Not Found"}
        </h2>
        <p className="text-slate-600 dark:text-slate-400 text-center max-w-md">
          {errorMessage || "The company you're looking for doesn't exist or you don't have permission to view it."}
        </p>
        <div className="flex gap-2">
          <Button onClick={() => setLocation("/companies")} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Companies
          </Button>
          <Button onClick={() => window.location.reload()} variant="ghost">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setLocation("/companies")}
                    className="hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex items-center gap-4">
                    {company.companyLogo ? (
                      <img 
                        src={company.companyLogo} 
                        alt={`${company.name} logo`}
                        className="w-16 h-16 object-cover rounded-lg border-2 border-slate-200 dark:border-slate-700 shadow-md"
                        onError={(e) => {
                          // Hide image on error and show fallback
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-16 h-16 bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900 dark:to-purple-900 rounded-lg flex items-center justify-center border-2 border-slate-200 dark:border-slate-700 shadow-md">
                        <Building2 className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
                      </div>
                    )}
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-3">
                        {company.name}
                        </h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Company Details
                        </p>
                    </div>
                </div>
                </div>
                <div className="flex items-center gap-2">
                <Badge variant={company.isActive ? "default" : "secondary"} className="text-sm">
                    {company.licenseStatus}
                </Badge>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                    </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setIsEditDialogOpen(true)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Company
                    </DropdownMenuItem>
                    {isSuperAdmin && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={handleToggleActive}
                          disabled={toggleActiveMutation.isPending}
                        >
                          <Power className="h-4 w-4 mr-2" />
                          {company?.isActive ? 'Deactivate' : 'Activate'} Company
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuItem 
                      onClick={handleSendInvitation}
                      disabled={inviteCompanyMutation.isPending}
                    >
                        <Send className="h-4 w-4 mr-2" />
                        Send Invitation
                    </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
                </div>
            </div>

            {/* Company Information Card */}
            <Card>
                <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                    Company Information
                </CardTitle>
                </CardHeader>
                <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Company Logo */}
                    <div className="space-y-2 md:col-span-2">
                    <Label className="text-sm font-medium text-slate-600 dark:text-slate-400">
                        Company Logo
                    </Label>
                    <div className="flex items-center gap-4">
                      {company.companyLogo ? (
                        <img 
                          src={company.companyLogo} 
                          alt={`${company.name} logo`}
                          className="w-32 h-32 object-cover rounded-lg border-2 border-slate-200 dark:border-slate-700 shadow-md"
                          onError={(e) => {
                            // Hide image on error
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-32 h-32 bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900 dark:to-purple-900 rounded-lg flex items-center justify-center border-2 border-slate-200 dark:border-slate-700 shadow-md">
                          <Building2 className="h-12 w-12 text-indigo-600 dark:text-indigo-400" />
                        </div>
                      )}
                    </div>
                    </div>

                    <Separator className="md:col-span-2" />

                    {/* Company Name */}
                    <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-600 dark:text-slate-400">
                        Company Name
                    </Label>
                    <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
                        {company.name}
                    </p>
                    </div>

                    {/* Registration Number */}
                    <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-600 dark:text-slate-400">
                        Registration Number
                    </Label>
                    <p className="text-base text-slate-900 dark:text-slate-100">
                        {company.registrationNumber}
                    </p>
                    </div>

                    {/* VAT Number */}
                    <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-600 dark:text-slate-400">
                        VAT Number
                    </Label>
                    <p className="text-base text-slate-900 dark:text-slate-100">
                        {company.vatNumber || "N/A"}
                    </p>
                    </div>

                    {/* Status */}
                    <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-600 dark:text-slate-400">
                        Status
                    </Label>
                    <div>
                        <Badge variant={company.isActive ? "default" : "secondary"}>
                        {company.licenseStatus}
                        </Badge>
                    </div>
                    </div>

                    {/* Address */}
                    <div className="space-y-2 md:col-span-2">
                    <Label className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        Address
                    </Label>
                    <p className="text-base text-slate-900 dark:text-slate-100">
                        {company.address}
                    </p>
                    </div>

                    <Separator className="md:col-span-2" />

                    {/* Contact Information */}
                    <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        Email
                    </Label>
                    <p className="text-base text-slate-900 dark:text-slate-100">
                        {company.email}
                    </p>
                    </div>

                    <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        Phone
                    </Label>
                    <p className="text-base text-slate-900 dark:text-slate-100">
                        {company.phone}
                    </p>
                    </div>

                    <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Contact Person
                    </Label>
                    <p className="text-base text-slate-900 dark:text-slate-100">
                        {company.contactPerson}
                    </p>
                    </div>

                    {/* Company Admin Email */}
                    {company.companyAdminEmail && (
                    <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        Company Admin Email
                    </Label>
                    <p className="text-base text-slate-900 dark:text-slate-100">
                        {company.companyAdminEmail}
                    </p>
                    </div>
                    )}

                    <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
                        <Store className="h-4 w-4" />
                        Max Branches
                    </Label>
                    <p className="text-base text-slate-900 dark:text-slate-100">
                        {company.maxBranches}
                    </p>
                    </div>

                    <Separator className="md:col-span-2" />

                    {/* Statistics */}
                    <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
                        <Store className="h-4 w-4" />
                        Current Branches
                    </Label>
                    <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                        {company.branchCount}
                    </p>
                    </div>

                    <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Total Users
                    </Label>
                    <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                        {company.userCount}
                    </p>
                    </div>

                    <Separator className="md:col-span-2" />

                    {/* Created Date */}
                    <div className="space-y-2 md:col-span-2">
                    <Label className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Created At
                    </Label>
                    <p className="text-base text-slate-900 dark:text-slate-100">
                        {formatDate(company.createdAt)}
                    </p>
                    </div>
                </div>
                </CardContent>
            </Card>

            {/* Last 5 Branches */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Store className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                    Last 5 Branches
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setLocation(`/companies/${companyId}/stores`)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View All Branches
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {branchesLoading ? (
                  <div className="space-y-2">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="flex gap-4">
                        <Skeleton className="h-5 w-40" />
                        <Skeleton className="h-5 w-64" />
                        <Skeleton className="h-5 w-32" />
                        <Skeleton className="h-5 w-40" />
                      </div>
                    ))}
                  </div>
                ) : branchesError ? (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {(branchesError as Error).message ||
                      "An error occurred"}
                  </p>
                ) : branches.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    No branches found for this company yet.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Address</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Created At</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {branches.map((branch) => (
                        <TableRow 
                          key={branch.id}
                          className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800"
                          onClick={() => setLocation(`/companies/${companyId}/stores/${branch.id}`)}
                        >
                          <TableCell className="font-medium">
                            {branch.name}
                          </TableCell>
                          <TableCell>{branch.address || "—"}</TableCell>
                          <TableCell>{branch.phone || "—"}</TableCell>
                          <TableCell>
                            {formatDate(branch.createdAt)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <CompanyEditDialog
              isOpen={isEditDialogOpen}
              onOpenChange={setIsEditDialogOpen}
              company={company ? {
                id: company.id,
                name: company.name,
                registrationNumber: company.registrationNumber,
                vatNumber: company.vatNumber,
                address: company.address,
                email: company.email,
                phone: company.phone,
                contactPerson: company.contactPerson,
                maxBranches: company.maxBranches,
                companyLogo: company.companyLogo,
              } : null}
              onUpdated={() => refetch()}
            />

            {/* Activate/Deactivate Company Dialog */}
            {isSuperAdmin && (
              <AlertDialog open={isActivateDialogOpen} onOpenChange={setIsActivateDialogOpen}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {company?.isActive ? 'Deactivate' : 'Activate'} Company
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to {company?.isActive ? 'deactivate' : 'activate'} <strong>{company?.name}</strong>?
                      {company?.isActive && ' This will prevent the company from accessing the system.'}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setIsActivateDialogOpen(false)}>
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={confirmToggleActive}
                      disabled={toggleActiveMutation.isPending}
                      className={company?.isActive ? "bg-orange-600 hover:bg-orange-700" : "bg-green-600 hover:bg-green-700"}
                    >
                      {toggleActiveMutation.isPending ? "Processing..." : (company?.isActive ? 'Deactivate' : 'Activate')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            {/* Send Invitation Dialog */}
            <SendInvitationDialog
              open={isInviteDialogOpen}
              onOpenChange={setIsInviteDialogOpen}
              onConfirm={confirmSendInvitation}
              itemName={company?.name}
              itemEmail={company?.email}
              isLoading={inviteCompanyMutation.isPending}
            />
        </div>
    </div>
  );
}

