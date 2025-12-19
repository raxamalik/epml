import { format, formatDistanceToNow, type Locale } from "date-fns";
import { enUS, cs } from "date-fns/locale";

/**
 * Format a date string to a readable date-time string
 * @param dateString - ISO date string
 * @param options - Formatting options
 * @returns Formatted date string
 */
export function formatDate(dateString: string, options?: { includeTime?: boolean }): string {
  try {
    const date = new Date(dateString);
    if (options?.includeTime === false) {
      return format(date, "MMM dd, yyyy");
    }
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch (error) {
    return dateString;
  }
}

/**
 * Format a date string to a detailed date-time string
 * @param dateString - ISO date string
 * @returns Formatted date-time string (e.g., "MMM dd, yyyy HH:mm:ss")
 */
export function formatDateTime(dateString: string): string {
  try {
    return format(new Date(dateString), "MMM dd, yyyy HH:mm:ss");
  } catch (error) {
    return dateString;
  }
}

/**
 * Format a date string to a relative time string (e.g., "2 hours ago")
 * @param dateString - ISO date string
 * @param locale - Optional locale code ('en' or 'cz')
 * @returns Relative time string
 */
export function formatRelativeTime(dateString: string, locale?: string): string {
  try {
    const localeMap: Record<string, Locale> = {
      'en': enUS,
      'cz': cs,
      'cs': cs,
    };
    const selectedLocale = locale ? localeMap[locale] || enUS : enUS;
    return formatDistanceToNow(new Date(dateString), { 
      addSuffix: true,
      locale: selectedLocale
    });
  } catch (error) {
    return dateString;
  }
}

/**
 * Format a date string to a specific format
 * @param dateString - ISO date string
 * @param dateFormat - Date format string (date-fns format)
 * @returns Formatted date string
 */
export function formatDateCustom(dateString: string, dateFormat: string): string {
  try {
    return format(new Date(dateString), dateFormat);
  } catch (error) {
    return dateString;
  }
}

/**
 * Format JSON data for display
 * @param data - Data to format
 * @returns Formatted JSON string or "N/A"
 */
export function formatJsonData(data: any): string {
  if (!data) return "N/A";
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
}

