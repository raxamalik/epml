import PDFDocument from 'pdfkit';
import { ExportData, ExportTotals, ExportType } from './types';
import { PDF_CONFIG, EXPORT_TYPE_NAMES, TOTALS_LABELS } from './constants';

function formatNumber(value: number): string {
  return value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ').replace('.', ',');
}

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('cs-CZ', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    return dateString;
  }
}

/**
 * Formats a datetime for display
 */
function formatDateTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleString('cs-CZ', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
}

/**
 * Adds a table row to PDF document
 */
function addTableRow(
  doc: InstanceType<typeof PDFDocument>,
  x: number,
  y: number,
  columns: string[],
  columnWidths: number[],
  isHeader: boolean = false
): number {
  const rowHeight = 20;
  let currentX = x;
  
  // Draw background for header
  if (isHeader) {
    doc.rect(x, y, columnWidths.reduce((a, b) => a + b, 0), rowHeight)
       .fill(PDF_CONFIG.colors.header);
  }
  
  // Draw text
  columns.forEach((text, index) => {
    doc.font(isHeader ? PDF_CONFIG.font.bold : PDF_CONFIG.font.normal)
       .fontSize(PDF_CONFIG.font.size.body)
       .fillColor(isHeader ? '#ffffff' : PDF_CONFIG.colors.text)
       .text(String(text || ''), currentX + 5, y + 5, {
         width: columnWidths[index] - 10,
         align: 'left',
       });
    currentX += columnWidths[index];
  });
  
  // Draw border
  doc.strokeColor(PDF_CONFIG.colors.border)
     .lineWidth(0.5)
     .rect(x, y, columnWidths.reduce((a, b) => a + b, 0), rowHeight)
     .stroke();
  
  return y + rowHeight;
}

/**
 * Generates PDF content from export data
 */
