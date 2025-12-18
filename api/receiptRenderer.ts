export type ReceiptLanguage = 'en' | 'cz';
export type ReceiptMode = 'description' | 'live';
export type PaymentMethod = 'cash' | 'card';

export interface ReceiptRenderOptions {
  language: ReceiptLanguage;
  mode: ReceiptMode;
  paymentMethod: PaymentMethod;
}

interface SaleWithDetails {
  sale: any;
  items: Array<{
    id: number;
    productId: number;
    batchId?: number | null;
    quantity: string | number;
    unitPrice: string | number;
    vatRate: string | number;
    product?: {
      name: string;
      pack?: string;
    };
    batch?: {
      batchNumber?: string;
    };
  }>;
  company: {
    name: string;
    address: string;
    registrationNumber: string;
    vatNumber?: string | null;
    companyLogo?: string | null;
  };
  store: {
    id: number;
    name: string;
    address?: string | null;
  };
  cashier?: {
    firstName?: string;
    lastName?: string;
  } | null;
  totals: {
    subtotal: number;
    discount?: number;
    discountName?: string;
    vatBase: number;
    vatAmount: number;
    total: number;
  };
  payment?: {
    terminalId?: string;
    authCode?: string;
    paid: number;
    change: number;
  };
  currency?: string;
  receiptNumber?: string;
  registerId?: string;
}

// Receipt labels in English and Czech
const receiptLabels: Record<ReceiptLanguage, Record<string, string>> = {
  en: {
    taxReceiptTitle: "Tax receipt",
    companyId: "Company ID",
    vatId: "VAT ID",
    branch: "Branch",
    address: "Address",
    register: "Register",
    cashier: "Cashier",
    dateTime: "Date/time",
    receiptNo: "Receipt No.",
    mode: "Mode",
    itemsTitle: "ITEMS",
    batch: "Batch",
    quantity: "Quantity",
    unitPrice: "Unit price",
    vat: "VAT",
    subtotal: "SUBTOTAL",
    discount: "Discount",
    vatBase: "VAT BASE",
    totalVat: "VAT",
    totalDue: "TOTAL DUE",
    paymentTitle: "PAYMENT",
    paymentType: "Payment type",
    terminal: "Terminal",
    authorization: "Authorization",
    paid: "Paid",
    change: "Change",
    footerLine1: "Thank you and have a nice day.",
  },
  cz: {
    taxReceiptTitle: "Daňový doklad",
    companyId: "IČO",
    vatId: "DIČ",
    branch: "Pobočka",
    address: "Adresa",
    register: "Pokladna",
    cashier: "Pokladní",
    dateTime: "Datum/čas",
    receiptNo: "Číslo dokladu",
    mode: "Typ",
    itemsTitle: "POLOŽKY",
    batch: "Šarže",
    quantity: "Množství",
    unitPrice: "Jednotková cena",
    vat: "DPH",
    subtotal: "MEZISOUČET",
    discount: "Sleva",
    vatBase: "Základ DPH",
    totalVat: "DPH",
    totalDue: "CELKEM K ÚHRADĚ",
    paymentTitle: "PLATBA",
    paymentType: "Způsob platby",
    terminal: "Terminál",
    authorization: "Autorizace",
    paid: "Zaplaceno",
    change: "Vráceno",
    footerLine1: "Děkujeme a přejeme hezký den.",
  },
};

function formatMoney(amount: number | string | null | undefined, currency: string = "CZK"): string {
  if (amount === null || amount === undefined) return "0.00";
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return `${num.toFixed(2)} ${currency}`;
}

function formatDateTime(date: Date | string | null | undefined, language: ReceiptLanguage): string {
  if (!date) return "";
  const d = typeof date === 'string' ? new Date(date) : date;
  
  if (language === 'cz') {
    // Czech format: DD.MM.YYYY HH:MM:SS
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`;
  } else {
    // English format: DD.MM.YYYY HH:MM:SS (same format for consistency)
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`;
  }
}

function parseAddress(address: string): { street: string; city: string } {
  // Try to parse address like "Street 123, 12345 City" or "Street 123, City"
  const parts = address.split(',').map(s => s.trim());
  if (parts.length >= 2) {
    const street = parts[0];
    const cityPart = parts[parts.length - 1];
    // Check if city part has ZIP code
    const zipMatch = cityPart.match(/^(\d+)\s+(.+)$/);
    if (zipMatch) {
      return { street, city: `${zipMatch[1]} ${zipMatch[2]}` };
    }
    return { street, city: cityPart };
  }
  return { street: address, city: "" };
}

