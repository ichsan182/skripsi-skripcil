import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { USERS_API_URL } from '../config/app-api.config';
import {
  ExpenseCategory,
  inferExpenseCategory,
} from '../../shared/utils/expense-category';

export type ChatSender = 'user' | 'assistant';

export interface ChatMessage {
  id: number;
  sender: ChatSender;
  text: string;
  time: string;
}

export interface ExpenseEntry {
  amount: number;
  description: string;
  category: ExpenseCategory;
}

export interface IncomeEntry {
  amount: number;
  description: string;
  source: string;
}

export interface UserJournal {
  nextChatMessageId: number;
  chatByDate: Record<string, ChatMessage[]>;
  expensesByDate: Record<string, ExpenseEntry[]>;
  incomesByDate: Record<string, IncomeEntry[]>;
}

export type TopUpSource = 'tabungan' | 'danaDarurat';

export interface BudgetAllocation {
  mode: 2 | 3;
  pengeluaran: number;
  wants: number;
  savings: number;
}

export interface SavingsAllocation {
  tabungan: number;
  danaDarurat: number;
  danaInvestasi: number;
}

export interface InvestmentTracking {
  cycleAmounts: Record<string, number>;
}

export interface MonthlyTopUpSummary {
  cycleKey: string;
  fromTabunganCount: number;
  totalFromTabungan: number;
  totalFromDanaDarurat: number;
}

export interface FinancialData {
  pendapatan: number;
  pengeluaranWajib: number;
  tanggalPemasukan: number;
  intendedTanggalPemasukan?: number;
  hutangWajib: number;
  estimasiTabungan: number;
  danaDarurat: number;
  danaInvestasi?: number;
  budgetAllocation?: BudgetAllocation;
  savingsAllocation?: SavingsAllocation;
  investmentTracking?: InvestmentTracking;
  currentCycleStart?: string;
  currentCycleEnd?: string;
  currentPengeluaranLimit?: number;
  currentPengeluaranUsed?: number;
  currentSisaSaldoPool?: number;
  monthlyTopUp?: MonthlyTopUpSummary;
}

export interface ExpenseBudgetPrompt {
  shortage: number;
  monthlyExpenseLimit: number;
  monthlyExpenseUsed: number;
  monthlyExpenseRemaining: number;
  maxTopUpFromTabungan: number;
  maxTopUpFromDanaDarurat: number;
  tabunganTopUpRemainingCount: number;
  tabunganTopUpAllowedCount: number;
}

export interface ExpenseMutationOptions {
  allowTopUp?: boolean;
  topUpSource?: TopUpSource;
  topUpAmount?: number;
}

export interface ExpenseMutationResult {
  journal: UserJournal;
  financialData: FinancialData | null;
  requiresTopUp: boolean;
  prompt: ExpenseBudgetPrompt | null;
  pendingExpense: ExpenseEntry | null;
  message: string;
}

export interface FinancialCycleSummary {
  financialData: FinancialData | null;
  cycleStartKey: string | null;
  cycleEndKey: string | null;
  monthlyExpenseTotal: number;
}

interface StoredUser {
  id?: number | string;
  financialData?: FinancialData;
}

interface UserRecord {
  id: number | string;
  financialData?: FinancialData;
  journal?: Partial<UserJournal>;
}

@Injectable({
  providedIn: 'root',
})
export class JournalService {
  private readonly httpClient = inject(HttpClient);

  private static readonly DEFAULT_BUDGET: BudgetAllocation = {
    mode: 2,
    pengeluaran: 80,
    wants: 0,
    savings: 20,
  };

  async loadCurrentUserJournal(): Promise<UserJournal> {
    const userId = this.getCurrentUserId();
    if (!userId) {
      return this.createEmptyJournal();
    }

    const user = await firstValueFrom(
      this.httpClient.get<UserRecord>(`${USERS_API_URL}/${userId}`),
    );

    const journal = this.normalizeJournal(user.journal);
    const financialState = this.ensureFinancialState(
      this.normalizeFinancialData(user.financialData),
      journal,
      this.startOfDay(new Date()),
    );

    if (!user.journal || financialState.changed) {
      await this.patchUserData(userId, {
        journal,
        financialData: financialState.data,
      });
      this.patchLocalCurrentUser({ financialData: financialState.data });
    }

    return journal;
  }