export async function generatePDF(
  data: ExportData,
  exportType: ExportType,
  dateFrom?: string,
  dateTo?: string
): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: PDF_CONFIG.pageSize,
      margins: PDF_CONFIG.margin,
    });
    
    const chunks: Buffer[] = [];
    
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    
    let y = PDF_CONFIG.margin.top;
    
    // Title
    doc.font(PDF_CONFIG.font.bold)
       .fontSize(PDF_CONFIG.font.size.title)
       .fillColor(PDF_CONFIG.colors.text)
       .text(EXPORT_TYPE_NAMES[exportType], PDF_CONFIG.margin.left, y, {
         align: 'left',
       });
    
    y += 30;
    
    // Date range
    if (dateFrom || dateTo) {
      const dateRange = dateFrom && dateTo
        ? `${formatDate(dateFrom)} - ${formatDate(dateTo)}`
        : dateFrom
        ? `Od: ${formatDate(dateFrom)}`
        : `Do: ${formatDate(dateTo!)}`;
      
      doc.font(PDF_CONFIG.font.normal)
         .fontSize(PDF_CONFIG.font.size.body)
         .text(`Období: ${dateRange}`, PDF_CONFIG.margin.left, y, {
           align: 'left',
         });
      
      y += 20;
    }
    
    // Generation date
    doc.font(PDF_CONFIG.font.normal)
       .fontSize(PDF_CONFIG.font.size.footer)
       .fillColor('#6b7280')
       .text(`Vygenerováno: ${new Date().toLocaleString('cs-CZ')}`, PDF_CONFIG.margin.left, y, {
         align: 'left',
       });
    
    y += 30;
    
    // Calculate column widths
    const pageWidth = doc.page.width - PDF_CONFIG.margin.left - PDF_CONFIG.margin.right;
    const columnCount = data.headers.length;
    const columnWidth = pageWidth / columnCount;
    const columnWidths = data.headers.map(() => columnWidth);
    
    // Table header
    y = addTableRow(doc, PDF_CONFIG.margin.left, y, data.headers, columnWidths, true);
    
    // Table rows
    for (const row of data.rows) {
      // Check if we need a new page
      if (y + 20 > doc.page.height - PDF_CONFIG.margin.bottom) {
        doc.addPage();
        y = PDF_CONFIG.margin.top;
        // Redraw header on new page
        y = addTableRow(doc, PDF_CONFIG.margin.left, y, data.headers, columnWidths, true);
      }
      
      const rowData = data.headers.map(header => {
        const value = row[header];
        if (value === null || value === undefined) {
          return '';
        }
        if (typeof value === 'number') {
          return formatNumber(value);
        }
        return String(value);
      });
      
      y = addTableRow(doc, PDF_CONFIG.margin.left, y, rowData, columnWidths, false);
    }
    
    // Add summary section
    if (data.totals && Object.keys(data.totals).length > 0) {
      y += 20;
      
      // Check if we need a new page for summary
      if (y + 100 > doc.page.height - PDF_CONFIG.margin.bottom) {
        doc.addPage();
        y = PDF_CONFIG.margin.top;
      }
      
      // Summary title
      doc.font(PDF_CONFIG.font.bold)
         .fontSize(PDF_CONFIG.font.size.header)
         .fillColor(PDF_CONFIG.colors.summary)
         .text('SOUHRN', PDF_CONFIG.margin.left, y, {
           align: 'left',
         });
      
      y += 25;
      
      // Summary rows
      for (const [key, value] of Object.entries(data.totals)) {
        const label = TOTALS_LABELS[key as keyof typeof TOTALS_LABELS] || key;
        const formattedValue = typeof value === 'number' ? formatNumber(value) : String(value);
        
        doc.font(PDF_CONFIG.font.bold)
           .fontSize(PDF_CONFIG.font.size.body)
           .fillColor(PDF_CONFIG.colors.text)
           .text(`${label}:`, PDF_CONFIG.margin.left, y, {
             width: pageWidth * 0.6,
             align: 'left',
           });
        
        doc.font(PDF_CONFIG.font.bold)
           .fontSize(PDF_CONFIG.font.size.body)
           .fillColor(PDF_CONFIG.colors.summary)
           .text(formattedValue, PDF_CONFIG.margin.left + pageWidth * 0.6, y, {
             width: pageWidth * 0.4,
             align: 'right',
           });
        
        y += 20;
      }
    }
    
    // Add grouped totals if present
    if (data.groupedTotals) {
      for (const [groupKey, groupTotals] of Object.entries(data.groupedTotals)) {
        y += 20;
        
        if (y + 100 > doc.page.height - PDF_CONFIG.margin.bottom) {
          doc.addPage();
          y = PDF_CONFIG.margin.top;
        }
        
        doc.font(PDF_CONFIG.font.bold)
           .fontSize(PDF_CONFIG.font.size.header)
           .fillColor(PDF_CONFIG.colors.summary)
           .text(`SOUHRN - ${groupKey}`, PDF_CONFIG.margin.left, y, {
             align: 'left',
           });
        
        y += 25;
        
        for (const [key, value] of Object.entries(groupTotals)) {
          const label = TOTALS_LABELS[key as keyof typeof TOTALS_LABELS] || key;
          const formattedValue = typeof value === 'number' ? formatNumber(value) : String(value);
          
          doc.font(PDF_CONFIG.font.bold)
             .fontSize(PDF_CONFIG.font.size.body)
             .fillColor(PDF_CONFIG.colors.text)
             .text(`${label}:`, PDF_CONFIG.margin.left, y, {
               width: pageWidth * 0.6,
               align: 'left',
             });
          
          doc.font(PDF_CONFIG.font.bold)
             .fontSize(PDF_CONFIG.font.size.body)
             .fillColor(PDF_CONFIG.colors.summary)
             .text(formattedValue, PDF_CONFIG.margin.left + pageWidth * 0.6, y, {
               width: pageWidth * 0.4,
               align: 'right',
             });
          
          y += 20;
        }
      }
    }
    
    doc.end();
  });
}

/**
 * Generates filename for PDF export
 */
export function generatePDFFilename(exportType: string, dateFrom?: string, dateTo?: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const dateRange = dateFrom && dateTo 
    ? `${dateFrom}_${dateTo}` 
    : 'all';
  return `${exportType}_${dateRange}_${timestamp}.pdf`;
}
