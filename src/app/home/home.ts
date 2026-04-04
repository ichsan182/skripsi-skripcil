import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Sidebar } from '../shared/components/sidebar/sidebar';
import {
  BudgetAllocation,
  FinancialData,
  JournalService,
  SavingsAllocation,
  UserJournal,
} from '../core/services/journal.service';
import { ExpenseCategory } from '../shared/utils/expense-category';
import { USERS_API_URL } from '../core/config/app-api.config';
import {
  normalizeDate,
  toDateKey,
  parseDateKey,
  daysBetween,
  toMonthInputValue,
} from '../core/utils/date.utils';
import {
  formatCurrency,
  formatNumber,
  formatCompactCurrency,
  formatPercent,
} from '../core/utils/format.utils';
import { RollingBudgetService } from '../core/utils/rolling-budget.service';

interface ExpenseRow {
  date: string;
  amount: string;
  description: string;
  categoryLabel: ExpenseCategory;
  categoryClass: string;
  day: number;
}

interface StreakDay {
  day: number | null;
  date: Date | null;
  isDisabled: boolean;
  isSuccess: boolean;
  isSkipped: boolean;
  isFailed: boolean;
  isBeforeStart: boolean;
  isToday: boolean;
}

type StreakDayStatus =
  | 'success'
  | 'skipped'
  | 'failed'
  | 'before-start'
  | 'future';

