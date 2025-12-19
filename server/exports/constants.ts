import { ExportType } from './types';

export const TIMEZONE = 'Europe/Prague';

export const EXPORT_HEADERS: Record<ExportType, string[]> = {
  [ExportType.DAILY_REVENUE]: [
    'Datum',
    'Prodejna',
    'Uživatel',
    'Počet dokladů',
    'Tržba bez DPH',
    'DPH celkem',
    'Tržba včetně DPH',
  ],
  [ExportType.VAT_BREAKDOWN]: [
    'Sazba DPH (%)',
    'Základ daně',
    'Částka DPH',
    'Tržba včetně DPH',
  ],
  [ExportType.SOLD_PRODUCTS]: [
    'Název produktu',
    'Číslo šarže',
    'Aktivní látka',
    'Prodané množství',
    'Jednotková cena bez DPH',
    'Tržba bez DPH',
    'Částka DPH',
    'Tržba včetně DPH',
  ],
  [ExportType.INVENTORY_SNAPSHOT]: [
    'Název produktu',
    'Číslo šarže',
    'Aktuální skladové množství',
    'Datum expirace',
    'Dodavatel',
  ],
  [ExportType.STOCK_MOVEMENTS]: [
    'Datum / čas',
    'Prodejna',
    'Název produktu',
    'Číslo šarže',
    'Změna množství',
    'Typ pohybu',
    'Související dokument / doklad',
    'Uživatel',
    'Poznámka / popis',
  ],
  [ExportType.ACTIVE_SUBSTANCES]: [
    'Název aktivní látky',
    'Jednotka limitu',
    'Maximální povolený limit',
    'Poznámka / popis',
  ],
  [ExportType.RETURNED_PRODUCTS]: [
    'Datum vrácení',
    'Číslo původního dokladu',
    'Název produktu',
    'Číslo šarže',
    'Důvod vrácení',
    'Stav zpracování',
    'Částka vrácení',
  ],
  [ExportType.AUDIT_LOGS]: [
    'Datum / čas',
    'Uživatel',
    'Akce',
    'Entita',
    'Popis',
  ],
};

export const TOTALS_LABELS = {
  totalReceipts: 'Celkem dokladů',
  totalRevenueExclVAT: 'Celkem tržba bez DPH',
  totalVAT: 'Celkem DPH',
  totalRevenueInclVAT: 'Celkem tržba včetně DPH',
  totalQuantitySold: 'Celkem prodané množství',
  totalTaxBase: 'Celkem základ daně',
  totalStockQuantity: 'Celkem skladové množství',
  totalQuantityIn: 'Celkem příjem',
  totalQuantityOut: 'Celkem výdej',
  netQuantityChange: 'Čistá změna množství',
  totalRefundedAmount: 'Celkem vrácená částka',
  numberOfReturns: 'Počet vrácení',
  totalEvents: 'Celkem událostí',
};

export const EXPORT_TYPE_NAMES: Record<ExportType, string> = {
  [ExportType.DAILY_REVENUE]: 'Přehled denních tržeb',
  [ExportType.VAT_BREAKDOWN]: 'Rozpis DPH',
  [ExportType.SOLD_PRODUCTS]: 'Přehled prodaných produktů',
  [ExportType.INVENTORY_SNAPSHOT]: 'Snímek skladu',
  [ExportType.STOCK_MOVEMENTS]: 'Skladové pohyby',
  [ExportType.ACTIVE_SUBSTANCES]: 'Aktivní látky a limity',
  [ExportType.RETURNED_PRODUCTS]: 'Vrácené produkty',
  [ExportType.AUDIT_LOGS]: 'Auditní protokoly',
};

export const CSV_CONFIG = {
  delimiter: ';',
  encoding: 'utf-8',
  includeBOM: true,
};

export const PDF_CONFIG = {
  pageSize: 'A4',
  margin: {
    top: 50,
    bottom: 50,
    left: 50,
    right: 50,
  },
  font: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    size: {
      title: 16,
      header: 12,
      body: 10,
      footer: 8,
    },
  },
  colors: {
    header: '#1f2937',
    border: '#e5e7eb',
    text: '#111827',
    summary: '#059669',
  },
};
