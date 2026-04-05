import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { USERS_API_URL } from '../../../core/config/app-api.config';
import { FinancialData } from '../../../core/services/journal.service';
import {
  buildLevelSignals,
  evaluateFinancialLevel,
} from '../../../core/utils/level';
import {
  CurrencyAmountLimitTier,
  parseCurrencyInput as parseCurrencyInputValue,
  resolveCurrencyAmountLimit,
} from '../../../core/utils/format.utils';
import { InputField } from '../../../shared/components/input-field/input-field';
import { Sidebar } from '../../../shared/components/sidebar/sidebar';

type DebtCategory = 'konsumtif' | 'produktif';

type DebtType =
  | 'Paylater'
  | 'Pinjol'
  | 'Kartu Kredit'
  | 'Cicilan Barang'
  | 'KPR'
  | 'Modal Usaha'
  | 'Hutang Personal'
  | 'Lainnya';

interface DebtItem {
  id: string;
  name: string;
  category: DebtCategory;
  debtType: DebtType;
  principalAmount: number;
  remainingAmount: number;
  monthlyInstallment: number;
  dueDay: number;
  notes: string;
}

interface DebtFormModel {
  name: string;
  category: DebtCategory;
  debtType: DebtType;
  principalAmount: string;
  remainingAmount: string;
  monthlyInstallment: string;
  dueDay: number;
  notes: string;
}

interface StoredUser {
  id?: string | number;
  level?: number;
  financialData?: FinancialData;
  debts?: DebtItem[];
}

@Component({
  selector: 'app-debt',
  standalone: true,
  imports: [CommonModule, FormsModule, Sidebar, InputField],
  templateUrl: './debt.html',
  styleUrl: './debt.css',
})
export class Debt {
  private readonly http = inject(HttpClient);
  private readonly kprPromptFlagKey = 'debtKprPromptSeen';
  protected readonly currencyMaxTier = CurrencyAmountLimitTier.HUNDRED_BILLION;

  protected readonly debtTypeOptions: DebtType[] = [
    'Paylater',
    'Pinjol',
    'Kartu Kredit',
    'Cicilan Barang',
    'KPR',
    'Modal Usaha',
    'Hutang Personal',
    'Lainnya',
  ];

  protected debts: DebtItem[] = [];
  protected financialData: FinancialData | null = null;
  protected isSaving = false;
  protected formError = '';
  protected showLargeDebtPrompt = false;
  protected editingDebtId: string | null = null;
  protected paymentInputs: Record<string, string> = {};

  protected form: DebtFormModel = {
    name: '',
    category: 'konsumtif',
    debtType: 'Paylater',
    principalAmount: '',
    remainingAmount: '',
    monthlyInstallment: '',
    dueDay: 1,
    notes: '',
  };

  constructor() {
    this.loadDebtPageState();
  }

  protected get monthlyIncome(): number {
    return Math.max(0, this.financialData?.pendapatan ?? 0);
  }

  protected get totalConsumptiveDebt(): number {
    return this.debts
      .filter((item) => item.category === 'konsumtif')
      .reduce((sum, item) => sum + item.remainingAmount, 0);
  }

  protected get sisaHutangWajib(): number {
    return this.totalConsumptiveDebt;
  }

  protected get totalProductiveDebt(): number {
    return this.debts
      .filter((item) => item.category === 'produktif')
      .reduce((sum, item) => sum + item.remainingAmount, 0);
  }

  protected get totalDebt(): number {
    return this.totalConsumptiveDebt + this.totalProductiveDebt;
  }

  protected get totalMonthlyInstallment(): number {
    return this.debts.reduce((sum, item) => sum + item.monthlyInstallment, 0);
  }

  protected get dtiRatio(): number {
    if (this.monthlyIncome <= 0) {
      return 0;
    }

    return (this.totalMonthlyInstallment / this.monthlyIncome) * 100;
  }

  protected get dtiStatus(): string {
    if (this.monthlyIncome <= 0) {
      return 'Isi pendapatan bulanan dulu agar DTI akurat.';
    }

    if (this.dtiRatio < 30) {
      return 'Aman';
    }

    if (this.dtiRatio <= 50) {
      return 'Perlu Hati-Hati';
    }

    return 'Berbahaya';
  }

