import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  USER_FINANCIAL_DATA_API_URL,
  USERS_API_URL,
} from '../config/app-api.config';
import { CurrentUserService } from './current-user.service';
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
  parsedText?: string | null;
  parsedNominal?: number | null;
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

export type TopUpSource = 'tabungan' | 'danaDarurat' | 'sisaSaldo';

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
  fromSisaSaldoCount?: number;
  totalFromSisaSaldo?: number;
}

export interface FinancialData {
  pendapatan: number;
  pengeluaranWajib: number;
  tanggalPemasukan: number;
  intendedTanggalPemasukan?: number;
  hutangWajib: number;
  hutangWajibPrincipal?: number;
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
  lastCycleCarryOverSaldo?: number;
  currentCycleSavingsAllocated?: number;
  monthlyTopUp?: MonthlyTopUpSummary;
  debtSummary?: {
    totalPrincipalAmount: number;
    totalRemainingAmount: number;
  };
}

export interface ExpenseBudgetPrompt {
  shortage: number;
  monthlyExpenseLimit: number;
  monthlyExpenseUsed: number;
  monthlyExpenseRemaining: number;
  maxTopUpFromTabungan: number;
  maxTopUpFromDanaDarurat: number;
  maxTopUpFromSisaSaldo: number;
  tabunganTopUpRemainingCount: number;
  tabunganTopUpAllowedCount: number;
  sisaSaldoTopUpRemainingCount: number;
  sisaSaldoTopUpAllowedCount: number;
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

interface UserRecord {
  id: number | string;
  financialData?: FinancialData;
  journal?: Partial<UserJournal>;
}

interface ExpenseApiPayload {
  amount: number;
  description: string;
  category: string;
}

interface IncomeApiPayload {
  amount: number;
  description: string;
  source?: string;
}

interface ChatApiPayload {
  sender: ChatSender;
  text: string;
  time: string;
}

@Injectable({
  providedIn: 'root',
})
export class JournalService {
  private readonly httpClient = inject(HttpClient);
  private readonly currentUserService = inject(CurrentUserService);

  private static readonly DEFAULT_BUDGET: BudgetAllocation = {
    mode: 2,
    pengeluaran: 20,
    wants: 0,
    savings: 80,
  };

  async loadCurrentUserJournal(
    referenceDate: Date = new Date(),
  ): Promise<UserJournal> {
    const userId = this.getCurrentUserId();
    if (!userId) {
      return this.createEmptyJournal();
    }

    const user = await firstValueFrom(
      this.httpClient.get<UserRecord>(`${USERS_API_URL}/${userId}`),
    );

    const journal = this.normalizeJournal(user.journal);
    await this.hydrateDateEntriesFromApi(userId, journal, referenceDate);
    const financialState = this.ensureFinancialState(
      this.normalizeFinancialData(user.financialData),
      journal,
      this.startOfDay(referenceDate),
    );

    if (financialState.changed) {
      await this.saveFinancialData(userId, financialState.data);
      this.patchLocalCurrentUser({ financialData: financialState.data });
    }

    return journal;
  }

