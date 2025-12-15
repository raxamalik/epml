import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Edit, Trash2, Shield, ShieldOff, Eye } from "lucide-react";

interface Action {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: "default" | "destructive";
}

interface TableActionsProps {
  item: any;
  onEdit?: (item: any) => void;
  onDelete?: (item: any) => void;
  onToggleActive?: (item: any) => void;
  onView?: (item: any) => void;
  customActions?: Action[];
  showToggleActive?: boolean;
}

export function TableActions({
  item,
  onEdit,
  onDelete,
  onToggleActive,
  onView,
  customActions,
  showToggleActive = true,
}: TableActionsProps) {
  const isActive = typeof item.isActive === "boolean" ? item.isActive : item.isActive === "active";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-8 w-8 p-0 hover:bg-gradient-to-r hover:from-blue-100 hover:to-purple-100 dark:hover:from-blue-900 dark:hover:to-purple-900 rounded-full transition-all duration-200"
        >
          <MoreHorizontal className="h-4 w-4 text-slate-600 dark:text-slate-300" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {onView && (
          <DropdownMenuItem onClick={() => onView(item)}>
            <Eye className="h-4 w-4 mr-2" />
            View Details
          </DropdownMenuItem>
        )}
        {onEdit && (
          <DropdownMenuItem onClick={() => onEdit(item)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </DropdownMenuItem>
        )}
        {showToggleActive && onToggleActive && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onToggleActive(item)}>
              {isActive ? (
                <>
                  <ShieldOff className="h-4 w-4 mr-2" />
                  Deactivate
                </>
              ) : (
                <>
                  <Shield className="h-4 w-4 mr-2" />
                  Activate
                </>
              )}
            </DropdownMenuItem>
          </>
        )}
        {onDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(item)}
              className="text-red-600 focus:text-red-600"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </>
        )}
        {customActions?.map((action, index) => (
          <DropdownMenuItem
            key={index}
            onClick={action.onClick}
            className={action.variant === "destructive" ? "text-red-600 focus:text-red-600" : ""}
          >
            {action.icon && <span className="h-4 w-4 mr-2">{action.icon}</span>}
            {action.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

