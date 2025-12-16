import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProductForm } from "@/components/product/ProductForm";
import { ProductActiveSubstance } from "@/components/product/ProductActiveSubstancesList";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Edit, Palette, ImageIcon, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/hooks/useTranslation";

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
  storeId: number;
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
  activeSubstances?: ProductActiveSubstance[];
  isActive?: boolean;
}

interface ProductCategory {
  id: number;
  name: string;
  description?: string;
  companyId?: number;
  storeId?: number | null;
  userId?: string;
}

export default function ProductFormPage() {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  
  // Get product ID from URL if editing
  const match = location.match(/\/edit\/(\d+)$/);
  const productId = match ? parseInt(match[1]) : null;
  const isEditMode = !!productId;
  
  // Determine storeId
  const isCompanyAdmin = user?.role === 'company_admin';
  
  // Fetch stores for company admins (to get a storeId for API call - backend will make it company-wide)
  const { data: stores = [] } = useQuery({
    queryKey: ['/api/stores'],
    queryFn: () => apiRequest('GET', '/api/stores').then(res => res.json()),
    enabled: isCompanyAdmin && !user?.storeId,
  });
  
  // For company admins: use first store from their company (backend will make product company-wide)
  // For store owners/managers: use their assigned storeId
  const storeId = isCompanyAdmin 
    ? (user?.storeId || (stores.length > 0 ? stores[0]?.id : null))
    : user?.storeId;

  // Fetch product if editing
  const { data: product, isLoading: productLoading } = useQuery<Product>({
    queryKey: [`/api/stores/${storeId}/products/${productId}`],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/stores/${storeId}/products/${productId}`);
      return await res.json();
    },
    enabled: isEditMode && !!productId && !!storeId,
  });

  // Fetch categories
  const { data: categories = [], isLoading: categoriesLoading } = useQuery<ProductCategory[]>({
    queryKey: ["/api/categories"],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/categories');
      return await res.json();
    },
    enabled: !!user,
  });

  // Fetch uploaded images for gallery
  const { data: uploadedImages = [], isLoading: imagesLoading } = useQuery<string[]>({
    queryKey: ["/api/uploaded-images"],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/uploaded-images');
      return await res.json();
    },
    enabled: !!user,
  });

  const [isImageGalleryOpen, setIsImageGalleryOpen] = useState(false);
  const [selectedImageFromGallery, setSelectedImageFromGallery] = useState("");

  // Mutations
  const createProductMutation = useMutation({
    mutationFn: async (productData: any) => {
      // For company admins, use company-wide endpoint
      // For store owners/managers, use store-specific endpoint
      const endpoint = isCompanyAdmin 
        ? '/api/company/products'
        : `/api/stores/${storeId}/products`;
      const response = await apiRequest('POST', endpoint, productData);
      return response.json();
    },
    onSuccess: () => {
      // Invalidate both company and store product queries
      if (isCompanyAdmin) {
        queryClient.invalidateQueries({ queryKey: ['/api/company/products'] });
        // Also invalidate any store-specific queries in case they're viewing a specific store
        queryClient.invalidateQueries({ queryKey: ['/api/stores'] });
      } else {
        queryClient.invalidateQueries({ queryKey: [`/api/stores/${storeId}/products`] });
      }
      toast({ title: "Product created successfully!" });
      setLocation('/products');
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "An error occurred", 
        variant: "destructive" 
      });
    }
  });

  const updateProductMutation = useMutation({
    mutationFn: async ({ id, productData }: { id: number; productData: any }) => {
      // For company admins, use company-wide endpoint
      // For store owners/managers, use store-specific endpoint
      const endpoint = isCompanyAdmin
        ? `/api/company/products/${id}`
        : `/api/stores/${storeId}/products/${id}`;
      const response = await apiRequest('PUT', endpoint, productData);
      return response.json();
    },
    onSuccess: () => {
      // Invalidate both company and store product queries
      if (isCompanyAdmin) {
        queryClient.invalidateQueries({ queryKey: ['/api/company/products'] });
        queryClient.invalidateQueries({ queryKey: [`/api/company/products/${productId}`] });
      } else {
        queryClient.invalidateQueries({ queryKey: [`/api/stores/${storeId}/products`] });
        queryClient.invalidateQueries({ queryKey: [`/api/stores/${storeId}/products/${productId}`] });
      }
      toast({ title: "Product updated successfully!" });
      setLocation('/products');
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "An error occurred", 
        variant: "destructive" 
      });
    }
  });

  const handleSubmit = (formData: any, imageUrl: string, activeSubstances: ProductActiveSubstance[] = []) => {
    // Prepare product data with all fields
    const productData: any = {
      name: formData.name,
      categoryId: parseInt(formData.categoryId),
      price: parseFloat(formData.price),
      vatRate: parseFloat(formData.vatRate),
      stock: parseInt(formData.stock) || 0,
      barcode: formData.barcode || undefined,
      description: formData.description || undefined,
      imageUrl: imageUrl || undefined,
      // Regulatory compliance fields
      substanceName: formData.substanceName || undefined,
      form: formData.form || undefined,
      subtype: formData.subtype || undefined,
      packageSize: formData.packageSize || undefined,
      receivedDate: formData.receivedDate ? new Date(formData.receivedDate).toISOString() : undefined,
      batchNumber: formData.batchNumber || undefined,
      quantityUnit: formData.quantityUnit || undefined,
      // Psychomodulatory substance compliance fields
      recommendedDoseSingle: formData.recommendedDoseSingle || undefined,
      recommendedDoseDaily: formData.recommendedDoseDaily || undefined,
      dosageInfo: formData.dosageInfo || undefined,
      warningUnder18: formData.warningUnder18 || undefined,
      warningHealth: formData.warningHealth || undefined,
      minAge: formData.minAge ? parseInt(formData.minAge) : undefined,
      adultOnly: formData.adultOnly,
      consumerInfo: formData.consumerInfo || undefined,
      // Active substances array
      activeSubstances: activeSubstances.map((s) => ({
        substanceId: s.substanceId,
        contentAmount: s.contentAmount || null,
        contentUnit: s.contentUnit || null,
        concentration: s.concentration || null,
      })),
    };
    
    if (isEditMode && productId) {
      updateProductMutation.mutate({
        id: productId,
        productData: productData
      });
    } else {
      // Don't include storeId in the payload for company admins (backend handles it)
      const payload = isCompanyAdmin 
        ? productData 
        : { ...productData, storeId: storeId };
      createProductMutation.mutate(payload);
    }
  };

  const handleCancel = () => {
    setLocation('/products');
  };

  // Prepare initial data for edit mode
  const productInitialData = isEditMode && product ? {
    name: product.name,
    price: product.price,
    vatRate: product.vatRate || "21.00",
    category: product.category,
    categoryId: product.categoryId?.toString() || "",
    stock: product.stock.toString(),
    barcode: product.barcode || "",
    description: product.description || "",
    imageUrl: product.imageUrl || "",
    // Regulatory compliance fields
    substanceName: product.substanceName || "",
    form: product.form || "",
    subtype: product.subtype || "",
    packageSize: product.packageSize || "",
    receivedDate: product.receivedDate ? new Date(product.receivedDate).toISOString().split('T')[0] : "",
    batchNumber: product.batchNumber || "",
    quantityUnit: product.quantityUnit || "",
    // Psychomodulatory substance compliance fields
    recommendedDoseSingle: product.recommendedDoseSingle || "",
    recommendedDoseDaily: product.recommendedDoseDaily || "",
    dosageInfo: product.dosageInfo || "",
    warningUnder18: product.warningUnder18 || "",
    warningHealth: product.warningHealth || "",
    minAge: product.minAge?.toString() || "",
    adultOnly: product.adultOnly || false,
    consumerInfo: product.consumerInfo || "",
    activeSubstancesComposition: product.activeSubstancesComposition ? 
      JSON.stringify(product.activeSubstancesComposition) : ""
  } : undefined;

  // Prepare initial active substances for edit mode
  const initialActiveSubstances: ProductActiveSubstance[] = isEditMode && product?.activeSubstances && Array.isArray(product.activeSubstances)
    ? product.activeSubstances.map((s: any) => ({
        id: s.id,
        substanceId: s.substanceId,
        substanceName: s.substanceName || s.substance?.name || "",
        contentAmount: s.contentAmount ? String(s.contentAmount) : null,
        contentUnit: s.contentUnit ? String(s.contentUnit) : null,
        concentration: s.concentration ? String(s.concentration) : null,
      }))
    : [];
  
  // Update selected image when product data loads (edit mode)
  useEffect(() => {
    if (productInitialData?.imageUrl) {
      setSelectedImageFromGallery(productInitialData.imageUrl);
    } else if (!isEditMode) {
      // Clear selection when creating new product
      setSelectedImageFromGallery("");
    }
  }, [productInitialData?.imageUrl, isEditMode]);

  if (productLoading || categoriesLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-slate-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4 max-w-5xl">
      <Card className="shadow-lg border-slate-200 dark:border-slate-800">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900">
          <CardTitle className="flex items-center gap-2">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
              {isEditMode ? (
                <Edit className="h-5 w-5 text-white" />
              ) : (
                <Plus className="h-5 w-5 text-white" />
              )}
            </div>
            {isEditMode ? t("products.dialogs.editProduct") : t("products.dialogs.createNewProduct")}
          </CardTitle>
          {isCompanyAdmin && !isEditMode && (
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
              {t("products.dialogs.companyWideProductNote")}
            </p>
          )}
        </CardHeader>
        <CardContent className="p-6">
          <ProductForm
            initialData={productInitialData}
            categories={categories}
            uploadedImages={uploadedImages}
            isEditMode={isEditMode}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isLoading={createProductMutation.isPending || updateProductMutation.isPending}
            onImageGalleryOpen={() => setIsImageGalleryOpen(true)}
            selectedImageFromGallery={selectedImageFromGallery}
            onImageSelected={setSelectedImageFromGallery}
            initialActiveSubstances={initialActiveSubstances}
          />
        </CardContent>
      </Card>

      {/* Image Gallery Dialog */}
      <Dialog open={isImageGalleryOpen} onOpenChange={setIsImageGalleryOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-2 bg-gradient-to-br from-pink-500 to-purple-500 rounded-lg">
                <Palette className="h-4 w-4 text-white" />
              </div>
              Image Gallery
            </DialogTitle>
            <DialogDescription>
              Select an image from your uploaded images
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            {uploadedImages.length === 0 ? (
              <div className="text-center py-12">
                <ImageIcon className="h-16 w-16 mx-auto text-slate-400 mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">No images uploaded</h3>
                <p className="text-slate-500">Upload images to use them in your products</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {uploadedImages.map((imageUrl, index) => (
                  <div
                    key={index}
                    className={`relative aspect-square rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
                      selectedImageFromGallery === imageUrl
                        ? 'border-purple-500 ring-2 ring-purple-200'
                        : 'border-slate-200 hover:border-purple-300'
                    }`}
                    onClick={() => {
                      setSelectedImageFromGallery(imageUrl);
                      setIsImageGalleryOpen(false);
                    }}
                  >
                    <img
                      src={imageUrl}
                      alt={`Gallery image ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    {selectedImageFromGallery === imageUrl && (
                      <div className="absolute inset-0 bg-purple-500/20 flex items-center justify-center">
                        <div className="bg-purple-500 text-white rounded-full p-2">
                          <CheckCircle className="h-5 w-5" />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

