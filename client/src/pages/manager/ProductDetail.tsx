import { useQuery } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ArrowLeft,
  Edit,
  Package,
  DollarSign,
  Box,
  Barcode,
  Tag,
  AlertTriangle,
  CheckCircle,
  FlaskConical,
  Info,
  Calendar,
  FileText,
} from "lucide-react";

interface Product {
  id: number;
  name: string;
  price: string;
  vatRate: string;
  category: string;
  categoryId?: number;
  stock: number;
  barcode?: string;
  description?: string;
  imageUrl?: string;
  storeId: number | null;
  companyId?: number | null;
  // Regulatory compliance fields
  substanceName?: string;
  form?: string;
  subtype?: string;
  packageSize?: string;
  receivedDate?: string;
  batchNumber?: string;
  quantityUnit?: string;
  // Psychomodulatory substance compliance fields
  recommendedDoseSingle?: string;
  recommendedDoseDaily?: string;
  dosageInfo?: string;
  warningUnder18?: string;
  warningHealth?: string;
  minAge?: number;
  adultOnly?: boolean;
  consumerInfo?: string;
  activeSubstancesComposition?: any;
  activeSubstances?: Array<{
    id: number;
    substanceId: number;
    substanceName: string;
    contentAmount: string | null;
    contentUnit: string | null;
    concentration: string | null;
  }>;
}

