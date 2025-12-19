import { ExportRequest, ExportData, VATBreakdownRow, VATBreakdownTotals, ExportType } from '../types';
import { EXPORT_HEADERS, TIMEZONE } from '../constants';
import { db } from '../../db';
import { sales } from '@shared/schema';
import { sql, and, eq, gte, lte, isNotNull } from 'drizzle-orm';
import { ExportService } from '../exportService';

interface VATBreakdownData {
  rate: string;
  base: number;
  vat: number;
  revenueInclVAT: number;
}

function getStartOfDay(dateString: string): Date {
  const date = new Date(dateString);
  return new Date(date.toLocaleString('en-US', { timeZone: TIMEZONE }));
}

function getEndOfDay(dateString: string): Date {
  const date = new Date(getStartOfDay(dateString));
  date.setHours(23, 59, 59, 999);
  return date;
}

export async function getVATBreakdownExport(request: ExportRequest): Promise<ExportData> {
  const companyFilter = ExportService.buildCompanyFilter(request.companyId, request.storeId);
  
  const dateConditions = [];
  if (request.dateFrom) {
    const startDate = getStartOfDay(request.dateFrom);
    dateConditions.push(gte(sales.createdAt, startDate));
  }
  if (request.dateTo) {
    const endDate = getEndOfDay(request.dateTo);
    dateConditions.push(lte(sales.createdAt, endDate));
  }
  const dateFilter = dateConditions.length > 0 ? and(...dateConditions) : undefined;

  const whereConditions = [
    eq(sales.isCancelled, false),
    isNotNull(sales.vatBreakdown),
    companyFilter,
    dateFilter,
  ].filter(Boolean);

  const salesData = await db
    .select({
      vatBreakdown: sales.vatBreakdown,
      total: sales.total,
    })
    .from(sales)
    .where(and(...whereConditions));

  const vatAggregation: Record<string, VATBreakdownData> = {};

  for (const sale of salesData) {
    const vatBreakdown = sale.vatBreakdown as Record<string, { base: number; vat: number }> | null;
    if (!vatBreakdown) continue;

    for (const [rate, data] of Object.entries(vatBreakdown)) {
      if (!vatAggregation[rate]) {
        vatAggregation[rate] = {
          rate,
          base: 0,
          vat: 0,
          revenueInclVAT: 0,
        };
      }

      const base = typeof data.base === 'number' ? data.base : parseFloat(String(data.base || 0));
      const vat = typeof data.vat === 'number' ? data.vat : parseFloat(String(data.vat || 0));

      vatAggregation[rate].base += base;
      vatAggregation[rate].vat += vat;
      vatAggregation[rate].revenueInclVAT += base + vat;
    }
  }

  const rows: VATBreakdownRow[] = Object.values(vatAggregation)
    .sort((a, b) => parseFloat(a.rate) - parseFloat(b.rate))
    .map(item => ({
      vatRate: parseFloat(item.rate),
      taxBase: item.base,
      vatAmount: item.vat,
      revenueInclVAT: item.revenueInclVAT,
    }));

  const totals: VATBreakdownTotals = {
    totalTaxBase: rows.reduce((sum, row) => sum + row.taxBase, 0),
    totalVAT: rows.reduce((sum, row) => sum + row.vatAmount, 0),
    totalRevenueInclVAT: rows.reduce((sum, row) => sum + row.revenueInclVAT, 0),
  };

  const exportRows = rows.map(row => ({
    'Sazba DPH (%)': row.vatRate,
    'Základ daně': row.taxBase,
    'Částka DPH': row.vatAmount,
    'Tržba včetně DPH': row.revenueInclVAT,
  }));

  return {
    headers: EXPORT_HEADERS[ExportType.VAT_BREAKDOWN],
    rows: exportRows,
    totals: {
      totalTaxBase: totals.totalTaxBase,
      totalVAT: totals.totalVAT,
      totalRevenueInclVAT: totals.totalRevenueInclVAT,
    },
  };
}
