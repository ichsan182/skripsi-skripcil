import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  formatCurrencyPlain,
  parseCurrencyInput,
} from '../../../../core/utils/format.utils';

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
  | 'weekly'
  | 'bi-weekly'
  | 'semi-monthly'
  | 'monthly'
  | 'bi-monthly'
  | 'quarterly'
  | 'half-yearly'
  | 'yearly';

type DepositTiming = 'beginning' | 'end';
type NormalOperator = 'add' | 'subtract' | 'multiply' | 'divide';

type ChartGranularity = 'monthly' | 'yearly';
type ChartMetric = 'future-value' | 'net-result';

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

interface ProjectionChartPoint {
  timeInYears: number;
  label: string;
  futureValue: number;
  netResult: number;
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
      label: 'Semi-weekly (104/year)',
      periodsPerYear: 104,
    },
    { value: 'weekly', label: 'Weekly (52/year)', periodsPerYear: 52 },
    { value: 'bi-weekly', label: 'Bi-weekly (26/year)', periodsPerYear: 26 },
    {
      value: 'semi-monthly',
      label: 'Semi-monthly (24/year)',
      periodsPerYear: 24,
    },
    { value: 'monthly', label: 'Monthly (12/year)', periodsPerYear: 12 },
    { value: 'bi-monthly', label: 'Bi-monthly (6/year)', periodsPerYear: 6 },
    { value: 'quarterly', label: 'Quarterly (4/year)', periodsPerYear: 4 },
    { value: 'half-yearly', label: 'Half-yearly (2/year)', periodsPerYear: 2 },
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
  protected compoundFrequency: CompoundFrequency = 'monthly';
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

  protected chartGranularity: ChartGranularity = 'yearly';
  protected chartMetric: ChartMetric = 'future-value';
  protected chartPoints: ProjectionChartPoint[] = [];
  protected chartPath = '';
  protected chartMinValue = 0;
  protected chartMaxValue = 0;
  protected chartCurrentValue = 0;
  protected chartDeltaValue = 0;
  protected chartYearTicks: number[] = [0];

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

  protected get chartStartLabel(): string {
    return this.chartPoints.length > 0 ? this.chartPoints[0].label : '0 bulan';
  }

  protected get chartEndLabel(): string {
    return this.chartPoints.length > 0
      ? this.chartPoints[this.chartPoints.length - 1].label
      : '0 bulan';
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

  protected onIncomeInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const parsed = this.parseCurrencyInput(input.value);
    this.income = parsed;
    input.value = parsed ? this.formatCurrencyInput(parsed) : '';
    this.syncAndRecalculateSavings();
  }

  protected onInitialInvestmentInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const parsed = this.parseCurrencyInput(input.value);
    this.initialInvestment = parsed;
    input.value = parsed ? this.formatCurrencyInput(parsed) : '';
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

  protected onDepositAmountInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const parsed = this.parseCurrencyInput(input.value);
    this.depositAmount = parsed;
    this.isDepositSynced = false;
    input.value = parsed ? this.formatCurrencyInput(parsed) : '';
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

  protected onChartGranularityChange(): void {
    this.updateChartData();
  }

  protected onChartMetricChange(): void {
    this.rebuildChartPath();
  }

  protected onNormalFieldChange(): void {
    this.normalLeft = this.ensureFinite(this.normalLeft);
    this.normalRight = this.ensureFinite(this.normalRight);
    this.calculateNormal();
  }

  protected formatCurrency(amount: number): string {
    return formatCurrencyPlain(this.ensureFinite(amount), {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  protected formatPercent(percentValue: number): string {
    return `${this.ensureFinite(percentValue).toFixed(2)}%`;
  }

  private recalculateAll(): void {
    this.projection = this.calculateProjection();
    this.updateChartData();
    this.calculateNormal();
  }

  private updateChartData(): void {
    this.chartPoints = this.buildProjectionSeries(this.chartGranularity);
    this.updateChartYearTicks();
    this.rebuildChartPath();
  }

  private updateChartYearTicks(): void {
    if (this.chartPoints.length === 0) {
      this.chartYearTicks = [0];
      return;
    }

    const totalYears =
      this.chartPoints[this.chartPoints.length - 1].timeInYears;
    const wholeYears = Math.max(0, Math.floor(totalYears + 1e-8));
    this.chartYearTicks = Array.from(
      { length: wholeYears + 1 },
      (_, index) => index,
    );
  }

  private buildProjectionSeries(
    granularity: ChartGranularity,
  ): ProjectionChartPoint[] {
    const initialInvestment = this.safeNonNegative(this.initialInvestment);
    const interestRate = this.safeNonNegative(this.interestRate);
    const depositAmount = this.safeNonNegative(this.depositAmount);
    const investmentYears = Math.floor(
      this.safeNonNegative(this.investmentYears),
    );
    const investmentMonths = Math.floor(
      this.clamp(this.safeNonNegative(this.investmentMonths), 0, 11),
    );
    const annualDepositIncrease = this.safeNonNegative(
      this.annualDepositIncrease,
    );

    const totalYears = investmentYears + investmentMonths / 12;
    const sampleTimes = this.buildChartSampleTimes(totalYears, granularity);

    const compoundPerYear = this.getCompoundPeriods(this.compoundFrequency);
    const periodicRate = interestRate / 100;
    const annualNominalRate =
      periodicRate * this.getInterestPeriods(this.interestRateInterval);
    const annualDepositIncreaseRate = annualDepositIncrease / 100;

    return sampleTimes.map((sampleTime) => {
      const projection = this.runProjectionTimeline(
        initialInvestment,
        annualNominalRate,
        compoundPerYear,
        sampleTime,
        depositAmount,
        this.getSavingsPeriods(this.depositEvery),
        this.depositTiming,
        annualDepositIncreaseRate,
      );

      const totalInvested = initialInvestment + projection.totalContributions;
      const netResult = projection.futureValue - totalInvested;

      return {
        timeInYears: sampleTime,
        label: this.formatDuration(sampleTime),
        futureValue: this.roundCurrency(projection.futureValue),
        netResult: this.roundCurrency(netResult),
      };
    });
  }

  private buildChartSampleTimes(
    totalYears: number,
    granularity: ChartGranularity,
  ): number[] {
    if (totalYears <= 0) {
      return [0];
    }

    const baseStep = granularity === 'monthly' ? 1 / 12 : 1;
    const maxPoints = 360;
    const estimatePointCount = Math.ceil(totalYears / baseStep) + 1;
    const multiplier = Math.max(1, Math.ceil(estimatePointCount / maxPoints));
    const step = baseStep * multiplier;

    const times: number[] = [0];
    let current = step;
    while (current < totalYears - 1e-8) {
      times.push(this.roundToPrecision(current, 6));
      current += step;
    }

    if (times[times.length - 1] < totalYears - 1e-8) {
      times.push(this.roundToPrecision(totalYears, 6));
    }

    return times;
  }

  private rebuildChartPath(): void {
    if (this.chartPoints.length === 0) {
      this.chartPath = '';
      this.chartMinValue = 0;
      this.chartMaxValue = 0;
      this.chartCurrentValue = 0;
      this.chartDeltaValue = 0;
      return;
    }

    const values = this.chartPoints.map((point) =>
      this.getChartMetricValue(point),
    );
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const valueRange = maxValue - minValue;

    const chartWidth = 560;
    const chartHeight = 220;
    const padLeft = 20;
    const padRight = 10;
    const padTop = 14;
    const padBottom = 18;
    const innerWidth = chartWidth - padLeft - padRight;
    const innerHeight = chartHeight - padTop - padBottom;

    const safeRange = valueRange > 0 ? valueRange : 1;
    const lastIndex = this.chartPoints.length - 1;
    const pathParts: string[] = [];

    this.chartPoints.forEach((point, index) => {
      const value = this.getChartMetricValue(point);
      const x =
        lastIndex > 0
          ? padLeft + (index / lastIndex) * innerWidth
          : padLeft + innerWidth / 2;
      const y = padTop + ((maxValue - value) / safeRange) * innerHeight;

      pathParts.push(
        `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`,
      );
    });

    this.chartPath = pathParts.join(' ');
    this.chartMinValue = this.roundCurrency(minValue);
    this.chartMaxValue = this.roundCurrency(maxValue);
    this.chartCurrentValue = this.roundCurrency(values[values.length - 1]);
    this.chartDeltaValue = this.roundCurrency(
      values[values.length - 1] - values[0],
    );
  }

  private getChartMetricValue(point: ProjectionChartPoint): number {
    return this.chartMetric === 'future-value'
      ? point.futureValue
      : point.netResult;
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

    const ratePerCompound = annualNominalRate / compoundsPerYear;
    const compoundInterval = 1 / compoundsPerYear;
    const depositInterval =
      contributionPerYear > 0 ? 1 / contributionPerYear : 0;

    const totalCompoundPeriods = Math.floor(
      totalYears * compoundsPerYear + 1e-8,
    );
    const totalDepositEvents =
      baseContribution > 0 && contributionPerYear > 0
        ? Math.floor(totalYears * contributionPerYear + 1e-8)
        : 0;

    const doubleTarget = initialInvestment > 0 ? initialInvestment * 2 : 0;
    let timeToDouble: number | null = null;
    let balance = initialInvestment;
    let totalContributions = 0;

    for (
      let compoundIndex = 0;
      compoundIndex < totalCompoundPeriods;
      compoundIndex += 1
    ) {
      const compoundStart = compoundIndex * compoundInterval;
      const compoundEnd = (compoundIndex + 1) * compoundInterval;

      // Collect deposits that fall within this compound period
      interface PendingDeposit {
        depositIndex: number;
        timeInYears: number;
        amount: number;
        fractionRemaining: number;
      }
      const depositsInPeriod: PendingDeposit[] = [];

      if (totalDepositEvents > 0) {
        if (contributionTiming === 'beginning') {
          // Beginning-of-period deposits: at t = depositIndex / contributionPerYear
          for (
            let depositIndex = 0;
            depositIndex < totalDepositEvents;
            depositIndex += 1
          ) {
            const depositTime = depositIndex * depositInterval;
            if (
              depositTime >= compoundStart - 1e-8 &&
              depositTime < compoundEnd - 1e-8
            ) {
              const depositYear = Math.floor(
                depositIndex / contributionPerYear + 1e-8,
              );
              const amount =
                baseContribution *
                Math.pow(1 + annualContributionIncreaseRate, depositYear);
              const fractionRemaining =
                (compoundEnd - depositTime) / compoundInterval;
              depositsInPeriod.push({
                depositIndex,
                timeInYears: depositTime,
                amount,
                fractionRemaining: Math.min(1, Math.max(0, fractionRemaining)),
              });
            }
          }
        } else {
          // End-of-period deposits: at t = (depositIndex + 1) / contributionPerYear
          for (
            let depositIndex = 0;
            depositIndex < totalDepositEvents;
            depositIndex += 1
          ) {
            const depositTime = (depositIndex + 1) * depositInterval;
            if (
              depositTime > compoundStart + 1e-8 &&
              depositTime <= compoundEnd + 1e-8
            ) {
              const depositYear = Math.floor(
                depositIndex / contributionPerYear + 1e-8,
              );
              const amount =
                baseContribution *
                Math.pow(1 + annualContributionIncreaseRate, depositYear);
              const fractionRemaining =
                (compoundEnd - depositTime) / compoundInterval;
              depositsInPeriod.push({
                depositIndex,
                timeInYears: depositTime,
                amount,
                fractionRemaining: Math.min(1, Math.max(0, fractionRemaining)),
              });
            }
          }
        }
      }

      // Add beginning-of-period deposits before compounding
      for (const deposit of depositsInPeriod) {
        if (
          contributionTiming === 'beginning' &&
          Math.abs(deposit.timeInYears - compoundStart) < 1e-8
        ) {
          balance += deposit.amount;
          totalContributions += deposit.amount;

          if (
            timeToDouble === null &&
            doubleTarget > 0 &&
            balance >= doubleTarget
          ) {
            timeToDouble = deposit.timeInYears;
          }
        }
      }

      // Apply compound interest to existing balance
      const previousBalance = balance;
      balance *= 1 + ratePerCompound;

      if (
        timeToDouble === null &&
        doubleTarget > 0 &&
        previousBalance < doubleTarget &&
        balance >= doubleTarget
      ) {
        const crossingTime = this.solveCrossingTime(
          previousBalance,
          doubleTarget,
          1 + ratePerCompound,
          compoundsPerYear,
          compoundInterval,
        );
        timeToDouble =
          crossingTime !== null ? compoundStart + crossingTime : compoundEnd;
      }

      // Add deposits with simple pro-rated interest for remaining fraction
      for (const deposit of depositsInPeriod) {
        if (
          contributionTiming === 'beginning' &&
          Math.abs(deposit.timeInYears - compoundStart) < 1e-8
        ) {
          continue; // Already added above
        }

        const depositWithInterest =
          deposit.amount * (1 + ratePerCompound * deposit.fractionRemaining);
        balance += depositWithInterest;
        totalContributions += deposit.amount;

        if (
          timeToDouble === null &&
          doubleTarget > 0 &&
          balance >= doubleTarget
        ) {
          timeToDouble = deposit.timeInYears;
        }
      }
    }

    // Handle remaining time after the last compound period
    const timeAfterLastCompound = totalCompoundPeriods / compoundsPerYear;
    if (totalYears > timeAfterLastCompound + 1e-8) {
      const remainingFraction =
        (totalYears - timeAfterLastCompound) / compoundInterval;
      const previousBalance = balance;
      balance *= 1 + ratePerCompound * remainingFraction;

      if (
        timeToDouble === null &&
        doubleTarget > 0 &&
        previousBalance < doubleTarget &&
        balance >= doubleTarget
      ) {
        timeToDouble = totalYears;
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
      return 'Tidak tersedia karena initial investment = 0';
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
    return parseCurrencyInput(rawValue);
  }

  private formatCurrencyInput(value: number): string {
    return formatCurrencyPlain(Math.round(this.safeNonNegative(value)));
  }

  private roundToPrecision(value: number, precision: number): number {
    const factor = Math.pow(10, precision);
    return Math.round(this.ensureFinite(value) * factor) / factor;
  }

  private syncCurrencyInputsFromNumbers(): void {
    this.incomeInput = this.income ? this.formatCurrencyInput(this.income) : '';
    this.initialInvestmentInput = this.initialInvestment
      ? this.formatCurrencyInput(this.initialInvestment)
      : '';
    this.depositAmountInput = this.depositAmount
      ? this.formatCurrencyInput(this.depositAmount)
      : '';
  }

  private roundCurrency(value: number): number {
    return Math.round(this.ensureFinite(value) * 100) / 100;
  }

  private roundPercent(value: number): number {
    return Math.round(this.ensureFinite(value) * 100) / 100;
  }
}
