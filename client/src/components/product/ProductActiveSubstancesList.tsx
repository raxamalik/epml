import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "@/hooks/useTranslation";

export interface ProductActiveSubstance {
  id?: number; // Optional for new items not yet saved
  substanceId: number;
  substanceName: string;
  contentAmount: string | null;
  contentUnit: string | null;
  concentration: string | null;
}

interface ProductActiveSubstancesListProps {
  substances: ProductActiveSubstance[];
  onRemove: (index: number) => void;
}

export function ProductActiveSubstancesList({
  substances,
  onRemove,
}: ProductActiveSubstancesListProps) {
  const { t } = useTranslation();

  if (substances.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("products.dialogs.activeSubstancesTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t("products.dialogs.noActiveSubstances")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t("products.dialogs.activeSubstancesTitle")}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("products.dialogs.substanceName")}</TableHead>
              <TableHead>{t("products.dialogs.content")}</TableHead>
              <TableHead>{t("products.dialogs.concentration")}</TableHead>
              <TableHead className="w-[100px]">{t("products.table.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {substances.map((substance, index) => (
              <TableRow key={substance.id || index}>
                <TableCell className="font-medium">{substance.substanceName}</TableCell>
                <TableCell>
                  {substance.contentAmount && substance.contentUnit
                    ? `${substance.contentAmount} ${substance.contentUnit}`
                    : substance.contentAmount || "-"}
                </TableCell>
                <TableCell>
                  {substance.concentration ? `${substance.concentration}%` : "-"}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemove(index)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

