import { Injectable, inject } from '@angular/core';
import {
  JournalService,
  FinancialData,
  UserJournal,
} from '../services/journal.service';
import { TestingTimeService } from '../services/testing-time.service';
import { daysBetween, parseDateKey, normalizeDate } from './date.utils';

export interface RollingBudgetState {
  rollingTotalBudget: number;
  rollingUsedBudget: number;
  rollingBudgetRemaining: number;
  rollingDaysRemaining: number;
  rollingBudgetToday: number;
  rollingSpentToday: number;
}

const ZERO_STATE: RollingBudgetState = {
  rollingTotalBudget: 0,
  rollingUsedBudget: 0,
  rollingBudgetRemaining: 0,
  rollingDaysRemaining: 0,
  rollingBudgetToday: 0,
  rollingSpentToday: 0,
};

/**
 * Single source of truth untuk rolling budget state di seluruh aplikasi.
 * Semua halaman memanggil refresh() saat init dan setelah mutasi data,
 * lalu membaca dari currentState — sehingga nilai selalu konsisten.
 */
@Injectable({
  providedIn: 'root',
})
export class RollingBudgetService {
  private readonly journalService = inject(JournalService);
  private readonly testingTimeService = inject(TestingTimeService);

  /** State rolling budget yang dibagikan ke semua halaman. */
  currentState: RollingBudgetState = { ...ZERO_STATE };

  /**
   * Muat ulang data dari server dan perbarui currentState.
   * Selalu menggunakan referenceDate dari TestingTimeService agar konsisten.
   */
  async refresh(): Promise<void> {
    try {
      const referenceDate = this.testingTimeService.getReferenceDate();
      const journal =
        await this.journalService.loadCurrentUserJournal(referenceDate);
      const { financialData } =
        await this.journalService.getCurrentCycleSummary(referenceDate);
      this.currentState = this.computeRollingBudgetState(
        financialData,
        journal,
        referenceDate,
      );
    } catch {
      this.currentState = { ...ZERO_STATE };
    }
  }

  computeRollingBudgetState(
    financialData: FinancialData | null,
    journal: UserJournal,
    referenceDate: Date = this.testingTimeService.getReferenceDate(),
  ): RollingBudgetState {
    // Default state jika data tidak lengkap
    if (!financialData?.currentCycleStart || !financialData.currentCycleEnd) {
      return {
        rollingTotalBudget: 0,
        rollingUsedBudget: 0,
        rollingBudgetRemaining: 0,
        rollingDaysRemaining: 0,
        rollingBudgetToday: 0,
        rollingSpentToday: 0,
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
        rollingSpentToday: 0,
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
    const rollingSpentToday = this.sumExpensesInRange(today, today, journal);

    return {
      rollingTotalBudget: totalBudget,
      rollingUsedBudget,
      rollingBudgetRemaining: Math.max(0, totalBudget - rollingUsedBudget),
      rollingDaysRemaining: remainingDays,
      rollingBudgetToday: Math.max(
        0,
        Math.floor(remainingBudget / remainingDays),
      ),
      rollingSpentToday,
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
