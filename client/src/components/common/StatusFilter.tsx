import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTranslation } from "@/hooks/useTranslation";

interface StatusFilterProps {
  value: string;
  onChange: (value: string) => void;
  includeAll?: boolean;
  className?: string;
}

export function StatusFilter({
  value,
  onChange,
  includeAll = true,
  className,
}: StatusFilterProps) {
  const { t } = useTranslation();
  
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={`w-48 h-12 border-slate-200 dark:border-slate-600 bg-white/60 dark:bg-slate-700/60 ${className || ""}`}>
        <SelectValue placeholder={t("common.filterByStatus")} />
      </SelectTrigger>
      <SelectContent>
        {includeAll && <SelectItem value="all">{t("common.allStatus")}</SelectItem>}
        <SelectItem value="active">{t("common.active")}</SelectItem>
        <SelectItem value="inactive">{t("common.inactive")}</SelectItem>
      </SelectContent>
    </Select>
  );
}