  async saveCurrentUserJournal(journal: UserJournal): Promise<UserJournal> {
    const userId = this.getCurrentUserId();
    const normalized = this.normalizeJournal(journal);

    if (!userId) {
      return normalized;
    }

    await this.patchJournal(userId, normalized);
    return normalized;
  }

  async addChatMessageWithAutoExpense(
    dateKey: string,
    text: string,
    selectedDateLabel: string,
    options?: ExpenseMutationOptions,
  ): Promise<ExpenseMutationResult> {
    const userId = this.getCurrentUserId();
    const user = await this.loadUserById(userId);
    const journal = this.normalizeJournal(user?.journal);
    let financialData = this.normalizeFinancialData(user?.financialData);

    const referenceDate =
      this.parseDateKey(dateKey) ?? this.startOfDay(new Date());
    const financialState = this.ensureFinancialState(
      financialData,
      journal,
      referenceDate,
    );
    financialData = financialState.data;

    const trimmedText = text.trim();
    if (!trimmedText) {
      return {
        journal,
        financialData,
        requiresTopUp: false,
        prompt: null,
        pendingExpense: null,
        message: '',
      };
    }

    this.ensureChatBucket(journal, dateKey).push({
      id: journal.nextChatMessageId++,
      sender: 'user',
      text: trimmedText,
      time: this.getCurrentTimeLabel(),
    });

    const parsedExpense = this.parseExpenseFromMessage(trimmedText);
    let assistantText: string;

    let requiresTopUp = false;
    let prompt: ExpenseBudgetPrompt | null = null;
    let pendingExpense: ExpenseEntry | null = null;

    if (parsedExpense) {
      const expenseResult = this.tryInsertExpenseWithBudget(
        journal,
        financialData,
        dateKey,
        parsedExpense,
        options,
      );

      financialData = expenseResult.financialData;
      assistantText = expenseResult.message;
      requiresTopUp = expenseResult.requiresTopUp;
      prompt = expenseResult.prompt;
      pendingExpense = expenseResult.pendingExpense;
    } else {
      assistantText = `Catatan untuk ${selectedDateLabel} sudah disimpan.`;
    }

    this.ensureChatBucket(journal, dateKey).push({
      id: journal.nextChatMessageId++,
      sender: 'assistant',
      text: assistantText,
      time: this.getCurrentTimeLabel(),
    });

    const normalizedFinancial = this.ensureFinancialState(
      financialData,
      journal,
      referenceDate,
    ).data;

    await this.saveJournalAndFinancial(userId, journal, normalizedFinancial);
    return {
      journal,
      financialData: normalizedFinancial,
      requiresTopUp,
      prompt,
      pendingExpense,
      message: assistantText,
    };
  }

  async addExpense(
    dateKey: string,
    entry: ExpenseEntry,
    options?: ExpenseMutationOptions,
  ): Promise<ExpenseMutationResult> {
    const userId = this.getCurrentUserId();
    const user = await this.loadUserById(userId);
    const journal = this.normalizeJournal(user?.journal);
    const referenceDate =
      this.parseDateKey(dateKey) ?? this.startOfDay(new Date());

    const financialState = this.ensureFinancialState(
      this.normalizeFinancialData(user?.financialData),
      journal,
      referenceDate,
    );

    const result = this.tryInsertExpenseWithBudget(
      journal,
      financialState.data,
      dateKey,
      entry,
      options,
    );

    await this.saveJournalAndFinancial(userId, journal, result.financialData);

    return {
      journal,
      financialData: result.financialData,
      requiresTopUp: result.requiresTopUp,
      prompt: result.prompt,
      pendingExpense: result.pendingExpense,
      message: result.message,
    };
  }

