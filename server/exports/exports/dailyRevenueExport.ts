import { ExportRequest, ExportData, DailyRevenueRow, DailyRevenueTotals, ExportType } from '../types';
import { EXPORT_HEADERS, TIMEZONE } from '../constants';
import { db } from '../../db';
import { sales, stores, users } from '@shared/schema';
import { sql, and, eq, gte, lte } from 'drizzle-orm';
import { ExportService } from '../exportService';

function getStartOfDay(dateString: string): Date {
  const date = new Date(dateString);
  return new Date(date.toLocaleString('en-US', { timeZone: TIMEZONE }));
}

function getEndOfDay(dateString: string): Date {
  const date = new Date(getStartOfDay(dateString));
  date.setHours(23, 59, 59, 999);
  return date;
}

interface DailyRevenueAggregation {
  date: string;
  storeId: number;
  storeName: string;
  userId: string | null;
  userName: string;
  receiptCount: number;
  revenueExclVAT: number;
  vatTotal: number;
  revenueInclVAT: number;
}

export async function getDailyRevenueExport(request: ExportRequest): Promise<ExportData> {
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
    companyFilter,
    dateFilter,
  ].filter(Boolean);

  const salesData = await db
    .select({
      id: sales.id,
      createdAt: sales.createdAt,
      storeId: sales.storeId,
      storeName: stores.name,
      userId: sales.userId,
      userFirstName: users.firstName,
      userLastName: users.lastName,
      netAmount: sales.netAmount,
      totalVAT: sales.totalVAT,
      total: sales.total,
    })
    .from(sales)
    .leftJoin(stores, eq(sales.storeId, stores.id))
    .leftJoin(users, eq(sales.userId, users.id))
    .where(and(...whereConditions))
    .orderBy(sales.createdAt);

  const aggregation: Record<string, DailyRevenueAggregation> = {};

  for (const sale of salesData) {
    const saleDate = new Date(sale.createdAt).toISOString().split('T')[0];
    const storeId = sale.storeId;
    const userId = sale.userId || 'unknown';
    const key = `${saleDate}_${storeId}_${userId}`;

    if (!aggregation[key]) {
      aggregation[key] = {
        date: saleDate,
        storeId,
        storeName: sale.storeName || `Store ${storeId}`,
        userId: sale.userId,
        userName: sale.userFirstName && sale.userLastName
          ? `${sale.userFirstName} ${sale.userLastName}`
          : sale.userFirstName || sale.userLastName || sale.userId || 'Neznámý',
        receiptCount: 0,
        revenueExclVAT: 0,
        vatTotal: 0,
        revenueInclVAT: 0,
      };
    }

    const netAmount = sale.netAmount ? parseFloat(String(sale.netAmount)) : 0;
    const totalVAT = sale.totalVAT ? parseFloat(String(sale.totalVAT)) : 0;
    const total = parseFloat(String(sale.total));

    aggregation[key].receiptCount += 1;
    aggregation[key].revenueExclVAT += netAmount || (total - totalVAT);
    aggregation[key].vatTotal += totalVAT;
    aggregation[key].revenueInclVAT += total;
  }

  const rows: DailyRevenueRow[] = Object.values(aggregation)
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      if (a.storeName !== b.storeName) return a.storeName.localeCompare(b.storeName);
      return a.userName.localeCompare(b.userName);
    })
    .map(item => ({
      date: item.date,
      store: item.storeName,
      user: item.userName,
      receiptCount: item.receiptCount,
      revenueExclVAT: item.revenueExclVAT,
      vatTotal: item.vatTotal,
      revenueInclVAT: item.revenueInclVAT,
    }));

  const totals: DailyRevenueTotals = {
    totalReceipts: rows.reduce((sum, row) => sum + row.receiptCount, 0),
    totalRevenueExclVAT: rows.reduce((sum, row) => sum + row.revenueExclVAT, 0),
    totalVAT: rows.reduce((sum, row) => sum + row.vatTotal, 0),
    totalRevenueInclVAT: rows.reduce((sum, row) => sum + row.revenueInclVAT, 0),
  };

  const exportRows = rows.map(row => ({
    'Datum': row.date,
    'Prodejna': row.store,
    'Uživatel': row.user,
    'Počet dokladů': row.receiptCount,
    'Tržba bez DPH': row.revenueExclVAT,
    'DPH celkem': row.vatTotal,
    'Tržba včetně DPH': row.revenueInclVAT,
  }));

  return {
    headers: EXPORT_HEADERS[ExportType.DAILY_REVENUE],
    rows: exportRows,
    totals: {
      totalReceipts: totals.totalReceipts,
      totalRevenueExclVAT: totals.totalRevenueExclVAT,
      totalVAT: totals.totalVAT,
      totalRevenueInclVAT: totals.totalRevenueInclVAT,
    },
  };
}
