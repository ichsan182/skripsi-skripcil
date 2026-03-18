import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

type SavingsFrequency =
  | 'weekly'
  | 'bi-weekly'
  | 'monthly'
  | 'quarterly'
  | 'half-yearly'
  | 'yearly';

type InterestInterval = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

type CompoundFrequency =
  | 'daily-365'
  | 'daily-360'
  | 'semi-weekly'
  | 'monthly'
  | 'bi-monthly'
  | 'quarterly'
  | 'half-yearly'
  | 'yearly';

type DepositTiming = 'beginning' | 'end';
type NormalOperator = 'add' | 'subtract' | 'multiply' | 'divide';
type TimelineEventType = 'deposit-beginning' | 'compound' | 'deposit-end';

interface FrequencyOption<TValue extends string> {
  value: TValue;
  label: string;
  periodsPerYear: number;
}

interface ProjectionResult {
  termLabel: string;
  futureValue: number;
  totalInterestEarned: number;
  totalContributions: number;
  totalInvested: number;
  initialBalance: number;
  allTimeRateOfReturnPct: number;
  effectiveAnnualRatePct: number;
  periodicRatePct: number;
  doubledAfterLabel: string;
}

interface TimelineEvent {
  timeInYears: number;
  type: TimelineEventType;
}

@Component({
  selector: 'app-tools-calculator',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './calculator.html',
  styleUrl: './calculator.css',
})
export class ToolsCalculator {
  protected readonly savingsFrequencyOptions: Array<
    FrequencyOption<SavingsFrequency>
  > = [
    { value: 'weekly', label: 'Weekly', periodsPerYear: 52 },
    { value: 'bi-weekly', label: 'Bi Weekly', periodsPerYear: 26 },
    { value: 'monthly', label: 'Monthly', periodsPerYear: 12 },
    { value: 'quarterly', label: 'Quarterly', periodsPerYear: 4 },
    { value: 'half-yearly', label: 'Half Yearly', periodsPerYear: 2 },
    { value: 'yearly', label: 'Yearly', periodsPerYear: 1 },
  ];

  protected readonly interestIntervalOptions: Array<
    FrequencyOption<InterestInterval>
  > = [
    { value: 'daily', label: 'Daily', periodsPerYear: 365 },
    { value: 'weekly', label: 'Weekly', periodsPerYear: 52 },
    { value: 'monthly', label: 'Monthly', periodsPerYear: 12 },
    { value: 'quarterly', label: 'Quarterly', periodsPerYear: 4 },
    { value: 'yearly', label: 'Yearly', periodsPerYear: 1 },
  ];

  protected readonly compoundFrequencyOptions: Array<
    FrequencyOption<CompoundFrequency>
  > = [
    { value: 'daily-365', label: 'Daily (365/year)', periodsPerYear: 365 },
    { value: 'daily-360', label: 'Daily (360/year)', periodsPerYear: 360 },
    {
      value: 'semi-weekly',
      label: 'Semi-weekly (24/year)',
      periodsPerYear: 24,
    },
    { value: 'monthly', label: 'Monthly (12/year)', periodsPerYear: 12 },
    { value: 'bi-monthly', label: 'Bi monthly (6/year)', periodsPerYear: 6 },
    { value: 'quarterly', label: 'Quarterly (4/year)', periodsPerYear: 4 },
    { value: 'half-yearly', label: 'Half yearly (2/year)', periodsPerYear: 2 },
    { value: 'yearly', label: 'Yearly (1/year)', periodsPerYear: 1 },
  ];

  protected readonly normalOperatorOptions: Array<{
    value: NormalOperator;
    label: string;
  }> = [
    { value: 'add', label: '+' },
    { value: 'subtract', label: '-' },
    { value: 'multiply', label: 'x' },
    { value: 'divide', label: '/' },
  ];

  protected savingsRate = 20;
  protected income = 1_000_000;
  protected requiredExpenseRate = 40;
  protected savingsEvery: SavingsFrequency = 'monthly';

  protected initialInvestment = 1_000_000;
  protected interestRate = 2;
  protected interestRateInterval: InterestInterval = 'monthly';
  protected compoundFrequency: CompoundFrequency = 'yearly';
  protected investmentYears = 5;
  protected investmentMonths = 0;

