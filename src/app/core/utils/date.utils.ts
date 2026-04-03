/**
 * Date Utilities
 * Pure utility functions untuk operasi tanggal yang konsisten di seluruh aplikasi.
 * Tidak memiliki dependensi pada state atau service.
 */

/**
 * Normalize date ke awal hari (00:00:00)
 * @param date - Date to normalize
 * @returns Normalized date at 00:00:00
 */
export function normalizeDate(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Convert date ke format key YYYY-MM-DD
 * @param date - Date to convert
 * @returns Date key string
 */
export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse date key YYYY-MM-DD ke Date object
 * @param dateKey - Date key string (YYYY-MM-DD)
 * @returns Date atau null jika invalid
 */
export function parseDateKey(dateKey: string): Date | null {
  const [yearRaw, monthRaw, dayRaw] = dateKey.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
    return null;
  }

  return new Date(year, month - 1, day);
}

/**
 * Hitung perbedaan hari antara dua tanggal
 * @param start - Start date
 * @param end - End date
 * @returns Number of days between start and end
 */
export function daysBetween(start: Date, end: Date): number {
  const startMs = normalizeDate(start).getTime();
  const endMs = normalizeDate(end).getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.floor((endMs - startMs) / dayMs);
}

/**
 * Konversi ke format bulan-tahun input (YYYY-MM)
 * @param year - Tahun
 * @param monthIndex - Index bulan (0-11)
 * @returns Input value untuk month picker
 */
export function toMonthInputValue(year: number, monthIndex: number): string {
  const monthStr = `${monthIndex + 1}`.padStart(2, '0');
  return `${year}-${monthStr}`;
}
