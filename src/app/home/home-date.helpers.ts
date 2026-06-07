/**
 * Pure date utility functions for the Home dashboard.
 * No side effects, no component state — all inputs passed explicitly.
 */

export function startOfDay(date: Date): Date {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

export function parseDateKey(dateKey: string): Date | null {
  const [yearRaw, monthRaw, dayRaw] = dateKey.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }
  return startOfDay(new Date(year, month - 1, day));
}

export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function daysBetween(from: Date, to: Date): number {
  const ms = startOfDay(to).getTime() - startOfDay(from).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export function toMonthInputValue(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
}

export function toYearMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** Returns the actual reset day for the given month, clamped to the last day of that month. */
export function resolveResetDay(
  year: number,
  monthIndex: number,
  intendedDay: number,
): number {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return Math.min(intendedDay, lastDay);
}
