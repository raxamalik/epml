import { ExportData, ExportTotals } from './types';
import { CSV_CONFIG, TOTALS_LABELS } from './constants';

function escapeCSVField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }
  
  const stringValue = String(value);
  
  if (stringValue.includes(CSV_CONFIG.delimiter) || 
      stringValue.includes('"') || 
      stringValue.includes('\n') ||
      stringValue.includes('\r')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  
  return stringValue;
}

function formatNumber(value: number): string {
  return value.toFixed(2).replace('.', ',');
}

function rowToCSVLine(row: Record<string, string | number | null | undefined>, headers: string[]): string {
  return headers
    .map(header => escapeCSVField(row[header]))
    .join(CSV_CONFIG.delimiter);
}

export function generateCSV(data: ExportData): Buffer {
  const lines: string[] = [];
  
  if (CSV_CONFIG.includeBOM) {
    lines.push('\uFEFF');
  }
  
  lines.push(data.headers.map(h => escapeCSVField(h)).join(CSV_CONFIG.delimiter));
  
  for (const row of data.rows) {
    lines.push(rowToCSVLine(row, data.headers));
  }
  
  if (data.totals && Object.keys(data.totals).length > 0) {
    lines.push('');
    lines.push('SOUHRN');
    
    for (const [key, value] of Object.entries(data.totals)) {
      const label = TOTALS_LABELS[key as keyof typeof TOTALS_LABELS] || key;
      const formattedValue = typeof value === 'number' ? formatNumber(value) : String(value);
      lines.push(`${escapeCSVField(label)}${CSV_CONFIG.delimiter}${escapeCSVField(formattedValue)}`);
    }
  }
  
  if (data.groupedTotals) {
    for (const [groupKey, groupTotals] of Object.entries(data.groupedTotals)) {
      lines.push('');
      lines.push(`SOUHRN - ${escapeCSVField(groupKey)}`);
      
      for (const [key, value] of Object.entries(groupTotals)) {
        const label = TOTALS_LABELS[key as keyof typeof TOTALS_LABELS] || key;
        const formattedValue = typeof value === 'number' ? formatNumber(value) : String(value);
        lines.push(`${escapeCSVField(label)}${CSV_CONFIG.delimiter}${escapeCSVField(formattedValue)}`);
      }
    }
  }
  
  const csvContent = lines.join('\n');
  return Buffer.from(csvContent, 'utf-8');
}

export function generateCSVFilename(exportType: string, dateFrom?: string, dateTo?: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const dateRange = dateFrom && dateTo 
    ? `${dateFrom}_${dateTo}` 
    : 'all';
  return `${exportType}_${dateRange}_${timestamp}.csv`;
}