export function renderCashCardTaxReceipt(
  data: SaleWithDetails,
  options: ReceiptRenderOptions
): string {
  const isDescription = options.mode === 'description';
  const labels = receiptLabels[options.language];
  const currency = data.currency || "CZK";

  const lines: string[] = [];

  // Company logo placeholder (above receipt details)
  if (isDescription) {
    lines.push("");
    lines.push("          [COMPANY LOGO]");
    lines.push("");
  } else if (data.company.companyLogo) {
    // In live mode, if logo exists, add placeholder for it
    // For text receipts, we'll add a centered placeholder
    lines.push("");
    lines.push("          [LOGO]");
    lines.push("");
  }

  // Header - Tax receipt title
  lines.push(labels.taxReceiptTitle);
  lines.push("");

  // Company information
  const companyName = isDescription ? "[COMPANY NAME]" : data.company.name;
  lines.push(companyName);

  const address = isDescription ? "[STREET + NO.]" : data.company.address;
  const { street, city } = parseAddress(address);
  
  if (isDescription) {
    lines.push("[STREET + NO.]");
    lines.push("[ZIP + CITY]");
  } else {
    lines.push(street);
    if (city) {
      lines.push(city);
    }
  }

  const companyId = isDescription ? "[ICO]" : data.company.registrationNumber;
  lines.push(`${labels.companyId}: ${companyId}`);

  const vatId = isDescription ? "[VAT ID]" : (data.company.vatNumber || "");
  if (vatId) {
    lines.push(`${labels.vatId}: ${vatId}`);
  }

  lines.push("----------------------------------------------");

  // Transaction details
  const branchName = isDescription ? "[BRANCH NAME]" : data.store.name;
  const branchId = isDescription ? "[BRANCH ID]" : data.store.id.toString();
  lines.push(`${labels.branch}: ${branchName} ID:${branchId}`);

  const branchAddress = isDescription ? "[BRANCH ADDRESS]" : (data.store.address || "");
  if (branchAddress) {
    lines.push(`${labels.address}: ${branchAddress}`);
  }

  const registerId = isDescription ? "[REGISTER/POS]" : (data.registerId || "POS-01");
  const cashierName = isDescription ? "[CASHIER]" : 
    (data.cashier ? `${data.cashier.firstName || ""} ${data.cashier.lastName || ""}`.trim() : "");
  lines.push(`${labels.register}: ${registerId} ${labels.cashier}: ${cashierName}`);

  const dateTime = isDescription ? "[DATE] [TIME]" : formatDateTime(data.sale.createdAt, options.language);
  lines.push(`${labels.dateTime}: ${dateTime}`);

  const receiptNo = isDescription ? "[RECEIPT NO.]" : (data.receiptNumber || data.sale.id);
  const mode = isDescription ? "[MODE]" : "SALE";
  lines.push(`${labels.receiptNo}: ${receiptNo} ${labels.mode}: ${mode}`);

  lines.push("==============================================");
  lines.push("");

  // Items section
  lines.push(labels.itemsTitle);
  lines.push("----------------------------------------------");

  // Items section - use actual item structure from sale, show placeholders in description mode
  data.items.forEach((item: any, index: number) => {
    const itemNum = index + 1;
    if (isDescription) {
      // Description mode - show placeholders but use actual item structure
      const hasPack = item.product?.pack ? true : false;
      if (hasPack) {
        lines.push(`${itemNum}) [ITEM ${itemNum} NAME] ([ITEM ${itemNum} PACK])`);
      } else {
        lines.push(`${itemNum}) [ITEM ${itemNum} NAME]`);
      }
      
      // Always show batch in description mode (as placeholder)
      lines.push(`${labels.batch}: [ITEM ${itemNum} BATCH]`);
      
      lines.push(`${labels.quantity}: [ITEM ${itemNum} QTY] pcs ${labels.unitPrice}: [ITEM ${itemNum} UNIT PRICE] ${currency}`);
      lines.push(`${labels.vat}: [ITEM ${itemNum} VAT]% [ITEM ${itemNum} LINE TOTAL] ${currency}`);
    } else {
      // Live mode - show real data
      const itemName = item.product?.name || "";
      const pack = item.product?.pack || "";
      const itemLine = pack ? `${itemNum}) ${itemName} (${pack})` : `${itemNum}) ${itemName}`;
      lines.push(itemLine);

      const batch = item.batch?.batchNumber || "";
      if (batch) {
        lines.push(`${labels.batch}: ${batch}`);
      }

      const qty = item.quantity.toString();
      const unitPrice = formatMoney(item.unitPrice, currency);
      lines.push(`${labels.quantity}: ${qty} pcs ${labels.unitPrice}: ${unitPrice}`);

      const vatRate = `${item.vatRate}%`;
      const lineTotal = parseFloat(item.unitPrice.toString()) * parseFloat(item.quantity.toString());
      const lineTotalFormatted = formatMoney(lineTotal, currency);
      lines.push(`${labels.vat}: ${vatRate} ${lineTotalFormatted}`);
    }
    // No blank line between items - they flow directly
  });

  lines.push("----------------------------------------------");

  // Summary section - following the exact design with separators
  const subtotal = isDescription ? `[SUBTOTAL] ${currency}` : formatMoney(data.totals.subtotal, currency);
  lines.push(`${labels.subtotal} ${subtotal}`);
  lines.push("----------------------------------------------");

  // Always show discount in description mode, or if there's a discount in live mode
  if (isDescription) {
    // Always show discount placeholder in description mode
    lines.push(`${labels.discount} ([DISCOUNT NAME]) [DISCOUNT AMOUNT] ${currency}`);
    lines.push("----------------------------------------------");
  } else if (data.totals.discount && data.totals.discount > 0) {
    // Only show discount in live mode if it exists
    const discountName = data.totals.discountName || "";
    const discountAmount = formatMoney(-data.totals.discount, currency);
    lines.push(`${labels.discount} (${discountName}) ${discountAmount}`);
    lines.push("----------------------------------------------");
  }

  const vatBase = isDescription ? `[VAT BASE] ${currency}` : formatMoney(data.totals.vatBase, currency);
  // Use actual VAT rate from items (or first item's rate, or default to 21)
  const vatRate = data.items.length > 0 ? data.items[0].vatRate : "21";
  const vatRateDisplay = isDescription ? "[VAT RATE]" : vatRate;
  lines.push(`${labels.vatBase} ${vatRateDisplay}% ${vatBase}`);

  const vatAmount = isDescription ? `[VAT AMOUNT] ${currency}` : formatMoney(data.totals.vatAmount, currency);
  lines.push(`${labels.totalVat} ${vatRateDisplay}% ${vatAmount}`);
  lines.push("----------------------------------------------");

  const totalDue = isDescription ? `[TOTAL] ${currency}` : formatMoney(data.totals.total, currency);
  lines.push(`${labels.totalDue} ${totalDue}`);

  lines.push("==============================================");
  lines.push("");

  // Payment section - following the exact design
  lines.push("");
  lines.push(labels.paymentTitle);
  lines.push("----------------------------------------------");

  const paymentType = options.paymentMethod.toUpperCase();
  lines.push(`${labels.paymentType}: ${paymentType}`);

  // Show terminal and authorization only for card payments (no Paid/Change for card)
  if (options.paymentMethod === 'card') {
    if (isDescription) {
      lines.push(`${labels.terminal}: [TERMINAL ID]`);
      lines.push(`${labels.authorization}: [AUTH CODE]`);
    } else {
      const terminalId = data.payment?.terminalId || "";
      if (terminalId) {
        lines.push(`${labels.terminal}: ${terminalId}`);
      }

      const authCode = data.payment?.authCode || "";
      if (authCode) {
        lines.push(`${labels.authorization}: ${authCode}`);
      }
    }
  } else {
    // For cash payments, show Paid and Change
    const paid = isDescription ? `[PAID] ${currency}` : formatMoney(data.payment?.paid || data.totals.total, currency);
    lines.push(`${labels.paid}: ${paid}`);
    
    const change = isDescription ? `[CHANGE] ${currency}` : formatMoney(data.payment?.change || 0, currency);
    lines.push(`${labels.change}: ${change}`);
  }

  lines.push("==============================================");
  lines.push("");

  // Footer
  lines.push(labels.footerLine1);
  lines.push("----------------------------------------------");
  lines.push("ePML.cz");

  return lines.join("\n");
}