  async addIncome(dateKey: string, entry: IncomeEntry): Promise<UserJournal> {
    const journal = await this.loadCurrentUserJournal();
    this.ensureIncomeBucket(journal, dateKey).unshift(entry);
    return this.saveCurrentUserJournal(journal);
  }

  async getCurrentCycleSummary(
    referenceDate: Date = new Date(),
  ): Promise<FinancialCycleSummary> {
    const userId = this.getCurrentUserId();
    const user = await this.loadUserById(userId);
    const journal = this.normalizeJournal(user?.journal);
    const financialState = this.ensureFinancialState(
      this.normalizeFinancialData(user?.financialData),
      journal,
      this.startOfDay(referenceDate),
    );

    await this.saveJournalAndFinancial(userId, journal, financialState.data);

    const rangeStart = financialState.data?.currentCycleStart ?? null;
    const rangeEnd = financialState.data?.currentCycleEnd ?? null;

    return {
      financialData: financialState.data,
      cycleStartKey: rangeStart,
      cycleEndKey: rangeEnd,
      monthlyExpenseTotal: financialState.data?.currentPengeluaranUsed ?? 0,
    };
  }

  async getExpensePromptForDate(
    dateKey: string,
  ): Promise<ExpenseBudgetPrompt | null> {
    const userId = this.getCurrentUserId();
    const user = await this.loadUserById(userId);
    const journal = this.normalizeJournal(user?.journal);
    const referenceDate =
      this.parseDateKey(dateKey) ?? this.startOfDay(new Date());
    const financialState = this.ensureFinancialState(
      this.normalizeFinancialData(user?.financialData),
      journal,
      referenceDate,
    );
    await this.saveJournalAndFinancial(userId, journal, financialState.data);
    if (!financialState.data) {
      return null;
    }
    return this.buildExpensePrompt(financialState.data, 0);
  }

  private getCurrentUserId(): number | string | null {
    const rawCurrentUser = localStorage.getItem('currentUser');
    if (!rawCurrentUser) {
      return null;
    }

    try {
      const currentUser = JSON.parse(rawCurrentUser) as StoredUser;
      return currentUser.id ?? null;
    } catch {
      return null;
    }
  }

  private async patchJournal(
    userId: number | string,
    journal: UserJournal,
  ): Promise<void> {
    await this.patchUserData(userId, { journal });
  }

  private async patchUserData(
    userId: number | string,
    payload: {
      journal?: UserJournal;
      financialData?: FinancialData | null;
    },
  ): Promise<void> {
    await firstValueFrom(
      this.httpClient.patch(`${USERS_API_URL}/${userId}`, payload),
    );
  }

  private createEmptyJournal(): UserJournal {
    return {
      nextChatMessageId: 1,
      chatByDate: {},
      expensesByDate: {},
      incomesByDate: {},
    };
  }

  private normalizeJournal(journal?: Partial<UserJournal>): UserJournal {
    return {
      nextChatMessageId: Math.max(1, Number(journal?.nextChatMessageId) || 1),
      chatByDate: this.cloneRecordOfArrays(journal?.chatByDate),
      expensesByDate: this.cloneRecordOfArrays(journal?.expensesByDate),
      incomesByDate: this.cloneRecordOfArrays(journal?.incomesByDate),
    };
  }

  private normalizeFinancialData(data?: FinancialData): FinancialData | null {
    if (!data) {
      return null;
    }

    const budget = data.budgetAllocation ?? this.deriveBudgetAllocation(data);
    const intendedDay = this.clampDay(
      (data.intendedTanggalPemasukan ?? data.tanggalPemasukan) || 1,
    );
    const pengeluaranPct =
      budget.mode === 3
        ? budget.pengeluaran + budget.wants
        : budget.pengeluaran;
    const baseLimit = Math.max(
      0,
      Math.round((data.pendapatan * pengeluaranPct) / 100) ||
        data.pengeluaranWajib,
    );
    const baseSaldo = Math.max(
      0,
      Math.round((data.pendapatan * budget.savings) / 100),
    );

    return {
      ...data,
      budgetAllocation: budget,
      intendedTanggalPemasukan: intendedDay,
      tanggalPemasukan: intendedDay,
      currentPengeluaranLimit: Math.max(
        0,
        data.currentPengeluaranLimit ?? baseLimit,
      ),
      currentPengeluaranUsed: Math.max(0, data.currentPengeluaranUsed ?? 0),
      currentSisaSaldoPool: Math.max(0, data.currentSisaSaldoPool ?? baseSaldo),
      monthlyTopUp: data.monthlyTopUp,
    };
  }