  protected depositAmount = 0;
  protected depositEvery: SavingsFrequency = 'monthly';
  protected depositTiming: DepositTiming = 'end';
  protected annualDepositIncrease = 10;
  protected isDepositSynced = true;

  protected incomeInput = '';
  protected initialInvestmentInput = '';
  protected depositAmountInput = '';

  protected normalLeft = 0;
  protected normalRight = 0;
  protected normalOperator: NormalOperator = 'add';
  protected normalResult = 0;
  protected normalError = '';

  protected projection: ProjectionResult = {
    termLabel: '0 bulan',
    futureValue: 0,
    totalInterestEarned: 0,
    totalContributions: 0,
    totalInvested: 0,
    initialBalance: 0,
    allTimeRateOfReturnPct: 0,
    effectiveAnnualRatePct: 0,
    periodicRatePct: 0,
    doubledAfterLabel: 'Belum tersedia',
  };

  constructor() {
    this.syncDepositWithSavings();
    this.syncCurrencyInputsFromNumbers();
  }

  protected get savingsAmount(): number {
    return this.roundCurrency(
      (this.clampPercent(this.savingsRate) / 100) *
        this.safeNonNegative(this.income),
    );
  }

  protected get requiredExpenseAmount(): number {
    return this.roundCurrency(
      (this.clampPercent(this.requiredExpenseRate) / 100) *
        this.safeNonNegative(this.income),
    );
  }

  protected get cashflowAfterSavingsAndExpenses(): number {
    return this.roundCurrency(
      this.safeNonNegative(this.income) -
        this.savingsAmount -
        this.requiredExpenseAmount,
    );
  }

  protected get annualSavingsProjection(): number {
    return this.roundCurrency(
      this.savingsAmount * this.getSavingsPeriods(this.savingsEvery),
    );
  }

  protected get effectiveYearlyRateLabel(): string {
    return this.formatPercent(this.projection.effectiveAnnualRatePct);
  }

  protected get periodicRateLabel(): string {
    const intervalLabel = this.getInterestIntervalLabel(
      this.interestRateInterval,
    );
    return `${this.formatPercent(this.projection.periodicRatePct)} / ${intervalLabel.toLowerCase()}`;
  }

  protected get canChooseDepositTiming(): boolean {
    return (
      this.depositEvery === 'monthly' ||
      this.depositEvery === 'quarterly' ||
      this.depositEvery === 'half-yearly' ||
      this.depositEvery === 'yearly'
    );
  }

  protected onSavingsRateChange(): void {
    // Clamp saving rate to 0-100
    this.savingsRate = this.clamp(this.ensureFinite(this.savingsRate), 0, 100);
    // Auto-calculate required expense rate as complement (total = 100%)
    this.requiredExpenseRate = this.clamp(100 - this.savingsRate, 0, 100);
    this.income = this.safeNonNegative(this.income);

    this.syncAndRecalculateSavings();
  }

  protected onRequiredExpenseRateChange(): void {
    // Clamp required expense rate to 0-100
    this.requiredExpenseRate = this.clamp(
      this.ensureFinite(this.requiredExpenseRate),
      0,
      100,
    );
    // Auto-calculate saving rate as complement (total = 100%)
    this.savingsRate = this.clamp(100 - this.requiredExpenseRate, 0, 100);
    this.income = this.safeNonNegative(this.income);

    this.syncAndRecalculateSavings();
  }

  protected syncAndRecalculateSavings(): void {
    if (this.isDepositSynced) {
      this.depositAmount = this.savingsAmount;
      this.depositEvery = this.savingsEvery;
      if (!this.canChooseDepositTiming) {
        this.depositTiming = 'end';
      }
    }

    this.syncCurrencyInputsFromNumbers();
    this.recalculateAll();
  }

  protected onIncomeInputChange(rawValue: string): void {
    this.income = this.parseCurrencyInput(rawValue);
    this.syncAndRecalculateSavings();
  }

  protected onInitialInvestmentInputChange(rawValue: string): void {
    this.initialInvestment = this.parseCurrencyInput(rawValue);
    this.syncCurrencyInputsFromNumbers();
    this.onCompoundFieldChange();
  }

