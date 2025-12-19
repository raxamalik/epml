import { ExportRequest, ExportData, SoldProductsRow, SoldProductsTotals, ExportType } from '../types';
import { EXPORT_HEADERS, TIMEZONE } from '../constants';
import { db } from '../../db';
import { sales, salesItems, products, productBatches, productActiveSubstance, activeSubstances } from '@shared/schema';
import { sql, and, eq, gte, lte, inArray } from 'drizzle-orm';
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

export async function getSoldProductsExport(request: ExportRequest): Promise<ExportData> {
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

  const itemsData = await db
    .select({
      saleItemId: salesItems.id,
      productId: salesItems.productId,
      productName: products.name,
      batchId: salesItems.batchId,
      batchNumber: productBatches.batchNumber,
      quantity: salesItems.quantity,
      unitPrice: salesItems.unitPrice,
      vatRate: salesItems.vatRate,
    })
    .from(salesItems)
    .innerJoin(sales, eq(salesItems.saleId, sales.id))
    .innerJoin(products, eq(salesItems.productId, products.id))
    .leftJoin(productBatches, eq(salesItems.batchId, productBatches.id))
    .where(and(...whereConditions))
    .orderBy(products.name, productBatches.batchNumber);

  const productIds = [...new Set(itemsData.map(item => item.productId))];
  
  const activeSubstancesData = productIds.length > 0 ? await db
    .select({
      productId: productActiveSubstance.productId,
      substanceName: activeSubstances.name,
    })
    .from(productActiveSubstance)
    .innerJoin(activeSubstances, eq(productActiveSubstance.substanceId, activeSubstances.id))
    .where(inArray(productActiveSubstance.productId, productIds)) : [];

  const substancesByProduct: Record<number, string[]> = {};
  for (const sub of activeSubstancesData) {
    if (!substancesByProduct[sub.productId]) {
      substancesByProduct[sub.productId] = [];
    }
    substancesByProduct[sub.productId].push(sub.substanceName);
  }

  const rows: SoldProductsRow[] = [];

  for (const item of itemsData) {
    const quantity = parseFloat(String(item.quantity));
    const unitPrice = parseFloat(String(item.unitPrice));
    const vatRate = parseFloat(String(item.vatRate));
    
    const revenueInclVAT = quantity * unitPrice;
    const vatAmount = (revenueInclVAT * vatRate) / (100 + vatRate);
    const revenueExclVAT = revenueInclVAT - vatAmount;
    const unitPriceExclVAT = unitPrice - (unitPrice * vatRate) / (100 + vatRate);

    const substances = substancesByProduct[item.productId] || [];
    const activeSubstance = substances.length > 0 ? substances.join(', ') : null;

    rows.push({
      productName: item.productName,
      batchNumber: item.batchNumber || null,
      activeSubstance: activeSubstance,
      quantitySold: quantity,
      unitPriceExclVAT: unitPriceExclVAT,
      revenueExclVAT: revenueExclVAT,
      vatAmount: vatAmount,
      revenueInclVAT: revenueInclVAT,
    });
  }

  const totals: SoldProductsTotals = {
    totalQuantitySold: rows.reduce((sum, row) => sum + row.quantitySold, 0),
    totalRevenueExclVAT: rows.reduce((sum, row) => sum + row.revenueExclVAT, 0),
    totalVAT: rows.reduce((sum, row) => sum + row.vatAmount, 0),
    totalRevenueInclVAT: rows.reduce((sum, row) => sum + row.revenueInclVAT, 0),
  };

  const exportRows = rows.map(row => ({
    'Název produktu': row.productName,
    'Číslo šarže': row.batchNumber || '',
    'Aktivní látka': row.activeSubstance || '',
    'Prodané množství': row.quantitySold,
    'Jednotková cena bez DPH': row.unitPriceExclVAT,
    'Tržba bez DPH': row.revenueExclVAT,
    'Částka DPH': row.vatAmount,
    'Tržba včetně DPH': row.revenueInclVAT,
  }));

  return {
    headers: EXPORT_HEADERS[ExportType.SOLD_PRODUCTS],
    rows: exportRows,
    totals: {
      totalQuantitySold: totals.totalQuantitySold,
      totalRevenueExclVAT: totals.totalRevenueExclVAT,
      totalVAT: totals.totalVAT,
      totalRevenueInclVAT: totals.totalRevenueInclVAT,
    },
  };
}
