/**
 * Format Utilities
 * Pure utility functions untuk format currency dan number yang konsisten
 */

export const MAX_CURRENCY_AMOUNT = 10_000_000_000;

export interface CurrencyFormatOptions {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}

export enum CurrencyCode {
  IDR = 'IDR',
  USD = 'USD',
  EUR = 'EUR',
  JPY = 'JPY',
  CNY = 'CNY',
  CHF = 'CHF',
  GBP = 'GBP',
  SGD = 'SGD',
  AUD = 'AUD',
  CAD = 'CAD',
}

export const DEFAULT_CURRENCY_CODE = CurrencyCode.IDR;

const CURRENCY_PREFIX_MAP: Record<CurrencyCode, string> = {
  [CurrencyCode.IDR]: 'Rp ',
  [CurrencyCode.USD]: '$ ',
  [CurrencyCode.EUR]: '€ ',
  [CurrencyCode.JPY]: '¥ ',
  [CurrencyCode.CNY]: 'CN¥ ',
  [CurrencyCode.CHF]: 'CHF ',
  [CurrencyCode.GBP]: '£ ',
  [CurrencyCode.SGD]: 'S$ ',
  [CurrencyCode.AUD]: 'A$ ',
  [CurrencyCode.CAD]: 'C$ ',
};

export function getCurrencyPrefix(
  currencyCode: CurrencyCode = DEFAULT_CURRENCY_CODE,
): string {
  return (
    CURRENCY_PREFIX_MAP[currencyCode] ??
    CURRENCY_PREFIX_MAP[DEFAULT_CURRENCY_CODE]
  );
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
  prefix: string = getCurrencyPrefix(DEFAULT_CURRENCY_CODE),
  options: CurrencyFormatOptions = {},
): string {
  return `${prefix}${formatCurrencyPlain(amount, options)}`;
}

export function formatCurrencyByCode(
  amount: number,
  currencyCode: CurrencyCode = DEFAULT_CURRENCY_CODE,
  options: CurrencyFormatOptions = {},
): string {
  return formatCurrencyWithPrefix(
    amount,
    getCurrencyPrefix(currencyCode),
    options,
  );
}

/**
 * Format bilangan ke format Rupiah dengan pemisah ribuan
 * @param amount - Amount to format
 * @returns Formatted currency string (Rp format)
 */
export function formatCurrency(amount: number): string {
  return formatCurrencyByCode(amount, DEFAULT_CURRENCY_CODE);
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
