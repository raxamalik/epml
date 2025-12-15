import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={`w-48 h-12 border-slate-200 dark:border-slate-600 bg-white/60 dark:bg-slate-700/60 ${className || ""}`}>
        <SelectValue placeholder="Filter by status" />
      </SelectTrigger>
      <SelectContent>
        {includeAll && <SelectItem value="all">All Status</SelectItem>}
        <SelectItem value="active">Active</SelectItem>
        <SelectItem value="inactive">Inactive</SelectItem>
      </SelectContent>
    </Select>
  );
}