  private deriveBudgetAllocation(data: FinancialData): BudgetAllocation {
    if (data.pendapatan <= 0) {
      return JournalService.DEFAULT_BUDGET;
    }

    const expensePct = Math.min(
      100,
      Math.max(0, Math.round((data.pengeluaranWajib / data.pendapatan) * 100)),
    );
    return {
      mode: 2,
      pengeluaran: expensePct,
      wants: 0,
      savings: Math.max(0, 100 - expensePct),
    };
  }

  private cloneRecordOfArrays<T>(
    source?: Record<string, T[]>,
  ): Record<string, T[]> {
    if (!source) {
      return {};
    }

    const cloned: Record<string, T[]> = {};
    for (const [key, items] of Object.entries(source)) {
      cloned[key] = Array.isArray(items) ? [...items] : [];
    }
    return cloned;
  }

  private ensureFinancialState(
    data: FinancialData | null,
    journal: UserJournal,
    referenceDate: Date,
  ): { data: FinancialData | null; changed: boolean } {
    if (!data) {
      return { data: null, changed: false };
    }

    const next = { ...data };
    let changed = false;

    const budget = next.budgetAllocation ?? this.deriveBudgetAllocation(next);
    if (!next.budgetAllocation) {
      next.budgetAllocation = budget;
      changed = true;
    }

    const intendedDay = this.clampDay(
      (next.intendedTanggalPemasukan ?? next.tanggalPemasukan) || 1,
    );
    if (
      next.intendedTanggalPemasukan !== intendedDay ||
      next.tanggalPemasukan !== intendedDay
    ) {
      next.intendedTanggalPemasukan = intendedDay;
      next.tanggalPemasukan = intendedDay;
      changed = true;
    }

    const pengeluaranPct =
      budget.mode === 3
        ? budget.pengeluaran + budget.wants
        : budget.pengeluaran;
    const baseLimit = Math.max(
      0,
      Math.round((next.pendapatan * pengeluaranPct) / 100),
    );
    const baseSaldo = Math.max(
      0,
      Math.round((next.pendapatan * budget.savings) / 100),
    );

    const cycle = this.resolveCycleRange(referenceDate, intendedDay);
    const cycleStartKey = this.toDateKey(cycle.start);
    const cycleEndKey = this.toDateKey(cycle.end);

    if (
      next.currentCycleStart !== cycleStartKey ||
      next.currentCycleEnd !== cycleEndKey
    ) {
      next.currentCycleStart = cycleStartKey;
      next.currentCycleEnd = cycleEndKey;
      next.currentPengeluaranLimit = baseLimit;
      next.currentSisaSaldoPool = baseSaldo;
      next.monthlyTopUp = {
        cycleKey: cycleStartKey,
        fromTabunganCount: 0,
        totalFromTabungan: 0,
        totalFromDanaDarurat: 0,
      };
      changed = true;
    }

    if (!next.monthlyTopUp || next.monthlyTopUp.cycleKey !== cycleStartKey) {
      next.monthlyTopUp = {
        cycleKey: cycleStartKey,
        fromTabunganCount: 0,
        totalFromTabungan: 0,
        totalFromDanaDarurat: 0,
      };
      changed = true;
    }

    const calculatedUsed = this.sumExpensesInRange(
      journal,
      cycle.start,
      cycle.end,
    );
    if (next.currentPengeluaranUsed !== calculatedUsed) {
      next.currentPengeluaranUsed = calculatedUsed;
      changed = true;
    }

    if (next.currentPengeluaranLimit === undefined) {
      next.currentPengeluaranLimit = baseLimit;
      changed = true;
    }

    if (next.currentSisaSaldoPool === undefined) {
      next.currentSisaSaldoPool = baseSaldo;
      changed = true;
    }

    return { data: next, changed };
  }

