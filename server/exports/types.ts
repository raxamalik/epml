export enum ExportType {
  DAILY_REVENUE = 'daily-revenue',
  VAT_BREAKDOWN = 'vat-breakdown',
  SOLD_PRODUCTS = 'sold-products',
  INVENTORY_SNAPSHOT = 'inventory-snapshot',
  STOCK_MOVEMENTS = 'stock-movements',
  ACTIVE_SUBSTANCES = 'active-substances',
  RETURNED_PRODUCTS = 'returned-products',
  AUDIT_LOGS = 'audit-logs',
}

export type ExportFormat = 'csv' | 'pdf';

export interface ExportRequest {
  exportType: ExportType;
  format: ExportFormat;
  dateFrom?: string;
  dateTo?: string;
  storeId?: number;
  userId?: string;
  companyId: number;
}

export interface ExportResult {
  data: Buffer;
  filename: string;
  mimeType: string;
}

export interface ExportTotals {
  [key: string]: number | string;
}

export interface ExportRow {
  [column: string]: string | number | null | undefined;
}

export interface ExportData {
  headers: string[];
  rows: ExportRow[];
  totals?: ExportTotals;
  groupedTotals?: { [groupKey: string]: ExportTotals };
}

export interface DailyRevenueRow {
  date: string;
  store: string;
  user: string;
  receiptCount: number;
  revenueExclVAT: number;
  vatTotal: number;
  revenueInclVAT: number;
}

export interface DailyRevenueTotals {
  totalReceipts: number;
  totalRevenueExclVAT: number;
  totalVAT: number;
  totalRevenueInclVAT: number;
}

export interface VATBreakdownRow {
  vatRate: number;
  taxBase: number;
  vatAmount: number;
  revenueInclVAT: number;
}

export interface VATBreakdownTotals {
  totalTaxBase: number;
  totalVAT: number;
  totalRevenueInclVAT: number;
}

export interface SoldProductsRow {
  productName: string;
  batchNumber: string | null;
  activeSubstance: string | null;
  quantitySold: number;
  unitPriceExclVAT: number;
  revenueExclVAT: number;
  vatAmount: number;
  revenueInclVAT: number;
}

export interface SoldProductsTotals {
  totalQuantitySold: number;
  totalRevenueExclVAT: number;
  totalVAT: number;
  totalRevenueInclVAT: number;
}

export interface InventorySnapshotRow {
  productName: string;
  batchNumber: string | null;
  currentStock: number;
  expirationDate: string | null;
  supplier: string | null;
}

export interface InventorySnapshotTotals {
  totalStockQuantity: number;
}

export interface StockMovementRow {
  dateTime: string;
  store: string;
  productName: string;
  batchNumber: string | null;
  quantityChange: number;
  movementType: string;
  relatedDocument: string | null;
  user: string | null;
  note: string | null;
}

export interface StockMovementTotals {
  totalQuantityIn: number;
  totalQuantityOut: number;
  netQuantityChange: number;
}

export interface ActiveSubstanceRow {
  activeSubstanceName: string;
  limitUnit: string | null;
  maximumAllowedLimit: number | null;
  note: string | null;
}

export interface ReturnedProductsRow {
  returnDate: string;
  originalReceiptNumber: string;
  productName: string;
  batchNumber: string | null;
  returnReason: string | null;
  processingStatus: string;
  refundAmount: number;
}

export interface ReturnedProductsTotals {
  totalRefundedAmount: number;
  numberOfReturns: number;
}

export interface AuditLogRow {
  dateTime: string;
  user: string;
  action: string;
  entity: string;
  description: string;
}

export interface AuditLogTotals {
  totalEvents: number;
}
