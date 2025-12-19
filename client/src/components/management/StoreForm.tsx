import { UseFormReturn } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { StoreFormData } from "@/lib/utils/validation";
import { useTranslation } from "@/hooks/useTranslation";

interface StoreFormProps {
  form: UseFormReturn<StoreFormData>;
  mode?: "create" | "edit";
}

export function StoreForm({ form, mode = "create" }: StoreFormProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="name">{t("storeForm.name")}</Label>
        <Input
          id="name"
          placeholder={t("storeForm.namePlaceholder")}
          {...form.register("name")}
        />
        {form.formState.errors.name && (
          <p className="text-sm text-red-500 mt-1">{form.formState.errors.name.message}</p>
        )}
      </div>

      <div>
        <Label htmlFor="address">{t("storeForm.address")}</Label>
        <Textarea
          id="address"
          placeholder={t("storeForm.addressPlaceholder")}
          rows={2}
          {...form.register("address")}
        />
        {form.formState.errors.address && (
          <p className="text-sm text-red-500 mt-1">{form.formState.errors.address.message}</p>
        )}
      </div>

      <div>
        <Label htmlFor="phone">{t("storeForm.phone")}</Label>
        <Input
          id="phone"
          placeholder={t("storeForm.phonePlaceholder")}
          {...form.register("phone")}
        />
        {form.formState.errors.phone && (
          <p className="text-sm text-red-500 mt-1">{form.formState.errors.phone.message}</p>
        )}
      </div>

      {mode === "create" && (
        <>
          <div className="pt-4 border-t">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
              {t("storeForm.ownerSectionTitle")}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              {t("storeForm.ownerSectionDesc")}
            </p>
            
            <div>
              <Label htmlFor="ownerEmail">{t("storeForm.ownerEmail")}</Label>
              <Input
                id="ownerEmail"
                type="email"
                placeholder={t("storeForm.ownerEmailPlaceholder")}
                {...form.register("ownerEmail")}
              />
              {form.formState.errors.ownerEmail && (
                <p className="text-sm text-red-500 mt-1">{form.formState.errors.ownerEmail.message}</p>
              )}
            </div>

            <div className="mt-4">
              <Label htmlFor="ownerPassword">{t("storeForm.ownerPassword")}</Label>
              <Input
                id="ownerPassword"
                type="password"
                placeholder={t("storeForm.ownerPasswordPlaceholder")}
                {...form.register("ownerPassword")}
              />
              {form.formState.errors.ownerPassword && (
                <p className="text-sm text-red-500 mt-1">{form.formState.errors.ownerPassword.message}</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