  private ensureChatBucket(
    journal: UserJournal,
    dateKey: string,
  ): ChatMessage[] {
    if (!journal.chatByDate[dateKey]) {
      journal.chatByDate[dateKey] = [];
    }

    return journal.chatByDate[dateKey];
  }

  private ensureExpenseBucket(
    journal: UserJournal,
    dateKey: string,
  ): ExpenseEntry[] {
    if (!journal.expensesByDate[dateKey]) {
      journal.expensesByDate[dateKey] = [];
    }

    return journal.expensesByDate[dateKey];
  }

  private ensureIncomeBucket(
    journal: UserJournal,
    dateKey: string,
  ): IncomeEntry[] {
    if (!journal.incomesByDate[dateKey]) {
      journal.incomesByDate[dateKey] = [];
    }

    return journal.incomesByDate[dateKey];
  }

  private tryInsertExpenseWithBudget(
    journal: UserJournal,
    financialData: FinancialData | null,
    dateKey: string,
    entry: ExpenseEntry,
    options?: ExpenseMutationOptions,
  ): {
    financialData: FinancialData | null;
    requiresTopUp: boolean;
    prompt: ExpenseBudgetPrompt | null;
    pendingExpense: ExpenseEntry | null;
    message: string;
  } {
    if (!financialData) {
      this.ensureExpenseBucket(journal, dateKey).unshift(entry);
      return {
        financialData: null,
        requiresTopUp: false,
        prompt: null,
        pendingExpense: null,
        message: `Dicatat: ${this.formatCurrency(entry.amount)} untuk "${entry.description}" kategori ${entry.category}.`,
      };
    }

    const nextFinancial = { ...financialData };
    const limit = Math.max(
      0,
      nextFinancial.currentPengeluaranLimit ?? nextFinancial.pengeluaranWajib,
    );
    const used = Math.max(0, nextFinancial.currentPengeluaranUsed ?? 0);
    const remaining = Math.max(0, limit - used);

    if (entry.amount > remaining) {
      const shortage = entry.amount - remaining;
      let workingLimit = limit;
      let topUpNotice = '';

      if (
        options?.allowTopUp &&
        options.topUpSource &&
        (options.topUpAmount ?? 0) > 0
      ) {
        const topUpResult = this.applyTopUp(
          nextFinancial,
          options.topUpSource,
          options.topUpAmount ?? 0,
          shortage,
        );
        workingLimit += topUpResult.appliedAmount;
        topUpNotice = topUpResult.notice;
      }

      const workingRemaining = Math.max(0, workingLimit - used);
      if (entry.amount > workingRemaining) {
        const prompt = this.buildExpensePrompt(
          nextFinancial,
          entry.amount - workingRemaining,
        );
        return {
          financialData: nextFinancial,
          requiresTopUp: true,
          prompt,
          pendingExpense: entry,
          message:
            'Budget pengeluaran periode ini sudah habis. Kamu bisa top up sementara dari Tabungan atau Dana Darurat.',
        };
      }

      if (topUpNotice) {
        nextFinancial.currentPengeluaranLimit = workingLimit;
      }
    }

    this.ensureExpenseBucket(journal, dateKey).unshift(entry);
    nextFinancial.currentPengeluaranUsed =
      Math.max(0, nextFinancial.currentPengeluaranUsed ?? 0) + entry.amount;

    return {
      financialData: nextFinancial,
      requiresTopUp: false,
      prompt: null,
      pendingExpense: null,
      message: `Dicatat: ${this.formatCurrency(entry.amount)} untuk "${entry.description}" kategori ${entry.category}.`,
    };
  }

