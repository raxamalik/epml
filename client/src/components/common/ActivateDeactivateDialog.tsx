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
  const action = actionType === "toggle" 
    ? (isActive ? "deactivate" : "activate")
    : actionType;
  
  const actionLabel = action === "activate" 
    ? "Activate" 
    : action === "suspend"
    ? "Suspend"
    : "Deactivate";
  
  const actionColor = action === "activate" 
    ? "bg-green-600 hover:bg-green-700" 
    : action === "suspend"
    ? "bg-red-600 hover:bg-red-700"
    : "bg-orange-600 hover:bg-orange-700";

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
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isLoading}
            className={actionColor}
          >
            {isLoading ? `${actionLabel}ing...` : actionLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