  protected onCompoundFieldChange(): void {
    this.initialInvestment = this.safeNonNegative(this.initialInvestment);
    this.interestRate = this.clamp(
      this.safeNonNegative(this.interestRate),
      0,
      1000,
    );
    this.investmentYears = Math.floor(
      this.safeNonNegative(this.investmentYears),
    );
    this.investmentMonths = Math.floor(
      this.clamp(this.safeNonNegative(this.investmentMonths), 0, 11),
    );
    this.annualDepositIncrease = this.clamp(
      this.safeNonNegative(this.annualDepositIncrease),
      0,
      100,
    );

    if (!this.canChooseDepositTiming) {
      this.depositTiming = 'end';
    }

    this.syncCurrencyInputsFromNumbers();
    this.recalculateAll();
  }

  protected onDepositAmountChange(rawValue: string): void {
    this.depositAmount = this.parseCurrencyInput(rawValue);
    this.isDepositSynced = false;
    this.syncCurrencyInputsFromNumbers();
    this.recalculateAll();
  }

  protected syncDepositWithSavings(): void {
    this.depositAmount = this.savingsAmount;
    this.depositEvery = this.savingsEvery;
    if (!this.canChooseDepositTiming) {
      this.depositTiming = 'end';
    }
    this.isDepositSynced = true;
    this.syncCurrencyInputsFromNumbers();
    this.recalculateAll();
  }

  protected calculateNow(): void {
    this.recalculateAll();
  }

  protected onNormalFieldChange(): void {
    this.normalLeft = this.ensureFinite(this.normalLeft);
    this.normalRight = this.ensureFinite(this.normalRight);
    this.calculateNormal();
  }

  protected formatCurrency(amount: number): string {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(this.ensureFinite(amount));
  }

  protected formatPercent(percentValue: number): string {
    return `${this.ensureFinite(percentValue).toFixed(2)}%`;
  }

  private recalculateAll(): void {
    this.projection = this.calculateProjection();
    this.calculateNormal();
  }

  private calculateNormal(): void {
    const left = this.ensureFinite(this.normalLeft);
    const right = this.ensureFinite(this.normalRight);
    this.normalError = '';

    switch (this.normalOperator) {
      case 'add':
        this.normalResult = left + right;
        break;
      case 'subtract':
        this.normalResult = left - right;
        break;
      case 'multiply':
        this.normalResult = left * right;
        break;
      case 'divide':
        if (right === 0) {
          this.normalResult = 0;
          this.normalError = 'Pembagian dengan angka 0 tidak diperbolehkan.';
          return;
        }
        this.normalResult = left / right;
        break;
      default:
        this.normalResult = 0;
        break;
    }
  }

  private calculateProjection(): ProjectionResult {
    this.initialInvestment = this.safeNonNegative(this.initialInvestment);
    this.interestRate = this.safeNonNegative(this.interestRate);
    this.depositAmount = this.safeNonNegative(this.depositAmount);
    this.investmentYears = Math.floor(
      this.safeNonNegative(this.investmentYears),
    );
    this.investmentMonths = Math.floor(
      this.clamp(this.safeNonNegative(this.investmentMonths), 0, 11),
    );
    this.annualDepositIncrease = this.safeNonNegative(
      this.annualDepositIncrease,
    );

    const totalYears = this.investmentYears + this.investmentMonths / 12;
    const compoundPerYear = this.getCompoundPeriods(this.compoundFrequency);
    const periodicRate = this.interestRate / 100;
    const annualNominalRate =
      periodicRate * this.getInterestPeriods(this.interestRateInterval);
    const annualDepositIncreaseRate = this.annualDepositIncrease / 100;

    const projection = this.runProjectionTimeline(
      this.initialInvestment,
      annualNominalRate,
      compoundPerYear,
      totalYears,
      this.depositAmount,
      this.getSavingsPeriods(this.depositEvery),
      this.depositTiming,
      annualDepositIncreaseRate,
    );

    const effectiveAnnualRate =
      Math.pow(1 + annualNominalRate / compoundPerYear, compoundPerYear) - 1;
    const totalInvestedRaw =
      this.initialInvestment + projection.totalContributions;
    const gainRaw = projection.futureValue - totalInvestedRaw;
    const ror = totalInvestedRaw > 0 ? (gainRaw / totalInvestedRaw) * 100 : 0;

    return {
      termLabel: this.formatDuration(totalYears),
      futureValue: this.roundCurrency(projection.futureValue),
      totalInterestEarned: this.roundCurrency(gainRaw),
      totalContributions: this.roundCurrency(projection.totalContributions),
      totalInvested: this.roundCurrency(totalInvestedRaw),
      initialBalance: this.roundCurrency(this.initialInvestment),
      allTimeRateOfReturnPct: this.roundPercent(ror),
      effectiveAnnualRatePct: this.roundPercent(effectiveAnnualRate * 100),
      periodicRatePct: this.roundPercent(periodicRate * 100),
      doubledAfterLabel: this.formatDoubleTime(projection.timeToDouble),
    };
  }

