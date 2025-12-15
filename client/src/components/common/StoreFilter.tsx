import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={`w-48 h-12 border-slate-200 dark:border-slate-600 bg-white/60 dark:bg-slate-700/60 ${className || ""}`}>
        <SelectValue placeholder="Filter by store" />
      </SelectTrigger>
      <SelectContent>
        {includeAll && <SelectItem value="all">All Stores</SelectItem>}
        {includeUnassigned && <SelectItem value="unassigned">Unassigned</SelectItem>}
        {stores.map((store) => (
          <SelectItem key={store.id} value={store.id.toString()}>
            {store.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

