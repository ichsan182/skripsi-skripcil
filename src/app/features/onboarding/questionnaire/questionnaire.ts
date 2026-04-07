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

      const financialData = {
        pendapatan: this.parseNumber(this.form1.value.pendapatan || ''),
        pengeluaranWajib: this.parseNumber(
          this.form1.value.pengeluaranWajib || '',
        ),
        tanggalPemasukan,
        intendedTanggalPemasukan: tanggalPemasukan,
        hutangWajib: this.parseNumber(this.form1.value.hutangWajib || ''),
        estimasiTabungan: this.parseNumber(
          this.form2.value.estimasiTabungan || '',
        ),
        danaDarurat: this.parseNumber(this.form2.value.danaDarurat || ''),
      };

      const level = this.calculateLevel(
        financialData as unknown as FinancialData,
      );

      await firstValueFrom(
        this.http.patch(`${USERS_API_URL}/${user.id}`, {
          onboardingCompleted: true,
          financialData,
          level,
        }),
      );

      const updatedUser = {
        ...user,
        onboardingCompleted: true,
        financialData,
        level,
      };
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

  private calculateLevel(data: FinancialData): number {
    const signals = buildLevelSignals(data);
    const evaluation = evaluateFinancialLevel(signals);
    return evaluation.level;
  }
}
