/**
 * Format Utilities
 * Pure utility functions untuk format currency dan number yang konsisten
 */

/**
 * Format bilangan ke format Rupiah dengan pemisah ribuan
 * @param amount - Amount to format
 * @returns Formatted currency string (Rp format)
 */
export function formatCurrency(amount: number): string {
  return `Rp ${new Intl.NumberFormat('id-ID').format(amount)}`;
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
