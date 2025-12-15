import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";

interface ActiveSubstance {
  id: number;
  name: string;
  maxSingleDose: string | null;
  maxDailyDose: string | null;
  maxConcentration: string | null;
}

interface AddActiveSubstanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (substance: {
    substanceId: number;
    substanceName: string;
    contentAmount: string | null;
    contentUnit: string | null;
    concentration: string | null;
  }) => void;
  existingSubstanceIds?: number[]; // To prevent adding duplicates
}

export function AddActiveSubstanceDialog({
  open,
  onOpenChange,
  onAdd,
  existingSubstanceIds = [],
}: AddActiveSubstanceDialogProps) {
  const [selectedSubstanceId, setSelectedSubstanceId] = useState<string>("");
  const [contentAmount, setContentAmount] = useState("");
  const [contentUnit, setContentUnit] = useState("");
  const [concentration, setConcentration] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch active substances
  const { data: substancesResponse, isLoading } = useQuery({
    queryKey: ["/api/active-substances", "all"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/active-substances?limit=1000");
      const data = await response.json();
      return data.data || [];
    },
    enabled: open,
  });

  const substances: ActiveSubstance[] = substancesResponse || [];
  const availableSubstances = substances.filter(
    (s) => !existingSubstanceIds.includes(s.id)
  );

  useEffect(() => {
    if (!open) {
      // Reset form when dialog closes
      setSelectedSubstanceId("");
      setContentAmount("");
      setContentUnit("");
      setConcentration("");
      setErrors({});
    }
  }, [open]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!selectedSubstanceId) {
      newErrors.substanceId = "Please select a substance";
    }

    if (contentAmount && isNaN(parseFloat(contentAmount))) {
      newErrors.contentAmount = "Content amount must be a valid number";
    }

    if (contentAmount && parseFloat(contentAmount) < 0) {
      newErrors.contentAmount = "Content amount must be positive";
    }

    if (concentration && (isNaN(parseFloat(concentration)) || parseFloat(concentration) < 0 || parseFloat(concentration) > 100)) {
      newErrors.concentration = "Concentration must be between 0 and 100";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAdd = () => {
    if (!validate()) return;

    const selectedSubstance = substances.find(
      (s) => s.id === parseInt(selectedSubstanceId)
    );

    if (!selectedSubstance) return;

    onAdd({
      substanceId: selectedSubstance.id,
      substanceName: selectedSubstance.name,
      contentAmount: contentAmount || null,
      contentUnit: contentUnit || null,
      concentration: concentration || null,
    });

    // Reset form
    setSelectedSubstanceId("");
    setContentAmount("");
    setContentUnit("");
    setConcentration("");
    setErrors({});
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Active Substance</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="substance">Substance *</Label>
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : (
              <Select
                value={selectedSubstanceId}
                onValueChange={(value) => {
                  setSelectedSubstanceId(value);
                  if (errors.substanceId) {
                    setErrors({ ...errors, substanceId: "" });
                  }
                }}
              >
                <SelectTrigger className="bg-slate-50 dark:bg-slate-800">
                  <SelectValue placeholder="Select a substance" />
                </SelectTrigger>
                <SelectContent>
                  {availableSubstances.length === 0 ? (
                    <SelectItem value="none" disabled>
                      No substances available
                    </SelectItem>
                  ) : (
                    availableSubstances.map((substance) => (
                      <SelectItem key={substance.id} value={substance.id.toString()}>
                        {substance.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            )}
            {errors.substanceId && (
              <p className="text-sm text-red-500">{errors.substanceId}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contentAmount">Content Amount</Label>
              <Input
                id="contentAmount"
                type="number"
                step="0.001"
                min="0"
                placeholder="e.g. 100"
                value={contentAmount}
                onChange={(e) => {
                  setContentAmount(e.target.value);
                  if (errors.contentAmount) {
                    setErrors({ ...errors, contentAmount: "" });
                  }
                }}
                className="bg-slate-50 dark:bg-slate-800"
              />
              {errors.contentAmount && (
                <p className="text-sm text-red-500">{errors.contentAmount}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="contentUnit">Unit</Label>
              <Select
                value={contentUnit}
                onValueChange={setContentUnit}
              >
                <SelectTrigger className="bg-slate-50 dark:bg-slate-800">
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mg">mg</SelectItem>
                  <SelectItem value="g">g</SelectItem>
                  <SelectItem value="kg">kg</SelectItem>
                  <SelectItem value="ml">ml</SelectItem>
                  <SelectItem value="l">l</SelectItem>
                  <SelectItem value="pcs">pcs</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="concentration">Concentration (%)</Label>
            <Input
              id="concentration"
              type="number"
              step="0.01"
              min="0"
              max="100"
              placeholder="e.g. 0.3"
              value={concentration}
              onChange={(e) => {
                setConcentration(e.target.value);
                if (errors.concentration) {
                  setErrors({ ...errors, concentration: "" });
                }
              }}
              className="bg-slate-50 dark:bg-slate-800"
            />
            {errors.concentration && (
              <p className="text-sm text-red-500">{errors.concentration}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Percentage by weight (0-100%)
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleAdd} disabled={!selectedSubstanceId}>
            Add Substance
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

