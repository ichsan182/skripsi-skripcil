import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Sidebar } from '../../../shared/components/sidebar/sidebar';

type ChatSender = 'user' | 'assistant';
type ExpenseCategory =
  | 'makanan'
  | 'travel'
  | 'entertainment'
  | 'subscription'
  | 'bills';

interface ChatMessage {
  id: number;
  sender: ChatSender;
  text: string;
  time: string;
}

interface CalendarCell {
  date: Date;
  dayNumber: number;
  key: string;
  inCurrentMonth: boolean;
  isToday: boolean;
}

interface ExpenseEntry {
  amount: number;
  description: string;
  category: ExpenseCategory;
}

interface IncomeEntry {
  amount: number;
  description: string;
  source: string;
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
  makanan: {
    label: 'Makanan',
    className: 'category-makanan',
    colorVar: '--color-primary-light',
  },
  travel: {
    label: 'Travel',
    className: 'category-travel',
    colorVar: '--color-category-travel',
  },
  entertainment: {
    label: 'Entertainment',
    className: 'category-entertainment',
    colorVar: '--color-category-transport',
  },
  subscription: {
    label: 'Subscription',
    className: 'category-subscription',
    colorVar: '--color-category-subscription',
  },
  bills: {
    label: 'Bills',
    className: 'category-bills',
    colorVar: '--color-category-bills',
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
  readonly weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  readonly categoryMeta = CATEGORY_META;
  readonly categoryOptions = Object.entries(CATEGORY_META).map(
    ([key, value]) => ({
      key: key as ExpenseCategory,
      label: value.label,
    }),
  );

  readonly today = this.normalizeDate(new Date());

  selectedDate = this.normalizeDate(new Date());
  currentMonthCursor = new Date(
    this.selectedDate.getFullYear(),
    this.selectedDate.getMonth(),
    1,
  );

  calendarCells: CalendarCell[] = [];

  messageInput = '';

  expenseDraft: {
    description: string;
    amount: number | null;
    category: ExpenseCategory;
  } = {
    description: '',
    amount: null,
    category: 'makanan',
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

  private nextMessageId = 1;

  private readonly chatByDate: Record<string, ChatMessage[]> = {};
  private readonly expensesByDate: Record<string, ExpenseEntry[]> = {};
  private readonly incomesByDate: Record<string, IncomeEntry[]> = {};

  constructor() {
    this.seedDummyData();
    this.rebuildCalendar();
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
    return this.chatByDate[this.selectedDateKey] ?? [];
  }

  get selectedExpenses(): ExpenseEntry[] {
    return this.expensesByDate[this.selectedDateKey] ?? [];
  }

  get selectedIncomes(): IncomeEntry[] {
    return this.incomesByDate[this.selectedDateKey] ?? [];
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

    return (Object.keys(CATEGORY_META) as ExpenseCategory[])
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
  }

  isSameDate(dateA: Date, dateB: Date): boolean {
    return this.toDateKey(dateA) === this.toDateKey(dateB);
  }

  sendMessage(): void {
    if (!this.isSelectedDateToday) {
      return;
    }

    const text = this.messageInput.trim();
    if (!text) {
      return;
    }

    const todayKey = this.selectedDateKey;

    this.ensureChatBucket(todayKey).push({
      id: this.nextMessageId++,
      sender: 'user',
      text,
      time: this.getCurrentTimeLabel(),
    });

    this.messageInput = '';

    setTimeout(() => {
      this.ensureChatBucket(todayKey).push({
        id: this.nextMessageId++,
        sender: 'assistant',
        text: `Catatan untuk ${this.selectedDateLabel} sudah disimpan.`,
        time: this.getCurrentTimeLabel(),
      });
    }, 300);
  }

  addExpense(): void {
    if (!this.isSelectedDateToday) {
      return;
    }

    const description = this.expenseDraft.description.trim();
    const amount = this.expenseDraft.amount;

    if (!description || !amount || amount <= 0) {
      return;
    }

    this.ensureExpenseBucket(this.selectedDateKey).unshift({
      description,
      amount,
      category: this.expenseDraft.category,
    });

    this.expenseDraft.description = '';
    this.expenseDraft.amount = null;
  }

  addIncome(): void {
    if (!this.isSelectedDateToday) {
      return;
    }

    const description = this.incomeDraft.description.trim();
    const source = this.incomeDraft.source.trim();
    const amount = this.incomeDraft.amount;

    if (!description || !source || !amount || amount <= 0) {
      return;
    }

    this.ensureIncomeBucket(this.selectedDateKey).unshift({
      description,
      source,
      amount,
    });

    this.incomeDraft.description = '';
    this.incomeDraft.source = '';
    this.incomeDraft.amount = null;
  }

  formatCurrency(amount: number): string {
    return `Rp ${new Intl.NumberFormat('id-ID').format(amount)}`;
  }

  formatCompactCurrency(amount: number): string {
    if (amount >= 1_000_000_000) {
      return `${this.trimTrailingZero(amount / 1_000_000_000)} M`;
    }

    if (amount >= 1_000_000) {
      return `${this.trimTrailingZero(amount / 1_000_000)} Jt`;
    }

    if (amount >= 1_000) {
      return `${this.trimTrailingZero(amount / 1_000)} Rb`;
    }

    return this.formatCurrency(amount);
  }

  formatPercent(value: number): string {
    const normalized = Number.isFinite(value) ? value : 0;
    const safe = Math.min(100, Math.max(0, normalized));
    return this.trimTrailingZero(safe);
  }

  private seedDummyData(): void {
    const today = this.normalizeDate(new Date());
    const yesterday = this.shiftDate(today, -1);
    const twoDaysAgo = this.shiftDate(today, -2);

    const todayKey = this.toDateKey(today);
    const yesterdayKey = this.toDateKey(yesterday);
    const twoDaysAgoKey = this.toDateKey(twoDaysAgo);

    this.chatByDate[todayKey] = [
      {
        id: this.nextMessageId++,
        sender: 'assistant',
        text: 'Halo! Pilih tanggal untuk lihat riwayat chat dan transaksi kamu.',
        time: '09:00',
      },
    ];

    this.chatByDate[yesterdayKey] = [
      {
        id: this.nextMessageId++,
        sender: 'user',
        text: 'Kemarin pengeluaran paling besar ada di transport.',
        time: '20:10',
      },
      {
        id: this.nextMessageId++,
        sender: 'assistant',
        text: 'Noted, besok bisa dibatasi dengan budget harian ya.',
        time: '20:11',
      },
    ];

    this.expensesByDate[todayKey] = [
      {
        amount: 85000,
        description: 'Makan siang kantor',
        category: 'makanan',
      },
      {
        amount: 35000,
        description: 'Langganan musik',
        category: 'subscription',
      },
      {
        amount: 125000,
        description: 'Transport pulang pergi',
        category: 'travel',
      },
    ];

    this.expensesByDate[yesterdayKey] = [
      {
        amount: 120000,
        description: 'Bensin',
        category: 'travel',
      },
      {
        amount: 70000,
        description: 'Makan malam',
        category: 'makanan',
      },
      {
        amount: 90000,
        description: 'Nonton bioskop',
        category: 'entertainment',
      },
    ];

    this.expensesByDate[twoDaysAgoKey] = [
      {
        amount: 140000,
        description: 'Tagihan listrik',
        category: 'bills',
      },
    ];

    this.incomesByDate[todayKey] = [
      {
        amount: 450000,
        description: 'Freelance desain',
        source: 'Project klien A',
      },
    ];

    this.incomesByDate[yesterdayKey] = [
      {
        amount: 200000,
        description: 'Cashback marketplace',
        source: 'Program promo',
      },
    ];
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

  private ensureChatBucket(dateKey: string): ChatMessage[] {
    if (!this.chatByDate[dateKey]) {
      this.chatByDate[dateKey] = [];
    }

    return this.chatByDate[dateKey];
  }

  private ensureExpenseBucket(dateKey: string): ExpenseEntry[] {
    if (!this.expensesByDate[dateKey]) {
      this.expensesByDate[dateKey] = [];
    }

    return this.expensesByDate[dateKey];
  }

  private ensureIncomeBucket(dateKey: string): IncomeEntry[] {
    if (!this.incomesByDate[dateKey]) {
      this.incomesByDate[dateKey] = [];
    }

    return this.incomesByDate[dateKey];
  }

  private getCurrentTimeLabel(): string {
    return new Intl.DateTimeFormat('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date());
  }

  private normalizeDate(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private shiftDate(source: Date, offset: number): Date {
    const shifted = new Date(source);
    shifted.setDate(shifted.getDate() + offset);
    return this.normalizeDate(shifted);
  }

  private toDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private trimTrailingZero(value: number): string {
    return value.toFixed(1).replace('.0', '');
  }
}
