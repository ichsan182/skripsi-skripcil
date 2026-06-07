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

// Home-scoped models and helpers
import {
  DebtCardState,
  DebtChangeDirection,
  DebtItemSnapshot,
  DebtMonthlySnapshot,
  ExpenseRow,
} from './home.models';
import {
  buildLegacyConsumptiveDebt,
  computeDebtCardState,
  computeDebtSummaryFromRawDebts,
  getActiveDebtsByCategory,
  normalizeDueDay,
  normalizeDebts,
  sumDebtRemaining,
  toPositiveInt,
} from './home-debt.helpers';
import {
  computeSavingsPoolBase,
  getBudgetExpensePercent,
  getCycleBudgetByDate,
  normalizeBudgetAllocationForEditor,
  normalizeBudgetMode,
  resolveCycleRangeByDate,
  toSafePercent,
} from './home-budget.helpers';
import {
  daysBetween,
  parseDateKey,
  startOfDay,
  toDateKey,
  toMonthInputValue,
  toYearMonthKey,
} from './home-date.helpers';
import {
  buildMonthlyExpenseRows,
  getFirstRecordDate,
  getTotalEntryCountByDate,
  getTotalExpenseByDate,
  sumExpensesInRange,
} from './home-journal.helpers';

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
  protected readonly rollingBudgetService = inject(RollingBudgetService);
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
  /** Per-date cache for computeRollingBudgetForDate — cleared on every data mutation. */
  private readonly rollingBudgetCache = new Map<
    string,
    { hasBudget: boolean; dailyBudget: number }
  >();
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
  testingFeaturesEnabled = false;

  budgetMode: 2 | 3 = 2;
  budgetPengeluaran = 20;
  budgetWants = 0;
  budgetSavings = 80;
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
  selectedMonthValue = toMonthInputValue(this.selectedYear, this.selectedMonthIndex);
  monthlyExpenses: ExpenseRow[] = [];

  readonly dayHeaders = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  streakStartDate: Date = new Date(2026, 2, 1);
  streakCalendarYear: number = new Date().getFullYear();
  streakCalendarMonth: number = new Date().getMonth();
  streakCalendarDays: StreakDay[] = [];
  firstRecordDate: Date | null = null;

  constructor() {
    this.loadUserData();
    this.syncReferenceDateControls();
    void this.initializeDashboard();
  }

  get isTestingDateActive(): boolean {
    return false;
  }

  async applyTestingDate(): Promise<void> {
    return;
  }

  async resetTestingDate(): Promise<void> {
    return;
  }

  setStreakTestMode(mode: StreakTestMode): void {
    this.streakTestMode = mode;
  }

  saveCheckpoint(): void {
    return;
  }

  async restoreCheckpoint(): Promise<void> {
    return;
  }

  private loadUserData(): void {
    try {
      const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
      this.userId = user.id ?? null;
      if (user.name) this.userName = user.name;
      if (user.email) this.userEmail = user.email;
      if (user.profileImage) this.userProfileImage = user.profileImage;
      this.debts = normalizeDebts(user.debts);
      const computedDebtSummary = computeDebtSummaryFromRawDebts(user.debts);
      if (user.financialData) {
        this.financialData = {
          ...user.financialData,
          debtSummary:
            computedDebtSummary ??
            user.financialData.debtSummary ??
            user.debtSummary,
        };
        this.pendapatanInput = user.financialData.pendapatan || 0;
        if (user.financialData.budgetAllocation) {
          const ba = normalizeBudgetAllocationForEditor(
            user.financialData.budgetAllocation,
            user.financialData,
          );
          this.budgetMode = normalizeBudgetMode(ba.mode);
          this.budgetPengeluaran = ba.pengeluaran;
          this.budgetWants = ba.wants;
          this.budgetSavings = ba.savings;
        }
        // savings inputs always start at 0 (sisa saldo system)
      }

      if (!this.debts.length && (this.financialData?.hutangWajib ?? 0) > 0) {
        this.debts = [
          buildLegacyConsumptiveDebt(
            this.financialData?.hutangWajib ?? 0,
            normalizeDueDay(this.financialData?.tanggalPemasukan),
          ),
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
      this.financialData.pendapatan - this.financialData.pengeluaranWajib;
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
    if (this.debtCardState.mode === 'consumptive') return 'Hutang Konsumtif';
    if (this.debtCardState.mode === 'productive') return 'Hutang Produktif';
    return 'Status Hutang';
  }

  get debtCardPrimaryValue(): string {
    if (this.debtCardState.mode === 'clear') return 'Bebas Hutang';
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
    if (this.debtCardState.mode === 'consumptive') return this.debtCardState.urgentLine;
    if (this.debtCardState.mode === 'productive') {
      return 'Hutang produktif berjalan sesuai rencana jangka panjang.';
    }
    return 'Semua hutang sudah lunas. Pertahankan kondisi sehat ini.';
  }

  get debtCardToneClass(): string {
    if (this.debtCardState.mode === 'consumptive') return 'debt-tone-alert';
    if (this.debtCardState.mode === 'productive') return 'debt-tone-progress';
    return 'debt-tone-clear';
  }

  get showDebtChange(): boolean {
    return this.debtCardState.changePercent !== null;
  }

  get debtChangePercentLabel(): string {
    if (this.debtCardState.changePercent === null) return '';
    return `${this.debtCardState.changePercent}%`;
  }

  get debtChangeDirection(): DebtChangeDirection | null {
    return this.debtCardState.changeDirection;
  }

  get debtChangeClass(): string {
    if (this.debtCardState.changeDirection === 'up') return 'debt-change-up';
    if (this.debtCardState.changeDirection === 'down') return 'debt-change-down';
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
    if (this.pendapatanInput <= 0 || this.savingsDanaInvestasiInput <= 0) return '0';
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
    if (this.pendapatanInput <= 0) return 0;
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
      const ba = this.getCurrentBudgetAllocation();
      this.budgetMode = normalizeBudgetMode(ba.mode);
      this.budgetPengeluaran = ba.pengeluaran;
      this.budgetWants = ba.wants;
      this.budgetSavings = ba.savings;
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
      const todayKey = toDateKey(today);
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
      this.rollingBudgetCache.clear();
      if (result.financialData) {
        this.financialData = {
          ...result.financialData,
          debtSummary:
            result.financialData.debtSummary ?? this.financialData?.debtSummary,
        };
        this.syncFinancialDataToLocalStorage();
        this.refreshLevelEvaluation();
        await this.rollingBudgetService.refresh();
      }

      // skipFinancialUpdate=true because result already carries fresh financialData.
      await this.loadMonthlyExpenseTotal(!!result.financialData);
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
      const todayKey = toDateKey(today);
      const result = await this.journalService.addTemporaryIncome(
        todayKey,
        payload,
      );
      this.journal = result.journal;
      this.rollingBudgetCache.clear();
      if (result.financialData) {
        this.financialData = {
          ...result.financialData,
          debtSummary:
            result.financialData.debtSummary ?? this.financialData?.debtSummary,
        };
        this.syncFinancialDataToLocalStorage();
        this.refreshLevelEvaluation();
        await this.rollingBudgetService.refresh();
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
    const totalPengeluaranPct = getBudgetExpensePercent(budgetAllocation);
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
    const prevAlreadyAllocated = Math.max(
      0,
      this.financialData?.currentCycleSavingsAllocated ?? 0,
    );
    const newlyAllocated =
      this.savingsTabunganInput +
      this.savingsDanaDaruratInput +
      (this.levelEvaluation.level >= 4 ? this.savingsDanaInvestasiInput : 0);
    const currentCycleSavingsAllocated = prevAlreadyAllocated + newlyAllocated;

    // Hitung "extra" income yang masuk lewat transaksi (di luar formula % normal).
    // Ini perlu dipreserve supaya tidak hilang saat user ubah persentase budget.
    const existingPool = Math.max(0, this.financialData?.currentSisaSaldoPool ?? 0);
    const oldFormulaBase = computeSavingsPoolBase(
      this.financialData?.pendapatan ?? pendapatan,
      this.getCurrentBudgetAllocation(),
    );
    const poolExtra = existingPool - Math.max(0, oldFormulaBase - prevAlreadyAllocated);

    // Pool baru = formula base baru - total yang sudah dialokasikan + extra transaksi.
    const newFormulaBase = computeSavingsPoolBase(pendapatan, budgetAllocation);
    const newSisaSaldoPool = Math.max(
      0,
      newFormulaBase - currentCycleSavingsAllocated + poolExtra,
    );
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
      currentSisaSaldoPool: newSisaSaldoPool,
      currentCycleSavingsAllocated,
    };
    this.financialData = updatedFinancialData;
    this.refreshLevelEvaluation();
    await this.journalService.saveCurrentUserFinancialData(
      updatedFinancialData,
    );
    this.showSettingPersenan = false;
  }

  changeMonth(step: number): void {
    const totalMonths = this.selectedYear * 12 + this.selectedMonthIndex + step;
    this.selectedYear = Math.floor(totalMonths / 12);
    this.selectedMonthIndex = ((totalMonths % 12) + 12) % 12;
    this.selectedMonthValue = toMonthInputValue(
      this.selectedYear,
      this.selectedMonthIndex,
    );
    this.refreshMonthlyExpenses();
  }

  onPickMonth(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.value) return;

    const [yearRaw, monthRaw] = input.value.split('-');
    const year = Number(yearRaw);
    const month = Number(monthRaw) - 1;

    if (Number.isNaN(year) || Number.isNaN(month) || month < 0 || month > 11) {
      return;
    }

    this.selectedYear = year;
    this.selectedMonthIndex = month;
    this.selectedMonthValue = toMonthInputValue(year, month);
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
    this.monthlyExpenses = buildMonthlyExpenseRows(
      this.journal,
      this.selectedYear,
      this.selectedMonthIndex,
      this.monthNames,
    );
  }

  private async loadMonthlyExpenseTotal(
    skipFinancialUpdate = false,
  ): Promise<void> {
    try {
      const summary = await this.journalService.getCurrentCycleSummary(
        this.getReferenceToday(),
      );
      this.monthlyExpenseTotal = summary.monthlyExpenseTotal;
      if (!skipFinancialUpdate && summary.financialData) {
        this.financialData = {
          ...summary.financialData,
          debtSummary:
            summary.financialData.debtSummary ??
            this.financialData?.debtSummary,
        };
        // Server is source of truth — write back to localStorage so the next
        // page load starts from fresh data instead of stale cache.
        this.syncFinancialDataToLocalStorage();
        this.refreshLevelEvaluation();
      }
    } catch {
      // keep default 0
    }
  }

  private async initializeDashboard(): Promise<void> {
    this.rollingBudgetCache.clear();
    await this.loadMonthlyExpenseTotal();
    this.journal = await this.journalService.loadCurrentUserJournal(
      this.getReferenceToday(),
    );
    await this.rollingBudgetService.refresh();
    this.firstRecordDate = getFirstRecordDate(this.journal);
    this.syncDailyStreakState();
    this.refreshMonthlyExpenses();
    this.refreshStreakCalendar();
  }

  private syncDailyStreakState(): void {
    const today = this.getReferenceToday();
    const todayKey = toDateKey(today);
    const currentUserStreak = normalizeUserStreak(
      JSON.parse(localStorage.getItem('currentUser') || '{}').streak,
    );

    if (this.isTestingDateActive && this.streakTestMode === 'always-streak') {
      const testingSync = computeTestingModeStreakState({
        currentStreak: currentUserStreak,
        today,
        todayKey,
        parseDateKey: (dateKey) => parseDateKey(dateKey),
        daysBetween: (from, to) => daysBetween(from, to),
      });

      this.streakState = testingSync.streak;
      if (!this.firstRecordDate) {
        this.firstRecordDate = testingSync.inferredFirstRecordDate;
      }
      this.persistStreak(testingSync.streak);
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
      this.persistStreak(emptyStreak);
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
    this.persistStreak(updated);
  }

  private persistStreak(streak: UserStreak): void {
    // Synchronous: update local cache immediately so subsequent reads are consistent.
    const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
    localStorage.setItem('currentUser', JSON.stringify({ ...user, streak }));
    // Async: server sync is non-blocking — UI does not wait for this.
    if (user.id) {
      void (async () => {
        try {
          const serverUser = await firstValueFrom(
            this.http.get<Record<string, unknown>>(
              `${USERS_API_URL}/${user.id}`,
            ),
          );
          await firstValueFrom(
            this.http.put(`${USERS_API_URL}/${user.id}`, {
              ...serverUser,
              streak,
              id: user.id,
            }),
          );
        } catch {
          // silent
        }
      })();
    }
  }

  private getStreakDayStatus(date: Date): StreakDayStatus {
    const day = startOfDay(date);
    const today = this.getReferenceToday();
    if (day > today) return 'future';

    if (this.isTestingDateActive && this.streakTestMode === 'always-streak') {
      const simulatedStart =
        this.firstRecordDate ||
        parseDateKey(this.streakState.lastActiveDate);
      if (simulatedStart && day < simulatedStart) return 'before-start';
      return 'success';
    }

    if (!this.firstRecordDate || day < this.firstRecordDate) return 'before-start';

    const hasEntry = getTotalEntryCountByDate(this.journal, day) > 0;
    if (!hasEntry && this.noExpensePolicy === 'require-entry') return 'skipped';

    const rolling = this.computeRollingBudgetForDate(day);
    if (!rolling.hasBudget) return hasEntry ? 'success' : 'skipped';

    const spentToday = getTotalExpenseByDate(this.journal, day);
    return spentToday <= rolling.dailyBudget ? 'success' : 'failed';
  }

  private computeRollingBudgetForDate(date: Date): {
    hasBudget: boolean;
    dailyBudget: number;
  } {
    const cacheKey = toDateKey(date);
    const cached = this.rollingBudgetCache.get(cacheKey);
    if (cached) return cached;

    if (!this.financialData) {
      const miss = { hasBudget: false, dailyBudget: 0 };
      this.rollingBudgetCache.set(cacheKey, miss);
      return miss;
    }

    const cycle = resolveCycleRangeByDate(date, this.financialData);
    const totalBudget = getCycleBudgetByDate(date, this.financialData);
    if (totalBudget <= 0) {
      const miss = { hasBudget: false, dailyBudget: 0 };
      this.rollingBudgetCache.set(cacheKey, miss);
      return miss;
    }

    const dayBefore = new Date(date);
    dayBefore.setDate(dayBefore.getDate() - 1);
    const usedBefore = sumExpensesInRange(this.journal, cycle.start, dayBefore);
    const remainingBudget = Math.max(0, totalBudget - usedBefore);
    const remainingDays = Math.max(1, daysBetween(date, cycle.end) + 1);
    const result = {
      hasBudget: true,
      dailyBudget: Math.floor(remainingBudget / remainingDays),
    };
    this.rollingBudgetCache.set(cacheKey, result);
    return result;
  }

  private setBudgetField(
    field: 'pengeluaran' | 'wants' | 'savings',
    value: number,
  ): void {
    if (field === 'pengeluaran') this.budgetPengeluaran = value;
    else if (field === 'wants') this.budgetWants = value;
    else this.budgetSavings = value;
  }

  private getBudgetFieldVal(
    field: 'pengeluaran' | 'wants' | 'savings',
  ): number {
    if (field === 'pengeluaran') return this.budgetPengeluaran;
    if (field === 'wants') return this.budgetWants;
    return this.budgetSavings;
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
    // 3-field mode: absorb remainder into the field that wasn't just edited.
    // Priority: adjust the last field in order that isn't the edited one.
    const priority: ('pengeluaran' | 'wants' | 'savings')[] = [
      'savings',
      'wants',
      'pengeluaran',
    ];
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
      this.setBudgetField(absorber, 0);
      this.setBudgetField(
        thirdField,
        Math.max(0, 100 - this.getBudgetFieldVal(editedField)),
      );
    }
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
    if (!thirdField) return;

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

    this.savingsTabunganPercent = toSafePercent(
      (this.savingsTabunganInput / total) * 100,
    );
    this.savingsDanaDaruratPercent = toSafePercent(
      (this.savingsDanaDaruratInput / total) * 100,
    );

    if (this.levelEvaluation.level >= 4) {
      this.savingsDanaInvestasiPercent = toSafePercent(
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
    if (overflow <= 0) return;

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
      if (remainder <= 0) break;
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
    else if (field === 'danaDarurat') this.savingsDanaDaruratPercent = normalized;
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
    return Math.max(0, this.financialData?.currentSisaSaldoPool ?? 0);
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
      return normalizeBudgetAllocationForEditor(
        currentBudget,
        this.financialData,
      );
    }

    const pendapatan = this.financialData?.pendapatan || 0;
    if (pendapatan <= 0) return this.getPendingBudgetAllocation();

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

  private refreshLevelEvaluation(): void {
    const consumptiveTotal = this.debts
      .filter((d) => d.category === 'konsumtif')
      .reduce((sum, d) => sum + d.remainingAmount, 0);

    const financialDataForLevel =
      consumptiveTotal > 0 && this.financialData
        ? {
            ...this.financialData,
            debtSummary: {
              totalPrincipalAmount: Math.max(
                consumptiveTotal,
                this.financialData.debtSummary?.totalPrincipalAmount ?? 0,
              ),
              totalRemainingAmount: consumptiveTotal,
            },
          }
        : this.financialData;

    this.levelEvaluation = evaluateFinancialLevel(
      buildLevelSignals(financialDataForLevel),
    );
  }

  private buildUpdatedInvestmentTracking(): InvestmentTracking | undefined {
    const existingTracking = this.financialData?.investmentTracking;
    const cycleAmounts = { ...(existingTracking?.cycleAmounts ?? {}) };
    const addedInvestment = Math.max(0, this.savingsDanaInvestasiInput);
    const currentCycleKey = this.resolveInvestmentCycleKey();

    if (addedInvestment > 0) {
      cycleAmounts[currentCycleKey] =
        Math.max(0, cycleAmounts[currentCycleKey] ?? 0) + addedInvestment;
    }

    if (!Object.keys(cycleAmounts).length) return existingTracking;
    return { cycleAmounts };
  }

  private resolveInvestmentCycleKey(): string {
    const existingCycleStart = this.financialData?.currentCycleStart;
    if (existingCycleStart) return existingCycleStart;

    const today = this.getReferenceToday();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
  }

  formatRupiah(amount: number): string {
    return formatRupiahUtil(amount);
  }

  formatNumber(value: number): string {
    if (!value) return '';
    return formatNumberUtil(value);
  }

  private generatePercentage(): number {
    return Math.floor(Math.random() * 100) + 1;
  }

  private refreshDebtCardState(): void {
    const today = this.getReferenceToday();
    const snapshots = this.getDebtSnapshots();
    const previousMonth = new Date(today);
    previousMonth.setMonth(previousMonth.getMonth() - 1);
    const previousSnapshot = snapshots[toYearMonthKey(previousMonth)] ?? null;

    this.debtCardState = computeDebtCardState(
      this.debts,
      previousSnapshot,
      today,
    );

    const consumptiveActive = getActiveDebtsByCategory(this.debts, 'konsumtif');
    const productiveActive = getActiveDebtsByCategory(this.debts, 'produktif');
    this.persistCurrentDebtSnapshot(
      sumDebtRemaining(consumptiveActive),
      sumDebtRemaining(productiveActive),
    );
  }

  private persistCurrentDebtSnapshot(
    consumptiveTotal: number,
    productiveTotal: number,
  ): void {
    const snapshots = this.getDebtSnapshots();
    const currentKey = toYearMonthKey(this.getReferenceToday());
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
      if (!parsed || typeof parsed !== 'object') return {};

      const entries = Object.entries(parsed as Record<string, unknown>);
      const snapshots: Record<string, DebtMonthlySnapshot> = {};
      for (const [key, value] of entries) {
        if (!value || typeof value !== 'object') continue;
        const raw = value as Partial<DebtMonthlySnapshot>;
        snapshots[key] = {
          consumptiveActiveTotal: toPositiveInt(raw.consumptiveActiveTotal),
          productiveActiveTotal: toPositiveInt(raw.productiveActiveTotal),
        };
      }

      return snapshots;
    } catch {
      return {};
    }
  }

  private async reloadForReferenceDate(): Promise<void> {
    this.syncReferenceDateControls();
    await this.initializeDashboard();
  }

  private syncReferenceDateControls(): void {
    const reference = this.getReferenceToday();
    this.testingDateInput = toDateKey(reference);
    this.streakTestMode = 'realistic';
    this.checkpointExists = false;
    this.selectedYear = reference.getFullYear();
    this.selectedMonthIndex = reference.getMonth();
    this.selectedMonthValue = toMonthInputValue(
      this.selectedYear,
      this.selectedMonthIndex,
    );
    this.streakCalendarYear = reference.getFullYear();
    this.streakCalendarMonth = reference.getMonth();
  }

  private getReferenceToday(): Date {
    return startOfDay(new Date());
  }

  /** Write current financialData back into the localStorage user cache so the
   *  next cold start reads fresh server-authoritative data, not stale snapshot. */
  private syncFinancialDataToLocalStorage(): void {
    if (!this.financialData) return;
    try {
      const cached = JSON.parse(localStorage.getItem('currentUser') || '{}');
      localStorage.setItem(
        'currentUser',
        JSON.stringify({ ...cached, financialData: this.financialData }),
      );
    } catch {
      // localStorage quota exceeded or unavailable — ignore
    }
  }

  private parseTestingDateInput(value: string): Date | null {
    if (!value) return null;
    return parseDateKey(value);
  }
}