export default function ProductDetail() {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const params = useParams<{ id: string }>();
  const productId = params?.id ? parseInt(params.id) : null;
  
  // Determine if user is company admin
  const isCompanyAdmin = user?.role === 'company_admin';
  const storeId = user?.storeId;

  // Fetch product
  // For company admins: use company-wide endpoint
  // For store owners/managers: use store-specific endpoint
  const { data: product, isLoading, error } = useQuery<Product>({
    queryKey: isCompanyAdmin 
      ? [`/api/company/products/${productId}`]
      : [`/api/stores/${storeId}/products/${productId}`],
    queryFn: async () => {
      const endpoint = isCompanyAdmin
        ? `/api/company/products/${productId}`
        : `/api/stores/${storeId}/products/${productId}`;
      const res = await apiRequest('GET', endpoint);
      return await res.json();
    },
    enabled: !!productId && (isCompanyAdmin || !!storeId),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-slate-500">Loading product details...</p>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Product Not Found</h3>
              <p className="text-slate-500 mb-4">The product you're looking for doesn't exist or you don't have access to it.</p>
              <Button onClick={() => setLocation('/products')} variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Products
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getStockStatus = (stock: number) => {
    if (stock === 0) {
      return { label: "Out of Stock", variant: "destructive" as const };
    } else if (stock <= 10) {
      return { label: "Low Stock", variant: "secondary" as const };
    } else {
      return { label: "In Stock", variant: "default" as const };
    }
  };

  const stockStatus = getStockStatus(product.stock);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
        <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation('/products')}
            >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
        </Button>
      <div className="flex items-center justify-between">
        <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{product.name}</h1>
        <p className="text-slate-500 mt-1">Product ID: {product.id}</p>
        </div>
        <Button
          onClick={() => setLocation(`/products/edit/${product.id}`)}
          className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
        >
          <Edit className="h-4 w-4 mr-2" />
          Edit Product
        </Button>
      </div>

      {/* Quick Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Stats</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
              <div className="flex items-center gap-2">
                <Box className="h-4 w-4 text-slate-500" />
                <span className="text-sm text-slate-500">Stock Level</span>
              </div>
              <Badge variant={stockStatus.variant}>{product.stock} units</Badge>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-slate-500" />
                <span className="text-sm text-slate-500">Price</span>
              </div>
              <span className="font-medium">${parseFloat(product.price).toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-slate-500" />
                <span className="text-sm text-slate-500">VAT</span>
              </div>
              <span className="font-medium">{product.vatRate}%</span>
            </div>
            {product.barcode && (
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <div className="flex items-center gap-2">
                  <Barcode className="h-4 w-4 text-slate-500" />
                  <span className="text-sm text-slate-500">Barcode</span>
                </div>
                <span className="font-mono text-xs">{product.barcode}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
          {/* Product Image */}
          {product.imageUrl && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Product Image
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-center">
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="max-w-full h-auto max-h-96 rounded-lg object-contain"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5" />
                Basic Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500 mb-1">Name</p>
                  <p className="font-medium">{product.name}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Category</p>
                  <Badge variant="outline">{product.category || "Uncategorized"}</Badge>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Price</p>
                  <p className="font-medium flex items-center gap-1">
                    <DollarSign className="h-4 w-4" />
                    {parseFloat(product.price).toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">VAT Rate</p>
                  <p className="font-medium">{product.vatRate}%</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Stock</p>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{product.stock}</p>
                    <Badge variant={stockStatus.variant}>{stockStatus.label}</Badge>
                  </div>
                </div>
                {product.barcode && (
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Barcode</p>
                    <p className="font-mono text-sm">{product.barcode}</p>
                  </div>
                )}
              </div>
              {product.description && (
                <div>
                  <p className="text-sm text-slate-500 mb-1">Description</p>
                  <p className="text-sm">{product.description}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Active Substances */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FlaskConical className="h-5 w-5" />
                Active Substances
              </CardTitle>
            </CardHeader>
            <CardContent>
              {product.activeSubstances && product.activeSubstances.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Substance Name</TableHead>
                      <TableHead>Content</TableHead>
                      <TableHead>Concentration</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {product.activeSubstances.map((substance) => (
                      <TableRow key={substance.id}>
                        <TableCell className="font-medium">{substance.substanceName}</TableCell>
                        <TableCell>
                          {substance.contentAmount && substance.contentUnit
                            ? `${substance.contentAmount} ${substance.contentUnit}`
                            : substance.contentAmount || "-"}
                        </TableCell>
                        <TableCell>
                          {substance.concentration ? `${substance.concentration}%` : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8">
                  <FlaskConical className="h-12 w-12 text-slate-400 mx-auto mb-3" />
                  <p className="text-slate-500 text-sm">No active substances added to this product.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Regulatory Compliance */}
          {(product.substanceName || product.form || product.subtype || product.packageSize) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Regulatory Compliance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  {product.substanceName && (
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Substance Name</p>
                      <p className="font-medium">{product.substanceName}</p>
                    </div>
                  )}
                  {product.form && (
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Form</p>
                      <p className="font-medium">{product.form}</p>
                    </div>
                  )}
                  {product.subtype && (
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Subtype</p>
                      <p className="font-medium">{product.subtype}</p>
                    </div>
                  )}
                  {product.packageSize && (
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Package Size</p>
                      <p className="font-medium">{product.packageSize}</p>
                    </div>
                  )}
                  {product.batchNumber && (
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Batch Number</p>
                      <p className="font-medium">{product.batchNumber}</p>
                    </div>
                  )}
                  {product.quantityUnit && (
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Quantity Unit</p>
                      <p className="font-medium">{product.quantityUnit}</p>
                    </div>
                  )}
                  {product.receivedDate && (
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Received Date</p>
                      <p className="font-medium flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {new Date(product.receivedDate).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Dosage Information */}
          {(product.recommendedDoseSingle || product.recommendedDoseDaily || product.dosageInfo) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5" />
                  Dosage Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {product.recommendedDoseSingle && (
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Recommended Single Dose</p>
                    <p className="font-medium">{product.recommendedDoseSingle}</p>
                  </div>
                )}
                {product.recommendedDoseDaily && (
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Recommended Daily Dose</p>
                    <p className="font-medium">{product.recommendedDoseDaily}</p>
                  </div>
                )}
                {product.dosageInfo && (
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Dosage Info</p>
                    <p className="text-sm">{product.dosageInfo}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Warnings & Age Restrictions */}
          {(product.warningUnder18 || product.warningHealth || product.minAge !== undefined || product.adultOnly) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Warnings & Age Restrictions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {product.warningUnder18 && (
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Warning for Under 18</p>
                    <p className="text-sm">{product.warningUnder18}</p>
                  </div>
                )}
                {product.warningHealth && (
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Health Warning</p>
                    <p className="text-sm">{product.warningHealth}</p>
                  </div>
                )}
                <div className="flex items-center gap-4">
                  {product.minAge !== undefined && (
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Minimum Age</p>
                      <p className="font-medium">{product.minAge} years</p>
                    </div>
                  )}
                  {product.adultOnly && (
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-orange-500" />
                      <span className="text-sm font-medium">Adults Only</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Consumer Info */}
          {product.consumerInfo && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5" />
                  Consumer Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{product.consumerInfo}</p>
              </CardContent>
            </Card>
          )}
      </div>
    </div>
  );
}