  async saveCurrentUserJournal(journal: UserJournal): Promise<UserJournal> {
    const normalized = this.normalizeJournal(journal);
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

    const userMsg = await this.postChatByDate(
      userId,
      dateKey,
      { sender: 'user', text: trimmedText, time: this.getCurrentTimeLabel() },
      journal.nextChatMessageId++,
    );
    this.ensureChatBucket(journal, dateKey).push(userMsg);

    const parsedExpense =
      this.parseExpenseFromChatMessage(userMsg) ??
      this.parseExpenseFromMessage(trimmedText);
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

    const assistantMsg = await this.postChatByDate(
      userId,
      dateKey,
      {
        sender: 'assistant',
        text: assistantText,
        time: this.getCurrentTimeLabel(),
      },
      journal.nextChatMessageId++,
    );
    this.ensureChatBucket(journal, dateKey).push(assistantMsg);

    const normalizedFinancial = this.ensureFinancialState(
      financialData,
      journal,
      referenceDate,
    ).data;

    if (userId && parsedExpense && !requiresTopUp) {
      await this.postExpenseByDate(userId, dateKey, parsedExpense);
      const latestJournal = await this.loadCurrentUserJournal(referenceDate);
      journal.expensesByDate = latestJournal.expensesByDate;
      journal.incomesByDate = latestJournal.incomesByDate;
      journal.chatByDate = latestJournal.chatByDate;
      journal.nextChatMessageId = latestJournal.nextChatMessageId;
    }

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

    if (!result.requiresTopUp && userId) {
      await this.postExpenseByDate(userId, dateKey, entry);
      const latestJournal = await this.loadCurrentUserJournal(referenceDate);
      journal.expensesByDate = latestJournal.expensesByDate;
      journal.incomesByDate = latestJournal.incomesByDate;
      journal.chatByDate = latestJournal.chatByDate;
      journal.nextChatMessageId = latestJournal.nextChatMessageId;
      await this.saveFinancialData(userId, result.financialData);
      this.patchLocalCurrentUser({ financialData: result.financialData });
    } else {
      await this.saveJournalAndFinancial(userId, journal, result.financialData);
    }

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
    const userId = this.getCurrentUserId();
    const referenceDate =
      this.parseDateKey(dateKey) ?? this.startOfDay(new Date());

    if (userId) {
      await this.postIncomeByDate(userId, dateKey, entry);
      return this.loadCurrentUserJournal(referenceDate);
    }

    const journal = await this.loadCurrentUserJournal(referenceDate);
    this.ensureIncomeBucket(journal, dateKey).unshift(entry);
    return journal;
  }

  async addTemporaryIncome(
    dateKey: string,
    entry: IncomeEntry,
  ): Promise<{ journal: UserJournal; financialData: FinancialData | null }> {
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

    const nextFinancial = financialState.data
      ? {
          ...financialState.data,
          currentSisaSaldoPool: Math.max(
            0,
            (financialState.data.currentSisaSaldoPool ?? 0) + entry.amount,
          ),
        }
      : null;

    if (userId) {
      await this.postIncomeByDate(userId, dateKey, entry);
      const latestJournal = await this.loadCurrentUserJournal(referenceDate);
      journal.expensesByDate = latestJournal.expensesByDate;
      journal.incomesByDate = latestJournal.incomesByDate;
      journal.chatByDate = latestJournal.chatByDate;
      journal.nextChatMessageId = latestJournal.nextChatMessageId;
      await this.saveFinancialData(userId, nextFinancial);
      this.patchLocalCurrentUser({ financialData: nextFinancial });
    } else {
      this.ensureIncomeBucket(journal, dateKey).unshift(entry);
      await this.saveJournalAndFinancial(userId, journal, nextFinancial);
    }

    return { journal, financialData: nextFinancial };
  }

  async getCurrentCycleSummary(
    referenceDate: Date = new Date(),
  ): Promise<FinancialCycleSummary> {
    const userId = this.getCurrentUserId();
    const user = await this.loadUserById(userId);
    const journal = this.normalizeJournal(user?.journal);
    if (userId) {
      await this.hydrateDateEntriesFromApi(userId, journal, referenceDate);
    }
    const financialState = this.ensureFinancialState(
      this.normalizeFinancialData(user?.financialData),
      journal,
      this.startOfDay(referenceDate),
    );

    if (userId && financialState.changed) {
      await this.saveFinancialData(userId, financialState.data);
      this.patchLocalCurrentUser({ financialData: financialState.data });
    }

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
    if (userId && financialState.changed) {
      await this.saveFinancialData(userId, financialState.data);
      this.patchLocalCurrentUser({ financialData: financialState.data });
    }
    if (!financialState.data) {
      return null;
    }
    return this.buildExpensePrompt(financialState.data, 0);
  }

  async saveCurrentUserFinancialData(
    financialData: FinancialData | null,
  ): Promise<void> {
    const userId = this.getCurrentUserId();
    if (!userId) {
      return;
    }

    await this.saveFinancialData(userId, financialData);
    this.patchLocalCurrentUser({ financialData });
  }

