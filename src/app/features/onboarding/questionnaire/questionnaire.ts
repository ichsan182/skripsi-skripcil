import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { USERS_API_URL } from '../../../core/config/app-api.config';
import { CurrencyAmountLimitTier } from '../../../core/utils/format.utils';
import { CurrentUserService } from '../../../core/services/current-user.service';
import { FinancialData } from '../../../core/services/journal.service';
import {
  buildLevelSignals,
  evaluateFinancialLevel,
} from '../../../core/utils/level';
import { InputField } from '../../../shared/components/input-field/input-field';

const MAX_TANGGAL_PEMASUKAN = 31;

@Component({
  selector: 'app-questionnaire',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, InputField],
  templateUrl: './questionnaire.html',
  styleUrl: './questionnaire.css',
})
export class Questionnaire {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);
  private readonly currentUserService = inject(CurrentUserService);

  currentStep = 1;
  isSubmitting = false;
  protected readonly currencyMaxTier = CurrencyAmountLimitTier.TEN_BILLION;

  form1 = this.fb.group({
    pendapatan: ['', [Validators.required]],
    pengeluaranWajib: ['', [Validators.required]],
    tanggalPemasukan: [
      '',
      [
        Validators.required,
        Validators.pattern(/^[0-9]{1,2}$/),
        Validators.max(MAX_TANGGAL_PEMASUKAN),
      ],
    ],
    hutangWajib: [''],
  });

  form2 = this.fb.group({
    estimasiTabungan: ['', [Validators.required]],
    danaDarurat: ['', [Validators.required]],
  });

  get isForm1Valid(): boolean {
    return this.form1.valid;
  }

  getStepIcon(step: number): string {
    if (step === this.currentStep) {
      return 'assets/progress/current-position-progress.svg';
    }
    if (step < this.currentStep) {
      return 'assets/progress/filled-progress.svg';
    }
    return 'assets/progress/not-filled-progress.svg';
  }

  goToStep(step: number): void {
    if (step === 2 && this.form1.invalid) {
      this.form1.markAllAsTouched();
      return;
    }
    if (step < this.currentStep || step === this.currentStep) {
      this.currentStep = step;
    }
    if (step > this.currentStep && this.form1.valid) {
      this.currentStep = step;
    }
  }

  nextStep(): void {
    if (this.form1.invalid) {
      this.form1.markAllAsTouched();
      return;
    }
    this.currentStep = 2;
  }

  async onFinish(): Promise<void> {
    if (this.form2.invalid) {
      this.form2.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    try {
      const user = this.currentUserService.getCurrentUserOrDefault<{
        id?: number | string;
      }>({});

      if (!user.id) {
        return;
      }

      const tanggalPemasukan = this.parseNumber(
        this.form1.value.tanggalPemasukan || '',
      );

      if (tanggalPemasukan < 1 || tanggalPemasukan > 31) {
        this.form1.get('tanggalPemasukan')?.setErrors({ invalidDay: true });
        this.form1.get('tanggalPemasukan')?.markAsTouched();
        this.currentStep = 1;
        return;
      }

      if (tanggalPemasukan >= 29) {
        const isConfirmed = window.confirm(
          'Di bulan yang tidak memiliki tanggal ini, reset akan dilakukan pada hari terakhir bulan tersebut. Apakah kamu setuju?',
        );
        if (!isConfirmed) {
          this.currentStep = 1;
          return;
        }
      }

      const pendapatan = this.parseNumber(this.form1.value.pendapatan || '');
      const pengeluaranWajib = this.parseNumber(
        this.form1.value.pengeluaranWajib || '',
      );
      const hutangWajib = this.parseNumber(this.form1.value.hutangWajib || '');
      const estimasiTabungan = this.parseNumber(
        this.form2.value.estimasiTabungan || '',
      );
      const danaDarurat = this.parseNumber(this.form2.value.danaDarurat || '');
      const pengeluaranPercent =
        pendapatan > 0
          ? this.clampPercent(Math.round((pengeluaranWajib / pendapatan) * 100))
          : 0;
      const now = new Date();
      const cycleRange = this.buildCycleRange(now, tanggalPemasukan);
      const currentPengeluaranLimit = pengeluaranWajib;
      const currentSisaSaldoPool = Math.max(
        0,
        pendapatan - pengeluaranWajib - hutangWajib,
      );

      const financialData = {
        pendapatan,
        pengeluaranWajib,
        tanggalPemasukan,
        intendedTanggalPemasukan: tanggalPemasukan,
        hutangWajib,
        estimasiTabungan,
        danaDarurat,
        budgetAllocation: {
          mode: 2,
          pengeluaran: pengeluaranPercent,
          wants: 0,
          savings: Math.max(0, 100 - pengeluaranPercent),
        },
        currentPengeluaranLimit,
        currentPengeluaranUsed: 0,
        currentSisaSaldoPool,
        lastCycleCarryOverSaldo: 0,
        monthlyTopUp: {
          cycleKey: cycleRange.start,
          fromTabunganCount: 0,
          totalFromTabungan: 0,
          totalFromDanaDarurat: 0,
        },
        currentCycleStart: cycleRange.start,
        currentCycleEnd: cycleRange.end,
      };

      const level = this.calculateLevel(
        financialData as unknown as FinancialData,
      );

      const updatedUser = {
        ...user,
        onboardingCompleted: true,
        financialData,
        level,
      };

      const serverUser = await firstValueFrom(
        this.http.get<Record<string, unknown>>(`${USERS_API_URL}/${user.id}`),
      );
      await firstValueFrom(
        this.http.put(`${USERS_API_URL}/${user.id}`, {
          ...serverUser,
          onboardingCompleted: true,
          financialData,
          level,
          id: user.id,
        }),
      );

      this.currentUserService.setCurrentUser(updatedUser);

      this.router.navigateByUrl('/result');
    } catch {
      // silently handle — user can retry
    } finally {
      this.isSubmitting = false;
    }
  }

  showError(form: 'form1' | 'form2', controlName: string): boolean {
    const formGroup = form === 'form1' ? this.form1 : this.form2;
    const control = (formGroup as any).get(controlName);
    return Boolean(
      control?.hasError?.('required') && (control.dirty || control.touched),
    );
  }

  onCurrencyInput(
    form: 'form1' | 'form2',
    controlName: string,
    state: { value: number; formattedValue: string; exceededMax: boolean },
  ): void {
    const formGroup = form === 'form1' ? this.form1 : this.form2;
    const control = (formGroup as any).get(controlName);
    if (!control) {
      return;
    }

    const currentErrors = control.errors || {};
    if (state.exceededMax) {
      currentErrors['maxAmount'] = true;
    } else {
      delete currentErrors['maxAmount'];
    }
    control.setErrors(Object.keys(currentErrors).length ? currentErrors : null);

    control.setValue(state.formattedValue, {
      emitEvent: false,
    });
  }

  onTanggalPemasukanInput(): void {
    const control = this.form1.get('tanggalPemasukan');
    if (!control) {
      return;
    }

    const rawValue = this.parseNumber(String(control.value || ''));
    const numericValue = this.clampDay(rawValue);
    const currentErrors = control.errors || {};
    if (rawValue > MAX_TANGGAL_PEMASUKAN) {
      currentErrors['max'] = true;
    } else {
      delete currentErrors['max'];
    }
    control.setErrors(Object.keys(currentErrors).length ? currentErrors : null);
    control.setValue(numericValue > 0 ? String(numericValue) : '', {
      emitEvent: false,
    });
  }

  onTanggalPemasukanValueChange(value: string): void {
    this.form1.get('tanggalPemasukan')?.setValue(value, { emitEvent: false });
    this.onTanggalPemasukanInput();
  }

  hasControlError(
    form: 'form1' | 'form2',
    controlName: string,
    errorName: string,
  ): boolean {
    const formGroup = form === 'form1' ? this.form1 : this.form2;
    const control = (formGroup as any).get(controlName);
    return Boolean(
      control?.hasError?.(errorName) && (control.dirty || control.touched),
    );
  }

  getControlValue(form: 'form1' | 'form2', controlName: string): string {
    const formGroup = form === 'form1' ? this.form1 : this.form2;
    const control = (formGroup as any).get(controlName);
    return String(control?.value || '');
  }

  private parseNumber(value: string): number {
    if (!value) return 0;
    const cleaned = value.toString().replace(/[^0-9]/g, '');
    return Number(cleaned) || 0;
  }

  private clampDay(value: number): number {
    return Math.max(0, Math.min(MAX_TANGGAL_PEMASUKAN, value));
  }

  private clampPercent(value: number): number {
    return Math.max(0, Math.min(100, value));
  }

  private calculateLevel(data: FinancialData): number {
    const signals = buildLevelSignals(data);
    const evaluation = evaluateFinancialLevel(signals);
    return evaluation.level;
  }

  private buildCycleRange(
    referenceDate: Date,
    intendedDay: number,
  ): { start: string; end: string } {
    const normalizedDay = Math.max(1, Math.min(31, intendedDay));
    const thisMonthResetDay = this.resolveResetDay(
      referenceDate.getFullYear(),
      referenceDate.getMonth(),
      normalizedDay,
    );
    const thisMonthResetDate = new Date(
      referenceDate.getFullYear(),
      referenceDate.getMonth(),
      thisMonthResetDay,
    );

    const startDate =
      referenceDate >= thisMonthResetDate
        ? thisMonthResetDate
        : new Date(
            referenceDate.getFullYear(),
            referenceDate.getMonth() - 1,
            this.resolveResetDay(
              referenceDate.getFullYear(),
              referenceDate.getMonth() - 1,
              normalizedDay,
            ),
          );

    const nextStartDate = new Date(
      startDate.getFullYear(),
      startDate.getMonth() + 1,
      this.resolveResetDay(
        startDate.getFullYear(),
        startDate.getMonth() + 1,
        normalizedDay,
      ),
    );
    const endDate = new Date(nextStartDate);
    endDate.setDate(endDate.getDate() - 1);

    return {
      start: this.toDateKey(startDate),
      end: this.toDateKey(endDate),
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

  private toDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
