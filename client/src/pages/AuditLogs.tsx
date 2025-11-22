import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar, Search, Filter, AlertCircle, Info, AlertTriangle, XCircle, RefreshCw, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";

interface AuditLog {
  id: number;
  action: string;
  entityType?: string;
  entityId?: string;
  userId?: string;
  userEmail?: string;
  userRole?: string;
  storeId?: number;
  companyId?: number;
  ipAddress?: string;
  userAgent?: string;
  description: string;
  oldValues?: any;
  newValues?: any;
  metadata?: any;
  severity: string;
  createdAt: string;
}

const severityIcons = {
  info: <Info className="h-4 w-4 text-blue-500" />,
  warning: <AlertTriangle className="h-4 w-4 text-yellow-500" />,
  error: <XCircle className="h-4 w-4 text-red-500" />,
  critical: <AlertCircle className="h-4 w-4 text-red-600" />
};

const severityColors = {
  info: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  warning: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  error: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  critical: "bg-red-200 text-red-900 dark:bg-red-950 dark:text-red-300"
};

export default function AuditLogs() {
  const [filters, setFilters] = useState({
    action: "all",
    entityType: "all",
    severity: "all",
    startDate: "",
    endDate: "",
    search: ""
  });
  
  const [currentPage, setCurrentPage] = useState(1);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const limit = 50;
  const queryClient = useQueryClient();

  // Fetch audit logs with filters and pagination metadata
  const { data: auditLogsResponse, isLoading, error, refetch } = useQuery({
    queryKey: ["/api/audit-logs", filters, currentPage],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: ((currentPage - 1) * limit).toString(),
      });
      
      if (filters.action && filters.action !== "all") params.append("action", filters.action);
      if (filters.entityType && filters.entityType !== "all") params.append("entityType", filters.entityType);
      if (filters.startDate) params.append("startDate", filters.startDate);
      if (filters.endDate) params.append("endDate", filters.endDate);
      
      const response = await fetch(`/api/audit-logs?${params}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch audit logs: ${response.statusText}`);
      }
      return response.json();
    },
    refetchInterval: autoRefresh ? 10000 : false, // Auto-refresh every 10 seconds when enabled
  });

  const auditLogs = auditLogsResponse?.data || [];
  const totalCount = auditLogsResponse?.total || 0;
  const totalPages = Math.ceil(totalCount / limit);

  // Filter audit logs on the frontend for search and severity
  const filteredLogs = useMemo(() => {
    return auditLogs.filter((log: AuditLog) => {
      const matchesSearch = !filters.search || 
        log.description.toLowerCase().includes(filters.search.toLowerCase()) ||
        log.userEmail?.toLowerCase().includes(filters.search.toLowerCase()) ||
        log.action.toLowerCase().includes(filters.search.toLowerCase());
      
      const matchesSeverity = !filters.severity || filters.severity === "all" || log.severity === filters.severity;
      
      return matchesSearch && matchesSeverity;
    });
  }, [auditLogs, filters.search, filters.severity]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1); // Reset to first page when filtering
  };

  const clearFilters = () => {
    setFilters({
      action: "all",
      entityType: "all",
      severity: "all",
      startDate: "",
      endDate: "",
      search: ""
    });
    setCurrentPage(1);
  };

  const handleManualRefresh = () => {
    refetch();
  };

  const toggleAutoRefresh = () => {
    setAutoRefresh(!autoRefresh);
  };

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "MMM dd, yyyy HH:mm:ss");
  };

  const formatJsonData = (data: any) => {
    if (!data) return "N/A";
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  };

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
          <CardHeader>
            <CardTitle className="text-red-800 dark:text-red-200 flex items-center gap-2">
              <XCircle className="h-5 w-5" />
              Access Denied
            </CardTitle>
            <CardDescription className="text-red-600 dark:text-red-400">
              {error.message || "You don't have permission to view audit logs."}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Audit Logs</h1>
        <p className="text-gray-600 dark:text-gray-300">
          Monitor all system activities and user actions for security and compliance
        </p>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="search"
                  placeholder="Search descriptions, emails, actions..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange("search", e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="action">Action</Label>
              <Select value={filters.action} onValueChange={(value) => handleFilterChange("action", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All actions</SelectItem>
                  <SelectItem value="user_login">User Login</SelectItem>
                  <SelectItem value="user_logout">User Logout</SelectItem>
                  <SelectItem value="product_create">Product Create</SelectItem>
                  <SelectItem value="product_update">Product Update</SelectItem>
                  <SelectItem value="sale_create">Sale Create</SelectItem>
                  <SelectItem value="user_create">User Create</SelectItem>
                  <SelectItem value="user_update">User Update</SelectItem>
                  <SelectItem value="store_create">Store Create</SelectItem>
                  <SelectItem value="store_update">Store Update</SelectItem>
                  <SelectItem value="company_create">Company Create</SelectItem>
                  <SelectItem value="company_update">Company Update</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="entityType">Entity Type</Label>
              <Select value={filters.entityType} onValueChange={(value) => handleFilterChange("entityType", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="product">Product</SelectItem>
                  <SelectItem value="sale">Sale</SelectItem>
                  <SelectItem value="store">Store</SelectItem>
                  <SelectItem value="company">Company</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="severity">Severity</Label>
              <Select value={filters.severity} onValueChange={(value) => handleFilterChange("severity", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All severities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All severities</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange("startDate", e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange("endDate", e.target.value)}
              />
            </div>

            <div className="md:col-span-2 flex items-end gap-2">
              <Button onClick={clearFilters} variant="outline" className="flex-1">
                Clear All Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Refresh Controls */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                onClick={handleManualRefresh} 
                variant="outline" 
                size="sm"
                disabled={isLoading}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button 
                onClick={toggleAutoRefresh} 
                variant={autoRefresh ? "default" : "outline"} 
                size="sm"
                className="flex items-center gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
              </Button>
              {autoRefresh && (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Updates every 10 seconds
                </span>
              )}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Total: {totalCount} entries
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Audit Log Entries</CardTitle>
              <CardDescription>
                Showing {((currentPage - 1) * limit) + 1} to {Math.min(currentPage * limit, totalCount)} of {totalCount} entries
              </CardDescription>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  variant="outline"
                  size="sm"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  variant="outline"
                  size="sm"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No audit logs found</h3>
              <p className="text-gray-500 dark:text-gray-400">
                Try adjusting your filters to see more results.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredLogs.map((log: AuditLog) => (
                <div key={log.id} className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      {severityIcons[log.severity as keyof typeof severityIcons] || severityIcons.info}
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white">
                          {log.description}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline">{log.action}</Badge>
                          {log.entityType && (
                            <Badge variant="secondary">{log.entityType}</Badge>
                          )}
                          <Badge className={severityColors[log.severity as keyof typeof severityColors] || severityColors.info}>
                            {log.severity}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="text-right text-sm text-gray-500 dark:text-gray-400">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(log.createdAt)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                    {log.userEmail && (
                      <div><strong>User:</strong> {log.userEmail} ({log.userRole})</div>
                    )}
                    {log.ipAddress && (
                      <div><strong>IP Address:</strong> {log.ipAddress}</div>
                    )}
                    {log.entityId && (
                      <div><strong>Entity ID:</strong> {log.entityId}</div>
                    )}
                    {log.storeId && (
                      <div><strong>Store ID:</strong> {log.storeId}</div>
                    )}
                    {log.companyId && (
                      <div><strong>Company ID:</strong> {log.companyId}</div>
                    )}
                    
                    {(log.oldValues || log.newValues || log.metadata) && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-blue-600 dark:text-blue-400 hover:underline">
                          View Details
                        </summary>
                        <div className="mt-2 p-3 bg-gray-100 dark:bg-gray-800 rounded text-xs">
                          {log.oldValues && (
                            <div className="mb-2">
                              <strong>Old Values:</strong>
                              <pre className="mt-1 overflow-x-auto">{formatJsonData(log.oldValues)}</pre>
                            </div>
                          )}
                          {log.newValues && (
                            <div className="mb-2">
                              <strong>New Values:</strong>
                              <pre className="mt-1 overflow-x-auto">{formatJsonData(log.newValues)}</pre>
                            </div>
                          )}
                          {log.metadata && (
                            <div>
                              <strong>Metadata:</strong>
                              <pre className="mt-1 overflow-x-auto">{formatJsonData(log.metadata)}</pre>
                            </div>
                          )}
                        </div>
                      </details>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Bottom Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Showing {((currentPage - 1) * limit) + 1} to {Math.min(currentPage * limit, totalCount)} of {totalCount} entries
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => goToPage(1)}
                  disabled={currentPage === 1}
                  variant="outline"
                  size="sm"
                >
                  First
                </Button>
                <Button
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  variant="outline"
                  size="sm"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  variant="outline"
                  size="sm"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  onClick={() => goToPage(totalPages)}
                  disabled={currentPage === totalPages}
                  variant="outline"
                  size="sm"
                >
                  Last
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}