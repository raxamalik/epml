import React, { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ImageIcon, Upload, X } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

export type EditableCompany = {
  id: number;
  name: string;
  registrationNumber: string;
  vatNumber: string | null;
  address: string;
  email: string;
  phone: string;
  contactPerson: string;
  maxBranches: number;
  companyLogo?: string | null;
};

type CompanyEditDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  company: EditableCompany | null;
  onUpdated?: (updatedCompany: any) => void;
};

type EditFormData = {
  name: string;
  registrationNumber: string;
  vatNumber: string;
  address: string;
  email: string;
  phone: string;
  contactPerson: string;
  password: string;
  maxBranches: number;
};

const emptyForm: EditFormData = {
  name: "",
  registrationNumber: "",
  vatNumber: "",
  address: "",
  email: "",
  phone: "",
  contactPerson: "",
  password: "",
  maxBranches: 1,
};

export function CompanyEditDialog({
  isOpen,
  onOpenChange,
  company,
  onUpdated,
}: CompanyEditDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [formData, setFormData] = useState<EditFormData>(emptyForm);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  // Populate form when dialog opens or company changes
  useEffect(() => {
    if (isOpen && company) {
      setFormData({
        name: company.name || "",
        registrationNumber: company.registrationNumber || "",
        vatNumber: company.vatNumber || "",
        address: company.address || "",
        email: company.email || "",
        phone: company.phone || "",
        contactPerson: company.contactPerson || "",
        password: "",
        maxBranches: company.maxBranches || 1,
      });
      setLogoPreview(company.companyLogo || null);
      setLogoFile(null);
    } else if (!isOpen) {
      setFormData(emptyForm);
      setLogoPreview(null);
      setLogoFile(null);
    }
  }, [isOpen, company]);

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please upload an image file",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Logo must be less than 5MB",
        variant: "destructive",
      });
      return;
    }

    setLogoFile(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
  };

  const uploadLogo = async (): Promise<string | null> => {
    if (!logoFile) return null;

    setIsUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append('image', logoFile);

      const response = await fetchWithAuth('/api/upload-image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload logo');
      }

      const data = await response.json();
      return data.imageUrl || data.url;
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast({
        title: "Upload failed",
        description: "Failed to upload company logo",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const updateCompanyMutation = useMutation({
    mutationFn: async (updates: EditFormData & { companyLogo?: string | null }) => {
      if (!company?.id) throw new Error("Company ID is required");
      
      // Upload logo first if a new one was selected
      let logoUrl = updates.companyLogo;
      if (logoFile) {
        const uploadedUrl = await uploadLogo();
        if (uploadedUrl) {
          logoUrl = uploadedUrl;
        }
      }

      const response = await fetchWithAuth(`/api/companies/${company.id}`, {
        method: "PUT",
        body: JSON.stringify({ ...updates, companyLogo: logoUrl }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "" }));
        throw new Error(errorData.message || "");
      }

      return response.json();
    },
    onSuccess: (updatedCompany) => {
      onUpdated?.(updatedCompany);
      onOpenChange(false);
      toast({
        title: t("success.updated"),
        description: t("companyManagement.toasts.updated"),
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

  const handleSubmit = () => {
    if (!company) return;
    updateCompanyMutation.mutate({ 
      ...formData, 
      companyLogo: logoPreview || company.companyLogo || null 
    });
  };

  if (!company) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("companyEdit.title")}</DialogTitle>
        </DialogHeader>
        
        {/* Logo Upload Section */}
        <div className="space-y-2">
          <Label>{t("companyForm.companyLogo") || "Company Logo"}</Label>
          <div className="flex items-center gap-4">
            {logoPreview ? (
              <div className="relative">
                <img 
                  src={logoPreview} 
                  alt="Company logo preview" 
                  className="w-24 h-24 object-cover rounded-lg border-2 border-slate-200"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="absolute -top-2 -right-2 rounded-full w-6 h-6 p-0"
                  onClick={handleRemoveLogo}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <div className="w-24 h-24 border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center bg-slate-50">
                <ImageIcon className="h-8 w-8 text-slate-400" />
              </div>
            )}
            <div className="flex-1">
              <Input
                type="file"
                accept="image/*"
                onChange={handleLogoChange}
                className="hidden"
                id="logo-upload"
                disabled={isUploadingLogo}
              />
              <Label htmlFor="logo-upload" className="cursor-pointer">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={isUploadingLogo}
                  asChild
                >
                  <span>
                    <Upload className="h-4 w-4 mr-2" />
                    {logoFile ? "Change Logo" : "Upload Logo"}
                  </span>
                </Button>
              </Label>
              <p className="text-xs text-slate-500 mt-1">
                Recommended: Square image, max 5MB
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="editName">{t("companyForm.companyName")}</Label>
            <Input
              id="editName"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="editRegNumber">{t("companyForm.registrationNumber")}</Label>
            <Input
              id="editRegNumber"
              value={formData.registrationNumber}
              onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="editVatNumber">{t("companyForm.vatNumber")}</Label>
            <Input
              id="editVatNumber"
              value={formData.vatNumber}
              onChange={(e) => setFormData({ ...formData, vatNumber: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="editEmail">{t("companyForm.email")}</Label>
            <Input
              id="editEmail"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>
          <div className="col-span-2">
            <Label htmlFor="editAddress">{t("companyForm.address")}</Label>
            <Textarea
              id="editAddress"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="editPhone">{t("companyForm.phone")}</Label>
            <Input
              id="editPhone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="editContactPerson">{t("companyForm.contactPerson")}</Label>
            <Input
              id="editContactPerson"
              value={formData.contactPerson}
              onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="editPassword">{t("companyForm.password")}</Label>
            <Input
              id="editPassword"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder={t("companyForm.passwordPlaceholder")}
            />
          </div>
          <div>
            <Label htmlFor="editMaxBranches">{t("companyForm.maxBranches")}</Label>
            <Input
              id="editMaxBranches"
              type="number"
              min="1"
              value={formData.maxBranches}
              onChange={(e) => setFormData({ ...formData, maxBranches: parseInt(e.target.value) || 1 })}
            />
          </div>
        </div>
        
        <div className="flex justify-end space-x-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={updateCompanyMutation.isPending || isUploadingLogo}
          >
            {updateCompanyMutation.isPending || isUploadingLogo ? t("companyEdit.updating") : t("companyEdit.updateButton")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