  protected get dtiBarWidth(): number {
    return Math.min(100, this.dtiRatio);
  }

  protected get dtiClass(): 'safe' | 'warning' | 'danger' {
    if (this.monthlyIncome <= 0 || this.dtiRatio < 30) {
      return 'safe';
    }

    if (this.dtiRatio <= 50) {
      return 'warning';
    }

    return 'danger';
  }

  protected get estimatedPayoffMonths(): number {
    const months = this.debts
      .map((item) => this.estimateDebtMonths(item))
      .filter((value) => value > 0);

    if (!months.length) {
      return 0;
    }

    return Math.max(...months);
  }

  protected get estimatedPayoffLabel(): string {
    if (this.estimatedPayoffMonths <= 0) {
      return '-';
    }

    return this.buildPayoffDateLabel(this.estimatedPayoffMonths);
  }

  protected get formEstimatedMonths(): number {
    const remaining = this.parseCurrencyInput(this.form.remainingAmount);
    const installment = this.parseCurrencyInput(this.form.monthlyInstallment);
    if (remaining <= 0 || installment <= 0) {
      return 0;
    }

    return Math.ceil(remaining / installment);
  }

  protected get formEstimatedLabel(): string {
    if (this.formEstimatedMonths <= 0) {
      return '-';
    }

    return this.buildPayoffDateLabel(this.formEstimatedMonths);
  }

  protected get consumptiveDebtRatioToIncome(): number {
    if (this.monthlyIncome <= 0) {
      return 0;
    }

    return (this.totalConsumptiveDebt / this.monthlyIncome) * 100;
  }

  protected get showConsumptiveWarning(): boolean {
    const level = evaluateFinancialLevel(
      buildLevelSignals(this.financialData),
    ).level;
    return level >= 4 && this.consumptiveDebtRatioToIncome > 10;
  }

  protected get levelRelationLabel(): string {
    const level = evaluateFinancialLevel(
      buildLevelSignals(this.financialData),
    ).level;

    if (level <= 3) {
      return 'Level 1-3: Hutang konsumtif menghambat kenaikan level.';
    }

    if (level <= 5) {
      return 'Level 4-5: Hutang konsumtif memicu peringatan dan evaluasi cash flow.';
    }

    return 'Level 6-7: Hutang produktif jadi fokus utama pelunasan.';
  }

  protected onCurrencyInput(
    field: 'principalAmount' | 'remainingAmount' | 'monthlyInstallment',
    value: string,
  ): void {
    this.form[field] = value;
  }

  protected onNameInput(value: string): void {
    this.form.name = value;
  }

  protected onDueDayInput(value: number): void {
    this.form.dueDay = value;
  }

  protected async saveDebt(): Promise<void> {
    this.formError = '';

    const parsed = this.validateAndBuildDebtFromForm();
    if (!parsed) {
      return;
    }

    if (this.editingDebtId) {
      this.debts = this.debts.map((item) =>
        item.id === this.editingDebtId ? { ...parsed, id: item.id } : item,
      );
    } else {
      this.debts = [{ ...parsed, id: this.generateDebtId() }, ...this.debts];
    }

    await this.persistDebts();
    this.resetForm();
  }

  protected editDebt(item: DebtItem): void {
    this.editingDebtId = item.id;
    this.form = {
      name: item.name,
      category: item.category,
      debtType: item.debtType,
      principalAmount: this.formatNumber(item.principalAmount),
      remainingAmount: this.formatNumber(item.remainingAmount),
      monthlyInstallment: this.formatNumber(item.monthlyInstallment),
      dueDay: item.dueDay,
      notes: item.notes,
    };
  }

  protected async deleteDebt(id: string): Promise<void> {
    this.debts = this.debts.filter((item) => item.id !== id);
    delete this.paymentInputs[id];
    if (this.editingDebtId === id) {
      this.resetForm();
    }

    await this.persistDebts();
  }

  protected cancelEdit(): void {
    this.resetForm();
  }

  protected onPaymentInput(id: string, value: string): void {
    this.paymentInputs[id] = value;
  }

