import { UseFormReturn } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CompanyFormData } from "@/lib/utils/validation";
import { useTranslation } from "@/hooks/useTranslation";

interface CompanyFormProps {
  form: UseFormReturn<CompanyFormData>;
  mode?: "create" | "edit";
}

export function CompanyForm({ form, mode = "create" }: CompanyFormProps) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="col-span-2">
        <Label htmlFor="name">{t("companyForm.companyName")}</Label>
        <Input
          id="name"
          placeholder={t("companyForm.companyNamePlaceholder")}
          {...form.register("name")}
        />
        {form.formState.errors.name && (
          <p className="text-sm text-red-500 mt-1">{form.formState.errors.name.message}</p>
        )}
      </div>
      
      <div>
        <Label htmlFor="registrationNumber">{t("companyForm.registrationNumber")}</Label>
        <Input
          id="registrationNumber"
          placeholder={t("companyForm.registrationNumberPlaceholder")}
          {...form.register("registrationNumber")}
        />
        {form.formState.errors.registrationNumber && (
          <p className="text-sm text-red-500 mt-1">{form.formState.errors.registrationNumber.message}</p>
        )}
      </div>
      
      <div>
        <Label htmlFor="vatNumber">{t("companyForm.vatNumber")}</Label>
        <Input
          id="vatNumber"
          placeholder={t("companyForm.vatNumberPlaceholder")}
          {...form.register("vatNumber")}
        />
        {form.formState.errors.vatNumber && (
          <p className="text-sm text-red-500 mt-1">{form.formState.errors.vatNumber.message}</p>
        )}
      </div>
      
      <div className="col-span-2">
        <Label htmlFor="address">{t("companyForm.address")}</Label>
        <Textarea
          id="address"
          placeholder={t("companyForm.addressPlaceholder")}
          rows={2}
          {...form.register("address")}
        />
        {form.formState.errors.address && (
          <p className="text-sm text-red-500 mt-1">{form.formState.errors.address.message}</p>
        )}
      </div>
      
      <div>
        <Label htmlFor="email">{t("companyForm.email")}</Label>
        <Input
          id="email"
          type="email"
          placeholder={t("companyForm.emailPlaceholder")}
          {...form.register("email")}
        />
        {form.formState.errors.email && (
          <p className="text-sm text-red-500 mt-1">{form.formState.errors.email.message}</p>
        )}
      </div>
      
      <div>
        <Label htmlFor="phone">{t("companyForm.phone")}</Label>
        <Input
          id="phone"
          placeholder={t("companyForm.phonePlaceholder")}
          {...form.register("phone")}
        />
        {form.formState.errors.phone && (
          <p className="text-sm text-red-500 mt-1">{form.formState.errors.phone.message}</p>
        )}
      </div>
      
      <div>
        <Label htmlFor="contactPerson">{t("companyForm.contactPerson")}</Label>
        <Input
          id="contactPerson"
          placeholder={t("companyForm.contactPersonPlaceholder")}
          {...form.register("contactPerson")}
        />
        {form.formState.errors.contactPerson && (
          <p className="text-sm text-red-500 mt-1">{form.formState.errors.contactPerson.message}</p>
        )}
      </div>
      
      {mode === "create" && (
        <div>
          <Label htmlFor="password">{t("companyForm.password")}</Label>
          <Input
            id="password"
            type="password"
            placeholder={t("companyForm.passwordPlaceholder")}
            {...form.register("password")}
          />
          {form.formState.errors.password && (
            <p className="text-sm text-red-500 mt-1">{form.formState.errors.password.message}</p>
          )}
        </div>
      )}
      
      <div>
        <Label htmlFor="maxBranches">{t("companyForm.maxBranches")}</Label>
        <Input
          id="maxBranches"
          type="number"
          min="1"
          {...form.register("maxBranches", { valueAsNumber: true })}
        />
        {form.formState.errors.maxBranches && (
          <p className="text-sm text-red-500 mt-1">{form.formState.errors.maxBranches.message}</p>
        )}
      </div>
    </div>
  );
}