  private applyTopUp(
    financialData: FinancialData,
    source: TopUpSource,
    amountRequested: number,
    shortage: number,
  ): { appliedAmount: number; notice: string } {
    const amount = Math.max(0, Math.floor(amountRequested));
    if (amount <= 0) {
      return { appliedAmount: 0, notice: '' };
    }

    if (source === 'danaDarurat') {
      const applied = Math.min(amount, financialData.danaDarurat);
      if (applied <= 0) {
        return { appliedAmount: 0, notice: '' };
      }
      financialData.danaDarurat -= applied;
      financialData.currentPengeluaranLimit =
        Math.max(
          0,
          financialData.currentPengeluaranLimit ??
            financialData.pengeluaranWajib,
        ) + applied;
      if (financialData.monthlyTopUp) {
        financialData.monthlyTopUp.totalFromDanaDarurat += applied;
      }
      return {
        appliedAmount: applied,
        notice: `Top up dari Dana Darurat sebesar ${this.formatCurrency(applied)} berhasil ditambahkan ke limit pengeluaran periode ini.`,
      };
    }

    const prompt = this.buildExpensePrompt(financialData, shortage);
    const allowedTabunganAmount = prompt.maxTopUpFromTabungan;
    const applied = Math.min(amount, allowedTabunganAmount);
    if (applied <= 0) {
      return { appliedAmount: 0, notice: '' };
    }

    financialData.estimasiTabungan -= applied;
    if (financialData.savingsAllocation) {
      financialData.savingsAllocation = {
        ...financialData.savingsAllocation,
        tabungan: Math.max(
          0,
          financialData.savingsAllocation.tabungan - applied,
        ),
      };
    }
    financialData.currentPengeluaranLimit =
      Math.max(
        0,
        financialData.currentPengeluaranLimit ?? financialData.pengeluaranWajib,
      ) + applied;
    if (financialData.monthlyTopUp) {
      financialData.monthlyTopUp.fromTabunganCount += 1;
      financialData.monthlyTopUp.totalFromTabungan += applied;
    }
    return {
      appliedAmount: applied,
      notice: `Top up dari Tabungan sebesar ${this.formatCurrency(applied)} berhasil ditambahkan ke limit pengeluaran periode ini.`,
    };
  }

  private buildExpensePrompt(
    financialData: FinancialData,
    shortage: number,
  ): ExpenseBudgetPrompt {
    const limit = Math.max(
      0,
      financialData.currentPengeluaranLimit ?? financialData.pengeluaranWajib,
    );
    const used = Math.max(0, financialData.currentPengeluaranUsed ?? 0);
    const remaining = Math.max(0, limit - used);
    const baseLimit = this.getBaseExpenseLimit(financialData);
    const allowedCount =
      financialData.estimasiTabungan >= baseLimit * 3 ? 2 : 1;
    const usedCount = financialData.monthlyTopUp?.fromTabunganCount ?? 0;
    const remainingCount = Math.max(0, allowedCount - usedCount);

    return {
      shortage: Math.max(0, shortage),
      monthlyExpenseLimit: limit,
      monthlyExpenseUsed: used,
      monthlyExpenseRemaining: remaining,
      maxTopUpFromTabungan:
        remainingCount > 0
          ? Math.max(0, Math.min(baseLimit, financialData.estimasiTabungan))
          : 0,
      maxTopUpFromDanaDarurat: Math.max(0, financialData.danaDarurat),
      tabunganTopUpRemainingCount: remainingCount,
      tabunganTopUpAllowedCount: allowedCount,
    };
  }

  private parseExpenseFromMessage(text: string): ExpenseEntry | null {
    const trimmed = text.trim();

    // Support both "10000 makan" and "makan 10000"
    const numberFirst = /^(\d[\d.,]*)\s+(.+)$/.exec(trimmed);
    const numberLast = /^(.+?)\s+(\d[\d.,]*)$/.exec(trimmed);

    let rawAmount: string;
    let description: string;

    if (numberFirst) {
      rawAmount = numberFirst[1];
      description = numberFirst[2].trim().toLowerCase();
    } else if (numberLast) {
      rawAmount = numberLast[2];
      description = numberLast[1].trim().toLowerCase();
    } else {
      return null;
    }

    const amount = Number.parseInt(rawAmount.replace(/\D/g, ''), 10);

    if (!Number.isFinite(amount) || amount <= 0 || !description) {
      return null;
    }

    return {
      amount,
      description,
      category: this.inferCategory(description),
    };
  }

