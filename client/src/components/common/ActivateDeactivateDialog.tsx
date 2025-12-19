import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useTranslation } from "@/hooks/useTranslation";

interface ActivateDeactivateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title: string;
  description: string;
  itemName?: string;
  isActive: boolean;
  isLoading?: boolean;
  actionType?: "activate" | "deactivate" | "toggle" | "suspend";
}

export function ActivateDeactivateDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  itemName,
  isActive,
  isLoading = false,
  actionType = "toggle",
}: ActivateDeactivateDialogProps) {
  const { t } = useTranslation();
  const action = actionType === "toggle" 
    ? (isActive ? "deactivate" : "activate")
    : actionType;
  
  const actionLabel = action === "activate" 
    ? t("dialogs.activate")
    : action === "suspend"
    ? t("dialogs.suspend")
    : t("dialogs.deactivate");
  
  const actionColor = action === "activate" 
    ? "bg-green-600 hover:bg-green-700" 
    : action === "suspend"
    ? "bg-red-600 hover:bg-red-700"
    : "bg-orange-600 hover:bg-orange-700";
  
  const actionLoading = action === "activate"
    ? t("dialogs.activating")
    : action === "suspend"
    ? t("dialogs.suspending")
    : t("dialogs.deactivating");

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            {description}
            {itemName && (
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {" "}
                {itemName}
              </span>
            )}
            ? {action === "suspend" && " This will suspend the company and all associated stores and users, preventing access to the system."}
            {action === "activate" && actionType === "activate" && " This will reactivate the company and all associated stores and users, restoring access to the system."}
            {action === "deactivate" && actionType !== "suspend" && " This will prevent access to the system."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>{t("dialogs.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isLoading}
            className={actionColor}
          >
            {isLoading ? actionLoading : actionLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

