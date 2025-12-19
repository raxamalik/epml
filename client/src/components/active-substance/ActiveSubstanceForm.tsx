import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Plus, Edit } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

interface ActiveSubstanceFormData {
  name: string;
  maxSingleDose: string;
  maxDailyDose: string;
  maxConcentration: string;
}

interface ActiveSubstanceFormProps {
  initialData?: Partial<ActiveSubstanceFormData>;
  isEditMode?: boolean;
  onSubmit: (data: ActiveSubstanceFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function ActiveSubstanceForm({
  initialData,
  isEditMode = false,
  onSubmit,
  onCancel,
  isLoading = false,
}: ActiveSubstanceFormProps) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<ActiveSubstanceFormData>({
    name: initialData?.name || "",
    maxSingleDose: initialData?.maxSingleDose || "",
    maxDailyDose: initialData?.maxDailyDose || "",
    maxConcentration: initialData?.maxConcentration || "",
  });

  const [errors, setErrors] = useState<Partial<Record<keyof ActiveSubstanceFormData, string>>>({});

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || "",
        maxSingleDose: initialData.maxSingleDose || "",
        maxDailyDose: initialData.maxDailyDose || "",
        maxConcentration: initialData.maxConcentration || "",
      });
    }
  }, [initialData]);

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof ActiveSubstanceFormData, string>> = {};

    if (!formData.name.trim()) {
      newErrors.name = t("activeSubstanceForm.nameRequired");
    }

    if (formData.maxSingleDose && (isNaN(parseFloat(formData.maxSingleDose)) || parseFloat(formData.maxSingleDose) < 0)) {
      newErrors.maxSingleDose = t("activeSubstanceForm.invalidNumber");
    }

    if (formData.maxDailyDose && (isNaN(parseFloat(formData.maxDailyDose)) || parseFloat(formData.maxDailyDose) < 0)) {
      newErrors.maxDailyDose = t("activeSubstanceForm.invalidNumber");
    }

    if (formData.maxConcentration && (isNaN(parseFloat(formData.maxConcentration)) || parseFloat(formData.maxConcentration) < 0 || parseFloat(formData.maxConcentration) > 100)) {
      newErrors.maxConcentration = t("activeSubstanceForm.invalidConcentration");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSubmit(formData);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="name">{t("activeSubstanceForm.name")}</Label>
          <Input
            id="name"
            placeholder={t("activeSubstanceForm.namePlaceholder")}
            value={formData.name}
            onChange={(e) => {
              setFormData({ ...formData, name: e.target.value });
              if (errors.name) setErrors({ ...errors, name: undefined });
            }}
            className="bg-slate-50 dark:bg-slate-800"
            required
          />
          {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="maxSingleDose">{t("activeSubstanceForm.maxSingleDose")}</Label>
          <Input
            id="maxSingleDose"
            type="number"
            step="0.001"
            min="0"
            placeholder={t("activeSubstanceForm.maxSingleDosePlaceholder")}
            value={formData.maxSingleDose}
            onChange={(e) => {
              setFormData({ ...formData, maxSingleDose: e.target.value });
              if (errors.maxSingleDose) setErrors({ ...errors, maxSingleDose: undefined });
            }}
            className="bg-slate-50 dark:bg-slate-800"
          />
          {errors.maxSingleDose && <p className="text-sm text-red-500">{errors.maxSingleDose}</p>}
          <p className="text-xs text-muted-foreground">{t("activeSubstanceForm.maxSingleDoseDesc")}</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="maxDailyDose">{t("activeSubstanceForm.maxDailyDose")}</Label>
          <Input
            id="maxDailyDose"
            type="number"
            step="0.001"
            min="0"
            placeholder={t("activeSubstanceForm.maxDailyDosePlaceholder")}
            value={formData.maxDailyDose}
            onChange={(e) => {
              setFormData({ ...formData, maxDailyDose: e.target.value });
              if (errors.maxDailyDose) setErrors({ ...errors, maxDailyDose: undefined });
            }}
            className="bg-slate-50 dark:bg-slate-800"
          />
          {errors.maxDailyDose && <p className="text-sm text-red-500">{errors.maxDailyDose}</p>}
          <p className="text-xs text-muted-foreground">{t("activeSubstanceForm.maxDailyDoseDesc")}</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="maxConcentration">{t("activeSubstanceForm.maxConcentration")}</Label>
          <Input
            id="maxConcentration"
            type="number"
            step="0.01"
            min="0"
            max="100"
            placeholder={t("activeSubstanceForm.maxConcentrationPlaceholder")}
            value={formData.maxConcentration}
            onChange={(e) => {
              setFormData({ ...formData, maxConcentration: e.target.value });
              if (errors.maxConcentration) setErrors({ ...errors, maxConcentration: undefined });
            }}
            className="bg-slate-50 dark:bg-slate-800"
          />
          {errors.maxConcentration && <p className="text-sm text-red-500">{errors.maxConcentration}</p>}
          <p className="text-xs text-muted-foreground">{t("activeSubstanceForm.maxConcentrationDesc")}</p>
        </div>
      </div>

      <Separator />

      {/* Form Actions */}
      <div className="flex justify-end gap-4 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          {t("common.cancel")}
        </Button>
        <Button
          type="submit"
          disabled={isLoading || !formData.name.trim()}
          className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
        >
          {isLoading ? (
            <>{isEditMode ? t("activeSubstanceForm.updating") : t("activeSubstanceForm.creating")}</>
          ) : (
            <>
              {isEditMode ? (
                <>
                  <Edit className="h-4 w-4 mr-2" />
                  {t("activeSubstanceForm.updateButton")}
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  {t("activeSubstanceForm.createButton")}
                </>
              )}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

