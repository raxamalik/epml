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
      toast({ title: "Image uploaded successfully!" });
    } catch (error: any) {
      console.error('Image upload error:', error);
      // Show toast notification with error message
      toast({ 
        title: "Failed to upload image", 
        description: error.message || "An error occurred while uploading the image. Please try again.",
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
        <Label className="text-base font-medium">Product Image</Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <Label className="text-sm">Upload New Image</Label>
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
                <span className="text-sm text-slate-500">Click to upload image</span>
              </Button>
            </div>
          </div>
          
          <div className="space-y-3">
            <Label className="text-sm">Or Select from Gallery</Label>
            <Button
              type="button"
              variant="outline"
              onClick={onImageGalleryOpen}
              className="w-full h-32 border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-purple-400 dark:hover:border-purple-500"
            >
              <div className="flex flex-col items-center">
                <Palette className="h-8 w-8 text-slate-400 mb-2" />
                <span className="text-sm text-slate-500">Browse Gallery</span>
              </div>
            </Button>
          </div>
        </div>
        
        {(uploadedImageUrl || selectedImageFromGallery) && (
          <div className="space-y-2">
            <Label className="text-sm">Selected Image Preview</Label>
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
          <Label htmlFor="name">Product Name *</Label>
          <Input
            id="name"
            placeholder="Enter product name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="bg-slate-50 dark:bg-slate-800"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">Category *</Label>
          <Select value={formData.categoryId} onValueChange={(value) => {
            setFormData({ ...formData, categoryId: value });
            const selectedCat = categories.find(cat => cat.id.toString() === value);
            if (selectedCat) {
              setFormData(prev => ({ ...prev, category: selectedCat.name }));
            }
          }}>
            <SelectTrigger className="bg-slate-50 dark:bg-slate-800">
              <SelectValue placeholder="Select category" />
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
          <Label htmlFor="price">Price *</Label>
          <Input
            id="price"
            type="number"
            step="0.01"
            placeholder="0.00"
            value={formData.price}
            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
            className="bg-slate-50 dark:bg-slate-800"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="vatRate">VAT Rate (%) *</Label>
          <Input
            id="vatRate"
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={formData.vatRate}
            onChange={(e) => setFormData({ ...formData, vatRate: e.target.value })}
            placeholder="Enter VAT rate (e.g., 6 for 6%, 21 for 21%)"
            className="bg-slate-50 dark:bg-slate-800"
            required
          />
          <p className="text-xs text-muted-foreground">
            Enter percentage (e.g., 6 for 6%, 21 for 21%)
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="stock">Stock Quantity</Label>
          <Input
            id="stock"
            type="number"
            placeholder="0"
            value={formData.stock}
            onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
            className="bg-slate-50 dark:bg-slate-800"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="barcode">Barcode</Label>
          <Input
            id="barcode"
            placeholder="Enter barcode"
            value={formData.barcode}
            onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
            className="bg-slate-50 dark:bg-slate-800"
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            placeholder="Enter product description"
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
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Regulatory Compliance</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="substanceName">Substance Name</Label>
            <Input
              id="substanceName"
              placeholder="Name of the substance (according to government regulation)"
              value={formData.substanceName}
              onChange={(e) => setFormData({ ...formData, substanceName: e.target.value })}
              className="bg-slate-50 dark:bg-slate-800"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="form">Product Form</Label>
            <Select value={formData.form} onValueChange={(value) => setFormData({ ...formData, form: value })}>
              <SelectTrigger className="bg-slate-50 dark:bg-slate-800">
                <SelectValue placeholder="Select form" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="liquid">Liquid</SelectItem>
                <SelectItem value="tablet">Tablet</SelectItem>
                <SelectItem value="powder">Powder</SelectItem>
                <SelectItem value="capsule">Capsule</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subtype">Subtype</Label>
            <Input
              id="subtype"
              placeholder="More specific product subtype (if applicable)"
              value={formData.subtype}
              onChange={(e) => setFormData({ ...formData, subtype: e.target.value })}
              className="bg-slate-50 dark:bg-slate-800"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="packageSize">Package Size</Label>
            <Input
              id="packageSize"
              placeholder="e.g. 500ml, 30 tablets"
              value={formData.packageSize}
              onChange={(e) => setFormData({ ...formData, packageSize: e.target.value })}
              className="bg-slate-50 dark:bg-slate-800"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="receivedDate">Received Date</Label>
            <Input
              id="receivedDate"
              type="date"
              value={formData.receivedDate}
              onChange={(e) => setFormData({ ...formData, receivedDate: e.target.value })}
              className="bg-slate-50 dark:bg-slate-800"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="batchNumber">Batch Number</Label>
            <Input
              id="batchNumber"
              placeholder="Batch or lot number"
              value={formData.batchNumber}
              onChange={(e) => setFormData({ ...formData, batchNumber: e.target.value })}
              className="bg-slate-50 dark:bg-slate-800"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantityUnit">Quantity Unit</Label>
            <Select value={formData.quantityUnit} onValueChange={(value) => setFormData({ ...formData, quantityUnit: value })}>
              <SelectTrigger className="bg-slate-50 dark:bg-slate-800">
                <SelectValue placeholder="Select unit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pcs">Pieces (pcs)</SelectItem>
                <SelectItem value="ml">Milliliters (ml)</SelectItem>
                <SelectItem value="g">Grams (g)</SelectItem>
                <SelectItem value="kg">Kilograms (kg)</SelectItem>
                <SelectItem value="l">Liters (l)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Separator />

      {/* Psychomodulatory Substance Compliance Fields */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Dosage Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="recommendedDoseSingle">Recommended Single Dose</Label>
            <Input
              id="recommendedDoseSingle"
              placeholder="e.g. 2 g"
              value={formData.recommendedDoseSingle}
              onChange={(e) => setFormData({ ...formData, recommendedDoseSingle: e.target.value })}
              className="bg-slate-50 dark:bg-slate-800"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="recommendedDoseDaily">Recommended Daily Dose</Label>
            <Input
              id="recommendedDoseDaily"
              placeholder="e.g. 4 g"
              value={formData.recommendedDoseDaily}
              onChange={(e) => setFormData({ ...formData, recommendedDoseDaily: e.target.value })}
              className="bg-slate-50 dark:bg-slate-800"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="dosageInfo">Dosage Info (Alternative)</Label>
            <Textarea
              id="dosageInfo"
              placeholder="Combined dose info in free text (alternative to single/daily dose fields)"
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
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Warnings & Age Restrictions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="warningUnder18">Warning for Under 18</Label>
            <Textarea
              id="warningUnder18"
              placeholder='Legal text: "Not intended for persons under 18..."'
              value={formData.warningUnder18}
              onChange={(e) => setFormData({ ...formData, warningUnder18: e.target.value })}
              className="bg-slate-50 dark:bg-slate-800"
              rows={2}
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="warningHealth">Health Warning</Label>
            <Textarea
              id="warningHealth"
              placeholder='Legal text: "Use of this product may harm your health..."'
              value={formData.warningHealth}
              onChange={(e) => setFormData({ ...formData, warningHealth: e.target.value })}
              className="bg-slate-50 dark:bg-slate-800"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="minAge">Minimum Age</Label>
            <Input
              id="minAge"
              type="number"
              min="0"
              max="100"
              placeholder="e.g. 18"
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
                Adult Only Product
              </Label>
            </div>
          </div>
        </div>
      </div>

      <Separator />

      {/* Consumer Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Consumer Information</h3>
        <div className="space-y-2">
          <Label htmlFor="consumerInfo">Consumer Info</Label>
          <Textarea
            id="consumerInfo"
            placeholder="Full consumer info (effects, risks, usage instructions)"
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
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Active Substances</h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsAddSubstanceDialogOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Active Substance
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
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isLoading || !formData.name || !formData.price || !formData.categoryId}
          className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
        >
          {isLoading ? (
            <>{isEditMode ? "Updating..." : "Creating..."}</>
          ) : (
            <>
              {isEditMode ? (
                <>
                  <Edit className="h-4 w-4 mr-2" />
                  Update Product
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Product
                </>
              )}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

