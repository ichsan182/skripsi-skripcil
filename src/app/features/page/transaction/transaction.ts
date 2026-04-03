import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Sidebar } from '../../../shared/components/sidebar/sidebar';
import {
  ExpenseEntry,
  ExpenseBudgetPrompt,
  FinancialData,
  IncomeEntry,
  ChatMessage,
  JournalService,
  TopUpSource,
  UserJournal,
} from '../../../core/services/journal.service';
import { ExpenseCategory } from '../../../shared/utils/expense-category';
import {
  normalizeDate,
  toDateKey,
  parseDateKey,
  daysBetween,
} from '../../../core/utils/date.utils';
import {
  formatCurrency,
  formatCompactCurrency,
  formatPercent,
} from '../../../core/utils/format.utils';
import { RollingBudgetService } from '../../../core/utils/rolling-budget.service';

interface CalendarCell {
  date: Date;
  dayNumber: number;
  key: string;
  inCurrentMonth: boolean;
  isToday: boolean;
}

interface CategoryMeta {
  label: string;
  className: string;
  colorVar: string;
}

interface CategoryBreakdown {
  key: ExpenseCategory;
  label: string;
  className: string;
  colorVar: string;
  amount: number;
  percent: number;
}

const CATEGORY_META: Record<ExpenseCategory, CategoryMeta> = {
  [ExpenseCategory.Makanan]: {
    label: 'Makanan',
    className: 'category-makanan',
    colorVar: '--color-primary-light',
  },
  [ExpenseCategory.Travel]: {
    label: 'Travel',
    className: 'category-travel',
    colorVar: '--color-category-travel',
  },
  [ExpenseCategory.Entertainment]: {
    label: 'Entertainment',
    className: 'category-entertainment',
    colorVar: '--color-category-entertainment',
  },
  [ExpenseCategory.Subscription]: {
    label: 'Subscription',
    className: 'category-subscription',
    colorVar: '--color-category-subscription',
  },
  [ExpenseCategory.Bills]: {
    label: 'Bills',
    className: 'category-bills',
    colorVar: '--color-category-bills',
  },
  [ExpenseCategory.Other]: {
    label: 'Other',
    className: 'category-other',
    colorVar: '--color-category-other',
  },
};

@Component({
  selector: 'app-transaction',
  standalone: true,
  imports: [CommonModule, FormsModule, Sidebar],
  templateUrl: './transaction.html',
  styleUrl: './transaction.css',
})
export class Transaction {
  private readonly journalService = inject(JournalService);
  private readonly rollingBudgetService = inject(RollingBudgetService);

  rollingBudgetToday = 0;
  rollingBudgetRemaining = 0;
  rollingDaysRemaining = 0;
  rollingTotalBudget = 0;
  rollingUsedBudget = 0;

  readonly weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  readonly categoryMeta = CATEGORY_META;
  readonly categoryOptions = Object.values(ExpenseCategory).map((key) => ({
    key,
    label: CATEGORY_META[key].label,
  }));

  readonly today = this.normalizeDate(new Date());

  selectedDate = this.normalizeDate(new Date());
  currentMonthCursor = new Date(
    this.selectedDate.getFullYear(),
    this.selectedDate.getMonth(),
    1,
  );

  calendarCells: CalendarCell[] = [];

  messageInput = '';
  currentFinancialData: FinancialData | null = null;
  budgetPrompt: ExpenseBudgetPrompt | null = null;
  topUpModalOpen = false;
  topUpSource: TopUpSource = 'tabungan';
  topUpAmountInput: number | null = null;
  pendingExpenseEntry: ExpenseEntry | null = null;
  pendingChatText = '';
  pendingFromChat = false;
  topUpNotice = '';

  expenseDraft: {
    description: string;
    amount: number | null;
    category: ExpenseCategory;
  } = {
    description: '',
    amount: null,
    category: ExpenseCategory.Makanan,
  };

  incomeDraft: {
    description: string;
    source: string;
    amount: number | null;
  } = {
    description: '',
    source: '',
    amount: null,
  };

  private journal: UserJournal = {
    nextChatMessageId: 1,
    chatByDate: {},
    expensesByDate: {},
    incomesByDate: {},
  };

  constructor() {
    this.rebuildCalendar();
    void this.initializeData();
  }

  get canSubmitTopUp(): boolean {
    if (
      !this.budgetPrompt ||
      !this.topUpAmountInput ||
      this.topUpAmountInput <= 0
    ) {
      return false;
    }
    return this.topUpAmountInput <= this.currentTopUpMax;
  }

