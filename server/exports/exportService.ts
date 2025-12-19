/**
 * Main Export Service
 * Orchestrates export generation with authorization and data fetching
 */

import { ExportRequest, ExportResult, ExportType, ExportData } from './types';
import { generateCSV, generateCSVFilename } from './csvGenerator';
import { generatePDF, generatePDFFilename } from './pdfGenerator';
import { TIMEZONE } from './constants';
import { db } from '../db';
import { sql, and, eq, gte, lte, or, isNotNull, isNull, inArray } from 'drizzle-orm';
import { sales, stores, users, products, productBatches, salesItems, stockTransactions, returns, returnsItems, auditLogs, activeSubstances, productActiveSubstance } from '@shared/schema';

/**
 * Validates export request and ensures user has access
 */
function validateExportRequest(request: ExportRequest, userCompanyId: number, userStoreId?: number, userRole?: string): void {
  // Ensure user can only export data for their company
  if (request.companyId !== userCompanyId) {
    throw new Error('Nemáte oprávnění exportovat data z jiné společnosti');
  }
  
  // Validate date range if provided
  if (request.dateFrom && request.dateTo) {
    const fromDate = new Date(request.dateFrom);
    const toDate = new Date(request.dateTo);
    
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      throw new Error('Neplatný formát data');
    }
    
    if (fromDate > toDate) {
      throw new Error('Datum od musí být před datem do');
    }
    
    // Limit date range to prevent excessive exports (e.g., max 2 years)
    const maxDays = 730;
    const daysDiff = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > maxDays) {
      throw new Error(`Maximální rozsah exportu je ${maxDays} dní`);
    }
  }
  
  // Validate store access
  if (request.storeId) {
    // For managers, they can only access their own store
    if (userRole === 'manager' && request.storeId !== userStoreId) {
      throw new Error('Nemáte oprávnění exportovat data z jiné prodejny');
    }
    
    // Verify store belongs to user's company
    // This will be checked in the actual query, but we can validate here too
  }
}

/**
 * Converts date string to start of day in Prague timezone
 */
function getStartOfDay(dateString: string): Date {
  const date = new Date(dateString);
  // Set to start of day in Prague timezone
  return new Date(date.toLocaleString('en-US', { timeZone: TIMEZONE }));
}

/**
 * Converts date string to end of day in Prague timezone
 */
function getEndOfDay(dateString: string): Date {
  const date = new Date(getStartOfDay(dateString));
  date.setHours(23, 59, 59, 999);
  return date;
}

/**
 * Builds date filter conditions for queries
 */
function buildDateFilter(dateFrom?: string, dateTo?: string, dateColumn = sql`created_at`) {
  const conditions = [];
  
  if (dateFrom) {
    const startDate = getStartOfDay(dateFrom);
    conditions.push(gte(dateColumn, startDate));
  }
  
  if (dateTo) {
    const endDate = getEndOfDay(dateTo);
    conditions.push(lte(dateColumn, endDate));
  }
  
  return conditions.length > 0 ? and(...conditions) : undefined;
}

/**
 * Main export service function
 * This will be extended by specific export implementations
 */
export class ExportService {
  /**
   * Generates export based on request
   */
  static async generateExport(request: ExportRequest, userCompanyId: number, userStoreId?: number, userRole?: string): Promise<ExportResult> {
    // Validate request
    validateExportRequest(request, userCompanyId, userStoreId, userRole);
    
    // Get export data (to be implemented by specific export handlers)
    const exportData = await this.getExportData(request);
    
    // Generate file based on format
    let data: Buffer;
    let filename: string;
    let mimeType: string;
    
    if (request.format === 'csv') {
      data = generateCSV(exportData);
      filename = generateCSVFilename(request.exportType, request.dateFrom, request.dateTo);
      mimeType = 'text/csv; charset=utf-8';
    } else {
      data = await generatePDF(exportData, request.exportType, request.dateFrom, request.dateTo);
      filename = generatePDFFilename(request.exportType, request.dateFrom, request.dateTo);
      mimeType = 'application/pdf';
    }
    
    return {
      data,
      filename,
      mimeType,
    };
  }
  
  /**
   * Gets export data based on export type
   * This method will delegate to specific export handlers
   */
  private static async getExportData(request: ExportRequest): Promise<ExportData> {
    switch (request.exportType) {
      case ExportType.DAILY_REVENUE:
        const { getDailyRevenueExport } = await import('./exports/dailyRevenueExport');
        return getDailyRevenueExport(request);
      case ExportType.VAT_BREAKDOWN:
        const { getVATBreakdownExport } = await import('./exports/vatBreakdownExport');
        return getVATBreakdownExport(request);
      case ExportType.SOLD_PRODUCTS:
        const { getSoldProductsExport } = await import('./exports/soldProductsExport');
        return getSoldProductsExport(request);
      default:
        throw new Error(`Export type ${request.exportType} not yet implemented`);
    }
  }
  
  /**
   * Ensures company_id filter is applied to all queries
   * Returns a condition that filters sales by company_id through stores table
   * Uses fully qualified column names (table.column) to avoid ambiguous references
   */
  static buildCompanyFilter(companyId: number, storeId?: number) {
    if (storeId) {
      // If store is specified, ensure it belongs to the company
      return sql`sales.store_id IN (
        SELECT stores.id FROM stores 
        WHERE stores.company_id = ${companyId} AND stores.id = ${storeId}
      )`;
    } else {
      // Filter by company through stores
      return sql`sales.store_id IN (
        SELECT stores.id FROM stores 
        WHERE stores.company_id = ${companyId}
      )`;
    }
  }
}
