import React, { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
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
    } else if (!isOpen) {
      setFormData(emptyForm);
    }
  }, [isOpen, company]);

  const updateCompanyMutation = useMutation({
    mutationFn: async (updates: EditFormData) => {
      if (!company?.id) throw new Error("Company ID is required");
      const response = await fetchWithAuth(`/api/companies/${company.id}`, {
        method: "PUT",
        body: JSON.stringify(updates),
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
    updateCompanyMutation.mutate(formData);
  };

  if (!company) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("companyEdit.title")}</DialogTitle>
        </DialogHeader>
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
            disabled={updateCompanyMutation.isPending}
          >
            {updateCompanyMutation.isPending ? t("companyEdit.updating") : t("companyEdit.updateButton")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
