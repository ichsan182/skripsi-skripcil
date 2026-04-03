/**
 * Format Utilities
 * Pure utility functions untuk format currency dan number yang konsisten
 */

export const MAX_CURRENCY_AMOUNT = 10_000_000_000;

export interface CurrencyFormatOptions {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}

export function clampCurrencyAmount(
  amount: number,
  maxAmount: number = MAX_CURRENCY_AMOUNT,
): number {
  const normalized = Number.isFinite(amount) ? amount : 0;
  return Math.max(0, Math.min(maxAmount, normalized));
}

export function parseCurrencyInput(
  rawValue: string,
  maxAmount: number = MAX_CURRENCY_AMOUNT,
): number {
  const digitsOnly = (rawValue || '').replace(/[^0-9]/g, '');
  if (!digitsOnly) {
    return 0;
  }

  return clampCurrencyAmount(Number(digitsOnly), maxAmount);
}

export function parseCurrencyInputUncapped(rawValue: string): number {
  const digitsOnly = (rawValue || '').replace(/[^0-9]/g, '');
  if (!digitsOnly) {
    return 0;
  }

  const parsed = Number(digitsOnly);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

export function formatCurrencyPlain(
  amount: number,
  options: CurrencyFormatOptions = {},
): string {
  const { minimumFractionDigits = 0, maximumFractionDigits = 0 } = options;

  const normalized = Number.isFinite(amount) ? amount : 0;

  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(normalized);
}

export function formatCurrencyWithPrefix(
  amount: number,
  prefix: string = 'Rp ',
  options: CurrencyFormatOptions = {},
): string {
  return `${prefix}${formatCurrencyPlain(amount, options)}`;
}

/**
 * Format bilangan ke format Rupiah dengan pemisah ribuan
 * @param amount - Amount to format
 * @returns Formatted currency string (Rp format)
 */
export function formatCurrency(amount: number): string {
  return formatCurrencyWithPrefix(amount);
}

/**
 * Format bilangan untuk display (contoh: 1.2M, 500Jt, 100Rb)
 * @param amount - Amount to format
 * @returns Compact formatted string
 */
export function formatCompactCurrency(amount: number): string {
  if (amount >= 1_000_000_000) {
    return `${trimTrailingZero(amount / 1_000_000_000)} M`;
  }

  if (amount >= 1_000_000) {
    return `${trimTrailingZero(amount / 1_000_000)} Jt`;
  }

  if (amount >= 1_000) {
    return `${trimTrailingZero(amount / 1_000)} Rb`;
  }

  return formatCurrency(amount);
}

/**
 * Format bilangan untuk input display, dengan separator ribuan
 * @param value - Value to format
 * @returns Formatted number string
 */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('id-ID').format(value);
}

/**
 * Format persentase, dengan max 100% dan min 0%
 * @param value - Percentage value
 * @returns Formatted percentage string
 */
export function formatPercent(value: number): string {
  const normalized = Number.isFinite(value) ? value : 0;
  const safe = Math.min(100, Math.max(0, normalized));
  return trimTrailingZero(safe);
}

/**
 * Hapus trailing zero dari bilangan desimal
 * @param value - Value to process
 * @returns String tanpa .0
 */
export function trimTrailingZero(value: number): string {
  return value.toFixed(1).replace('.0', '');
}
