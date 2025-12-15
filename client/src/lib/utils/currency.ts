/**
 * Format a number as currency
 * @param amount - Amount to format
 * @param currency - Currency code (default: "EUR")
 * @param locale - Locale string (default: "en-US")
 * @returns Formatted currency string
 */
export function formatCurrency(amount: number, currency: string = "EUR", locale: string = "en-US"): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
    }).format(amount);
  } catch (error) {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/**
 * Format a number as currency with custom symbol
 * @param amount - Amount to format
 * @param symbol - Currency symbol (default: "€")
 * @returns Formatted currency string
 */
export function formatCurrencyWithSymbol(amount: number, symbol: string = "€"): string {
  try {
    return `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  } catch (error) {
    return `${symbol}${amount.toFixed(2)}`;
  }
}

/**
 * Parse a currency string to a number
 * @param value - Currency string
 * @returns Parsed number
 */
export function parseCurrency(value: string): number {
  try {
    return parseFloat(value.replace(/[^\d.-]/g, ''));
  } catch (error) {
    return 0;
  }
}

