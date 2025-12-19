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

interface SendInvitationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  itemName?: string;
  itemEmail?: string;
  isLoading?: boolean;
}

export function SendInvitationDialog({
  open,
  onOpenChange,
  onConfirm,
  title = "Send Activation Invitation",
  description = "Send activation invitation to",
  itemName,
  itemEmail,
  isLoading = false,
}: SendInvitationDialogProps) {
  const { t } = useTranslation();
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
            {itemEmail && (
              <>
                {" "}at{" "}
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {itemEmail}
                </span>
              </>
            )}
            ?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>{t("dialogs.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isLoading ? t("dialogs.sending") : t("dialogs.sendInvitation")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