  protected async payDebt(item: DebtItem): Promise<void> {
    this.formError = '';
    const raw = this.paymentInputs[item.id] ?? '';
    const paymentAmount = this.parseCurrencyInput(raw);

    if (paymentAmount <= 0) {
      this.formError = 'Nominal pembayaran hutang harus lebih besar dari 0.';
      return;
    }

    if (paymentAmount > item.remainingAmount) {
      this.formError = 'Nominal pembayaran melebihi sisa hutang.';
      return;
    }

    this.debts = this.debts
      .map((debt) =>
        debt.id === item.id
          ? {
              ...debt,
              remainingAmount: Math.max(
                0,
                debt.remainingAmount - paymentAmount,
              ),
            }
          : debt,
      )
      .filter((debt) => debt.remainingAmount > 0);

    this.paymentInputs[item.id] = '';
    await this.persistDebts();
  }

  protected dismissLargeDebtPrompt(): void {
    localStorage.setItem(this.kprPromptFlagKey, '1');
    this.showLargeDebtPrompt = false;
  }

  protected formatRupiah(value: number): string {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.max(0, value));
  }

  protected formatPercent(value: number): string {
    const normalized = Number.isFinite(value) ? value : 0;
    return `${normalized.toFixed(1)}%`;
  }

  protected estimateDebtMonths(item: DebtItem): number {
    if (item.remainingAmount <= 0 || item.monthlyInstallment <= 0) {
      return 0;
    }

    return Math.ceil(item.remainingAmount / item.monthlyInstallment);
  }

  protected estimateDebtLabel(item: DebtItem): string {
    const months = this.estimateDebtMonths(item);
    if (months <= 0) {
      return '-';
    }

    return this.buildPayoffDateLabel(months);
  }

  private loadDebtPageState(): void {
    const user = this.getCurrentUser();
    this.financialData = user.financialData ?? null;
    this.debts = Array.isArray(user.debts)
      ? user.debts
          .map((item) => this.normalizeDebt(item))
          .filter((item): item is DebtItem => Boolean(item))
      : [];

    if (!this.debts.length && (this.financialData?.hutangWajib ?? 0) > 0) {
      const legacyDebt = this.buildLegacyConsumptiveDebt(
        this.financialData?.hutangWajib ?? 0,
      );
      if (legacyDebt) {
        this.debts = [legacyDebt];
      }
    }

    const level = evaluateFinancialLevel(
      buildLevelSignals(this.financialData),
    ).level;
    const hasSeenPrompt = localStorage.getItem(this.kprPromptFlagKey) === '1';
    this.showLargeDebtPrompt = (level === 5 || level === 6) && !hasSeenPrompt;
  }

  private normalizeDebt(value: unknown): DebtItem | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const raw = value as Partial<DebtItem>;
    const remaining = this.toPositiveNumber(raw.remainingAmount);
    const installment = this.toPositiveNumber(raw.monthlyInstallment);

    return {
      id: raw.id || this.generateDebtId(),
      name: (raw.name || '').trim(),
      category: raw.category === 'produktif' ? 'produktif' : 'konsumtif',
      debtType: this.normalizeDebtType(raw.debtType),
      principalAmount: this.toPositiveNumber(raw.principalAmount),
      remainingAmount: remaining,
      monthlyInstallment: installment,
      dueDay: this.normalizeDueDay(raw.dueDay),
      notes: (raw.notes || '').trim(),
    };
  }

  private normalizeDebtType(value: unknown): DebtType {
    const match = this.debtTypeOptions.find((type) => type === value);
    return match ?? 'Lainnya';
  }

  private normalizeDueDay(value: unknown): number {
    const day = Number(value);
    if (!Number.isFinite(day)) {
      return 1;
    }

    return Math.max(1, Math.min(31, Math.floor(day)));
  }

  private validateAndBuildDebtFromForm(): Omit<DebtItem, 'id'> | null {
    const name = this.form.name.trim();
    const principalAmount = this.parseCurrencyInput(this.form.principalAmount);
    const remainingAmount = this.parseCurrencyInput(this.form.remainingAmount);
    const monthlyInstallment = this.parseCurrencyInput(
      this.form.monthlyInstallment,
    );
    const dueDay = this.normalizeDueDay(this.form.dueDay);

    if (!name) {
      this.formError = 'Nama hutang wajib diisi.';
      return null;
    }

    if (
      principalAmount <= 0 ||
      remainingAmount <= 0 ||
      monthlyInstallment <= 0
    ) {
      this.formError = 'Nominal hutang dan cicilan harus lebih besar dari 0.';
      return null;
    }

    if (remainingAmount > principalAmount) {
      this.formError =
        'Sisa hutang tidak boleh lebih besar dari total hutang awal.';
      return null;
    }

    return {
      name,
      category: this.form.category,
      debtType: this.form.debtType,
      principalAmount,
      remainingAmount,
      monthlyInstallment,
      dueDay,
      notes: this.form.notes.trim(),
    };
  }

  private async persistDebts(): Promise<void> {
    const user = this.getCurrentUser();
    const nextFinancialData: FinancialData = {
      ...(this.financialData ?? {
        pendapatan: 0,
        pengeluaranWajib: 0,
        tanggalPemasukan: 1,
        hutangWajib: 0,
        estimasiTabungan: 0,
        danaDarurat: 0,
      }),
      hutangWajib: this.totalConsumptiveDebt,
    };

    this.financialData = nextFinancialData;
    const levelEvaluation = evaluateFinancialLevel(
      buildLevelSignals(nextFinancialData),
    );

    const updatedUser: StoredUser = {
      ...user,
      level: levelEvaluation.level,
      financialData: nextFinancialData,
      debts: this.debts,
    };

    localStorage.setItem('currentUser', JSON.stringify(updatedUser));
    sessionStorage.setItem('currentUser', JSON.stringify(updatedUser));

    if (!updatedUser.id) {
      return;
    }

    this.isSaving = true;
    try {
      await firstValueFrom(
        this.http.patch(`${USERS_API_URL}/${updatedUser.id}`, {
          level: updatedUser.level,
          financialData: nextFinancialData,
          debts: this.debts,
        }),
      );
    } catch {
      this.formError = 'Data tersimpan lokal, tapi sinkronisasi server gagal.';
    } finally {
      this.isSaving = false;
    }
  }

  private getCurrentUser(): StoredUser {
    try {
      return JSON.parse(localStorage.getItem('currentUser') || '{}');
    } catch {
      return {};
    }
  }

  private resetForm(): void {
    this.editingDebtId = null;
    this.formError = '';
    this.form = {
      name: '',
      category: 'konsumtif',
      debtType: 'Paylater',
      principalAmount: '',
      remainingAmount: '',
      monthlyInstallment: '',
      dueDay: 1,
      notes: '',
    };
  }

  private parseCurrencyInput(value: string): number {
    return parseCurrencyInputValue(
      value,
      resolveCurrencyAmountLimit(this.currencyMaxTier),
    );
  }

  private toPositiveNumber(value: unknown): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 0;
    }

    return Math.round(parsed);
  }

  private formatNumber(value: number): string {
    return new Intl.NumberFormat('id-ID').format(Math.max(0, value));
  }

  private generateDebtId(): string {
    return `debt-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  }

  private buildLegacyConsumptiveDebt(remainingAmount: number): DebtItem | null {
    const normalized = Math.max(0, Math.round(remainingAmount));
    if (normalized <= 0) {
      return null;
    }

    const monthlyInstallment = Math.max(1, Math.round(normalized * 0.1));

    return {
      id: this.generateDebtId(),
      name: 'Hutang Konsumtif Existing',
      category: 'konsumtif',
      debtType: 'Hutang Personal',
      principalAmount: normalized,
      remainingAmount: normalized,
      monthlyInstallment,
      dueDay: Math.max(1, this.financialData?.tanggalPemasukan ?? 1),
      notes: 'Data awal dari hutangWajib yang sudah ada sebelumnya.',
    };
  }

  private buildPayoffDateLabel(months: number): string {
    const projected = new Date();
    projected.setMonth(projected.getMonth() + months);

    return `${months} bulan (~${projected.toLocaleDateString('id-ID', {
      month: 'long',
      year: 'numeric',
    })})`;
  }
}
