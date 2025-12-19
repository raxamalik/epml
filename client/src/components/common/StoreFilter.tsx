import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTranslation } from "@/hooks/useTranslation";

interface Store {
  id: number;
  name: string;
}

interface StoreFilterProps {
  value: string;
  onChange: (value: string) => void;
  stores: Store[];
  includeAll?: boolean;
  includeUnassigned?: boolean;
  className?: string;
}

export function StoreFilter({
  value,
  onChange,
  stores,
  includeAll = true,
  includeUnassigned = false,
  className,
}: StoreFilterProps) {
  const { t } = useTranslation();
  
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={`w-48 h-12 border-slate-200 dark:border-slate-600 bg-white/60 dark:bg-slate-700/60 ${className || ""}`}>
        <SelectValue placeholder={t("common.filterByStore")} />
      </SelectTrigger>
      <SelectContent>
        {includeAll && <SelectItem value="all">{t("common.allStores")}</SelectItem>}
        {includeUnassigned && <SelectItem value="unassigned">{t("common.unassigned")}</SelectItem>}
        {stores.map((store) => (
          <SelectItem key={store.id} value={store.id.toString()}>
            {store.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

