import { useRoute, useLocation } from "wouter";
import { Link } from "wouter";
import { ArrowLeft, Store, MapPin, Phone, Building2, Calendar, TrendingUp, Package, Users, User, Mail } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
  storeOwnerEmail?: string | null;
}

interface StoreOwner {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

interface Product {
  id: number;
  name: string;
  price: string;
  stock: number;
  category: string | null;
}

interface Sale {
  id: string;
  total: string;
  paymentMethod: string;
  createdAt: string;
}

interface Manager {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role: string;
  isActive: boolean;
  storeId?: number;
  createdAt: string;
  store?: {
    id: number;
    name: string;
  };
}

interface Manager {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role: string;
  isActive: boolean;
  storeId?: number;
  createdAt: string;
  store?: {
    id: number;
    name: string;
  };
}

import { formatDate } from "@/lib/utils/date";
import { useTranslation } from "@/hooks/useTranslation";

export default function BranchDetails() {
  const [, params] = useRoute("/companies/:companyId/stores/:storeId");
  const [, paramsStore] = useRoute("/stores/:storeId");
  const [, setLocation] = useLocation();
  const { t, currentLanguage } = useTranslation();
  
  // Handle both routes: /stores/:storeId and /companies/:companyId/stores/:storeId
  const companyId = params?.companyId ? parseInt(params.companyId) : null;
  const branchId = params?.storeId ? parseInt(params.storeId) : (paramsStore?.storeId ? parseInt(paramsStore.storeId) : null);

  // Fetch branch details
  const { data: branch, isLoading, error, refetch } = useQuery<Branch>({
    queryKey: ["branch", branchId],
    queryFn: async () => {
      if (!branchId) throw new Error("Branch ID is required");
      const response = await fetchWithAuth(`/api/stores/${branchId}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "" }));
        throw new Error(errorData.message || errorData.error || "An error occurred");
      }
      const branchData = await response.json();
      
      // Fetch company name if companyId exists
      if (branchData.companyId) {
        try {
          const companyResponse = await fetchWithAuth(`/api/companies/${branchData.companyId}`);
          if (companyResponse.ok) {
            const company = await companyResponse.json();
            branchData.companyName = company.name;
          }
        } catch {
          // Ignore company fetch errors
        }
      }
      
      return branchData;
    },
    enabled: !!branchId,
  });

  // Fetch products for this branch
  const { data: products = [], isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["branch-products", branchId],
    queryFn: async () => {
      if (!branchId) return [];
      const response = await fetchWithAuth(`/api/stores/${branchId}/products`);
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data : (data?.data || []);
    },
    enabled: !!branchId,
  });

  // Fetch sales for this branch
  const { data: sales = [], isLoading: salesLoading } = useQuery<Sale[]>({
    queryKey: ["branch-sales", branchId],
    queryFn: async () => {
      if (!branchId) return [];
      const response = await fetchWithAuth(`/api/stores/${branchId}/sales`);
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data : (data?.data || []);
    },
    enabled: !!branchId,
  });

  // Fetch managers for this branch
  const { data: managers = [], isLoading: managersLoading } = useQuery<Manager[]>({
    queryKey: ["branch-managers", branchId],
    queryFn: async () => {
      if (!branchId) return [];
      const response = await fetchWithAuth(`/api/stores/${branchId}/managers`);
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data : (data?.data || []);
    },
    enabled: !!branchId,
  });


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

  if (error || !branch) {
    const errorMessage = error instanceof Error ? error.message : '';
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Store className="h-12 w-12 text-slate-400" />
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          {errorMessage ? t("branchDetails.errorTitle") : t("branchDetails.notFoundTitle")}
        </h2>
        <p className="text-slate-600 dark:text-slate-400 text-center max-w-md">
          {errorMessage || t("branchDetails.notFoundDescription")}
        </p>
        <div className="flex gap-2">
          <Button onClick={() => {
            if (companyId) {
              setLocation(`/companies/${companyId}/stores`);
            } else if (paramsStore) {
              setLocation("/stores");
            } else {
              setLocation("/companies");
            }
          }} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {companyId ? t("branchDetails.backToBranches") : t("branchDetails.backToStores")}
          </Button>
          <Button onClick={() => refetch()} variant="ghost">
            {t("branchDetails.retry")}
          </Button>
        </div>
      </div>
    );
  }

  const totalRevenue = sales.reduce((sum, sale) => {
    const total = typeof sale.total === 'string' ? parseFloat(sale.total) : sale.total;
    return sum + (total || 0);
  }, 0);

  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (companyId) {
                  setLocation(`/companies/${companyId}/stores`);
                } else if (paramsStore) {
                  setLocation("/stores");
                } else {
                  setLocation("/stores");
                }
              }}
              className="hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-3">
                <Store className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
                {branch.name}
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {t("storeDetail.info.sectionTitle")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={branch.isActive ? "default" : "secondary"} className="text-sm">
              {branch.isActive ? t("common.active") : t("common.inactive")}
            </Badge>
          </div>
        </div>

        {/* Branch Information Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              {t("storeDetail.info.sectionTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Branch Name */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  {t("storeDetail.info.storeName")}
                </Label>
                <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  {branch.name}
                </p>
              </div>

              {/* Company */}
              {branch.companyName && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    {t("companyDashboard.settings.companyProfile.companyName")}
                  </Label>
                  <p className="text-base text-slate-900 dark:text-slate-100">
                    {branch.companyName}
                  </p>
                </div>
              )}

              {/* Status */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  {t("storeDetail.info.status")}
                </Label>
                <div>
                  <Badge variant={branch.isActive ? "default" : "secondary"}>
                    {branch.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>

              {/* Address */}
              <div className="space-y-2 md:col-span-2">
                <Label className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  {t("storeDetail.info.address")}
                </Label>
                <p className="text-base text-slate-900 dark:text-slate-100">
                  {branch.address || t("storeDetail.info.noAddress")}
                </p>
              </div>

              {/* Phone */}
              {branch.phone && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    {t("storeDetail.info.phone")}
                  </Label>
                  <p className="text-base text-slate-900 dark:text-slate-100">
                    {branch.phone}
                  </p>
                </div>
              )}

              {/* Store Owner Email */}
              {branch.storeOwnerEmail && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    {t("storeDetail.info.storeOwnerEmail")}
                  </Label>
                  <p className="text-base text-slate-900 dark:text-slate-100">
                    {branch.storeOwnerEmail}
                  </p>
                </div>
              )}

              <Separator className="md:col-span-2" />

              {/* Statistics */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  {t("storeDetail.stats.totalRevenue")}
                </Label>
                <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                  €{totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  {t("storeDetail.stats.products")}
                </Label>
                <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                  {products.length}
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {t("branchDetails.infoCard.totalSales")}
                </Label>
                <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                  {sales.length}
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {t("storeDetail.info.customers")}
                </Label>
                <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                  {branch.customerCount}
                </p>
              </div>

              <Separator className="md:col-span-2" />

              {/* Created Date */}
              <div className="space-y-2 md:col-span-2">
                <Label className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {t("storeDetail.info.createdAt")}
                </Label>
                <p className="text-base text-slate-900 dark:text-slate-100">
                  {formatDate(branch.createdAt)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Products */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              {t("products.table.productCatalog", { count: products.length })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {productsLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : products.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t("products.empty.description")}
              </p>
            ) : (
              <Table>
                <TableHeader>
                    <TableRow>
                      <TableHead>{t("products.table.name")}</TableHead>
                      <TableHead>{t("products.table.category")}</TableHead>
                      <TableHead>{t("products.table.price")}</TableHead>
                      <TableHead>{t("products.table.stock")}</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                  {products.slice(0, 10).map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell>{product.category || t("common.notAvailable")}</TableCell>
                      <TableCell>€{parseFloat(product.price).toFixed(2)}</TableCell>
                      <TableCell>{product.stock}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Recent Sales */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              Recent Sales ({sales.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {salesLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : sales.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t("branchDetails.salesTable.noSalesFound")}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("branchDetails.salesTable.saleId")}</TableHead>
                    <TableHead>{t("branchDetails.salesTable.total")}</TableHead>
                    <TableHead>{t("branchDetails.salesTable.paymentMethod")}</TableHead>
                    <TableHead>{t("branchDetails.salesTable.date")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.slice(0, 10).map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell className="font-medium">{sale.id.slice(0, 8)}...</TableCell>
                      <TableCell>€{parseFloat(sale.total).toFixed(2)}</TableCell>
                      <TableCell>{sale.paymentMethod}</TableCell>
                      <TableCell>{formatDate(sale.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Recent Managers */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                {t("branchDetails.managersTable.title")}
              </CardTitle>
              {managers.length > 5 && (
                <Link href={`/managers?store=${branchId}`}>
                  <Button variant="outline" size="sm">
                    {t("branchDetails.managersTable.viewAll")}
                  </Button>
                </Link>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {managersLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : managers.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t("branchDetails.managersTable.noManagersFound")}
              </p>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("branchDetails.managersTable.name")}</TableHead>
                      <TableHead>{t("branchDetails.managersTable.email")}</TableHead>
                      <TableHead>{t("branchDetails.managersTable.phone")}</TableHead>
                      <TableHead>{t("branchDetails.managersTable.status")}</TableHead>
                      <TableHead>{t("branchDetails.managersTable.joined")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {managers.slice(0, 5).map((manager) => (
                      <TableRow key={manager.id}>
                        <TableCell className="font-medium">
                          {manager.firstName} {manager.lastName}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-slate-400" />
                            {manager.email}
                          </div>
                        </TableCell>
                        <TableCell>{manager.phone || t("common.notAvailable")}</TableCell>
                        <TableCell>
                          <Badge variant={manager.isActive ? "default" : "secondary"}>
                            {manager.isActive ? t("common.active") : t("common.inactive")}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(manager.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {managers.length > 5 && (
                  <div className="mt-4 text-center">
                    <Link href={`/managers?store=${branchId}`}>
                      <Button variant="outline">
                        {t("branchDetails.managersTable.viewAllCount", { count: managers.length })}
                      </Button>
                    </Link>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
