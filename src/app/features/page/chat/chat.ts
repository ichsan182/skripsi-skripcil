import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Sidebar } from '../../../shared/components/sidebar/sidebar';
import {
  ExpenseBudgetPrompt,
  ExpenseEntry,
  ChatMessage,
  TopUpSource,
  JournalService,
  UserJournal,
} from '../../../core/services/journal.service';

interface CalendarCell {
  date: Date;
  dayNumber: number;
  key: string;
  inCurrentMonth: boolean;
  isToday: boolean;
}

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, Sidebar],
  templateUrl: './chat.html',
  styleUrl: './chat.css',
})
export class Chat {
  private readonly journalService = inject(JournalService);

  readonly weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  readonly quickGuide = [
    'Contoh: 10000 makan',
    'Contoh: 25000 travel',
    'Contoh: 50000 tagihan listrik',
    'Contoh: 80000 entertainment',
    'Contoh: 30000 subscription',
  ];

  readonly today = this.normalizeDate(new Date());

  selectedDate = this.normalizeDate(new Date());
  currentMonthCursor = new Date(
    this.selectedDate.getFullYear(),
    this.selectedDate.getMonth(),
    1,
  );

  calendarCells: CalendarCell[] = [];
  messageInput = '';
  topUpModalOpen = false;
  topUpSource: TopUpSource = 'tabungan';
  topUpAmountInput: number | null = null;
  budgetPrompt: ExpenseBudgetPrompt | null = null;
  pendingExpenseEntry: ExpenseEntry | null = null;

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

  get currentTopUpMax(): number {
    if (!this.budgetPrompt) {
      return 0;
    }
    return this.topUpSource === 'tabungan'
      ? this.budgetPrompt.maxTopUpFromTabungan
      : this.budgetPrompt.maxTopUpFromDanaDarurat;
  }

  get canSubmitTopUp(): boolean {
    if (!this.topUpAmountInput || this.topUpAmountInput <= 0) {
      return false;
    }
    return this.topUpAmountInput <= this.currentTopUpMax;
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
  }

  isSameDate(dateA: Date, dateB: Date): boolean {
    return this.toDateKey(dateA) === this.toDateKey(dateB);
  }

  formatCurrency(amount: number): string {
    return `Rp ${new Intl.NumberFormat('id-ID').format(amount)}`;
  }

  async sendMessage(): Promise<void> {
    if (!this.isSelectedDateToday) {
      return;
    }

    const text = this.messageInput.trim();
    if (!text) {
      return;
    }

    const rawText = this.messageInput;
    this.messageInput = '';
    const result = await this.journalService.addChatMessageWithAutoExpense(
      this.selectedDateKey,
      text,
      this.selectedDateLabel,
    );
    this.journal = result.journal;

    if (result.requiresTopUp && result.prompt && result.pendingExpense) {
      this.budgetPrompt = result.prompt;
      this.pendingExpenseEntry = result.pendingExpense;
      this.topUpSource =
        result.prompt.maxTopUpFromTabungan > 0 ? 'tabungan' : 'danaDarurat';
      this.topUpAmountInput = null;
      this.topUpModalOpen = true;
      this.messageInput = rawText;
    }
  }

  private async initializeData(): Promise<void> {
    this.journal = await this.journalService.loadCurrentUserJournal();
  }

  async confirmTopUpAndRetry(): Promise<void> {
    if (
      !this.pendingExpenseEntry ||
      !this.canSubmitTopUp ||
      !this.topUpAmountInput
    ) {
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
    this.closeTopUpModal();
    this.messageInput = '';
  }

  closeTopUpModal(): void {
    this.topUpModalOpen = false;
    this.pendingExpenseEntry = null;
    this.topUpAmountInput = null;
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
}
