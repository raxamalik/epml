import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ImageIcon,
  Palette,
  Plus,
  Edit,
} from "lucide-react";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { ProductActiveSubstancesList, ProductActiveSubstance } from "./ProductActiveSubstancesList";
import { AddActiveSubstanceDialog } from "./AddActiveSubstanceDialog";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/hooks/useTranslation";

interface ProductFormData {
  name: string;
  price: string;
  vatRate: string;
  category: string;
  categoryId: string;
  stock: string;
  barcode: string;
  description: string;
  imageUrl: string;
  // Regulatory compliance fields
  substanceName: string;
  form: string;
  subtype: string;
  packageSize: string;
  receivedDate: string;
  batchNumber: string;
  quantityUnit: string;
  // Psychomodulatory substance compliance fields
  recommendedDoseSingle: string;
  recommendedDoseDaily: string;
  dosageInfo: string;
  warningUnder18: string;
  warningHealth: string;
  minAge: string;
  adultOnly: boolean;
  consumerInfo: string;
  activeSubstancesComposition: string;
}

interface ProductCategory {
  id: number;
  name: string;
  description?: string;
}

interface ProductFormProps {
  initialData?: Partial<ProductFormData>;
  categories: ProductCategory[];
  uploadedImages?: string[];
  isEditMode?: boolean;
  onSubmit: (data: ProductFormData, imageUrl: string, activeSubstances: ProductActiveSubstance[]) => void;
  onCancel: () => void;
  isLoading?: boolean;
  onImageGalleryOpen?: () => void;
  selectedImageFromGallery?: string;
  onImageSelected?: (imageUrl: string) => void;
  initialActiveSubstances?: ProductActiveSubstance[];
}