  private runProjectionTimeline(
    initialInvestment: number,
    annualNominalRate: number,
    compoundsPerYear: number,
    totalYears: number,
    baseContribution: number,
    contributionPerYear: number,
    contributionTiming: DepositTiming,
    annualContributionIncreaseRate: number,
  ): {
    futureValue: number;
    totalContributions: number;
    timeToDouble: number | null;
  } {
    if (totalYears <= 0) {
      return {
        futureValue: initialInvestment,
        totalContributions: 0,
        timeToDouble: null,
      };
    }

    const factorPerCompound = 1 + annualNominalRate / compoundsPerYear;
    const events: TimelineEvent[] = [];

    const compoundEvents = Math.floor(totalYears * compoundsPerYear + 1e-8);
    for (let index = 1; index <= compoundEvents; index += 1) {
      events.push({
        timeInYears: index / compoundsPerYear,
        type: 'compound',
      });
    }

    const contributionEvents = Math.floor(
      totalYears * contributionPerYear + 1e-8,
    );
    if (baseContribution > 0 && contributionEvents > 0) {
      if (contributionTiming === 'beginning') {
        for (let index = 0; index < contributionEvents; index += 1) {
          events.push({
            timeInYears: index / contributionPerYear,
            type: 'deposit-beginning',
          });
        }
      } else {
        for (let index = 1; index <= contributionEvents; index += 1) {
          events.push({
            timeInYears: index / contributionPerYear,
            type: 'deposit-end',
          });
        }
      }
    }

    events.sort((left, right) => {
      if (left.timeInYears !== right.timeInYears) {
        return left.timeInYears - right.timeInYears;
      }

      return (
        this.getEventPriority(left.type) - this.getEventPriority(right.type)
      );
    });

    const doubleTarget = initialInvestment > 0 ? initialInvestment * 2 : 0;
    let timeToDouble: number | null = null;
    let currentTime = 0;
    let balance = initialInvestment;
    let totalContributions = 0;

    for (const event of events) {
      if (event.timeInYears > currentTime) {
        const previousBalance = balance;
        const yearsDelta = event.timeInYears - currentTime;
        balance *= Math.pow(factorPerCompound, yearsDelta * compoundsPerYear);

        if (
          timeToDouble === null &&
          doubleTarget > 0 &&
          previousBalance < doubleTarget &&
          balance >= doubleTarget
        ) {
          const crossingTime = this.solveCrossingTime(
            previousBalance,
            doubleTarget,
            factorPerCompound,
            compoundsPerYear,
            yearsDelta,
          );
          timeToDouble =
            crossingTime !== null
              ? currentTime + crossingTime
              : event.timeInYears;
        }

        currentTime = event.timeInYears;
      }

      if (event.type === 'deposit-beginning' || event.type === 'deposit-end') {
        const contributionYear = Math.floor(event.timeInYears + 1e-8);
        const adjustedContribution =
          baseContribution *
          Math.pow(1 + annualContributionIncreaseRate, contributionYear);

        balance += adjustedContribution;
        totalContributions += adjustedContribution;

        if (
          timeToDouble === null &&
          doubleTarget > 0 &&
          balance >= doubleTarget
        ) {
          timeToDouble = event.timeInYears;
        }
      }
    }

    if (totalYears > currentTime) {
      const previousBalance = balance;
      const yearsDelta = totalYears - currentTime;
      balance *= Math.pow(factorPerCompound, yearsDelta * compoundsPerYear);

      if (
        timeToDouble === null &&
        doubleTarget > 0 &&
        previousBalance < doubleTarget &&
        balance >= doubleTarget
      ) {
        const crossingTime = this.solveCrossingTime(
          previousBalance,
          doubleTarget,
          factorPerCompound,
          compoundsPerYear,
          yearsDelta,
        );
        timeToDouble =
          crossingTime !== null ? currentTime + crossingTime : totalYears;
      }
    }

    return {
      futureValue: balance,
      totalContributions,
      timeToDouble,
    };
  }