  get currentTopUpMax(): number {
    if (!this.budgetPrompt) {
      return 0;
    }
    return this.topUpSource === 'tabungan'
      ? this.budgetPrompt.maxTopUpFromTabungan
      : this.budgetPrompt.maxTopUpFromDanaDarurat;
  }

  get cycleTopUpWarningText(): string {
    if (!this.currentFinancialData?.monthlyTopUp) {
      return '';
    }
    const summary = this.currentFinancialData.monthlyTopUp;
    if (summary.totalFromTabungan <= 0) {
      return '';
    }

    const monthLabel = new Intl.DateTimeFormat('id-ID', {
      month: 'long',
      year: 'numeric',
    }).format(this.selectedDate);
    const allowed =
      this.currentFinancialData.estimasiTabungan >= this.baseExpenseLimit * 3
        ? 2
        : 1;
    const remainingCount = Math.max(0, allowed - summary.fromTabunganCount);

    return `Pada periode ${monthLabel}, kamu sudah menarik ${this.formatCurrency(summary.totalFromTabungan)} dari Tabungan untuk menambah limit pengeluaran. Sisa kesempatan penarikan Tabungan: ${remainingCount}x.`;
  }

  get baseExpenseLimit(): number {
    const data = this.currentFinancialData;
    if (!data?.budgetAllocation) {
      return data?.pengeluaranWajib ?? 0;
    }
    const pct =
      data.budgetAllocation.mode === 3
        ? data.budgetAllocation.pengeluaran + data.budgetAllocation.wants
        : data.budgetAllocation.pengeluaran;
    return Math.round((data.pendapatan * pct) / 100);
  }

  get monthYearLabel(): string {
    return new Intl.DateTimeFormat('id-ID', {
      month: 'long',
      year: 'numeric',
    }).format(this.currentMonthCursor);
  }