interface UserStreak {
  current: number;
  longest: number;
  lastActiveDate: string;
  freezeUsed: boolean;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, Sidebar],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  private readonly journalService = inject(JournalService);
  private readonly http = inject(HttpClient);
  private readonly rollingBudgetService = inject(RollingBudgetService);
  private journal: UserJournal = {
    nextChatMessageId: 1,
    chatByDate: {},
    expensesByDate: {},
    incomesByDate: {},
  };
  private readonly noExpensePolicy: 'allow-no-expense' | 'require-entry' =
    'require-entry';

  userName = 'User';
  userEmail = 'user@example.com';
  userProfileImage = 'assets/user.svg';
  financialData: FinancialData | null = null;
  userId: string | number | null = null;
  streakState: UserStreak = {
    current: 0,
    longest: 0,
    lastActiveDate: '',
    freezeUsed: false,
  };
  rollingBudgetToday = 0;
  rollingBudgetRemaining = 0;
  rollingDaysRemaining = 0;
  rollingTotalBudget = 0;
  rollingUsedBudget = 0;

  showMentions = {
    saldo: false,
    pemasukan: true,
    pengeluaran: true,
    hutang: true,
  };

  saldoPercentage = this.generatePercentage();
  pemasukanPercentage = this.generatePercentage();
  pengeluaranPercentage = this.generatePercentage();
  hutangPercentage = this.generatePercentage();

  Math = Math;
  showSettingPersenan = false;
  budgetMode: 2 | 3 = 2;
  budgetPengeluaran = 80;
  budgetWants = 0;
  budgetSavings = 20;
  budgetLastEdited: ('pengeluaran' | 'wants' | 'savings') | null = null;
  savingsTabunganInput = 0;
  savingsDanaDaruratInput = 0;
  savingsDanaInvestasiInput = 0;
  savingsTabunganPercent = 0;
  savingsDanaDaruratPercent = 0;
  savingsDanaInvestasiPercent = 0;
  savingsPercentLastEdited:
    | 'tabungan'
    | 'danaDarurat'
    | 'danaInvestasi'
    | null = null;
  pendapatanInput = 0;
  monthlyExpenseTotal = 0;

  currentLevel = 2;
  levelProgress = 60;

  readonly monthNames = [
    'Januari',
    'Februari',
    'Maret',
    'April',
    'Mei',
    'Juni',
    'Juli',
    'Agustus',
    'September',
    'Oktober',
    'November',
    'Desember',
  ];

  selectedMonthIndex = new Date().getMonth();
  selectedYear = new Date().getFullYear();
  selectedMonthValue = this.toMonthInputValue(
    this.selectedYear,
    this.selectedMonthIndex,
  );
  monthlyExpenses: ExpenseRow[] = [];

  readonly levelImages = [
    'assets/level/level_1.svg',
    'assets/level/level_2.svg',
    'assets/level/level_3.svg',
    'assets/level/level_4.svg',
    'assets/level/level_5.svg',
    'assets/level/level-6.svg',
    'assets/level/level_7.svg',
  ];

  readonly levelTasks = [
    'Mulai mencatat pengeluaran harianmu',
    'Catat transaksi selama 7 hari berturut-turut',
    'Mengosongkan hutang',
    'Capai tabungan darurat 3x pengeluaran',
    'Mulai investasi pertama kamu',
    'Raih streak 100 hari berturut-turut',
    'Capai semua target keuangan',
  ];

  readonly dayHeaders = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  streakStartDate: Date = new Date(2026, 2, 1);
  streakCalendarYear: number = new Date().getFullYear();
  streakCalendarMonth: number = new Date().getMonth();
  streakCalendarDays: StreakDay[] = [];
  firstRecordDate: Date | null = null;

  constructor() {
    this.loadUserData();
    void this.initializeDashboard();
  }

  private loadUserData(): void {
    try {
      const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
      if (user.name) this.userName = user.name;
      if (user.email) this.userEmail = user.email;
      if (user.profileImage) this.userProfileImage = user.profileImage;
      if (user.level) {
        this.currentLevel = user.level;
        this.levelProgress = this.calculateLevelProgress();
      }
      if (user.financialData) {
        this.financialData = user.financialData;
        this.pendapatanInput = user.financialData.pendapatan || 0;
        if (user.financialData.budgetAllocation) {
          const ba = user.financialData.budgetAllocation;
          this.budgetMode = ba.mode;
          this.budgetPengeluaran = ba.pengeluaran;
          this.budgetWants = ba.wants;
          this.budgetSavings = ba.savings;
        }
        // savings inputs always start at 0 (sisa saldo system)
      }
    } catch {
      // use defaults
    }
  }

  onProfileUpdated(profile: {
    name: string;
    email: string;
    profileImage: string;
  }): void {
    this.userName = profile.name;
    this.userEmail = profile.email;
    this.userProfileImage = profile.profileImage;
  }

  private calculateLevelProgress(): number {
    if (!this.financialData) return 0;
    const { hutangWajib, estimasiTabungan, danaDarurat, pendapatan } =
      this.financialData;
    if (this.currentLevel === 2) return 10;
    if (this.currentLevel === 3) {
      const tabProgress = Math.min((estimasiTabungan / 10_000_000) * 100, 100);
      const target = pendapatan * 3;
      const ddProgress =
        target > 0 ? Math.min((danaDarurat / target) * 100, 100) : 0;
      return Math.round((tabProgress + ddProgress) / 2);
    }
    if (this.currentLevel >= 4) return 100;
    return 0;
  }

  get sisaSaldoAmount(): number {
    if (!this.financialData) return 0;
    if (this.financialData.currentSisaSaldoPool !== undefined) {
      return Math.max(0, this.financialData.currentSisaSaldoPool);
    }
    const budget = this.financialData.budgetAllocation;
    if (budget) {
      return Math.max(
        0,
        Math.round((this.financialData.pendapatan * budget.savings) / 100),
      );
    }
    const fallback =
      this.financialData.pendapatan -
      this.financialData.pengeluaranWajib -
      this.financialData.hutangWajib;
    return Math.max(0, fallback);
  }

  get sisaSaldo(): string {
    return this.formatRupiah(this.sisaSaldoAmount);
  }

  get pendapatanFormatted(): string {
    return this.formatRupiah(this.financialData?.pendapatan || 0);
  }

  get pengeluaranWajibFormatted(): string {
    return this.formatRupiah(
      this.financialData?.currentPengeluaranLimit ??
        this.financialData?.pengeluaranWajib ??
        0,
    );
  }

  get monthlyExpenseTotalFormatted(): string {
    return this.formatRupiah(this.monthlyExpenseTotal);
  }

  get hutangFormatted(): string {
    return this.formatRupiah(this.financialData?.hutangWajib || 0);
  }

  get tabunganFormatted(): string {
    return this.formatRupiah(this.financialData?.estimasiTabungan || 0);
  }

  get danaDaruratFormatted(): string {
    return this.formatRupiah(this.financialData?.danaDarurat || 0);
  }

  get danaInvestasiFormatted(): string {
    return this.formatRupiah(this.financialData?.danaInvestasi || 0);
  }

  get showDanaInvestasi(): boolean {
    return this.currentLevel >= 4;
  }

  get savingsTotalAmount(): number {
    return this.sisaSaldoAmount;
  }

  get isSisaSaldoEmpty(): boolean {
    return this.savingsTotalAmount <= 0;
  }

  get savingsUsed(): number {
    return (
      this.savingsTabunganInput +
      this.savingsDanaDaruratInput +
      (this.currentLevel >= 4 ? this.savingsDanaInvestasiInput : 0)
    );
  }

  get savingsRemaining(): number {
    return Math.max(0, this.savingsTotalAmount - this.savingsUsed);
  }

  get isSavingsValid(): boolean {
    return this.savingsUsed <= this.savingsTotalAmount;
  }

  get savingsPercentTotal(): number {
    return (
      this.savingsTabunganPercent +
      this.savingsDanaDaruratPercent +
      (this.currentLevel >= 4 ? this.savingsDanaInvestasiPercent : 0)
    );
  }

  get savingsPercentRemaining(): number {
    return Math.max(0, 100 - this.savingsPercentTotal);
  }

  get isSaveDisabled(): boolean {
    if (this.budgetTotalPercent !== 100) return true;
    if (this.budgetSavings > 0 && !this.isSavingsValid) return true;
    return false;
  }

  get budgetTotalPercent(): number {
    return this.budgetPengeluaran + this.budgetWants + this.budgetSavings;
  }

  get isBudgetTotalOverLimit(): boolean {
    return this.budgetTotalPercent > 100;
  }

  get isBudgetTotalUnderLimit(): boolean {
    return this.budgetTotalPercent < 100;
  }

  get budgetPercentExcess(): number {
    return Math.max(0, this.budgetTotalPercent - 100);
  }

  get budgetPercentShortage(): number {
    return Math.max(0, 100 - this.budgetTotalPercent);
  }

  get currentLevelImage(): string {
    return this.levelImages[this.currentLevel - 1];
  }

  get nextLevelImage(): string | null {
    return this.currentLevel < 7 ? this.levelImages[this.currentLevel] : null;
  }

  get currentLevelTask(): string {
    return this.levelTasks[this.currentLevel - 1];
  }

  get currentMonthYearLabel(): string {
    return `${this.monthNames[this.selectedMonthIndex]} ${this.selectedYear}`;
  }

  get streakCount(): number {
    return this.streakState.current;
  }

  get longestStreak(): number {
    return this.streakState.longest;
  }

  get activeStreakMilestone(): string {
    if (this.streakState.current >= 100) return 'Legenda';
    if (this.streakState.current >= 30) return 'Master Keuangan';
    if (this.streakState.current >= 7) return 'Seminggu Solid';
    if (this.streakState.current >= 3) return 'Mulai Konsisten';
    return 'Pemanasan';
  }

  get streakCalendarLabel(): string {
    return `${this.monthNames[this.streakCalendarMonth]} ${this.streakCalendarYear}`;
  }

  openSettingPersenan(): void {
    if (this.financialData) {
      this.pendapatanInput = this.financialData.pendapatan;
      if (this.financialData.budgetAllocation) {
        const ba = this.financialData.budgetAllocation;
        this.budgetMode = ba.mode;
        this.budgetPengeluaran = ba.pengeluaran;
        this.budgetWants = ba.wants;
        this.budgetSavings = ba.savings;
      }
    }
    // savings inputs always start at 0 (sisa saldo system)
    this.savingsTabunganInput = 0;
    this.savingsDanaDaruratInput = 0;
    this.savingsDanaInvestasiInput = 0;
    this.savingsTabunganPercent = 0;
    this.savingsDanaDaruratPercent = 0;
    this.savingsDanaInvestasiPercent = 0;
    this.savingsPercentLastEdited = null;
    this.budgetLastEdited = null;
    this.showSettingPersenan = true;
  }

  closeSettingPersenan(): void {
    this.showSettingPersenan = false;
  }

  setBudgetMode(mode: 2 | 3): void {
    this.budgetMode = mode;
    this.budgetLastEdited = null;
    if (mode === 2) {
      this.budgetWants = 0;
      this.budgetSavings = 100 - this.budgetPengeluaran;
    }
  }

  onPendapatanInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const cleaned = input.value.replace(/[^0-9]/g, '');
    this.pendapatanInput = parseInt(cleaned, 10) || 0;
    input.value = this.formatNumber(this.pendapatanInput);
  }

  onBudgetPercentInput(
    field: 'pengeluaran' | 'wants' | 'savings',
    event: Event,
  ): void {
    const input = event.target as HTMLInputElement;
    const cleaned = input.value.replace(/[^0-9]/g, '');
    let value = parseInt(cleaned, 10) || 0;
    if (value > 100) value = 100;
    this.setBudgetField(field, value);
    input.value = String(value);
    if (this.budgetMode === 2) {
      this.autoFillBudget(field);
    }
    this.budgetLastEdited = field;
  }

  onSavingsAmountInput(
    field: 'tabungan' | 'danaDarurat' | 'danaInvestasi',
    event: Event,
  ): void {
    const input = event.target as HTMLInputElement;
    const cleaned = input.value.replace(/[^0-9]/g, '');
    let value = parseInt(cleaned, 10) || 0;
    const maxForField = this.getSavingsMaxForField(field);
    if (value > maxForField) value = maxForField;
    if (field === 'tabungan') this.savingsTabunganInput = value;
    else if (field === 'danaDarurat') this.savingsDanaDaruratInput = value;
    else this.savingsDanaInvestasiInput = value;
    input.value = this.formatNumber(value);
    this.syncSavingsPercentFromAmounts();
  }

  onSavingsPercentInput(
    field: 'tabungan' | 'danaDarurat' | 'danaInvestasi',
    event: Event,
  ): void {
    const input = event.target as HTMLInputElement;
    const cleaned = input.value.replace(/[^0-9]/g, '');
    let value = parseInt(cleaned, 10) || 0;
    if (value > 100) value = 100;

    this.setSavingsPercentField(field, value);
    this.autoFillSavingsPercent(field);
    this.savingsPercentLastEdited = field;
    this.syncSavingsAmountsFromPercentages(field);
    input.value = String(this.getSavingsPercentField(field));
  }

  async saveSettingPersenan(): Promise<void> {
    const pendapatan = this.pendapatanInput;
    const totalPengeluaranPct =
      this.budgetMode === 3
        ? this.budgetPengeluaran + this.budgetWants
        : this.budgetPengeluaran;
    const pengeluaranWajib = Math.round(
      (pendapatan * totalPengeluaranPct) / 100,
    );
    const existingTabungan = this.financialData?.estimasiTabungan || 0;
    const existingDanaDarurat = this.financialData?.danaDarurat || 0;
    const existingDanaInvestasi = this.financialData?.danaInvestasi || 0;
    const estimasiTabungan = existingTabungan + this.savingsTabunganInput;
    const danaDarurat = existingDanaDarurat + this.savingsDanaDaruratInput;
    const danaInvestasi =
      this.currentLevel >= 4
        ? existingDanaInvestasi + this.savingsDanaInvestasiInput
        : existingDanaInvestasi;
    const budgetAllocation: BudgetAllocation = {
      mode: this.budgetMode,
      pengeluaran: this.budgetPengeluaran,
      wants: this.budgetWants,
      savings: this.budgetSavings,
    };
    const existingSavingsAlloc = this.financialData?.savingsAllocation || {
      tabungan: 0,
      danaDarurat: 0,
      danaInvestasi: 0,
    };
    const savingsAllocation: SavingsAllocation = {
      tabungan: existingSavingsAlloc.tabungan + this.savingsTabunganInput,
      danaDarurat:
        existingSavingsAlloc.danaDarurat + this.savingsDanaDaruratInput,
      danaInvestasi:
        existingSavingsAlloc.danaInvestasi + this.savingsDanaInvestasiInput,
    };
    const updatedFinancialData: FinancialData = {
      ...(this.financialData || {
        pendapatan: 0,
        pengeluaranWajib: 0,
        tanggalPemasukan: 1,
        hutangWajib: 0,
        estimasiTabungan: 0,
        danaDarurat: 0,
      }),
      pendapatan,
      pengeluaranWajib,
      estimasiTabungan,
      danaDarurat,
      danaInvestasi,
      budgetAllocation,
      savingsAllocation,
      currentPengeluaranLimit: pengeluaranWajib,
      currentSisaSaldoPool: Math.max(
        0,
        Math.round((pendapatan * this.budgetSavings) / 100) -
          (this.savingsTabunganInput +
            this.savingsDanaDaruratInput +
            this.savingsDanaInvestasiInput),
      ),
    };
    this.financialData = updatedFinancialData;
    const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
    user.financialData = updatedFinancialData;
    localStorage.setItem('currentUser', JSON.stringify(user));
    if (user.id) {
      try {
        await firstValueFrom(
          this.http.patch(`${USERS_API_URL}/${user.id}`, {
            financialData: updatedFinancialData,
          }),
        );
      } catch {
        // silent
      }
    }
    this.showSettingPersenan = false;
  }

  changeMonth(step: number): void {
    const totalMonths = this.selectedYear * 12 + this.selectedMonthIndex + step;
    this.selectedYear = Math.floor(totalMonths / 12);
    this.selectedMonthIndex = ((totalMonths % 12) + 12) % 12;
    this.selectedMonthValue = this.toMonthInputValue(
      this.selectedYear,
      this.selectedMonthIndex,
    );
    this.refreshMonthlyExpenses();
  }

  onPickMonth(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.value) {
      return;
    }

    const [yearRaw, monthRaw] = input.value.split('-');
    const year = Number(yearRaw);
    const month = Number(monthRaw) - 1;

    if (Number.isNaN(year) || Number.isNaN(month) || month < 0 || month > 11) {
      return;
    }

    this.selectedYear = year;
    this.selectedMonthIndex = month;
    this.selectedMonthValue = this.toMonthInputValue(year, month);
    this.refreshMonthlyExpenses();
  }

  changeStreakMonth(step: number): void {
    const total =
      this.streakCalendarYear * 12 + this.streakCalendarMonth + step;
    this.streakCalendarYear = Math.floor(total / 12);
    this.streakCalendarMonth = ((total % 12) + 12) % 12;
    this.refreshStreakCalendar();
  }

  private refreshStreakCalendar(): void {
    const year = this.streakCalendarYear;
    const month = this.streakCalendarMonth;
    const firstDayOfWeek = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const days: StreakDay[] = [];

    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push({
        day: null,
        date: null,
        isDisabled: false,
        isSuccess: false,
        isSkipped: false,
        isFailed: false,
        isBeforeStart: false,
        isToday: false,
      });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      date.setHours(0, 0, 0, 0);
      const dayStatus = this.getStreakDayStatus(date);
      days.push({
        day: d,
        date,
        isDisabled: date > today,
        isSuccess: dayStatus === 'success',
        isSkipped: dayStatus === 'skipped',
        isFailed: dayStatus === 'failed',
        isBeforeStart: dayStatus === 'before-start',
        isToday: date.getTime() === today.getTime(),
      });
    }

    this.streakCalendarDays = days;
  }

  private refreshMonthlyExpenses(): void {
    const rows: ExpenseRow[] = [];
    for (const [dateKey, expenses] of Object.entries(
      this.journal.expensesByDate,
    )) {
      const [yearRaw, monthRaw, dayRaw] = dateKey.split('-');
      const year = Number(yearRaw);
      const month = Number(monthRaw) - 1;
      const day = Number(dayRaw);
      if (
        Number.isNaN(year) ||
        Number.isNaN(month) ||
        Number.isNaN(day) ||
        year !== this.selectedYear ||
        month !== this.selectedMonthIndex
      ) {
        continue;
      }

      for (const expense of expenses) {
        rows.push({
          day,
          date: `${String(day).padStart(2, '0')} ${
            this.monthNames[this.selectedMonthIndex]
          } ${this.selectedYear}`,
          amount: this.formatRupiah(expense.amount),
          description: expense.description,
          categoryLabel: expense.category,
          categoryClass: this.getCategoryClass(expense.category),
        });
      }
    }

    this.monthlyExpenses = rows.sort((a, b) => a.day - b.day);
  }

  private async loadMonthlyExpenseTotal(): Promise<void> {
    try {
      const summary = await this.journalService.getCurrentCycleSummary();
      this.monthlyExpenseTotal = summary.monthlyExpenseTotal;
      if (summary.financialData) {
        this.financialData = summary.financialData;
        this.computeRollingBudgetToday();
      }
    } catch {
      // keep default 0
    }
  }

  private async initializeDashboard(): Promise<void> {
    await this.loadMonthlyExpenseTotal();
    this.journal = await this.journalService.loadCurrentUserJournal();
    this.firstRecordDate = this.getFirstRecordDate();
    await this.syncDailyStreakState();
    this.refreshMonthlyExpenses();
    this.refreshStreakCalendar();
  }

  private async syncDailyStreakState(): Promise<void> {
    const today = this.startOfDay(new Date());
    const todayKey = this.toDateKey(today);
    const currentUserStreak = this.normalizeStreak(
      JSON.parse(localStorage.getItem('currentUser') || '{}').streak,
    );

    if (!this.firstRecordDate) {
      const emptyStreak: UserStreak = {
        current: 0,
        longest: 0,
        lastActiveDate: todayKey,
        freezeUsed: currentUserStreak.freezeUsed,
      };
      this.streakState = emptyStreak;
      await this.persistStreak(emptyStreak);
      return;
    }

    let runningCurrent = 0;
    let runningLongest = 0;
    let consecutiveMissOrFail = 0;
    let cursor = this.startOfDay(new Date(this.firstRecordDate));

    while (cursor <= today) {
      const status = this.getStreakDayStatus(cursor);
      if (status === 'success') {
        runningCurrent += 1;
        runningLongest = Math.max(runningLongest, runningCurrent);
        consecutiveMissOrFail = 0;
      } else if (status === 'skipped' || status === 'failed') {
        consecutiveMissOrFail += 1;
        if (consecutiveMissOrFail >= 3) {
          runningCurrent = 0;
        }
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    const updated: UserStreak = {
      current: runningCurrent,
      longest: Math.max(currentUserStreak.longest, runningLongest),
      lastActiveDate: todayKey,
      freezeUsed: currentUserStreak.freezeUsed,
    };
    this.streakState = updated;
    await this.persistStreak(updated);
  }

  private async persistStreak(streak: UserStreak): Promise<void> {
    const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const updatedUser = {
      ...user,
      streak,
    };
    localStorage.setItem('currentUser', JSON.stringify(updatedUser));
    if (user.id) {
      try {
        await firstValueFrom(
          this.http.patch(`${USERS_API_URL}/${user.id}`, {
            streak,
          }),
        );
      } catch {
        // silent
      }
    }
  }

  private normalizeStreak(value: unknown): UserStreak {
    if (!value || typeof value !== 'object') {
      return {
        current: 0,
        longest: 0,
        lastActiveDate: '',
        freezeUsed: false,
      };
    }

    const raw = value as Partial<UserStreak>;
    return {
      current: Math.max(0, Math.floor(raw.current || 0)),
      longest: Math.max(0, Math.floor(raw.longest || 0)),
      lastActiveDate: raw.lastActiveDate || '',
      freezeUsed: Boolean(raw.freezeUsed),
    };
  }

  private computeRollingBudgetToday(): void {
    const state = this.rollingBudgetService.computeRollingBudgetState(
      this.financialData,
      this.journal,
    );
    this.rollingTotalBudget = state.rollingTotalBudget;
    this.rollingUsedBudget = state.rollingUsedBudget;
    this.rollingBudgetRemaining = state.rollingBudgetRemaining;
    this.rollingDaysRemaining = state.rollingDaysRemaining;
    this.rollingBudgetToday = state.rollingBudgetToday;
  }

  private getStreakDayStatus(date: Date): StreakDayStatus {
    const day = this.startOfDay(date);
    const today = this.startOfDay(new Date());
    if (day > today) {
      return 'future';
    }

    if (!this.firstRecordDate || day < this.firstRecordDate) {
      return 'before-start';
    }

    const hasEntry = this.getTotalEntryCountByDate(day) > 0;
    if (!hasEntry && this.noExpensePolicy === 'require-entry') {
      return 'skipped';
    }

    const rolling = this.computeRollingBudgetForDate(day);
    if (!rolling.hasBudget) {
      return hasEntry ? 'success' : 'skipped';
    }

    const spentToday = this.getTotalExpenseByDate(day);
    const isWithinBudget = spentToday <= rolling.dailyBudget;
    return isWithinBudget ? 'success' : 'failed';
  }

  private computeRollingBudgetForDate(date: Date): {
    hasBudget: boolean;
    dailyBudget: number;
  } {
    if (!this.financialData) {
      return { hasBudget: false, dailyBudget: 0 };
    }

    const cycle = this.resolveCycleRangeByDate(date);
    const totalBudget = this.getCycleBudgetByDate(date);
    if (totalBudget <= 0) {
      return { hasBudget: false, dailyBudget: 0 };
    }

    const dayBefore = new Date(date);
    dayBefore.setDate(dayBefore.getDate() - 1);
    const usedBefore = this.sumExpensesInRange(cycle.start, dayBefore);
    const remainingBudget = Math.max(0, totalBudget - usedBefore);
    const remainingDays = Math.max(1, this.daysBetween(date, cycle.end) + 1);
    return {
      hasBudget: true,
      dailyBudget: Math.floor(remainingBudget / remainingDays),
    };
  }

  private resolveCycleRangeByDate(referenceDate: Date): {
    start: Date;
    end: Date;
  } {
    const intendedDay = Math.max(
      1,
      Math.min(
        31,
        Math.floor(
          this.financialData?.intendedTanggalPemasukan ||
            this.financialData?.tanggalPemasukan ||
            1,
        ),
      ),
    );
    const resetDayThisMonth = this.resolveResetDay(
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
    end.setDate(end.getDate() - 1);
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

  private getCycleBudgetByDate(date: Date): number {
    if (!this.financialData) {
      return 0;
    }

    const targetDateKey = this.toDateKey(date);
    if (
      this.financialData.currentCycleStart &&
      this.financialData.currentCycleEnd &&
      targetDateKey >= this.financialData.currentCycleStart &&
      targetDateKey <= this.financialData.currentCycleEnd
    ) {
      return (
        this.financialData.currentPengeluaranLimit ??
        this.financialData.pengeluaranWajib
      );
    }

    return this.financialData.pengeluaranWajib;
  }

  private getTotalExpenseByDate(date: Date): number {
    const key = this.toDateKey(date);
    const expenses = this.journal.expensesByDate[key] || [];
    return expenses.reduce((sum, item) => sum + item.amount, 0);
  }

  private getTotalEntryCountByDate(date: Date): number {
    const key = this.toDateKey(date);
    const expenses = this.journal.expensesByDate[key]?.length || 0;
    const incomes = this.journal.incomesByDate[key]?.length || 0;
    return expenses + incomes;
  }

  private getFirstRecordDate(): Date | null {
    const dateKeys = new Set<string>();

    for (const [key, entries] of Object.entries(this.journal.expensesByDate)) {
      if (entries.length > 0) {
        dateKeys.add(key);
      }
    }

    for (const [key, entries] of Object.entries(this.journal.incomesByDate)) {
      if (entries.length > 0) {
        dateKeys.add(key);
      }
    }

    let earliest: Date | null = null;
    for (const key of dateKeys) {
      const parsed = this.parseDateKey(key);
      if (!parsed) {
        continue;
      }
      if (!earliest || parsed < earliest) {
        earliest = parsed;
      }
    }
    return earliest;
  }

  private sumExpensesInRange(start: Date, end: Date): number {
    if (end < start) {
      return 0;
    }
    let total = 0;
    for (const [dateKey, expenses] of Object.entries(
      this.journal.expensesByDate,
    )) {
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

  private getCategoryClass(category: ExpenseCategory): string {
    if (category === ExpenseCategory.Makanan) return 'category-makanan';
    if (category === ExpenseCategory.Travel) return 'category-travel';
    if (category === ExpenseCategory.Entertainment)
      return 'category-entertainment';
    if (category === ExpenseCategory.Subscription)
      return 'category-subscription';
    if (category === ExpenseCategory.Bills) return 'category-bills';
    return 'category-other';
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

  private daysBetween(from: Date, to: Date): number {
    const ms = this.startOfDay(to).getTime() - this.startOfDay(from).getTime();
    return Math.floor(ms / (1000 * 60 * 60 * 24));
  }

  private setBudgetField(
    field: 'pengeluaran' | 'wants' | 'savings',
    value: number,
  ): void {
    if (field === 'pengeluaran') this.budgetPengeluaran = value;
    else if (field === 'wants') this.budgetWants = value;
    else this.budgetSavings = value;
  }

  private autoFillBudget(
    editedField: 'pengeluaran' | 'wants' | 'savings',
  ): void {
    if (this.budgetMode === 2) {
      const absorber =
        editedField === 'pengeluaran' ? 'savings' : 'pengeluaran';
      this.setBudgetField(
        absorber,
        Math.max(0, 100 - this.getBudgetFieldVal(editedField)),
      );
      return;
    }
    // 3-field mode: absorb remainder into the "other" field that wasn't just edited
    // Priority: adjust the last field in order that isn't the edited one
    const priority: ('pengeluaran' | 'wants' | 'savings')[] = [
      'savings',
      'wants',
      'pengeluaran',
    ];
    // Pick absorber: prefer the previously-edited field if it exists and isn't current, else pick by priority
    let absorber: 'pengeluaran' | 'wants' | 'savings';
    if (this.budgetLastEdited && this.budgetLastEdited !== editedField) {
      absorber = this.budgetLastEdited;
    } else {
      absorber = priority.find((f) => f !== editedField) || 'savings';
    }
    const thirdField = (['pengeluaran', 'wants', 'savings'] as const).find(
      (f) => f !== editedField && f !== absorber,
    )!;
    const remainder =
      100 -
      this.getBudgetFieldVal(editedField) -
      this.getBudgetFieldVal(thirdField);
    if (remainder >= 0) {
      this.setBudgetField(absorber, remainder);
    } else {
      // thirdField also too large, so zero the absorber and clamp thirdField
      this.setBudgetField(absorber, 0);
      this.setBudgetField(
        thirdField,
        Math.max(0, 100 - this.getBudgetFieldVal(editedField)),
      );
    }
  }

  private getBudgetFieldVal(
    field: 'pengeluaran' | 'wants' | 'savings',
  ): number {
    if (field === 'pengeluaran') return this.budgetPengeluaran;
    if (field === 'wants') return this.budgetWants;
    return this.budgetSavings;
  }

  private getSavingsMaxForField(
    field: 'tabungan' | 'danaDarurat' | 'danaInvestasi',
  ): number {
    const total = this.savingsTotalAmount;
    let othersSum = 0;
    if (field !== 'tabungan') othersSum += this.savingsTabunganInput;
    if (field !== 'danaDarurat') othersSum += this.savingsDanaDaruratInput;
    if (field !== 'danaInvestasi' && this.currentLevel >= 4)
      othersSum += this.savingsDanaInvestasiInput;
    return Math.max(0, total - othersSum);
  }

  private autoFillSavingsPercent(
    editedField: 'tabungan' | 'danaDarurat' | 'danaInvestasi',
  ): void {
    if (this.currentLevel < 4) {
      const absorber = editedField === 'tabungan' ? 'danaDarurat' : 'tabungan';
      this.setSavingsPercentField(
        absorber,
        Math.max(0, 100 - this.getSavingsPercentField(editedField)),
      );
      this.savingsDanaInvestasiPercent = 0;
      return;
    }

    const allFields: ('tabungan' | 'danaDarurat' | 'danaInvestasi')[] = [
      'tabungan',
      'danaDarurat',
      'danaInvestasi',
    ];

    let absorber: 'tabungan' | 'danaDarurat' | 'danaInvestasi';
    if (
      this.savingsPercentLastEdited &&
      this.savingsPercentLastEdited !== editedField
    ) {
      absorber = this.savingsPercentLastEdited;
    } else {
      absorber =
        allFields.find((field) => field !== editedField) ?? 'danaDarurat';
    }

    const thirdField = allFields.find(
      (field) => field !== editedField && field !== absorber,
    );

    if (!thirdField) {
      return;
    }

    const remainder =
      100 -
      this.getSavingsPercentField(editedField) -
      this.getSavingsPercentField(thirdField);

    if (remainder >= 0) {
      this.setSavingsPercentField(absorber, remainder);
      return;
    }

    this.setSavingsPercentField(absorber, 0);
    this.setSavingsPercentField(
      thirdField,
      Math.max(0, 100 - this.getSavingsPercentField(editedField)),
    );
  }

  private syncSavingsPercentFromAmounts(): void {
    const total = this.savingsTotalAmount;
    if (total <= 0) {
      this.savingsTabunganPercent = 0;
      this.savingsDanaDaruratPercent = 0;
      this.savingsDanaInvestasiPercent = 0;
      return;
    }

    this.savingsTabunganPercent = this.toSafePercent(
      (this.savingsTabunganInput / total) * 100,
    );
    this.savingsDanaDaruratPercent = this.toSafePercent(
      (this.savingsDanaDaruratInput / total) * 100,
    );

    if (this.currentLevel >= 4) {
      this.savingsDanaInvestasiPercent = this.toSafePercent(
        (this.savingsDanaInvestasiInput / total) * 100,
      );
      return;
    }

    this.savingsDanaInvestasiPercent = 0;
  }

  private syncSavingsAmountsFromPercentages(
    primaryField: 'tabungan' | 'danaDarurat' | 'danaInvestasi',
  ): void {
    const total = this.savingsTotalAmount;
    if (total <= 0) {
      this.savingsTabunganInput = 0;
      this.savingsDanaDaruratInput = 0;
      this.savingsDanaInvestasiInput = 0;
      return;
    }

    this.savingsTabunganInput = Math.round(
      (total * this.savingsTabunganPercent) / 100,
    );
    this.savingsDanaDaruratInput = Math.round(
      (total * this.savingsDanaDaruratPercent) / 100,
    );
    this.savingsDanaInvestasiInput =
      this.currentLevel >= 4
        ? Math.round((total * this.savingsDanaInvestasiPercent) / 100)
        : 0;

    const overflow = this.savingsUsed - total;
    if (overflow <= 0) {
      return;
    }

    const primaryValue = this.getSavingsAmountField(primaryField);
    if (primaryValue >= overflow) {
      this.setSavingsAmountField(primaryField, primaryValue - overflow);
      return;
    }

    this.setSavingsAmountField(primaryField, 0);
    let remainder = overflow - primaryValue;

    const allSavingsFields = [
      'tabungan',
      'danaDarurat',
      'danaInvestasi',
    ] as const;
    const otherFields = allSavingsFields.filter(
      (field): field is 'tabungan' | 'danaDarurat' | 'danaInvestasi' =>
        field !== primaryField &&
        (this.currentLevel >= 4 || field !== 'danaInvestasi'),
    );

    for (const field of otherFields) {
      if (remainder <= 0) {
        break;
      }

      const current = this.getSavingsAmountField(field);
      const deduction = Math.min(current, remainder);
      this.setSavingsAmountField(field, current - deduction);
      remainder -= deduction;
    }
  }

  private setSavingsPercentField(
    field: 'tabungan' | 'danaDarurat' | 'danaInvestasi',
    value: number,
  ): void {
    const normalized = Math.max(0, Math.min(100, Math.floor(value)));
    if (field === 'tabungan') this.savingsTabunganPercent = normalized;
    else if (field === 'danaDarurat')
      this.savingsDanaDaruratPercent = normalized;
    else this.savingsDanaInvestasiPercent = normalized;
  }

  private getSavingsPercentField(
    field: 'tabungan' | 'danaDarurat' | 'danaInvestasi',
  ): number {
    if (field === 'tabungan') return this.savingsTabunganPercent;
    if (field === 'danaDarurat') return this.savingsDanaDaruratPercent;
    return this.savingsDanaInvestasiPercent;
  }

  private setSavingsAmountField(
    field: 'tabungan' | 'danaDarurat' | 'danaInvestasi',
    value: number,
  ): void {
    const normalized = Math.max(0, Math.floor(value));
    if (field === 'tabungan') this.savingsTabunganInput = normalized;
    else if (field === 'danaDarurat') this.savingsDanaDaruratInput = normalized;
    else this.savingsDanaInvestasiInput = normalized;
  }

  private getSavingsAmountField(
    field: 'tabungan' | 'danaDarurat' | 'danaInvestasi',
  ): number {
    if (field === 'tabungan') return this.savingsTabunganInput;
    if (field === 'danaDarurat') return this.savingsDanaDaruratInput;
    return this.savingsDanaInvestasiInput;
  }

  private toSafePercent(value: number): number {
    if (!Number.isFinite(value) || value <= 0) {
      return 0;
    }

    return Math.max(0, Math.min(100, Math.round(value)));
  }

  formatRupiah(amount: number): string {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  formatNumber(value: number): string {
    if (!value) return '';
    return new Intl.NumberFormat('id-ID').format(value);
  }

  private toMonthInputValue(year: number, monthIndex: number): string {
    return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
  }

  private generatePercentage(): number {
    return Math.floor(Math.random() * 100) + 1;
  }
}
