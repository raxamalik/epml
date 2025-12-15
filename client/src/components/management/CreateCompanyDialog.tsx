import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CompanyForm } from "./CompanyForm";
import { UseFormReturn } from "react-hook-form";
import { CompanyFormData } from "@/lib/utils/validation";
import { Loader2 } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

interface CreateCompanyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: UseFormReturn<CompanyFormData>;
  onSubmit: (data: CompanyFormData) => void;
  isLoading?: boolean;
}

export function CreateCompanyDialog({
  open,
  onOpenChange,
  form,
  onSubmit,
  isLoading = false,
}: CreateCompanyDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("companyCreate.title")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="py-4">
            <CompanyForm form={form} mode="create" />
          </div>
          
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              {t("common.cancel")}
            </Button>
            <Button 
              type="submit" 
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t("companyCreate.creating")}
                </>
              ) : (
                t("companyCreate.createButton")
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