  private getCurrentUserId(): number | string | null {
    return this.currentUserService.getCurrentUserId();
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
    },
  ): Promise<void> {
    const currentUser = await this.loadUserById(userId);
    const nextUser = {
      ...(currentUser ?? { id: userId }),
      ...payload,
      id: userId,
      financialData: undefined,
    };

    await firstValueFrom(
      this.httpClient.put(`${USERS_API_URL}/${userId}`, nextUser),
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
    const chatByDate = this.normalizeRecordOfArrays(
      journal?.chatByDate as Record<string, unknown[]> | undefined,
      (item, index) => this.normalizeChatMessage(item, index),
    );
    const expensesByDate = this.normalizeRecordOfArrays(
      journal?.expensesByDate as Record<string, unknown[]> | undefined,
      (item) => this.normalizeExpenseEntry(item),
    );
    const incomesByDate = this.normalizeRecordOfArrays(
      journal?.incomesByDate as Record<string, unknown[]> | undefined,
      (item) => this.normalizeIncomeEntry(item),
    );
    const maxChatId = Object.values(chatByDate)
      .flat()
      .reduce((max, message) => Math.max(max, message.id), 0);

    return {
      nextChatMessageId: Math.max(
        maxChatId + 1,
        Number(journal?.nextChatMessageId) || 1,
      ),
      chatByDate,
      expensesByDate,
      incomesByDate,
    };
  }

  private normalizeFinancialData(data?: FinancialData): FinancialData | null {
    if (!data) {
      return null;
    }

    const budget = this.normalizeBudgetAllocation(data.budgetAllocation, data);
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
      lastCycleCarryOverSaldo: Math.max(0, data.lastCycleCarryOverSaldo ?? 0),
      currentCycleSavingsAllocated: Math.max(
        0,
        data.currentCycleSavingsAllocated ?? 0,
      ),
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

  private normalizeBudgetAllocation(
    budget: BudgetAllocation | undefined,
    data: FinancialData,
  ): BudgetAllocation {
    if (!budget) {
      return this.deriveBudgetAllocation(data);
    }

    const modeCandidate = Number((budget as { mode?: unknown }).mode);
    const mode: 2 | 3 = modeCandidate === 3 ? 3 : 2;
    const pengeluaran = this.clampPercent(budget.pengeluaran);
    const wants = mode === 3 ? this.clampPercent(budget.wants) : 0;
    const savings = this.clampPercent(budget.savings);

    // For mode 2 only: verify that stored pengeluaran% matches the actual
    // recorded pengeluaranWajib. If they diverge by more than rounding error,
    // the budget was stored with wrong defaults (e.g. hardcoded 20/80) and
    // must be re-derived from the real data to avoid incorrect cycle resets.
    if (mode === 2 && data.pendapatan > 0 && (data.pengeluaranWajib ?? 0) > 0) {
      const expectedExpense = Math.round((data.pendapatan * pengeluaran) / 100);
      if (Math.abs(expectedExpense - data.pengeluaranWajib) > 1) {
        return this.deriveBudgetAllocation(data);
      }
    }

    return {
      mode,
      pengeluaran,
      wants,
      savings,
    };
  }

  private normalizeRecordOfArrays<T>(
    source: Record<string, unknown[]> | undefined,
    normalize: (item: unknown, index: number) => T,
  ): Record<string, T[]> {
    if (!source) {
      return {};
    }

    const normalized: Record<string, T[]> = {};
    for (const [key, items] of Object.entries(source)) {
      if (!Array.isArray(items)) {
        normalized[key] = [];
        continue;
      }
      normalized[key] = items.map((item, index) => normalize(item, index));
    }
    return normalized;
  }

  private normalizeChatMessage(item: unknown, index: number): ChatMessage {
    const value = item as
      | Partial<ChatMessage & { parsedText?: unknown; parsedNominal?: unknown }>
      | undefined;
    const parsedTextRaw = value?.parsedText;
    const parsedNominalRaw = Number(value?.parsedNominal);
    return {
      id: Math.max(1, Number(value?.id) || index + 1),
      sender: value?.sender === 'assistant' ? 'assistant' : 'user',
      text: String(value?.text || '').trim(),
      time: String(value?.time || '').trim(),
      parsedText:
        typeof parsedTextRaw === 'string' && parsedTextRaw.trim().length > 0
          ? parsedTextRaw.trim().toLowerCase()
          : null,
      parsedNominal:
        Number.isFinite(parsedNominalRaw) && parsedNominalRaw > 0
          ? Math.floor(parsedNominalRaw)
          : null,
    };
  }

  private normalizeExpenseEntry(item: unknown): ExpenseEntry {
    const value = item as Partial<ExpenseEntry & { category?: unknown }>;
    return {
      amount: Math.max(0, Math.round(Number(value?.amount) || 0)),
      description: String(value?.description || '').trim(),
      category: this.fromApiExpenseCategory(String(value?.category || '')),
    };
  }

  private normalizeIncomeEntry(item: unknown): IncomeEntry {
    const value = item as Partial<IncomeEntry>;
    return {
      amount: Math.max(0, Math.round(Number(value?.amount) || 0)),
      description: String(value?.description || '').trim(),
      source: String(value?.source || '').trim() || 'Lainnya',
    };
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
      const carriedSaldo = Math.max(
        0,
        next.currentSisaSaldoPool ?? next.lastCycleCarryOverSaldo ?? 0,
      );
      next.currentCycleStart = cycleStartKey;
      next.currentCycleEnd = cycleEndKey;
      next.currentPengeluaranLimit = baseLimit;
      next.lastCycleCarryOverSaldo = carriedSaldo;
      next.currentSisaSaldoPool = baseSaldo + carriedSaldo;
      next.currentCycleSavingsAllocated = 0;
      next.monthlyTopUp = {
        cycleKey: cycleStartKey,
        fromTabunganCount: 0,
        totalFromTabungan: 0,
        totalFromDanaDarurat: 0,
        fromSisaSaldoCount: 0,
        totalFromSisaSaldo: 0,
      };
      changed = true;
    }

    if (!next.monthlyTopUp || next.monthlyTopUp.cycleKey !== cycleStartKey) {
      next.monthlyTopUp = {
        cycleKey: cycleStartKey,
        fromTabunganCount: 0,
        totalFromTabungan: 0,
        totalFromDanaDarurat: 0,
        fromSisaSaldoCount: 0,
        totalFromSisaSaldo: 0,
      };
      changed = true;
    }

    const calculatedUsed = this.sumExpensesInRange(
      journal,
      cycle.start,
      cycle.end,
    );
    const preservedUsed = Math.max(
      Math.max(0, next.currentPengeluaranUsed ?? 0),
      calculatedUsed,
    );
    if (next.currentPengeluaranUsed !== preservedUsed) {
      next.currentPengeluaranUsed = preservedUsed;
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
            'Budget pengeluaran periode ini sudah habis. Kamu bisa top up sementara dari Tabungan, Dana Darurat, atau Sisa Saldo.',
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

    if (source === 'sisaSaldo') {
      const prompt = this.buildExpensePrompt(financialData, shortage);
      const allowedSisaSaldoAmount = prompt.maxTopUpFromSisaSaldo;
      const applied = Math.min(amount, allowedSisaSaldoAmount);
      if (applied <= 0) {
        return { appliedAmount: 0, notice: '' };
      }
      financialData.currentSisaSaldoPool = Math.max(
        0,
        (financialData.currentSisaSaldoPool ?? 0) - applied,
      );
      financialData.currentPengeluaranLimit =
        Math.max(
          0,
          financialData.currentPengeluaranLimit ??
            financialData.pengeluaranWajib,
        ) + applied;
      if (financialData.monthlyTopUp) {
        financialData.monthlyTopUp.fromSisaSaldoCount =
          (financialData.monthlyTopUp.fromSisaSaldoCount ?? 0) + 1;
        financialData.monthlyTopUp.totalFromSisaSaldo =
          (financialData.monthlyTopUp.totalFromSisaSaldo ?? 0) + applied;
      }
      return {
        appliedAmount: applied,
        notice: `Top up dari Sisa Saldo sebesar ${this.formatCurrency(applied)} berhasil ditambahkan ke limit pengeluaran periode ini.`,
      };
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

    const sisaSaldoAllowedCount = allowedCount;
    const sisaSaldoUsedCount =
      financialData.monthlyTopUp?.fromSisaSaldoCount ?? 0;
    const sisaSaldoRemainingCount = Math.max(
      0,
      sisaSaldoAllowedCount - sisaSaldoUsedCount,
    );
    const sisaSaldoPool = Math.max(0, financialData.currentSisaSaldoPool ?? 0);

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
      maxTopUpFromSisaSaldo:
        sisaSaldoRemainingCount > 0
          ? Math.max(0, Math.min(baseLimit, sisaSaldoPool))
          : 0,
      tabunganTopUpRemainingCount: remainingCount,
      tabunganTopUpAllowedCount: allowedCount,
      sisaSaldoTopUpRemainingCount: sisaSaldoRemainingCount,
      sisaSaldoTopUpAllowedCount: sisaSaldoAllowedCount,
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

  private parseExpenseFromChatMessage(chat: ChatMessage): ExpenseEntry | null {
    if (chat.sender !== 'user') {
      return null;
    }

    const description = String(chat.parsedText || '')
      .trim()
      .toLowerCase();
    const amount = Math.floor(Number(chat.parsedNominal));

    if (!description || !Number.isFinite(amount) || amount <= 0) {
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

  private clampPercent(value: number): number {
    return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
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

    await this.saveFinancialData(userId, financialData);
    this.patchLocalCurrentUser({ financialData });
  }

  private async saveFinancialData(
    userId: number | string,
    financialData: FinancialData | null,
  ): Promise<void> {
    await firstValueFrom(
      this.httpClient.patch(
        USER_FINANCIAL_DATA_API_URL(userId),
        financialData,
        {
          responseType: 'text',
        },
      ),
    );
  }

  private async hydrateDateEntriesFromApi(
    userId: number | string,
    journal: UserJournal,
    referenceDate: Date,
  ): Promise<void> {
    // Collect all date keys that need hydration: union of the reference date
    // plus all keys already tracked in the journal from the DB snapshot.
    const referenceDateKey = this.toDateKey(referenceDate);
    const allKeys = new Set<string>([
      referenceDateKey,
      ...Object.keys(journal.expensesByDate),
      ...Object.keys(journal.incomesByDate),
      ...Object.keys(journal.chatByDate),
    ]);

    await Promise.all(
      Array.from(allKeys).map(async (dateKey) => {
        const [expenses, incomes, chats] = await Promise.all([
          this.getExpensesByDate(userId, dateKey),
          this.getIncomesByDate(userId, dateKey),
          this.getChatsByDate(userId, dateKey),
        ]);

        if (expenses !== null) {
          journal.expensesByDate[dateKey] = expenses;
        }

        if (incomes !== null) {
          journal.incomesByDate[dateKey] = incomes;
        }

        if (chats !== null) {
          journal.chatByDate[dateKey] = chats;
          if (chats.length > 0) {
            const maxId = chats.reduce((max, msg) => Math.max(max, msg.id), 0);
            journal.nextChatMessageId = Math.max(
              journal.nextChatMessageId,
              maxId + 1,
            );
          }
        }
      }),
    );
  }

  private async getExpensesByDate(
    userId: number | string,
    dateKey: string,
  ): Promise<ExpenseEntry[] | null> {
    try {
      const payload = await firstValueFrom(
        this.httpClient.get<ExpenseApiPayload[]>(
          this.buildJournalDateUrl(userId, 'expenses', dateKey),
        ),
      );

      return (payload || []).map((entry) => ({
        amount: Math.max(0, Math.round(Number(entry.amount) || 0)),
        description: String(entry.description || '').trim(),
        category: this.fromApiExpenseCategory(entry.category),
      }));
    } catch {
      return null;
    }
  }

  private async getIncomesByDate(
    userId: number | string,
    dateKey: string,
  ): Promise<IncomeEntry[] | null> {
    try {
      const payload = await firstValueFrom(
        this.httpClient.get<IncomeApiPayload[]>(
          this.buildJournalDateUrl(userId, 'incomes', dateKey),
        ),
      );

      return (payload || []).map((entry) => ({
        amount: Math.max(0, Math.round(Number(entry.amount) || 0)),
        description: String(entry.description || '').trim(),
        source: String(entry.source || '').trim() || 'Lainnya',
      }));
    } catch {
      return null;
    }
  }

  private async postExpenseByDate(
    userId: number | string,
    dateKey: string,
    entry: ExpenseEntry,
  ): Promise<void> {
    const payload: ExpenseApiPayload = {
      amount: Math.max(0, Math.round(entry.amount)),
      description: entry.description,
      category: this.toApiExpenseCategory(entry.category),
    };

    await firstValueFrom(
      this.httpClient.post(
        this.buildJournalDateUrl(userId, 'expenses', dateKey),
        payload,
      ),
    );
  }

  private async postIncomeByDate(
    userId: number | string,
    dateKey: string,
    entry: IncomeEntry,
  ): Promise<void> {
    const payload: IncomeApiPayload = {
      amount: Math.max(0, Math.round(entry.amount)),
      description: entry.description,
      source: entry.source,
    };

    await firstValueFrom(
      this.httpClient.post(
        this.buildJournalDateUrl(userId, 'incomes', dateKey),
        payload,
      ),
    );
  }

  private async getChatsByDate(
    userId: number | string,
    dateKey: string,
  ): Promise<ChatMessage[] | null> {
    try {
      const payload = await firstValueFrom(
        this.httpClient.get<ChatMessage[]>(
          this.buildJournalDateUrl(userId, 'chats', dateKey),
        ),
      );
      return (payload || []).map((msg, index) =>
        this.normalizeChatMessage(msg, index),
      );
    } catch {
      return null;
    }
  }

  private async postChatByDate(
    userId: number | string | null,
    dateKey: string,
    payload: ChatApiPayload,
    fallbackId: number,
  ): Promise<ChatMessage> {
    if (userId) {
      try {
        const response = await firstValueFrom(
          this.httpClient.post<ChatMessage>(
            this.buildJournalDateUrl(userId, 'chats', dateKey),
            payload,
          ),
        );
        return this.normalizeChatMessage(
          {
            ...response,
            id: response?.id ?? fallbackId,
            sender: response?.sender ?? payload.sender,
            text: response?.text ?? payload.text,
            time: response?.time ?? payload.time,
          },
          fallbackId - 1,
        );
      } catch {
        // fall through to local fallback
      }
    }
    return this.normalizeChatMessage(
      {
        id: fallbackId,
        sender: payload.sender,
        text: payload.text,
        time: payload.time,
        parsedText: null,
        parsedNominal: null,
      },
      fallbackId - 1,
    );
  }

  private buildJournalDateUrl(
    userId: number | string,
    type: 'expenses' | 'incomes' | 'chats',
    dateKey: string,
  ): string {
    return `${USERS_API_URL}/${userId}/journal/${type}?date=${encodeURIComponent(
      dateKey,
    )}`;
  }

  private toApiExpenseCategory(category: ExpenseCategory): string {
    if (category === ExpenseCategory.Makanan) return 'Food';
    if (category === ExpenseCategory.Travel) return 'Travel';
    if (category === ExpenseCategory.Entertainment) return 'Entertainment';
    if (category === ExpenseCategory.Subscription) return 'Subscription';
    if (category === ExpenseCategory.Bills) return 'Bills';
    return 'Other';
  }

  private fromApiExpenseCategory(category: string): ExpenseCategory {
    const normalized = String(category || '')
      .trim()
      .toLowerCase();
    if (normalized === 'food' || normalized === 'makanan') {
      return ExpenseCategory.Makanan;
    }
    if (normalized === 'travel' || normalized === 'transport') {
      return ExpenseCategory.Travel;
    }
    if (normalized === 'entertainment') {
      return ExpenseCategory.Entertainment;
    }
    if (normalized === 'subscription') {
      return ExpenseCategory.Subscription;
    }
    if (
      normalized === 'bills' ||
      normalized === 'bill' ||
      normalized === 'tagihan'
    ) {
      return ExpenseCategory.Bills;
    }
    return ExpenseCategory.Other;
  }

  private patchLocalCurrentUser(patch: {
    financialData?: FinancialData | null;
  }): void {
    this.currentUserService.patchCurrentUser(patch);
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