  private getBaseExpenseLimit(data: FinancialData): number {
    const budget = data.budgetAllocation ?? this.deriveBudgetAllocation(data);
    const pct =
      budget.mode === 3
        ? budget.pengeluaran + budget.wants
        : budget.pengeluaran;
    return Math.max(0, Math.round((data.pendapatan * pct) / 100));
  }

  private resolveCycleRange(
    referenceDate: Date,
    intendedDay: number,
  ): { start: Date; end: Date } {
    const currentResetDay = this.resolveResetDay(
      referenceDate.getFullYear(),
      referenceDate.getMonth(),
      intendedDay,
    );
    const currentMonthResetDate = new Date(
      referenceDate.getFullYear(),
      referenceDate.getMonth(),
      currentResetDay,
    );

    const start =
      referenceDate >= currentMonthResetDate
        ? currentMonthResetDate
        : new Date(
            referenceDate.getFullYear(),
            referenceDate.getMonth() - 1,
            this.resolveResetDay(
              referenceDate.getFullYear(),
              referenceDate.getMonth() - 1,
              intendedDay,
            ),
          );

    const nextStart = new Date(
      start.getFullYear(),
      start.getMonth() + 1,
      this.resolveResetDay(
        start.getFullYear(),
        start.getMonth() + 1,
        intendedDay,
      ),
    );
    const end = new Date(nextStart);
    end.setDate(nextStart.getDate() - 1);

    return {
      start: this.startOfDay(start),
      end: this.startOfDay(end),
    };
  }

  private resolveResetDay(
    year: number,
    monthIndex: number,
    intendedDay: number,
  ): number {
    const lastDay = new Date(year, monthIndex + 1, 0).getDate();
    return Math.min(intendedDay, lastDay);
  }

  private sumExpensesInRange(
    journal: UserJournal,
    start: Date,
    end: Date,
  ): number {
    let total = 0;
    for (const [dateKey, expenses] of Object.entries(journal.expensesByDate)) {
      const date = this.parseDateKey(dateKey);
      if (!date) {
        continue;
      }
      if (date >= start && date <= end) {
        total += expenses.reduce((sum, item) => sum + item.amount, 0);
      }
    }
    return total;
  }

  private startOfDay(date: Date): Date {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
  }

  private parseDateKey(dateKey: string): Date | null {
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
    return this.startOfDay(new Date(year, month - 1, day));
  }

  private toDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private clampDay(day: number): number {
    return Math.max(1, Math.min(31, Math.floor(day || 1)));
  }

  private async loadUserById(
    userId: number | string | null,
  ): Promise<UserRecord | null> {
    if (!userId) {
      return null;
    }

    try {
      return await firstValueFrom(
        this.httpClient.get<UserRecord>(`${USERS_API_URL}/${userId}`),
      );
    } catch {
      return null;
    }
  }

  private async saveJournalAndFinancial(
    userId: number | string | null,
    journal: UserJournal,
    financialData: FinancialData | null,
  ): Promise<void> {
    if (!userId) {
      return;
    }

    await this.patchUserData(userId, {
      journal,
      financialData,
    });
    this.patchLocalCurrentUser({ financialData });
  }

  private patchLocalCurrentUser(patch: {
    financialData?: FinancialData | null;
  }): void {
    const rawCurrentUser = localStorage.getItem('currentUser');
    if (!rawCurrentUser) {
      return;
    }

    try {
      const currentUser = JSON.parse(rawCurrentUser) as StoredUser;
      localStorage.setItem(
        'currentUser',
        JSON.stringify({
          ...currentUser,
          ...patch,
        }),
      );
    } catch {
      // ignore parse error
    }
  }

  private inferCategory(description: string): ExpenseCategory {
    return inferExpenseCategory(description);
  }

  private getCurrentTimeLabel(): string {
    return new Intl.DateTimeFormat('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date());
  }

  private formatCurrency(amount: number): string {
    return `Rp ${new Intl.NumberFormat('id-ID').format(amount)}`;
  }
}
