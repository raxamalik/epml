import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileText, FileSpreadsheet, Calendar } from "lucide-react";
import { useTranslation } from "react-i18next";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type ExportType = 'daily-revenue' | 'vat-breakdown' | 'sold-products';
type ExportFormat = 'csv' | 'pdf';

// Helper function to format date as YYYY-MM-DD for HTML date input
function formatDateForInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Get default dates: start of current month to today
function getDefaultDates() {
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  return {
    dateFrom: formatDateForInput(startOfMonth),
    dateTo: formatDateForInput(today),
  };
}

export default function Exports() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  
  const defaultDates = getDefaultDates();
  
  const [exportType, setExportType] = useState<ExportType>('daily-revenue');
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [dateFrom, setDateFrom] = useState(defaultDates.dateFrom);
  const [dateTo, setDateTo] = useState(defaultDates.dateTo);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleExport = async () => {
    if (!dateFrom || !dateTo) {
      toast({
        title: t("exports.validation.dateRangeRequired"),
        description: t("exports.validation.dateRangeRequiredDesc"),
        variant: "destructive",
      });
      return;
    }

    if (new Date(dateFrom) > new Date(dateTo)) {
      toast({
        title: t("exports.validation.invalidDateRange"),
        description: t("exports.validation.invalidDateRangeDesc"),
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      const params = new URLSearchParams({
        format,
        date_from: dateFrom,
        date_to: dateTo,
      });

      const token = localStorage.getItem('auth_token');
      const headers: any = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`/api/exports/${exportType}?${params}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Export failed' }));
        throw new Error(errorData.message || 'Export failed');
      }

      const blob = await response.blob();
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `${exportType}_${dateFrom}_${dateTo}.${format}`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }
      
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: t("exports.success.title"),
        description: t("exports.success.description"),
      });
    } catch (error: any) {
      console.error("Export error:", error);
      toast({
        title: t("exports.error.title"),
        description: error.message || t("exports.error.description"),
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t("exports.title")}</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-2">
          {t("exports.description")}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {t("exports.form.title")}
          </CardTitle>
          <CardDescription>
            {t("exports.form.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="exportType">{t("exports.form.exportType")}</Label>
              <Select value={exportType} onValueChange={(value) => setExportType(value as ExportType)}>
                <SelectTrigger id="exportType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily-revenue">
                    {t("exports.exportTypes.daily-revenue")}
                  </SelectItem>
                  <SelectItem value="vat-breakdown">
                    {t("exports.exportTypes.vat-breakdown")}
                  </SelectItem>
                  <SelectItem value="sold-products">
                    {t("exports.exportTypes.sold-products")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="format">{t("exports.form.format")}</Label>
              <Select value={format} onValueChange={(value) => setFormat(value as ExportFormat)}>
                <SelectTrigger id="format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4" />
                      CSV
                    </div>
                  </SelectItem>
                  <SelectItem value="pdf">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      PDF
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateFrom" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {t("exports.form.dateFrom")}
              </Label>
              <Input
                id="dateFrom"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateTo" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {t("exports.form.dateTo")}
              </Label>
              <Input
                id="dateTo"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <Button
              onClick={handleExport}
              disabled={isGenerating || !dateFrom || !dateTo}
              className="min-w-[150px]"
            >
              {isGenerating ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
                  {t("exports.generating")}
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  {t("exports.download")}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("exports.info.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc list-inside space-y-2 text-sm text-slate-600 dark:text-slate-400">
            <li>{t("exports.info.csvFormat")}</li>
            <li>{t("exports.info.pdfFormat")}</li>
            <li>{t("exports.info.dateRange")}</li>
            <li>{t("exports.info.totals")}</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
