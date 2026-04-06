import { Injectable, inject } from '@angular/core';
import { FinancialData, UserJournal } from '../services/journal.service';
import { daysBetween, parseDateKey, normalizeDate } from './date.utils';

export interface RollingBudgetState {
  rollingTotalBudget: number;
  rollingUsedBudget: number;
  rollingBudgetRemaining: number;
  rollingDaysRemaining: number;
  rollingBudgetToday: number;
}

/**
 * Service untuk menghitung rolling budget state
 * Digunakan oleh komponen Home dan Transaction
 *
 * Best practice:
 * - Centralized calculation logic untuk rolling budget
 * - Pure functions ketika memungkinkan (perlu journal data dari komponen)
 * - Consistent calculation across all pages
 */
@Injectable({
  providedIn: 'root',
})
export class RollingBudgetService {
  /**
   * Compute rolling budget state berdasarkan financial data dan journal
   * @param financialData - Current financial data
   * @param journal - User journal dengan expense entries
   * @returns Rolling budget state object
   */
  computeRollingBudgetState(
    financialData: FinancialData | null,
    journal: UserJournal,
    referenceDate: Date = new Date(),
  ): RollingBudgetState {
    // Default state jika data tidak lengkap
    if (!financialData?.currentCycleStart || !financialData.currentCycleEnd) {
      return {
        rollingTotalBudget: 0,
        rollingUsedBudget: 0,
        rollingBudgetRemaining: 0,
        rollingDaysRemaining: 0,
        rollingBudgetToday: 0,
      };
    }

    const cycleStart = parseDateKey(financialData.currentCycleStart);
    const cycleEnd = parseDateKey(financialData.currentCycleEnd);
    if (!cycleStart || !cycleEnd) {
      return {
        rollingTotalBudget: 0,
        rollingUsedBudget: 0,
        rollingBudgetRemaining: 0,
        rollingDaysRemaining: 0,
        rollingBudgetToday: 0,
      };
    }

    const today = normalizeDate(referenceDate);
    const dayBeforeToday = new Date(today);
    dayBeforeToday.setDate(dayBeforeToday.getDate() - 1);

    const usedBeforeToday = this.sumExpensesInRange(
      cycleStart,
      dayBeforeToday,
      journal,
    );
    const totalBudget =
      financialData.currentPengeluaranLimit ?? financialData.pengeluaranWajib;
    const remainingBudget = Math.max(0, totalBudget - usedBeforeToday);
    const remainingDays = Math.max(1, daysBetween(today, cycleEnd) + 1);

    const rollingUsedBudget = financialData.currentPengeluaranUsed || 0;

    return {
      rollingTotalBudget: totalBudget,
      rollingUsedBudget,
      rollingBudgetRemaining: Math.max(0, totalBudget - rollingUsedBudget),
      rollingDaysRemaining: remainingDays,
      rollingBudgetToday: Math.max(
        0,
        Math.floor(remainingBudget / remainingDays),
      ),
    };
  }

  /**
   * Sum total expenses dalam range tanggal
   * @param start - Start date
   * @param end - End date
   * @param journal - User journal
   * @returns Total expenses amount
   */
  sumExpensesInRange(start: Date, end: Date, journal: UserJournal): number {
    if (end < start) {
      return 0;
    }

    let total = 0;
    for (const [dateKey, entries] of Object.entries(journal.expensesByDate)) {
      const date = parseDateKey(dateKey);
      if (!date) {
        continue;
      }

      if (date >= start && date <= end) {
        total += entries.reduce((acc, item) => acc + item.amount, 0);
      }
    }

    return total;
  }
}
