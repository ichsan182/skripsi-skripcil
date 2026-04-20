import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Sidebar } from '../shared/components/sidebar/sidebar';
import { LevelCardComponent } from '../shared/components/level-card/level-card';
import {
  BudgetAllocation,
  FinancialData,
  InvestmentTracking,
  JournalService,
  SavingsAllocation,
  UserJournal,
} from '../core/services/journal.service';
import { ExpenseCategory } from '../shared/utils/expense-category';
import { USERS_API_URL } from '../core/config/app-api.config';
import {
  CurrencyAmountLimitTier,
  formatCurrency as formatRupiahUtil,
  formatNumber as formatNumberUtil,
  formatPercent,
} from '../core/utils/format.utils';
import { RollingBudgetService } from '../core/utils/rolling-budget.service';
import {
  LevelEvaluation,
  buildLevelSignals,
  evaluateFinancialLevel,
} from '../core/utils/level';
import {
  StreakTestMode,
  TestingTimeService,
} from '../core/services/testing-time.service';
import {
  PemasukanPopup,
  PemasukanPopupSubmitPayload,
} from '../shared/components/pemasukan-popup/pemasukan-popup';
import {
  PengeluaranPopup,
  PengeluaranPopupSubmitPayload,
} from '../shared/components/pengeluaran-popup/pengeluaran-popup';
import { StreakDay, StreakDayStatus, UserStreak } from './streak/streak.models';
import {
  buildStreakCalendarDays,
  computeLiveStreakState,
  computeTestingModeStreakState,
  getStreakMilestoneLabel,
  normalizeUserStreak,
} from './streak/streak.utils';

interface ExpenseRow {
  date: string;
  amount: string;
  description: string;
  categoryLabel: ExpenseCategory;
  categoryClass: string;
  day: number;
}

type DebtCategory = 'konsumtif' | 'produktif';
type DebtCardMode = 'consumptive' | 'productive' | 'clear';
type DebtChangeDirection = 'up' | 'down';

interface DebtItemSnapshot {
  id: string;
  name: string;
  category: DebtCategory;
  remainingAmount: number;
  monthlyInstallment: number;
  dueDay: number;
  dueDate: string;
  status: string;
}

interface DebtMonthlySnapshot {
  consumptiveActiveTotal: number;
  productiveActiveTotal: number;
}