  get selectedDateLabel(): string {
    return new Intl.DateTimeFormat('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(this.selectedDate);
  }

  get selectedDateKey(): string {
    return this.toDateKey(this.selectedDate);
  }

  get isSelectedDateToday(): boolean {
    return this.selectedDateKey === this.toDateKey(this.today);
  }

  get selectedChatMessages(): ChatMessage[] {
    return this.journal.chatByDate[this.selectedDateKey] ?? [];
  }

  get selectedExpenses(): ExpenseEntry[] {
    return this.journal.expensesByDate[this.selectedDateKey] ?? [];
  }

  get selectedIncomes(): IncomeEntry[] {
    return this.journal.incomesByDate[this.selectedDateKey] ?? [];
  }

  get totalExpenseAmount(): number {
    return this.selectedExpenses.reduce(
      (total, item) => total + item.amount,
      0,
    );
  }

  get categoryBreakdown(): CategoryBreakdown[] {
    const total = this.totalExpenseAmount;
    if (!total) {
      return [];
    }

    return Object.values(ExpenseCategory)
      .map((key) => {
        const amount = this.selectedExpenses
          .filter((item) => item.category === key)
          .reduce((totalAmount, item) => totalAmount + item.amount, 0);

        return {
          key,
          label: CATEGORY_META[key].label,
          className: CATEGORY_META[key].className,
          colorVar: CATEGORY_META[key].colorVar,
          amount,
          percent: (amount / total) * 100,
        };
      })
      .filter((item) => item.amount > 0);
  }

  get donutGradient(): string {
    if (this.categoryBreakdown.length === 0) {
      return 'conic-gradient(rgba(3, 15, 15, 0.08) 0% 100%)';
    }

    let cursor = 0;
    const stops = this.categoryBreakdown.map((item, index) => {
      const start = cursor;
      const nextCursor = Math.min(100, cursor + item.percent);
      const end =
        index === this.categoryBreakdown.length - 1 ? 100 : nextCursor;
      cursor = end;
      return `var(${item.colorVar}) ${start}% ${end}%`;
    });

    if (cursor < 100) {
      stops.push(`rgba(3, 15, 15, 0.08) ${cursor}% 100%`);
    }

    return `conic-gradient(${stops.join(', ')})`;
  }

  get totalIncomeAmount(): number {
    return this.selectedIncomes.reduce((total, item) => total + item.amount, 0);
  }

  changeMonth(offset: number): void {
    this.currentMonthCursor = new Date(
      this.currentMonthCursor.getFullYear(),
      this.currentMonthCursor.getMonth() + offset,
      1,
    );
    this.rebuildCalendar();
  }

  selectDate(cell: CalendarCell): void {
    this.selectedDate = this.normalizeDate(cell.date);

    if (!cell.inCurrentMonth) {
      this.currentMonthCursor = new Date(
        this.selectedDate.getFullYear(),
        this.selectedDate.getMonth(),
        1,
      );
      this.rebuildCalendar();
    }

    void this.refreshPromptState();
  }

  isSameDate(dateA: Date, dateB: Date): boolean {
    return this.toDateKey(dateA) === this.toDateKey(dateB);
  }

  async sendMessage(): Promise<void> {
    if (!this.isSelectedDateToday) {
      return;
    }

    const text = this.messageInput.trim();
    if (!text) {
      return;
    }

    const todayKey = this.selectedDateKey;
    this.messageInput = '';

    const result = await this.journalService.addChatMessageWithAutoExpense(
      todayKey,
      text,
      this.selectedDateLabel,
    );
    this.journal = result.journal;
    this.currentFinancialData = result.financialData;
    this.computeRollingBudgetToday();

    if (result.requiresTopUp && result.prompt && result.pendingExpense) {
      this.openTopUpModal(result.prompt, result.pendingExpense, text, true);
    } else {
      await this.refreshPromptState();
    }
  }

  async addExpense(): Promise<void> {
    if (!this.isSelectedDateToday) {
      return;
    }

    const description = this.expenseDraft.description.trim();
    const amount = this.expenseDraft.amount;

    if (!description || !amount || amount <= 0) {
      return;
    }

    const result = await this.journalService.addExpense(this.selectedDateKey, {
      description,
      amount,
      category: this.expenseDraft.category,
    });

    this.journal = result.journal;
    this.currentFinancialData = result.financialData;
    this.computeRollingBudgetToday();

    if (result.requiresTopUp && result.prompt && result.pendingExpense) {
      this.openTopUpModal(result.prompt, result.pendingExpense, '', false);
      return;
    }

    this.expenseDraft.description = '';
    this.expenseDraft.amount = null;
    await this.refreshPromptState();
  }

  async addIncome(): Promise<void> {
    if (!this.isSelectedDateToday) {
      return;
    }

    const description = this.incomeDraft.description.trim();
    const source = this.incomeDraft.source.trim();
    const amount = this.incomeDraft.amount;

    if (!description || !source || !amount || amount <= 0) {
      return;
    }

    this.journal = await this.journalService.addIncome(this.selectedDateKey, {
      description,
      source,
      amount,
    });

    this.incomeDraft.description = '';
    this.incomeDraft.source = '';
    this.incomeDraft.amount = null;
  }

  formatCurrency(amount: number): string {
    return formatCurrency(amount);
  }

  formatCompactCurrency(amount: number): string {
    return formatCompactCurrency(amount);
  }

  formatPercent(value: number): string {
    return formatPercent(value);
  }

  private async initializeData(): Promise<void> {
    this.journal = await this.journalService.loadCurrentUserJournal();
    const cycle = await this.journalService.getCurrentCycleSummary(
      this.selectedDate,
    );
    this.currentFinancialData = cycle.financialData;
    this.computeRollingBudgetToday();
    this.budgetPrompt = await this.journalService.getExpensePromptForDate(
      this.selectedDateKey,
    );
  }

  async confirmTopUpAndRetry(): Promise<void> {
    if (
      !this.pendingExpenseEntry ||
      !this.canSubmitTopUp ||
      !this.topUpAmountInput
    ) {
      return;
    }

    if (this.pendingFromChat) {
      const result = await this.journalService.addExpense(
        this.selectedDateKey,
        this.pendingExpenseEntry,
        {
          allowTopUp: true,
          topUpSource: this.topUpSource,
          topUpAmount: this.topUpAmountInput,
        },
      );
      this.journal = result.journal;
      this.currentFinancialData = result.financialData;
      this.closeTopUpModal();
      this.computeRollingBudgetToday();
      await this.refreshPromptState();
      return;
    }

    const result = await this.journalService.addExpense(
      this.selectedDateKey,
      this.pendingExpenseEntry,
      {
        allowTopUp: true,
        topUpSource: this.topUpSource,
        topUpAmount: this.topUpAmountInput,
      },
    );

    this.journal = result.journal;
    this.currentFinancialData = result.financialData;
    this.computeRollingBudgetToday();
    if (!result.requiresTopUp) {
      this.expenseDraft.description = '';
      this.expenseDraft.amount = null;
      this.closeTopUpModal();
      await this.refreshPromptState();
    }
  }

  closeTopUpModal(): void {
    this.topUpModalOpen = false;
    this.pendingExpenseEntry = null;
    this.topUpAmountInput = null;
    this.pendingChatText = '';
    this.pendingFromChat = false;
  }

  private openTopUpModal(
    prompt: ExpenseBudgetPrompt,
    pendingExpense: ExpenseEntry,
    rawChatText: string,
    fromChat: boolean,
  ): void {
    this.budgetPrompt = prompt;
    this.pendingExpenseEntry = pendingExpense;
    this.pendingFromChat = fromChat;
    this.pendingChatText = rawChatText;
    this.topUpSource =
      prompt.maxTopUpFromTabungan > 0 ? 'tabungan' : 'danaDarurat';
    this.topUpAmountInput = null;
    this.topUpModalOpen = true;
  }

  private async refreshPromptState(): Promise<void> {
    this.budgetPrompt = await this.journalService.getExpensePromptForDate(
      this.selectedDateKey,
    );
  }

  private rebuildCalendar(): void {
    const monthStart = new Date(
      this.currentMonthCursor.getFullYear(),
      this.currentMonthCursor.getMonth(),
      1,
    );

    const offset = monthStart.getDay();
    const gridStart = new Date(monthStart);
    gridStart.setDate(monthStart.getDate() - offset);

    this.calendarCells = Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);
      const normalizedDate = this.normalizeDate(date);

      return {
        date: normalizedDate,
        dayNumber: normalizedDate.getDate(),
        key: this.toDateKey(normalizedDate),
        inCurrentMonth:
          normalizedDate.getMonth() === this.currentMonthCursor.getMonth(),
        isToday: this.isSameDate(normalizedDate, this.today),
      };
    });
  }

  private normalizeDate(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private toDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private computeRollingBudgetToday(): void {
    if (
      !this.currentFinancialData?.currentCycleStart ||
      !this.currentFinancialData.currentCycleEnd
    ) {
      this.rollingBudgetToday = 0;
      this.rollingBudgetRemaining = 0;
      this.rollingDaysRemaining = 0;
      this.rollingTotalBudget = 0;
      this.rollingUsedBudget = 0;
      return;
    }

    const cycleStart = this.parseDateKey(
      this.currentFinancialData.currentCycleStart,
    );
    const cycleEnd = this.parseDateKey(
      this.currentFinancialData.currentCycleEnd,
    );
    if (!cycleStart || !cycleEnd) {
      return;
    }

    const today = this.normalizeDate(new Date());
    const dayBeforeToday = new Date(today);
    dayBeforeToday.setDate(dayBeforeToday.getDate() - 1);

    const usedBeforeToday = this.sumExpensesInRange(cycleStart, dayBeforeToday);
    const totalBudget =
      this.currentFinancialData.currentPengeluaranLimit ??
      this.currentFinancialData.pengeluaranWajib;
    const remainingBudget = Math.max(0, totalBudget - usedBeforeToday);
    const remainingDays = Math.max(1, this.daysBetween(today, cycleEnd) + 1);

    this.rollingTotalBudget = totalBudget;
    this.rollingUsedBudget =
      this.currentFinancialData.currentPengeluaranUsed || 0;
    this.rollingBudgetRemaining = Math.max(
      0,
      totalBudget - this.rollingUsedBudget,
    );
    this.rollingDaysRemaining = remainingDays;
    this.rollingBudgetToday = Math.max(
      0,
      Math.floor(remainingBudget / remainingDays),
    );
  }

  private sumExpensesInRange(start: Date, end: Date): number {
    if (end < start) {
      return 0;
    }

    let total = 0;
    for (const [dateKey, entries] of Object.entries(
      this.journal.expensesByDate,
    )) {
      const date = this.parseDateKey(dateKey);
      if (!date) {
        continue;
      }

      if (date >= start && date <= end) {
        total += entries.reduce((acc, item) => acc + item.amount, 0);
      }
    }

    return total;
  }

  private parseDateKey(dateKey: string): Date | null {
    const [yearRaw, monthRaw, dayRaw] = dateKey.split('-');
    const year = Number(yearRaw);
    const month = Number(monthRaw);
    const day = Number(dayRaw);
    if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
      return null;
    }

    return new Date(year, month - 1, day);
  }

  private daysBetween(start: Date, end: Date): number {
    const startMs = this.normalizeDate(start).getTime();
    const endMs = this.normalizeDate(end).getTime();
    const dayMs = 24 * 60 * 60 * 1000;
    return Math.floor((endMs - startMs) / dayMs);
  }
}