  private solveCrossingTime(
    previousBalance: number,
    targetBalance: number,
    factorPerCompound: number,
    compoundsPerYear: number,
    maxYearsDelta: number,
  ): number | null {
    if (previousBalance <= 0 || factorPerCompound <= 1) {
      return null;
    }

    const periodCountToCross =
      Math.log(targetBalance / previousBalance) / Math.log(factorPerCompound);
    if (!Number.isFinite(periodCountToCross)) {
      return null;
    }

    const yearsToCross = periodCountToCross / compoundsPerYear;
    return yearsToCross <= maxYearsDelta ? yearsToCross : null;
  }

  private formatDoubleTime(timeToDouble: number | null): string {
    if (this.initialInvestment <= 0) {
      return 'Tidak tersedia karena initial investment = Rp0';
    }

    if (timeToDouble === null) {
      return 'Belum tercapai pada jangka waktu ini';
    }

    return this.formatDuration(timeToDouble);
  }

  private formatDuration(yearValue: number): string {
    const totalMonths = Math.max(0, Math.round(yearValue * 12));
    const years = Math.floor(totalMonths / 12);
    const months = totalMonths % 12;

    if (years === 0 && months === 0) {
      return '0 bulan';
    }

    if (years === 0) {
      return `${months} bulan`;
    }

    if (months === 0) {
      return `${years} tahun`;
    }

    return `${years} tahun ${months} bulan`;
  }

  private getEventPriority(type: TimelineEventType): number {
    if (type === 'deposit-beginning') {
      return 0;
    }

    if (type === 'compound') {
      return 1;
    }

    return 2;
  }

  private getInterestPeriods(interval: InterestInterval): number {
    return (
      this.interestIntervalOptions.find((option) => option.value === interval)
        ?.periodsPerYear ?? 1
    );
  }

  private getCompoundPeriods(frequency: CompoundFrequency): number {
    return (
      this.compoundFrequencyOptions.find((option) => option.value === frequency)
        ?.periodsPerYear ?? 1
    );
  }

  private getSavingsPeriods(frequency: SavingsFrequency): number {
    return (
      this.savingsFrequencyOptions.find((option) => option.value === frequency)
        ?.periodsPerYear ?? 1
    );
  }

  private getInterestIntervalLabel(interval: InterestInterval): string {
    return (
      this.interestIntervalOptions.find((option) => option.value === interval)
        ?.label ?? 'Monthly'
    );
  }

  private safeNonNegative(value: number): number {
    return Math.max(0, this.ensureFinite(value));
  }

  private clampPercent(value: number, maxValue: number = 100): number {
    return this.clamp(this.ensureFinite(value), 0, maxValue);
  }

  private clamp(value: number, minimum: number, maximum: number): number {
    return Math.min(Math.max(value, minimum), maximum);
  }

  private ensureFinite(value: number): number {
    return Number.isFinite(value) ? value : 0;
  }

  private parseCurrencyInput(rawValue: string): number {
    const normalized = rawValue.replace(/[^\d]/g, '');

    if (normalized.length === 0) {
      return 0;
    }

    // Remove leading zeros to prevent "0000", "006", etc.
    let parsed = Number.parseInt(normalized, 10);

    return this.safeNonNegative(parsed);
  }

  private formatCurrencyInput(value: number): string {
    return new Intl.NumberFormat('id-ID', {
      maximumFractionDigits: 0,
    }).format(Math.round(this.safeNonNegative(value)));
  }

  private syncCurrencyInputsFromNumbers(): void {
    this.incomeInput = this.formatCurrencyInput(this.income);
    this.initialInvestmentInput = this.formatCurrencyInput(
      this.initialInvestment,
    );
    this.depositAmountInput = this.formatCurrencyInput(this.depositAmount);
  }

  private roundCurrency(value: number): number {
    return Math.round(this.ensureFinite(value) * 100) / 100;
  }

  private roundPercent(value: number): number {
    return Math.round(this.ensureFinite(value) * 100) / 100;
  }
}
