import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Plus, Edit } from "lucide-react";

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
      newErrors.name = "Name is required";
    }

    if (formData.maxSingleDose && (isNaN(parseFloat(formData.maxSingleDose)) || parseFloat(formData.maxSingleDose) < 0)) {
      newErrors.maxSingleDose = "Must be a valid positive number";
    }

    if (formData.maxDailyDose && (isNaN(parseFloat(formData.maxDailyDose)) || parseFloat(formData.maxDailyDose) < 0)) {
      newErrors.maxDailyDose = "Must be a valid positive number";
    }

    if (formData.maxConcentration && (isNaN(parseFloat(formData.maxConcentration)) || parseFloat(formData.maxConcentration) < 0 || parseFloat(formData.maxConcentration) > 100)) {
      newErrors.maxConcentration = "Must be a valid number between 0 and 100";
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
          <Label htmlFor="name">Name *</Label>
          <Input
            id="name"
            placeholder="Enter substance name (e.g. Mitragynine)"
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
          <Label htmlFor="maxSingleDose">Max Single Dose</Label>
          <Input
            id="maxSingleDose"
            type="number"
            step="0.001"
            min="0"
            placeholder="e.g. 125"
            value={formData.maxSingleDose}
            onChange={(e) => {
              setFormData({ ...formData, maxSingleDose: e.target.value });
              if (errors.maxSingleDose) setErrors({ ...errors, maxSingleDose: undefined });
            }}
            className="bg-slate-50 dark:bg-slate-800"
          />
          {errors.maxSingleDose && <p className="text-sm text-red-500">{errors.maxSingleDose}</p>}
          <p className="text-xs text-muted-foreground">Maximum allowed single dose (e.g. 125 mg)</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="maxDailyDose">Max Daily Dose</Label>
          <Input
            id="maxDailyDose"
            type="number"
            step="0.001"
            min="0"
            placeholder="e.g. 375"
            value={formData.maxDailyDose}
            onChange={(e) => {
              setFormData({ ...formData, maxDailyDose: e.target.value });
              if (errors.maxDailyDose) setErrors({ ...errors, maxDailyDose: undefined });
            }}
            className="bg-slate-50 dark:bg-slate-800"
          />
          {errors.maxDailyDose && <p className="text-sm text-red-500">{errors.maxDailyDose}</p>}
          <p className="text-xs text-muted-foreground">Maximum allowed daily dose (e.g. 375 mg)</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="maxConcentration">Max Concentration (%)</Label>
          <Input
            id="maxConcentration"
            type="number"
            step="0.01"
            min="0"
            max="100"
            placeholder="e.g. 2.5"
            value={formData.maxConcentration}
            onChange={(e) => {
              setFormData({ ...formData, maxConcentration: e.target.value });
              if (errors.maxConcentration) setErrors({ ...errors, maxConcentration: undefined });
            }}
            className="bg-slate-50 dark:bg-slate-800"
          />
          {errors.maxConcentration && <p className="text-sm text-red-500">{errors.maxConcentration}</p>}
          <p className="text-xs text-muted-foreground">Maximum allowed concentration (0-100%)</p>
        </div>
      </div>

      <Separator />

      {/* Form Actions */}
      <div className="flex justify-end gap-4 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isLoading || !formData.name.trim()}
          className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
        >
          {isLoading ? (
            <>{isEditMode ? "Updating..." : "Creating..."}</>
          ) : (
            <>
              {isEditMode ? (
                <>
                  <Edit className="h-4 w-4 mr-2" />
                  Update Substance
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Substance
                </>
              )}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

