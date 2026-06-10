/**
 * Pure helper functions for budget and savings computation in the Home dashboard.
 * None of these functions access component state — all inputs are passed explicitly.
 */

import {
  BudgetAllocation,
  FinancialData,
} from '../core/services/journal.service';
import { startOfDay, resolveResetDay, toDateKey } from './home-date.helpers';

// ─── Budget mode & allocation helpers ────────────────────────────────────────

export function normalizeBudgetMode(mode: number): 2 | 3 {
  return Number(mode) === 3 ? 3 : 2;
}

/**
 * Returns the total expense percentage for a budget allocation.
 * In 3-part mode (50/30/20) this includes the "wants" slice.
 */
export function getBudgetExpensePercent(budget: BudgetAllocation): number {
  return budget.mode === 3
    ? budget.pengeluaran + budget.wants
    : budget.pengeluaran;
}

/**
 * Computes the gross savings pool base before subtracting amounts already
 * allocated in the current cycle.
 */
export function computeSavingsPoolBase(
  pendapatan: number,
  budget: BudgetAllocation,
): number {
  return Math.max(
    0,
    Math.round((Math.max(0, pendapatan) * budget.savings) / 100),
  );
}

/**
 * Clamps a raw percentage value to the range [0, 100].
 * Returns 0 for non-finite or negative values.
 */
export function toSafePercent(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

/**
 * Corrects a stored BudgetAllocation whose `pengeluaran` and `savings` fields
 * may have been saved in swapped order (a legacy issue).  Returns the original
 * object unchanged when mode ≠ 2 or the recorded data already matches.
 */
export function normalizeBudgetAllocationForEditor(
  budget: BudgetAllocation,
  financialData: FinancialData | null,
): BudgetAllocation {
  if (normalizeBudgetMode(budget.mode) !== 2) return budget;

  const income = Math.max(0, financialData?.pendapatan || 0);
  if (income <= 0) return budget;

  const recordedExpense = Math.max(
    0,
    Math.round(financialData?.pengeluaranWajib ?? 0),
  );
  if (recordedExpense <= 0) return budget;

  const expectedExpenseByPengeluaran = Math.round(
    (income * budget.pengeluaran) / 100,
  );
  const expectedExpenseBySavings = Math.round((income * budget.savings) / 100);
  const diffToPengeluaran = Math.abs(
    recordedExpense - expectedExpenseByPengeluaran,
  );
  const diffToSavings = Math.abs(recordedExpense - expectedExpenseBySavings);

  if (diffToPengeluaran <= 1) return budget;

  if (diffToSavings <= 1) {
    return {
      ...budget,
      pengeluaran: budget.savings,
      savings: budget.pengeluaran,
    };
  }

  const derivedPengeluaran = Math.max(
    0,
    Math.min(100, Math.round((recordedExpense / income) * 100)),
  );
  return {
    ...budget,
    pengeluaran: derivedPengeluaran,
    wants: 0,
    savings: Math.max(0, 100 - derivedPengeluaran),
  };
}

// ─── Budget cycle helpers ─────────────────────────────────────────────────────

/**
 * Returns the billing-cycle date range (start..end inclusive) for the given
 * reference date, using the intended reset day from financialData.
 */
export function resolveCycleRangeByDate(
  referenceDate: Date,
  financialData: FinancialData,
): { start: Date; end: Date } {
  const intendedDay = Math.max(
    1,
    Math.min(
      31,
      Math.floor(
        financialData.intendedTanggalPemasukan ||
          financialData.tanggalPemasukan ||
          1,
      ),
    ),
  );
  const resetDayThisMonth = resolveResetDay(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    intendedDay,
  );
  const thisMonthResetDate = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    resetDayThisMonth,
  );
  const start =
    referenceDate >= thisMonthResetDate
      ? thisMonthResetDate
      : new Date(
          referenceDate.getFullYear(),
          referenceDate.getMonth() - 1,
          resolveResetDay(
            referenceDate.getFullYear(),
            referenceDate.getMonth() - 1,
            intendedDay,
          ),
        );
  const nextStart = new Date(
    start.getFullYear(),
    start.getMonth() + 1,
    resolveResetDay(start.getFullYear(), start.getMonth() + 1, intendedDay),
  );
  const end = new Date(nextStart);
  end.setDate(end.getDate() - 1);
  return { start: startOfDay(start), end: startOfDay(end) };
}

/**
 * Returns the pengeluaran budget ceiling for the billing cycle that contains
 * the given date. Falls back to pengeluaranWajib for historical cycles.
 */
export function getCycleBudgetByDate(
  date: Date,
  financialData: FinancialData,
): number {
  const targetDateKey = toDateKey(date);
  if (
    financialData.currentCycleStart &&
    financialData.currentCycleEnd &&
    targetDateKey >= financialData.currentCycleStart &&
    targetDateKey <= financialData.currentCycleEnd
  ) {
    return financialData.currentPengeluaranLimit ?? financialData.pengeluaranWajib;
  }
  return financialData.pengeluaranWajib;
}
