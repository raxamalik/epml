import { useEffect } from "react";
import { useLocation } from "wouter";
import { Store, MapPin, Phone, Calendar, TrendingUp, Package, Users, CheckCircle2, XCircle, Loader2, Building2, Mail, User } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/utils/date";
import { formatCurrencyWithSymbol } from "@/lib/utils/currency";
import { getStatusBadgeVariant, getStatusText } from "@/lib/utils/status";
import { useTranslation } from "@/hooks/useTranslation";

interface StoreData {
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

interface Manager {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role: string;
  isActive: boolean;
  storeId?: number;
  createdAt: string;
}


export default function StoreOwnerStoreDetail() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { t } = useTranslation();

  // Redirect if not a store owner
  useEffect(() => {
    if (user && user.role !== 'store_owner') {
      setLocation('/');
    }
  }, [user, setLocation]);

  // Fetch store details - store owners can only access their assigned store
  const { data: store, isLoading, error } = useQuery<StoreData>({
    queryKey: ["store-owner-store", user?.storeId],
    queryFn: async () => {
      if (!user?.storeId) {
        throw new Error("No store assigned");
      }
      const response = await apiRequest("GET", `/api/stores/${user.storeId}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "" }));
        throw new Error(errorData.message || errorData.error || "Failed to fetch store");
      }
      const storeData = await response.json();
      
      
      return storeData;
    },
    enabled: !!user?.storeId && user?.role === 'store_owner',
  });

  // Fetch managers/staff for this store
  const { data: managers = [], isLoading: managersLoading } = useQuery<Manager[]>({
    queryKey: ["store-managers", store?.id],
    queryFn: async () => {
      if (!store?.id) return [];
      const response = await apiRequest("GET", `/api/stores/${store.id}/managers`);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!store?.id,
  });


  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="space-y-6">
            <Skeleton className="h-32 w-full" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
            <Skeleton className="h-96 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !store) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <Store className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">{t("storeDetail.notFoundTitle")}</h2>
              <p className="text-muted-foreground mb-4">
                {(error as Error)?.message || t("storeDetail.notFoundDescription")}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("storeDetail.notFoundHelp")}
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
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="p-3 bg-white/20 rounded-lg backdrop-blur-sm">
                      <Store className="h-8 w-8" />
                    </div>
                    <div>
                      <h1 className="text-3xl font-bold mb-2">{store.name}</h1>
                      <Badge 
                        variant={getStatusBadgeVariant(store.isActive)}
                        className="text-sm"
                      >
                        {store.isActive ? (
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                        ) : (
                          <XCircle className="h-3 w-3 mr-1" />
                        )}
                        {getStatusText(store.isActive)}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                    {store.address && (
                      <div className="flex items-start gap-3">
                        <MapPin className="h-5 w-5 mt-0.5 text-blue-200" />
                        <div>
                          <p className="text-sm text-blue-100">{t("storeDetail.header.address")}</p>
                          <p className="text-white font-medium">{store.address}</p>
                        </div>
                      </div>
                    )}
                    {store.phone && (
                      <div className="flex items-start gap-3">
                        <Phone className="h-5 w-5 mt-0.5 text-blue-200" />
                        <div>
                          <p className="text-sm text-blue-100">{t("storeDetail.header.phone")}</p>
                          <p className="text-white font-medium">{store.phone}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <Card className="border-0 shadow-lg bg-white dark:bg-slate-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t("storeDetail.stats.totalRevenue")}</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
                    {formatCurrencyWithSymbol(store.revenue || 0)}
                  </p>
                </div>
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-white dark:bg-slate-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t("storeDetail.stats.products")}</p>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                    {store.productCount}
                  </p>
                </div>
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Package className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>


          <Card className="border-0 shadow-lg bg-white dark:bg-slate-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t("storeDetail.stats.staffMembers")}</p>
                  <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                    {managers.length}
                  </p>
                </div>
                <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                  <Users className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Store Information */}
        <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                {t("storeDetail.info.sectionTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Store Name */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  {t("storeDetail.info.storeName")}
                </Label>
                <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  {store.name}
                </p>
              </div>

              {/* Status */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  {t("storeDetail.info.status")}
                </Label>
                <div>
                  <Badge variant={store.isActive ? "default" : "secondary"}>
                    {store.isActive ? "Active" : "Inactive"}
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
                  {store.address || t("storeDetail.info.noAddress")}
                </p>
              </div>

              {/* Phone */}
              {store.phone && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    {t("storeDetail.info.phone")}
                  </Label>
                  <p className="text-base text-slate-900 dark:text-slate-100">
                    {store.phone}
                  </p>
                </div>
              )}

              {/* Store Owner Email */}
              {store.storeOwnerEmail && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    {t("storeDetail.info.storeOwnerEmail")}
                  </Label>
                  <p className="text-base text-slate-900 dark:text-slate-100">
                    {store.storeOwnerEmail}
                  </p>
                </div>
              )}

              <Separator className="md:col-span-2" />

              {/* Statistics */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {t("storeDetail.info.customers")}
                </Label>
                <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                  {store.customerCount || 0}
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
                  {formatDate(store.createdAt)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Staff Members */}
        <Card className="border-0 shadow-lg bg-white dark:bg-slate-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                {t("storeDetail.staff.sectionTitle")} ({managers.length})
            </CardTitle>
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
                {t("storeDetail.staff.none")}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("storeDetail.staff.name")}</TableHead>
                    <TableHead>{t("storeDetail.staff.email")}</TableHead>
                    <TableHead>{t("storeDetail.staff.phone")}</TableHead>
                    <TableHead>{t("storeDetail.staff.status")}</TableHead>
                    <TableHead>{t("storeDetail.staff.created")}</TableHead>
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
                      <TableCell>{manager.phone || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={manager.isActive ? "default" : "secondary"}>
                          {manager.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(manager.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

