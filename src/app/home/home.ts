import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Sidebar } from '../shared/components/sidebar/sidebar';
import { JournalService } from '../core/services/journal.service';
import { ExpenseCategory } from '../shared/utils/expense-category';
import { USERS_API_URL } from '../core/config/app-api.config';

interface BudgetAllocation {
  mode: 2 | 3;
  pengeluaran: number;
  wants: number;
  savings: number;
}

interface SavingsAllocation {
  tabungan: number;
  danaDarurat: number;
  danaInvestasi: number;
}

interface FinancialData {
  pendapatan: number;
  pengeluaranWajib: number;
  tanggalPemasukan: number;
  hutangWajib: number;
  estimasiTabungan: number;
  danaDarurat: number;
  danaInvestasi?: number;
  budgetAllocation?: BudgetAllocation;
  savingsAllocation?: SavingsAllocation;
}

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
  isInRange: boolean;
  isStart: boolean;
  isEnd: boolean;
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

  userName = 'User';
  financialData: FinancialData | null = null;

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

  constructor() {
    this.loadUserData();
    this.refreshMonthlyExpenses();
    this.refreshStreakCalendar();
    void this.loadMonthlyExpenseTotal();
  }

  private loadUserData(): void {
    try {
      const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
      if (user.name) this.userName = user.name;
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
    const sisa =
      this.financialData.pendapatan -
      this.financialData.pengeluaranWajib -
      this.financialData.hutangWajib;
    const allocated = this.financialData.savingsAllocation
      ? this.financialData.savingsAllocation.tabungan +
        this.financialData.savingsAllocation.danaDarurat +
        this.financialData.savingsAllocation.danaInvestasi
      : 0;
    return Math.max(0, sisa - allocated);
  }

  get sisaSaldo(): string {
    return this.formatRupiah(this.sisaSaldoAmount);
  }

  get pendapatanFormatted(): string {
    return this.formatRupiah(this.financialData?.pendapatan || 0);
  }

  get pengeluaranWajibFormatted(): string {
    return this.formatRupiah(this.financialData?.pengeluaranWajib || 0);
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

  get isSaveDisabled(): boolean {
    const budgetTotal =
      this.budgetPengeluaran + this.budgetWants + this.budgetSavings;
    if (budgetTotal !== 100) return true;
    if (this.budgetSavings > 0 && !this.isSavingsValid) return true;
    return false;
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(this.streakStartDate);
    start.setHours(0, 0, 0, 0);
    if (today < start) return 0;
    return (
      Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) +
      1
    );
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
    this.autoFillBudget(field);
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
    const start = new Date(this.streakStartDate);
    start.setHours(0, 0, 0, 0);

    const days: StreakDay[] = [];

    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push({
        day: null,
        date: null,
        isDisabled: false,
        isInRange: false,
        isStart: false,
        isEnd: false,
      });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      date.setHours(0, 0, 0, 0);
      days.push({
        day: d,
        date,
        isDisabled: date > today,
        isInRange: date >= start && date <= today,
        isStart: date.getTime() === start.getTime(),
        isEnd: date.getTime() === today.getTime(),
      });
    }

    this.streakCalendarDays = days;
  }

  private refreshMonthlyExpenses(): void {
    const daysInMonth = new Date(
      this.selectedYear,
      this.selectedMonthIndex + 1,
      0,
    ).getDate();
    const totalRows = this.randomInRange(10, 18);

    this.monthlyExpenses = Array.from({ length: totalRows }, () =>
      this.createRandomExpense(daysInMonth),
    ).sort((a, b) => a.day - b.day);
  }

  private createRandomExpense(daysInMonth: number): ExpenseRow {
    const day = this.randomInRange(1, daysInMonth);
    const categories: Array<{
      label: ExpenseCategory;
      className: string;
      descriptions: string[];
    }> = [
      {
        label: ExpenseCategory.Makanan,
        className: 'category-makanan',
        descriptions: [
          'Makan siang kantor',
          'Belanja bahan dapur',
          'Ngopi sore',
          'Makan malam keluarga',
        ],
      },
      {
        label: ExpenseCategory.Travel,
        className: 'category-travel',
        descriptions: [
          'Tiket perjalanan',
          'Biaya hotel',
          'Transportasi bandara',
          'Biaya tol perjalanan',
        ],
      },
      {
        label: ExpenseCategory.Entertainment,
        className: 'category-entertainment',
        descriptions: [
          'Nonton bioskop',
          'Main game online',
          'Langganan streaming',
          'Beli buku hiburan',
        ],
      },
      {
        label: ExpenseCategory.Subscription,
        className: 'category-subscription',
        descriptions: [
          'Langganan aplikasi',
          'Paket cloud storage',
          'Biaya premium musik',
          'Langganan tools kerja',
        ],
      },
    ];

    const chosenCategory =
      categories[this.randomInRange(0, categories.length - 1)];
    const description =
      chosenCategory.descriptions[
        this.randomInRange(0, chosenCategory.descriptions.length - 1)
      ];
    const amount = this.randomInRange(25000, 850000);

    return {
      day,
      date: `${String(day).padStart(2, '0')} ${
        this.monthNames[this.selectedMonthIndex]
      } ${this.selectedYear}`,
      amount: this.formatRupiah(amount),
      description,
      categoryLabel: chosenCategory.label,
      categoryClass: chosenCategory.className,
    };
  }

  private async loadMonthlyExpenseTotal(): Promise<void> {
    if (!this.financialData) return;
    try {
      const journal = await this.journalService.loadCurrentUserJournal();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      let total = 0;
      for (const [dateKey, expenses] of Object.entries(
        journal.expensesByDate,
      )) {
        const [y, m, d] = dateKey.split('-').map(Number);
        const date = new Date(y, m - 1, d);
        date.setHours(0, 0, 0, 0);
        const isCurrentMonth =
          date.getFullYear() === today.getFullYear() &&
          date.getMonth() === today.getMonth();
        if (isCurrentMonth && date <= today) {
          total += expenses.reduce((sum, e) => sum + e.amount, 0);
        }
      }
      this.monthlyExpenseTotal = total;
    } catch {
      // keep default 0
    }
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

  private randomInRange(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private generatePercentage(): number {
    return Math.floor(Math.random() * 100) + 1;
  }
}
