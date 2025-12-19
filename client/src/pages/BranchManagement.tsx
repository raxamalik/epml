import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useDebounce } from "@/hooks/useDebounce";
import { Search, Store, MapPin, Phone, MoreHorizontal, Eye, Loader2, ArrowLeft } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious, PaginationEllipsis } from "@/components/ui/pagination";

interface Branch {
  id: number;
  name: string;
  address: string | null;
  phone: string | null;
  managerId: string | null;
  companyId: number;
  companyName?: string;
  isActive: boolean;
  revenue: number;
  customerCount: number;
  productCount: number;
  createdAt: string;
  updatedAt: string;
}

export default function BranchManagement() {
  const [, params] = useRoute("/companies/:companyId/stores");
  const [, setLocation] = useLocation();
  const companyId = params?.companyId ? parseInt(params.companyId) : null;
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 500);
  const [filterStatus, setFilterStatus] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { data: company } = useQuery({
    queryKey: ["company", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const response = await fetchWithAuth(`/api/companies/${companyId}`);
      if (!response.ok) {
        throw new Error("An error occurred");
      }
      return response.json();
    },
    enabled: !!companyId,
  });

  const { data: branchesResponse, isLoading, error, refetch } = useQuery({
    queryKey: ["company-branches", companyId, currentPage, pageSize, debouncedSearchQuery, filterStatus],
    queryFn: async () => {
      if (!companyId) return { data: [], total: 0, page: 1, limit: pageSize, totalPages: 0 };
      
      const params = new URLSearchParams({
        limit: pageSize.toString(),
        offset: ((currentPage - 1) * pageSize).toString(),
      });
      
      if (debouncedSearchQuery) {
        params.append("search", debouncedSearchQuery);
      }
      if (filterStatus && filterStatus !== "all") {
        params.append("status", filterStatus);
      }
      
      const response = await fetchWithAuth(`/api/companies/${companyId}/stores?${params}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || "An error occurred");
      }
      const result = await response.json();
      
      // Handle both paginated response (with data property) and array response
      let branches: Branch[] = [];
      if (Array.isArray(result)) {
        // Backward compatibility: if result is an array, wrap it
        branches = result;
      } else if (result.data && Array.isArray(result.data)) {
        branches = result.data;
      } else {
        // Fallback: empty array if structure is unexpected
        console.warn("Unexpected response structure:", result);
        branches = [];
      }
      
      const enrichedData = branches.map((branch: Branch) => ({
        ...branch,
        companyName: company?.name || "Unknown Company"
      }));
      
      // Return consistent structure
      return {
        data: enrichedData,
        total: result.total || enrichedData.length,
        page: result.page || currentPage,
        limit: result.limit || pageSize,
        totalPages: result.totalPages || Math.ceil((result.total || enrichedData.length) / pageSize)
      };
    },
    enabled: !!companyId,
  });

  // Ensure branches is always an array
  const branches: Branch[] = Array.isArray(branchesResponse?.data) 
    ? branchesResponse.data 
    : [];
  const total = branchesResponse?.total ?? 0;
  const totalPages = branchesResponse?.totalPages ?? 0;

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchQuery, filterStatus]);

  const handleViewDetails = (branch: Branch) => {
    if (companyId) {
      setLocation(`/companies/${companyId}/stores/${branch.id}`);
    }
  };

  if (!companyId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Store className="h-12 w-12 text-slate-400" />
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          Company ID Required
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          Please navigate to a company's stores page.
        </p>
        <Button onClick={() => setLocation("/companies")} variant="outline">
          Back to Companies
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Loading branches...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Store className="h-12 w-12 text-slate-400" />
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          Error Loading Branches
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
                    <h1 className="text-3xl font-bold">Branch Management</h1>
                    {company && (
                      <p className="text-blue-100 text-lg mt-1">
                        {company.name}
                      </p>
                    )}
                  </div>
                </div>
                <p className="text-blue-100 text-sm ml-16">
                  View branches and store locations for this company
                </p>
                <div className="flex items-center gap-6 mt-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-sm">System Active</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Store className="h-4 w-4" />
                    <span className="text-sm">{branches.length} Branches</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <Card className="mb-8 border-0 shadow-lg bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 h-5 w-5" />
                <Input
                  placeholder="Search branches by name, address, or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12 h-12 text-lg border-slate-200 dark:border-slate-600 bg-white/60 dark:bg-slate-700/60 backdrop-blur-sm focus:ring-2 focus:ring-blue-500/50"
                />
              </div>
              
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-48 h-12 border-slate-200 dark:border-slate-600 bg-white/60 dark:bg-slate-700/60">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Branches Table */}
        <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-700 dark:to-slate-600 border-b border-slate-200 dark:border-slate-600">
            <CardTitle className="flex items-center gap-3 text-xl">
              <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg">
                <Store className="h-6 w-6 text-white" />
              </div>
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent font-bold">
                Branches ({total})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {branches.length === 0 ? (
              <div className="text-center py-12">
                <Store className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No branches found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-gradient-to-r from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600 border-b-2 border-slate-300 dark:border-slate-500">
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-200 py-4">Branch Name</TableHead>
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-200 py-4">Address</TableHead>
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-200 py-4">Phone</TableHead>
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-200 py-4">Status</TableHead>
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-200 py-4">Revenue</TableHead>
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-200 py-4">Products</TableHead>
                    <TableHead className="w-[70px] font-semibold text-slate-700 dark:text-slate-200 py-4">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.isArray(branches) && branches.length > 0 ? (
                    branches.map((branch: Branch, index: number) => (
                    <TableRow 
                      key={branch.id} 
                      className={`border-b border-slate-200 dark:border-slate-600 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 dark:hover:from-slate-700 dark:hover:to-slate-600 transition-all duration-200 ${index % 2 === 0 ? 'bg-slate-50/50 dark:bg-slate-800/50' : 'bg-white dark:bg-slate-800'}`}
                    >
                      <TableCell className="py-4">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">{branch.name}</div>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                          <MapPin className="h-3 w-3" />
                          {branch.address || "—"}
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                          <Phone className="h-3 w-3" />
                          {branch.phone || "—"}
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <Badge variant={branch.isActive ? "default" : "secondary"}>
                          {branch.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-4">
                        <span className="font-medium text-slate-900 dark:text-slate-100">
                          {branch.revenue.toLocaleString()} Kč
                        </span>
                      </TableCell>
                      <TableCell className="py-4">
                        <span className="text-slate-600 dark:text-slate-400">{branch.productCount}</span>
                      </TableCell>
                      <TableCell className="py-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-gradient-to-r hover:from-blue-100 hover:to-purple-100 dark:hover:from-blue-900 dark:hover:to-purple-900 rounded-full transition-all duration-200">
                              <MoreHorizontal className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleViewDetails(branch)}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                        No branches found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center px-6 py-4 border-t">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          if (currentPage > 1) setCurrentPage(currentPage - 1);
                        }}
                        className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                    
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      
                      return (
                        <PaginationItem key={pageNum}>
                          <PaginationLink
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              setCurrentPage(pageNum);
                            }}
                            isActive={currentPage === pageNum}
                            className="cursor-pointer"
                          >
                            {pageNum}
                          </PaginationLink>
                        </PaginationItem>
                      );
                    })}
                    
                    {totalPages > 5 && currentPage < totalPages - 2 && (
                      <PaginationItem>
                        <PaginationEllipsis />
                      </PaginationItem>
                    )}
                    
                    <PaginationItem>
                      <PaginationNext 
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          if (currentPage < totalPages) setCurrentPage(currentPage + 1);
                        }}
                        className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