export function ProductForm({
  initialData,
  categories,
  uploadedImages = [],
  isEditMode = false,
  onSubmit,
  onCancel,
  isLoading = false,
  onImageGalleryOpen,
  selectedImageFromGallery: externalSelectedImage,
  onImageSelected,
  initialActiveSubstances = [],
}: ProductFormProps) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [isAddSubstanceDialogOpen, setIsAddSubstanceDialogOpen] = useState(false);
  const [activeSubstances, setActiveSubstances] = useState<ProductActiveSubstance[]>(initialActiveSubstances);
  const [formData, setFormData] = useState<ProductFormData>({
    name: initialData?.name || "",
    price: initialData?.price || "",
    vatRate: initialData?.vatRate || "21.00",
    category: initialData?.category || "",
    categoryId: initialData?.categoryId || "",
    stock: initialData?.stock || "",
    barcode: initialData?.barcode || "",
    description: initialData?.description || "",
    imageUrl: initialData?.imageUrl || "",
    // Regulatory compliance fields
    substanceName: initialData?.substanceName || "",
    form: initialData?.form || "",
    subtype: initialData?.subtype || "",
    packageSize: initialData?.packageSize || "",
    receivedDate: initialData?.receivedDate || "",
    batchNumber: initialData?.batchNumber || "",
    quantityUnit: initialData?.quantityUnit || "",
    // Psychomodulatory substance compliance fields
    recommendedDoseSingle: initialData?.recommendedDoseSingle || "",
    recommendedDoseDaily: initialData?.recommendedDoseDaily || "",
    dosageInfo: initialData?.dosageInfo || "",
    warningUnder18: initialData?.warningUnder18 || "",
    warningHealth: initialData?.warningHealth || "",
    minAge: initialData?.minAge || "",
    adultOnly: initialData?.adultOnly || false,
    consumerInfo: initialData?.consumerInfo || "",
    activeSubstancesComposition: initialData?.activeSubstancesComposition || "",
  });

  const [uploadedImageUrl, setUploadedImageUrl] = useState(initialData?.imageUrl || "");
  const [selectedImageFromGallery, setSelectedImageFromGallery] = useState(externalSelectedImage || initialData?.imageUrl || "");
  
  // Update selected image when external prop changes
  useEffect(() => {
    if (externalSelectedImage !== undefined) {
      setSelectedImageFromGallery(externalSelectedImage);
      // Clear uploaded image when gallery image is selected
      if (externalSelectedImage) {
        setUploadedImageUrl("");
      }
    }
  }, [externalSelectedImage]);

  const handleImageUpload = async (file: File) => {
    const formDataObj = new FormData();
    formDataObj.append('image', file);

    try {
      const response = await fetchWithAuth('/api/upload-image', {
        method: 'POST',
        body: formDataObj,
      });
      
      if (!response.ok) {
        // Try to extract error message from response
        const errorData = await response.json().catch(() => ({ 
          error: 'Upload failed', 
          message: 'Failed to upload image. Please try again.' 
        }));
        throw new Error(errorData.message || errorData.error || 'Upload failed');
      }
      
      const data = await response.json();
      const imageUrl = data.url || data.imageUrl;
      setUploadedImageUrl(imageUrl);
      // Clear gallery selection when uploading new image
      setSelectedImageFromGallery("");
      // Notify parent component to clear gallery selection
      if (onImageSelected) {
        onImageSelected("");
      }
      toast({ title: t("products.toasts.imageUploadedSuccess") });
    } catch (error: any) {
      console.error('Image upload error:', error);
      // Show toast notification with error message
      toast({ 
        title: t("products.toasts.imageUploadFailed"), 
        description: error.message || t("products.toasts.imageUploadErrorDesc"),
        variant: "destructive" 
      });
    }
  };

  useEffect(() => {
    setActiveSubstances(initialActiveSubstances);
  }, [initialActiveSubstances]);

  const handleAddSubstance = (substance: {
    substanceId: number;
    substanceName: string;
    contentAmount: string | null;
    contentUnit: string | null;
    concentration: string | null;
  }) => {
    setActiveSubstances([
      ...activeSubstances,
      {
        substanceId: substance.substanceId,
        substanceName: substance.substanceName,
        contentAmount: substance.contentAmount,
        contentUnit: substance.contentUnit,
        concentration: substance.concentration,
      },
    ]);
  };

  const handleRemoveSubstance = (index: number) => {
    setActiveSubstances(activeSubstances.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.price || !formData.categoryId) {
      return;
    }
    const imageUrl = uploadedImageUrl || selectedImageFromGallery;
    onSubmit(formData, imageUrl, activeSubstances);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Product Image */}
      <div className="space-y-4">
        <Label className="text-base font-medium">{t("products.dialogs.productImage")}</Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <Label className="text-sm">{t("products.dialogs.uploadNewImage")}</Label>
            <div>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleImageUpload(file);
                  }
                }}
                className="hidden"
                id="product-image-upload"
              />
              <Button 
                type="button"
                variant="outline" 
                onClick={() => document.getElementById('product-image-upload')?.click()}
                className="w-full h-32 border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-purple-400 dark:hover:border-purple-500 bg-slate-50 dark:bg-slate-800 flex flex-col items-center justify-center"
              >
                <ImageIcon className="h-8 w-8 text-slate-400 mb-2" />
                <span className="text-sm text-slate-500">{t("products.dialogs.clickToUpload")}</span>
              </Button>
            </div>
          </div>
          
          <div className="space-y-3">
            <Label className="text-sm">{t("products.dialogs.orSelectFromGallery")}</Label>
            <Button
              type="button"
              variant="outline"
              onClick={onImageGalleryOpen}
              className="w-full h-32 border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-purple-400 dark:hover:border-purple-500"
            >
              <div className="flex flex-col items-center">
                <Palette className="h-8 w-8 text-slate-400 mb-2" />
                <span className="text-sm text-slate-500">{t("products.dialogs.browseGallery")}</span>
              </div>
            </Button>
          </div>
        </div>
        
        {(uploadedImageUrl || selectedImageFromGallery) && (
          <div className="space-y-2">
            <Label className="text-sm">{t("products.dialogs.selectedImagePreview")}</Label>
            <div className="w-32 h-32 rounded-lg overflow-hidden border">
              <img
                src={uploadedImageUrl || selectedImageFromGallery}
                alt="Preview"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        )}
      </div>

      <Separator />

      {/* Product Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">{t("products.dialogs.productName")}</Label>
          <Input
            id="name"
            placeholder={t("products.dialogs.productNamePlaceholder")}
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="bg-slate-50 dark:bg-slate-800"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">{t("products.dialogs.category")}</Label>
          <Select value={formData.categoryId} onValueChange={(value) => {
            setFormData({ ...formData, categoryId: value });
            const selectedCat = categories.find(cat => cat.id.toString() === value);
            if (selectedCat) {
              setFormData(prev => ({ ...prev, category: selectedCat.name }));
            }
          }}>
            <SelectTrigger className="bg-slate-50 dark:bg-slate-800">
              <SelectValue placeholder={t("products.dialogs.selectCategory")} />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category: ProductCategory) => (
                <SelectItem key={category.id} value={category.id.toString()}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="price">{t("products.dialogs.price")}</Label>
          <Input
            id="price"
            type="number"
            step="0.01"
            placeholder={t("products.dialogs.pricePlaceholder")}
            value={formData.price}
            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
            className="bg-slate-50 dark:bg-slate-800"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="vatRate">{t("products.dialogs.vatRate")}</Label>
          <Input
            id="vatRate"
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={formData.vatRate}
            onChange={(e) => setFormData({ ...formData, vatRate: e.target.value })}
            placeholder={t("products.dialogs.vatRatePlaceholder")}
            className="bg-slate-50 dark:bg-slate-800"
            required
          />
          <p className="text-xs text-muted-foreground">
            {t("products.dialogs.vatRateHint")}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="stock">{t("products.dialogs.stockQuantity")}</Label>
          <Input
            id="stock"
            type="number"
            placeholder={t("products.dialogs.stockQuantityPlaceholder")}
            value={formData.stock}
            onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
            className="bg-slate-50 dark:bg-slate-800"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="barcode">{t("products.dialogs.barcode")}</Label>
          <Input
            id="barcode"
            placeholder={t("products.dialogs.barcodePlaceholder")}
            value={formData.barcode}
            onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
            className="bg-slate-50 dark:bg-slate-800"
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="description">{t("products.dialogs.description")}</Label>
          <Textarea
            id="description"
            placeholder={t("products.dialogs.descriptionPlaceholder")}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="bg-slate-50 dark:bg-slate-800"
            rows={3}
          />
        </div>
      </div>

      <Separator />

      {/* Regulatory Compliance Fields */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{t("products.dialogs.regulatoryCompliance")}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="substanceName">{t("products.dialogs.substanceName")}</Label>
            <Input
              id="substanceName"
              placeholder={t("products.dialogs.substanceNamePlaceholder")}
              value={formData.substanceName}
              onChange={(e) => setFormData({ ...formData, substanceName: e.target.value })}
              className="bg-slate-50 dark:bg-slate-800"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="form">{t("products.dialogs.productForm")}</Label>
            <Select value={formData.form} onValueChange={(value) => setFormData({ ...formData, form: value })}>
              <SelectTrigger className="bg-slate-50 dark:bg-slate-800">
                <SelectValue placeholder={t("products.dialogs.selectForm")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="liquid">{t("products.dialogs.formLiquid")}</SelectItem>
                <SelectItem value="tablet">{t("products.dialogs.formTablet")}</SelectItem>
                <SelectItem value="powder">{t("products.dialogs.formPowder")}</SelectItem>
                <SelectItem value="capsule">{t("products.dialogs.formCapsule")}</SelectItem>
                <SelectItem value="other">{t("products.dialogs.formOther")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subtype">{t("products.dialogs.subtype")}</Label>
            <Input
              id="subtype"
              placeholder={t("products.dialogs.subtypePlaceholder")}
              value={formData.subtype}
              onChange={(e) => setFormData({ ...formData, subtype: e.target.value })}
              className="bg-slate-50 dark:bg-slate-800"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="packageSize">{t("products.dialogs.packageSize")}</Label>
            <Input
              id="packageSize"
              placeholder={t("products.dialogs.packageSizePlaceholder")}
              value={formData.packageSize}
              onChange={(e) => setFormData({ ...formData, packageSize: e.target.value })}
              className="bg-slate-50 dark:bg-slate-800"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="receivedDate">{t("products.dialogs.receivedDate")}</Label>
            <Input
              id="receivedDate"
              type="date"
              value={formData.receivedDate}
              onChange={(e) => setFormData({ ...formData, receivedDate: e.target.value })}
              className="bg-slate-50 dark:bg-slate-800"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="batchNumber">{t("products.dialogs.batchNumber")}</Label>
            <Input
              id="batchNumber"
              placeholder={t("products.dialogs.batchNumberPlaceholder")}
              value={formData.batchNumber}
              onChange={(e) => setFormData({ ...formData, batchNumber: e.target.value })}
              className="bg-slate-50 dark:bg-slate-800"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantityUnit">{t("products.dialogs.quantityUnit")}</Label>
            <Select value={formData.quantityUnit} onValueChange={(value) => setFormData({ ...formData, quantityUnit: value })}>
              <SelectTrigger className="bg-slate-50 dark:bg-slate-800">
                <SelectValue placeholder={t("products.dialogs.selectUnit")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pcs">{t("products.dialogs.unitPcs")}</SelectItem>
                <SelectItem value="ml">{t("products.dialogs.unitMl")}</SelectItem>
                <SelectItem value="g">{t("products.dialogs.unitG")}</SelectItem>
                <SelectItem value="kg">{t("products.dialogs.unitKg")}</SelectItem>
                <SelectItem value="l">{t("products.dialogs.unitL")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Separator />

      {/* Psychomodulatory Substance Compliance Fields */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{t("products.dialogs.dosageInformation")}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="recommendedDoseSingle">{t("products.dialogs.recommendedSingleDose")}</Label>
            <Input
              id="recommendedDoseSingle"
              placeholder={t("products.dialogs.recommendedSingleDosePlaceholder")}
              value={formData.recommendedDoseSingle}
              onChange={(e) => setFormData({ ...formData, recommendedDoseSingle: e.target.value })}
              className="bg-slate-50 dark:bg-slate-800"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="recommendedDoseDaily">{t("products.dialogs.recommendedDailyDose")}</Label>
            <Input
              id="recommendedDoseDaily"
              placeholder={t("products.dialogs.recommendedDailyDosePlaceholder")}
              value={formData.recommendedDoseDaily}
              onChange={(e) => setFormData({ ...formData, recommendedDoseDaily: e.target.value })}
              className="bg-slate-50 dark:bg-slate-800"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="dosageInfo">{t("products.dialogs.dosageInfoAlternative")}</Label>
            <Textarea
              id="dosageInfo"
              placeholder={t("products.dialogs.dosageInfoAlternativePlaceholder")}
              value={formData.dosageInfo}
              onChange={(e) => setFormData({ ...formData, dosageInfo: e.target.value })}
              className="bg-slate-50 dark:bg-slate-800"
              rows={2}
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Warnings and Age Restrictions */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{t("products.dialogs.warningsAgeRestrictions")}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="warningUnder18">{t("products.dialogs.warningUnder18")}</Label>
            <Textarea
              id="warningUnder18"
              placeholder={t("products.dialogs.warningUnder18Placeholder")}
              value={formData.warningUnder18}
              onChange={(e) => setFormData({ ...formData, warningUnder18: e.target.value })}
              className="bg-slate-50 dark:bg-slate-800"
              rows={2}
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="warningHealth">{t("products.dialogs.healthWarning")}</Label>
            <Textarea
              id="warningHealth"
              placeholder={t("products.dialogs.healthWarningPlaceholder")}
              value={formData.warningHealth}
              onChange={(e) => setFormData({ ...formData, warningHealth: e.target.value })}
              className="bg-slate-50 dark:bg-slate-800"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="minAge">{t("products.dialogs.minAge")}</Label>
            <Input
              id="minAge"
              type="number"
              min="0"
              max="100"
              placeholder={t("products.dialogs.minAgePlaceholder")}
              value={formData.minAge}
              onChange={(e) => setFormData({ ...formData, minAge: e.target.value })}
              className="bg-slate-50 dark:bg-slate-800"
            />
          </div>

          <div className="space-y-2 flex items-end">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="adultOnly"
                checked={formData.adultOnly}
                onCheckedChange={(checked) => setFormData({ ...formData, adultOnly: checked === true })}
              />
              <Label htmlFor="adultOnly" className="cursor-pointer">
                {t("products.dialogs.adultOnlyProduct")}
              </Label>
            </div>
          </div>
        </div>
      </div>

      <Separator />

      {/* Consumer Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{t("products.dialogs.consumerInformation")}</h3>
        <div className="space-y-2">
          <Label htmlFor="consumerInfo">{t("products.dialogs.consumerInfo")}</Label>
          <Textarea
            id="consumerInfo"
            placeholder={t("products.dialogs.consumerInfoPlaceholder")}
            value={formData.consumerInfo}
            onChange={(e) => setFormData({ ...formData, consumerInfo: e.target.value })}
            className="bg-slate-50 dark:bg-slate-800"
            rows={4}
          />
        </div>

      </div>

      <Separator />

      {/* Active Substances Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{t("products.dialogs.activeSubstancesTitle")}</h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsAddSubstanceDialogOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            {t("products.dialogs.activeSubstancesComposition")}
          </Button>
        </div>

        <ProductActiveSubstancesList
          substances={activeSubstances}
          onRemove={handleRemoveSubstance}
        />

        <AddActiveSubstanceDialog
          open={isAddSubstanceDialogOpen}
          onOpenChange={setIsAddSubstanceDialogOpen}
          onAdd={handleAddSubstance}
          existingSubstanceIds={activeSubstances.map((s) => s.substanceId)}
        />
      </div>

      {/* Form Actions */}
      <div className="flex justify-end gap-4 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          {t("common.cancel")}
        </Button>
        <Button
          type="submit"
          disabled={isLoading || !formData.name || !formData.price || !formData.categoryId}
          className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
        >
          {isLoading ? (
            <>{isEditMode ? t("products.dialogs.updating") : t("products.dialogs.creating")}</>
          ) : (
            <>
              {isEditMode ? (
                <>
                  <Edit className="h-4 w-4 mr-2" />
                  {t("products.dialogs.updateProduct")}
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  {t("products.dialogs.createProduct")}
                </>
              )}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