interface DebtCardState {
  mode: DebtCardMode;
  total: number;
  activeCount: number;
  changePercent: number | null;
  changeDirection: DebtChangeDirection | null;
  urgentLine: string;
  payoffLabel: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, Sidebar, PemasukanPopup, PengeluaranPopup],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  private readonly journalService = inject(JournalService);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly rollingBudgetService = inject(RollingBudgetService);
  private readonly testingTimeService = inject(TestingTimeService);
  protected readonly levelCardComponent = LevelCardComponent;
  private journal: UserJournal = {
    nextChatMessageId: 1,
    chatByDate: {},
    expensesByDate: {},
    incomesByDate: {},
  };
  private readonly noExpensePolicy: 'allow-no-expense' | 'require-entry' =
    'require-entry';
  private readonly debtSnapshotStorageKey = 'homeDebtMonthlySnapshots';
  private debts: DebtItemSnapshot[] = [];
  private debtCardState: DebtCardState = {
    mode: 'clear',
    total: 0,
    activeCount: 0,
    changePercent: null,
    changeDirection: null,
    urgentLine: '',
    payoffLabel: '',
  };

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

  Math = Math;
  showSettingPersenan = false;
  showTambahPemasukan = false;
  incomeSubmitting = false;
  readonly incomeAmountLimitTier = CurrencyAmountLimitTier.ONE_BILLION;
  showTambahPengeluaran = false;
  expenseSubmitting = false;
  expenseSaveError = '';

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
  testingDateInput = '';
  streakTestMode: StreakTestMode = 'realistic';
  checkpointExists = false;
  monthlyExpenseTotal = 0;
  levelEvaluation: LevelEvaluation = evaluateFinancialLevel(
    buildLevelSignals(null),
  );

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

  readonly dayHeaders = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  streakStartDate: Date = new Date(2026, 2, 1);
  streakCalendarYear: number = new Date().getFullYear();
  streakCalendarMonth: number = new Date().getMonth();
  streakCalendarDays: StreakDay[] = [];
  firstRecordDate: Date | null = null;

  constructor() {
    this.loadUserData();
    this.streakTestMode = this.testingTimeService.getStreakTestMode();
    this.checkpointExists = this.testingTimeService.hasCheckpoint();
    this.syncReferenceDateControls();
    void this.initializeDashboard();
  }

  get isTestingDateActive(): boolean {
    return this.testingTimeService.isCustomDateActive();
  }

  async applyTestingDate(): Promise<void> {
    const parsed = this.parseTestingDateInput(this.testingDateInput);
    if (!parsed) {
      return;
    }

    this.testingTimeService.setReferenceDate(parsed);
    await this.reloadForReferenceDate();
  }

  async resetTestingDate(): Promise<void> {
    this.testingTimeService.clearReferenceDate();
    await this.reloadForReferenceDate();
  }

  setStreakTestMode(mode: StreakTestMode): void {
    this.streakTestMode = mode;
    this.testingTimeService.setStreakTestMode(mode);
    void this.reloadForReferenceDate();
  }

  saveCheckpoint(): void {
    const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
    user.journal = {
      nextChatMessageId: this.journal.nextChatMessageId,
      chatByDate: this.journal.chatByDate,
      expensesByDate: this.journal.expensesByDate,
      incomesByDate: this.journal.incomesByDate,
    };
    this.testingTimeService.saveCheckpoint(JSON.stringify(user));
    this.checkpointExists = true;
  }

  async restoreCheckpoint(): Promise<void> {
    const snapshot = this.testingTimeService.loadCheckpoint();
    if (!snapshot) return;
    const user = JSON.parse(snapshot);
    localStorage.setItem('currentUser', snapshot);
    if (user.id) {
      try {
        await firstValueFrom(
          this.http.put(`${USERS_API_URL}/${user.id}`, {
            ...user,
            id: user.id,
          }),
        );
      } catch {
        // silent
      }
    }
    this.loadUserData();
    this.syncReferenceDateControls();
    await this.initializeDashboard();
  }

  private loadUserData(): void {
    try {
      const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
      this.userId = user.id ?? null;
      if (user.name) this.userName = user.name;
      if (user.email) this.userEmail = user.email;
      if (user.profileImage) this.userProfileImage = user.profileImage;
      this.debts = this.normalizeDebts(user.debts);
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

      if (!this.debts.length && (this.financialData?.hutangWajib ?? 0) > 0) {
        this.debts = [
          this.buildLegacyConsumptiveDebt(this.financialData?.hutangWajib ?? 0),
        ];
      }

      this.refreshLevelEvaluation();
      this.refreshDebtCardState();
    } catch {
      // use defaults
      this.refreshDebtCardState();
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

  goToDebtPage(): void {
    void this.router.navigate(['/debt']);
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

  get pengeluaranBudgetLimit(): number {
    return (
      this.financialData?.currentPengeluaranLimit ??
      this.financialData?.pengeluaranWajib ??
      0
    );
  }

  get pengeluaranBudgetUsed(): number {
    return this.financialData?.currentPengeluaranUsed ?? 0;
  }

  get monthlyExpenseTotalFormatted(): string {
    return this.formatRupiah(this.monthlyExpenseTotal);
  }

  get debtCardTitle(): string {
    if (this.debtCardState.mode === 'consumptive') {
      return 'Hutang Konsumtif';
    }

    if (this.debtCardState.mode === 'productive') {
      return 'Hutang Produktif';
    }

    return 'Status Hutang';
  }

  get debtCardPrimaryValue(): string {
    if (this.debtCardState.mode === 'clear') {
      return 'Bebas Hutang';
    }

    return this.formatRupiah(this.debtCardState.total);
  }

  get debtCardSecondaryValue(): string {
    if (this.debtCardState.mode === 'consumptive') {
      return `${this.debtCardState.activeCount} Hutang Konsumtif Aktif`;
    }

    if (this.debtCardState.mode === 'productive') {
      return `Estimasi lunas: ${this.debtCardState.payoffLabel}`;
    }

    return '';
  }

  get debtCardMessage(): string {
    if (this.debtCardState.mode === 'consumptive') {
      return this.debtCardState.urgentLine;
    }

    if (this.debtCardState.mode === 'productive') {
      return 'Hutang produktif berjalan sesuai rencana jangka panjang.';
    }

    return 'Semua hutang sudah lunas. Pertahankan kondisi sehat ini.';
  }

  get debtCardToneClass(): string {
    if (this.debtCardState.mode === 'consumptive') {
      return 'debt-tone-alert';
    }

    if (this.debtCardState.mode === 'productive') {
      return 'debt-tone-progress';
    }

    return 'debt-tone-clear';
  }

  get showDebtChange(): boolean {
    return this.debtCardState.changePercent !== null;
  }

  get debtChangePercentLabel(): string {
    if (this.debtCardState.changePercent === null) {
      return '';
    }

    return `${this.debtCardState.changePercent}%`;
  }

  get debtChangeDirection(): DebtChangeDirection | null {
    return this.debtCardState.changeDirection;
  }

  get debtChangeClass(): string {
    if (this.debtCardState.changeDirection === 'up') {
      return 'debt-change-up';
    }

    if (this.debtCardState.changeDirection === 'down') {
      return 'debt-change-down';
    }

    return '';
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

  get danaInvestasiInputPercentOfIncome(): string {
    if (this.pendapatanInput <= 0 || this.savingsDanaInvestasiInput <= 0) {
      return '0';
    }

    return formatPercent(
      (this.savingsDanaInvestasiInput / this.pendapatanInput) * 100,
    );
  }

  get danaInvestasiIncomeHint(): string {
    if (this.pendapatanInput <= 0) {
      return 'Masukkan pemasukan untuk melihat persentase dana investasi terhadap pemasukan.';
    }

    return `Input ini setara ${this.danaInvestasiInputPercentOfIncome}% dari pemasukan bulanan.`;
  }

  get danaInvestasiIncomeTargetAmount(): number {
    if (this.pendapatanInput <= 0) {
      return 0;
    }

    return Math.round(this.pendapatanInput * 0.15);
  }

  get danaInvestasiTargetHint(): string {
    if (this.pendapatanInput <= 0) {
      return 'Target level 4 akan muncul setelah pemasukan diisi.';
    }

    return `Target level 4 minimal ${this.formatRupiah(this.danaInvestasiIncomeTargetAmount)} atau 15% dari pemasukan.`;
  }

  get showDanaInvestasi(): boolean {
    return this.levelEvaluation.level >= 4;
  }

  get savingsTotalAmount(): number {
    return this.computeEditableSavingsPoolTotal();
  }

  get isSisaSaldoEmpty(): boolean {
    return this.savingsTotalAmount <= 0;
  }

  get savingsUsed(): number {
    return (
      this.savingsTabunganInput +
      this.savingsDanaDaruratInput +
      (this.levelEvaluation.level >= 4 ? this.savingsDanaInvestasiInput : 0)
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
      (this.levelEvaluation.level >= 4 ? this.savingsDanaInvestasiPercent : 0)
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
    return getStreakMilestoneLabel(this.streakState.current);
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

  openTambahPemasukan(): void {
    this.incomeSubmitting = false;
    this.showTambahPemasukan = true;
  }

  closeTambahPemasukan(): void {
    this.showTambahPemasukan = false;
  }

  openTambahPengeluaran(): void {
    this.expenseSubmitting = false;
    this.expenseSaveError = '';
    this.showTambahPengeluaran = true;
  }

  closeTambahPengeluaran(): void {
    this.showTambahPengeluaran = false;
    this.expenseSaveError = '';
  }

  async saveTambahPengeluaran(
    payload: PengeluaranPopupSubmitPayload,
  ): Promise<void> {
    this.expenseSubmitting = true;
    this.expenseSaveError = '';
    try {
      const today = this.getReferenceToday();
      const todayKey = this.toDateKey(today);
      const result = await this.journalService.addExpense(todayKey, {
        amount: payload.amount,
        description: payload.description,
        category: payload.category,
      });

      if (result.requiresTopUp) {
        this.expenseSaveError =
          'Anggaran pengeluaran sudah penuh. Buka halaman Transaksi untuk menambah pengeluaran dengan pilihan tambahan dana.';
        return;
      }

      this.journal = result.journal;
      if (result.financialData) {
        this.financialData = result.financialData;
        this.refreshLevelEvaluation();
        this.computeRollingBudgetToday();
        const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
        user.financialData = result.financialData;
        localStorage.setItem('currentUser', JSON.stringify(user));
      }

      await this.loadMonthlyExpenseTotal();
      this.refreshMonthlyExpenses();
      this.showTambahPengeluaran = false;
    } finally {
      this.expenseSubmitting = false;
    }
  }

  async saveTambahPemasukan(
    payload: PemasukanPopupSubmitPayload,
  ): Promise<void> {
    this.incomeSubmitting = true;
    try {
      const today = this.getReferenceToday();
      const todayKey = this.toDateKey(today);
      const result = await this.journalService.addTemporaryIncome(
        todayKey,
        payload,
      );
      this.journal = result.journal;
      if (result.financialData) {
        this.financialData = result.financialData;
        this.refreshLevelEvaluation();
        this.computeRollingBudgetToday();
        const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
        user.financialData = result.financialData;
        localStorage.setItem('currentUser', JSON.stringify(user));
      }
      this.showTambahPemasukan = false;
    } finally {
      this.incomeSubmitting = false;
    }
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
    const budgetAllocation: BudgetAllocation = {
      mode: this.budgetMode,
      pengeluaran: this.budgetPengeluaran,
      wants: this.budgetWants,
      savings: this.budgetSavings,
    };
    const totalPengeluaranPct = this.getBudgetExpensePercent(budgetAllocation);
    const pengeluaranWajib = Math.round(
      (pendapatan * totalPengeluaranPct) / 100,
    );
    const existingTabungan = this.financialData?.estimasiTabungan || 0;
    const existingDanaDarurat = this.financialData?.danaDarurat || 0;
    const existingDanaInvestasi = this.financialData?.danaInvestasi || 0;
    const estimasiTabungan = existingTabungan + this.savingsTabunganInput;
    const danaDarurat = existingDanaDarurat + this.savingsDanaDaruratInput;
    const danaInvestasi =
      this.levelEvaluation.level >= 4
        ? existingDanaInvestasi + this.savingsDanaInvestasiInput
        : existingDanaInvestasi;
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
    const investmentTracking = this.buildUpdatedInvestmentTracking();
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
      investmentTracking,
      currentPengeluaranLimit: pengeluaranWajib,
      currentSisaSaldoPool: Math.max(0, this.savingsRemaining),
    };
    this.financialData = updatedFinancialData;
    this.refreshLevelEvaluation();
    const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
    user.financialData = updatedFinancialData;
    localStorage.setItem('currentUser', JSON.stringify(user));
    if (user.id) {
      try {
        await firstValueFrom(
          this.http.put(`${USERS_API_URL}/${user.id}`, {
            ...user,
            id: user.id,
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
    this.streakCalendarDays = buildStreakCalendarDays({
      year: this.streakCalendarYear,
      month: this.streakCalendarMonth,
      today: this.getReferenceToday(),
      getDayStatus: (date) => this.getStreakDayStatus(date),
    });
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
      const summary = await this.journalService.getCurrentCycleSummary(
        this.getReferenceToday(),
      );
      this.monthlyExpenseTotal = summary.monthlyExpenseTotal;
      if (summary.financialData) {
        this.financialData = summary.financialData;
        this.refreshLevelEvaluation();
        this.computeRollingBudgetToday();
      }
    } catch {
      // keep default 0
    }
  }

  private async initializeDashboard(): Promise<void> {
    await this.loadMonthlyExpenseTotal();
    this.journal = await this.journalService.loadCurrentUserJournal(
      this.getReferenceToday(),
    );
    this.firstRecordDate = this.getFirstRecordDate();
    await this.syncDailyStreakState();
    this.refreshMonthlyExpenses();
    this.refreshStreakCalendar();
  }

  private async syncDailyStreakState(): Promise<void> {
    const today = this.getReferenceToday();
    const todayKey = this.toDateKey(today);
    const currentUserStreak = normalizeUserStreak(
      JSON.parse(localStorage.getItem('currentUser') || '{}').streak,
    );

    if (this.isTestingDateActive && this.streakTestMode === 'always-streak') {
      const testingSync = computeTestingModeStreakState({
        currentStreak: currentUserStreak,
        today,
        todayKey,
        parseDateKey: (dateKey) => this.parseDateKey(dateKey),
        daysBetween: (from, to) => this.daysBetween(from, to),
      });

      this.streakState = testingSync.streak;
      if (!this.firstRecordDate) {
        this.firstRecordDate = testingSync.inferredFirstRecordDate;
      }
      await this.persistStreak(testingSync.streak);
      return;
    }

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

    const updated = computeLiveStreakState({
      firstRecordDate: this.firstRecordDate,
      today,
      todayKey,
      currentLongest: currentUserStreak.longest,
      freezeUsed: currentUserStreak.freezeUsed,
      getDayStatus: (date) => this.getStreakDayStatus(date),
    });
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
          this.http.put(`${USERS_API_URL}/${user.id}`, {
            ...updatedUser,
            id: user.id,
          }),
        );
      } catch {
        // silent
      }
    }
  }

  private computeRollingBudgetToday(): void {
    const state = this.rollingBudgetService.computeRollingBudgetState(
      this.financialData,
      this.journal,
      this.getReferenceToday(),
    );
    this.rollingTotalBudget = state.rollingTotalBudget;
    this.rollingUsedBudget = state.rollingUsedBudget;
    this.rollingBudgetRemaining = state.rollingBudgetRemaining;
    this.rollingDaysRemaining = state.rollingDaysRemaining;
    this.rollingBudgetToday = state.rollingBudgetToday;
  }

  private getStreakDayStatus(date: Date): StreakDayStatus {
    const day = this.startOfDay(date);
    const today = this.getReferenceToday();
    if (day > today) {
      return 'future';
    }

    if (this.isTestingDateActive && this.streakTestMode === 'always-streak') {
      const simulatedStart =
        this.firstRecordDate ||
        this.parseDateKey(this.streakState.lastActiveDate);
      if (simulatedStart && day < simulatedStart) {
        return 'before-start';
      }
      return 'success';
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
    if (field !== 'danaInvestasi' && this.levelEvaluation.level >= 4)
      othersSum += this.savingsDanaInvestasiInput;
    return Math.max(0, total - othersSum);
  }

  private autoFillSavingsPercent(
    editedField: 'tabungan' | 'danaDarurat' | 'danaInvestasi',
  ): void {
    if (this.levelEvaluation.level < 4) {
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

    if (this.levelEvaluation.level >= 4) {
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
      this.levelEvaluation.level >= 4
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
        (this.levelEvaluation.level >= 4 || field !== 'danaInvestasi'),
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

  private computeEditableSavingsPoolTotal(): number {
    const currentBudget = this.getCurrentBudgetAllocation();
    const currentPoolBase = this.computeSavingsPoolBase(
      this.financialData?.pendapatan || 0,
      currentBudget,
    );
    const activePool = Math.max(
      0,
      this.financialData?.currentSisaSaldoPool ?? currentPoolBase,
    );
    const nextPoolBase = this.computeSavingsPoolBase(
      this.pendapatanInput,
      this.getPendingBudgetAllocation(),
    );

    return Math.max(0, activePool + (nextPoolBase - currentPoolBase));
  }

  private getPendingBudgetAllocation(): BudgetAllocation {
    return {
      mode: this.budgetMode,
      pengeluaran: this.budgetPengeluaran,
      wants: this.budgetWants,
      savings: this.budgetSavings,
    };
  }

  private getCurrentBudgetAllocation(): BudgetAllocation {
    const currentBudget = this.financialData?.budgetAllocation;
    if (currentBudget) {
      return currentBudget;
    }

    const pendapatan = this.financialData?.pendapatan || 0;
    if (pendapatan <= 0) {
      return this.getPendingBudgetAllocation();
    }

    const pengeluaran = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          ((this.financialData?.pengeluaranWajib || 0) / pendapatan) * 100,
        ),
      ),
    );

    return {
      mode: 2,
      pengeluaran,
      wants: 0,
      savings: Math.max(0, 100 - pengeluaran),
    };
  }

  private getBudgetExpensePercent(budget: BudgetAllocation): number {
    return budget.mode === 3
      ? budget.pengeluaran + budget.wants
      : budget.pengeluaran;
  }

  private computeSavingsPoolBase(
    pendapatan: number,
    budget: BudgetAllocation,
  ): number {
    return Math.max(
      0,
      Math.round((Math.max(0, pendapatan) * budget.savings) / 100),
    );
  }

  private toSafePercent(value: number): number {
    if (!Number.isFinite(value) || value <= 0) {
      return 0;
    }

    return Math.max(0, Math.min(100, Math.round(value)));
  }

  private refreshLevelEvaluation(): void {
    this.levelEvaluation = evaluateFinancialLevel(
      buildLevelSignals(this.financialData),
    );
  }

  private buildUpdatedInvestmentTracking(): InvestmentTracking | undefined {
    const existingTracking = this.financialData?.investmentTracking;
    const cycleAmounts = {
      ...(existingTracking?.cycleAmounts ?? {}),
    };
    const addedInvestment = Math.max(0, this.savingsDanaInvestasiInput);
    const currentCycleKey = this.resolveInvestmentCycleKey();

    if (addedInvestment > 0) {
      cycleAmounts[currentCycleKey] =
        Math.max(0, cycleAmounts[currentCycleKey] ?? 0) + addedInvestment;
    }

    if (!Object.keys(cycleAmounts).length) {
      return existingTracking;
    }

    return { cycleAmounts };
  }

  private resolveInvestmentCycleKey(): string {
    const existingCycleStart = this.financialData?.currentCycleStart;
    if (existingCycleStart) {
      return existingCycleStart;
    }

    const today = this.getReferenceToday();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(
      2,
      '0',
    )}-01`;
  }

  formatRupiah(amount: number): string {
    return formatRupiahUtil(amount);
  }

  formatNumber(value: number): string {
    if (!value) return '';
    return formatNumberUtil(value);
  }

  private toMonthInputValue(year: number, monthIndex: number): string {
    return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
  }

  private generatePercentage(): number {
    return Math.floor(Math.random() * 100) + 1;
  }

  private refreshDebtCardState(): void {
    const consumptiveActive = this.getActiveDebtsByCategory('konsumtif');
    const productiveActive = this.getActiveDebtsByCategory('produktif');
    const consumptiveTotal = this.sumDebtRemaining(consumptiveActive);
    const productiveTotal = this.sumDebtRemaining(productiveActive);

    if (consumptiveActive.length > 0) {
      const urgent = this.findMostUrgentDebt(consumptiveActive);
      this.debtCardState = {
        mode: 'consumptive',
        total: consumptiveTotal,
        activeCount: consumptiveActive.length,
        changePercent: this.computeDebtChangePercent(
          'consumptive',
          consumptiveTotal,
        ),
        changeDirection: this.computeDebtChangeDirection(
          'consumptive',
          consumptiveTotal,
        ),
        urgentLine: urgent
          ? `Paling mendesak: ${urgent.name} jatuh tempo ${this.formatDebtDueDate(
              urgent,
            )} (${this.formatRupiah(urgent.remainingAmount)}).`
          : 'Masih ada hutang konsumtif aktif yang perlu diprioritaskan.',
        payoffLabel: '',
      };
      this.persistCurrentDebtSnapshot(consumptiveTotal, productiveTotal);
      return;
    }

    if (productiveActive.length > 0) {
      this.debtCardState = {
        mode: 'productive',
        total: productiveTotal,
        activeCount: productiveActive.length,
        changePercent: this.computeDebtChangePercent(
          'productive',
          productiveTotal,
        ),
        changeDirection: this.computeDebtChangeDirection(
          'productive',
          productiveTotal,
        ),
        urgentLine: '',
        payoffLabel: this.buildProductivePayoffLabel(productiveActive),
      };
      this.persistCurrentDebtSnapshot(consumptiveTotal, productiveTotal);
      return;
    }

    this.debtCardState = {
      mode: 'clear',
      total: 0,
      activeCount: 0,
      changePercent: null,
      changeDirection: null,
      urgentLine: '',
      payoffLabel: '',
    };
    this.persistCurrentDebtSnapshot(consumptiveTotal, productiveTotal);
  }

  private normalizeDebts(rawDebts: unknown): DebtItemSnapshot[] {
    if (!Array.isArray(rawDebts)) {
      return [];
    }

    return rawDebts
      .map((item) => this.normalizeSingleDebt(item))
      .filter((item): item is DebtItemSnapshot => Boolean(item));
  }

  private normalizeSingleDebt(raw: unknown): DebtItemSnapshot | null {
    if (!raw || typeof raw !== 'object') {
      return null;
    }

    const value = raw as Partial<DebtItemSnapshot> & {
      dueDate?: unknown;
      status?: unknown;
    };

    const remainingAmount = this.toPositiveInt(value.remainingAmount);
    const monthlyInstallment = this.toPositiveInt(value.monthlyInstallment);
    const dueDay = this.normalizeDueDay(value.dueDay);

    return {
      id: (value.id || `${Date.now()}`) as string,
      name: String(value.name || 'Hutang').trim(),
      category: value.category === 'produktif' ? 'produktif' : 'konsumtif',
      remainingAmount,
      monthlyInstallment,
      dueDay,
      dueDate: typeof value.dueDate === 'string' ? value.dueDate : '',
      status: typeof value.status === 'string' ? value.status : '',
    };
  }

  private getActiveDebtsByCategory(category: DebtCategory): DebtItemSnapshot[] {
    return this.debts.filter(
      (item) => item.category === category && this.isDebtActive(item),
    );
  }

  private isDebtActive(item: DebtItemSnapshot): boolean {
    if (item.remainingAmount <= 0) {
      return false;
    }

    const normalizedStatus = item.status.trim().toLowerCase();
    return (
      normalizedStatus !== 'lunas' &&
      normalizedStatus !== 'paid' &&
      normalizedStatus !== 'settled'
    );
  }

  private sumDebtRemaining(items: DebtItemSnapshot[]): number {
    return items.reduce((sum, item) => sum + item.remainingAmount, 0);
  }

  private findMostUrgentDebt(
    debts: DebtItemSnapshot[],
  ): DebtItemSnapshot | null {
    if (!debts.length) {
      return null;
    }

    const today = this.getReferenceToday();
    const sorted = [...debts].sort((a, b) => {
      const aDue = this.resolveDebtDueDate(a, today).getTime();
      const bDue = this.resolveDebtDueDate(b, today).getTime();

      if (aDue !== bDue) {
        return aDue - bDue;
      }

      return b.remainingAmount - a.remainingAmount;
    });

    return sorted[0] ?? null;
  }

  private resolveDebtDueDate(item: DebtItemSnapshot, reference: Date): Date {
    if (item.dueDate) {
      const parsed = new Date(item.dueDate);
      if (!Number.isNaN(parsed.getTime())) {
        return this.startOfDay(parsed);
      }
    }

    const year = reference.getFullYear();
    const month = reference.getMonth();
    const dayThisMonth = this.resolveDayInMonth(year, month, item.dueDay);
    const dueThisMonth = this.startOfDay(new Date(year, month, dayThisMonth));

    if (dueThisMonth >= reference) {
      return dueThisMonth;
    }

    const nextMonth = new Date(year, month + 1, 1);
    const dayNextMonth = this.resolveDayInMonth(
      nextMonth.getFullYear(),
      nextMonth.getMonth(),
      item.dueDay,
    );
    return this.startOfDay(
      new Date(nextMonth.getFullYear(), nextMonth.getMonth(), dayNextMonth),
    );
  }

  private formatDebtDueDate(item: DebtItemSnapshot): string {
    const due = this.resolveDebtDueDate(item, this.getReferenceToday());
    return due.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
    });
  }

  private buildProductivePayoffLabel(debts: DebtItemSnapshot[]): string {
    const totalRemaining = this.sumDebtRemaining(debts);
    const totalInstallment = debts.reduce(
      (sum, item) => sum + Math.max(0, item.monthlyInstallment),
      0,
    );

    if (totalRemaining <= 0 || totalInstallment <= 0) {
      return '-';
    }

    const months = Math.ceil(totalRemaining / totalInstallment);
    const projected = new Date(this.getReferenceToday());
    projected.setMonth(projected.getMonth() + months);
    return `${months} bulan (~${projected.toLocaleDateString('id-ID', {
      month: 'long',
      year: 'numeric',
    })})`;
  }

  private computeDebtChangePercent(
    mode: 'consumptive' | 'productive',
    currentTotal: number,
  ): number | null {
    const previousTotal = this.getPreviousMonthRelevantDebtTotal(mode);
    if (previousTotal <= 0 || previousTotal === currentTotal) {
      return null;
    }

    const deltaPercent = Math.round(
      (Math.abs(currentTotal - previousTotal) / previousTotal) * 100,
    );
    return deltaPercent > 0 ? deltaPercent : null;
  }

  private computeDebtChangeDirection(
    mode: 'consumptive' | 'productive',
    currentTotal: number,
  ): DebtChangeDirection | null {
    const previousTotal = this.getPreviousMonthRelevantDebtTotal(mode);
    if (previousTotal <= 0 || previousTotal === currentTotal) {
      return null;
    }

    return currentTotal > previousTotal ? 'up' : 'down';
  }

  private getPreviousMonthRelevantDebtTotal(
    mode: 'consumptive' | 'productive',
  ): number {
    const snapshots = this.getDebtSnapshots();
    const previousMonth = new Date(this.getReferenceToday());
    previousMonth.setMonth(previousMonth.getMonth() - 1);
    const key = this.toYearMonthKey(previousMonth);
    const previous = snapshots[key];
    if (!previous) {
      return 0;
    }

    return mode === 'consumptive'
      ? previous.consumptiveActiveTotal
      : previous.productiveActiveTotal;
  }

  private persistCurrentDebtSnapshot(
    consumptiveTotal: number,
    productiveTotal: number,
  ): void {
    const snapshots = this.getDebtSnapshots();
    const currentKey = this.toYearMonthKey(this.getReferenceToday());
    snapshots[currentKey] = {
      consumptiveActiveTotal: Math.max(0, Math.round(consumptiveTotal)),
      productiveActiveTotal: Math.max(0, Math.round(productiveTotal)),
    };

    localStorage.setItem(
      this.debtSnapshotStorageKey,
      JSON.stringify(snapshots),
    );
  }

  private getDebtSnapshots(): Record<string, DebtMonthlySnapshot> {
    try {
      const parsed = JSON.parse(
        localStorage.getItem(this.debtSnapshotStorageKey) || '{}',
      );
      if (!parsed || typeof parsed !== 'object') {
        return {};
      }

      const entries = Object.entries(parsed as Record<string, unknown>);
      const snapshots: Record<string, DebtMonthlySnapshot> = {};
      for (const [key, value] of entries) {
        if (!value || typeof value !== 'object') {
          continue;
        }

        const raw = value as Partial<DebtMonthlySnapshot>;
        snapshots[key] = {
          consumptiveActiveTotal: this.toPositiveInt(
            raw.consumptiveActiveTotal,
          ),
          productiveActiveTotal: this.toPositiveInt(raw.productiveActiveTotal),
        };
      }

      return snapshots;
    } catch {
      return {};
    }
  }

  private toYearMonthKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
      2,
      '0',
    )}`;
  }

  private toPositiveInt(value: unknown): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 0;
    }

    return Math.round(parsed);
  }

  private normalizeDueDay(value: unknown): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return 1;
    }

    return Math.max(1, Math.min(31, Math.floor(parsed)));
  }

  private resolveDayInMonth(
    year: number,
    monthIndex: number,
    intendedDay: number,
  ): number {
    const lastDay = new Date(year, monthIndex + 1, 0).getDate();
    return Math.min(Math.max(1, intendedDay), lastDay);
  }

  private buildLegacyConsumptiveDebt(amount: number): DebtItemSnapshot {
    return {
      id: 'legacy-consumptive-debt',
      name: 'Hutang Konsumtif',
      category: 'konsumtif',
      remainingAmount: Math.max(0, Math.round(amount)),
      monthlyInstallment: Math.max(1, Math.round(amount * 0.1)),
      dueDay: this.normalizeDueDay(this.financialData?.tanggalPemasukan),
      dueDate: '',
      status: 'aktif',
    };
  }

  private async reloadForReferenceDate(): Promise<void> {
    this.syncReferenceDateControls();
    await this.initializeDashboard();
  }

  private syncReferenceDateControls(): void {
    const reference = this.getReferenceToday();
    this.testingDateInput = this.testingTimeService.toDateInputValue(reference);
    this.selectedYear = reference.getFullYear();
    this.selectedMonthIndex = reference.getMonth();
    this.selectedMonthValue = this.toMonthInputValue(
      this.selectedYear,
      this.selectedMonthIndex,
    );
    this.streakCalendarYear = reference.getFullYear();
    this.streakCalendarMonth = reference.getMonth();
  }

  private getReferenceToday(): Date {
    return this.startOfDay(this.testingTimeService.getReferenceDate());
  }

  private parseTestingDateInput(value: string): Date | null {
    if (!value) {
      return null;
    }

    const [yearRaw, monthRaw, dayRaw] = value.split('-');
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
}
