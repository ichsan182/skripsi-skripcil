import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import {
  CurrencyAmountLimitTier,
  formatCurrencyPlain,
  formatCurrencyWithPrefix,
  parseCurrencyInput,
  resolveCurrencyAmountLimit,
} from '../../../core/utils/format.utils';

type InputFieldStyleVariant = 'default' | 'prefix';
type InputFieldAlign = 'left' | 'right';

@Component({
  selector: 'app-input-field',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './input-field.html',
  styleUrl: './input-field.css',
})
export class InputField {
  @Input() label = '';
  @Input() value = '';
  @Input() type: 'text' | 'number' | 'email' | 'password' | 'date' = 'text';
  @Input() placeholder = '';
  @Input() inputmode: 'text' | 'decimal' | 'numeric' | 'email' | 'tel' = 'text';
  @Input() maxlength?: number;

  @Input() min?: number;
  @Input() max?: number;
  @Input() step?: number;
  @Input() disabled = false;
  @Input() readonly = false;
  @Input() required = false;

  @Input() styleVariant: InputFieldStyleVariant = 'default';
  @Input() inputAlign: InputFieldAlign = 'left';
  @Input() showPrefix = false;
  @Input() prefix = 'Rp';
  @Input() showInlineCurrencyPrefix = false;
  @Input() allowZeroValue = false;

  @Input() isCurrency = false;
  @Input() currencyMaxTier: CurrencyAmountLimitTier =
    CurrencyAmountLimitTier.TEN_BILLION;

  @Output() valueChange = new EventEmitter<string>();
  @Output() currencyValueChange = new EventEmitter<number>();
  @Output() currencyStateChange = new EventEmitter<{
    value: number;
    formattedValue: string;
    exceededMax: boolean;
  }>();
  @Output() numberValueChange = new EventEmitter<number>();

  protected get wrapperClassName(): string {
    return `input-field input-field--${this.styleVariant}`;
  }

  protected onInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const nextRawValue = input.value ?? '';

    if (this.isCurrency) {
      const maxCurrencyAmount = resolveCurrencyAmountLimit(
        this.currencyMaxTier,
      );
      const normalizedDigits = this.normalizeCurrencyDigits(nextRawValue);
      const rawNumericValue = this.extractNumericValue(normalizedDigits);
      const parsedCurrencyAmount = parseCurrencyInput(
        normalizedDigits,
        maxCurrencyAmount,
      );
      const zeroValueWasTyped = normalizedDigits === '0';
      const formattedValue = this.formatCurrencyDisplayValue(
        parsedCurrencyAmount,
        this.allowZeroValue && zeroValueWasTyped,
      );
      const exceededMax = rawNumericValue > maxCurrencyAmount;

      this.value = formattedValue;
      input.value = formattedValue;
      this.valueChange.emit(formattedValue);
      this.currencyValueChange.emit(parsedCurrencyAmount);
      this.currencyStateChange.emit({
        value: parsedCurrencyAmount,
        formattedValue,
        exceededMax,
      });
      return;
    }

    this.value = nextRawValue;
    this.valueChange.emit(nextRawValue);

    if (this.type === 'number') {
      const parsed = Number(nextRawValue);
      this.numberValueChange.emit(Number.isFinite(parsed) ? parsed : 0);
    }
  }

  private extractNumericValue(rawValue: string): number {
    const digitsOnly = (rawValue || '').replace(/[^0-9]/g, '');
    if (!digitsOnly) {
      return 0;
    }

    const parsed = Number(digitsOnly);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private normalizeCurrencyDigits(rawValue: string): string {
    const digitsOnly = (rawValue || '').replace(/[^0-9]/g, '');
    if (!digitsOnly) {
      return '';
    }

    const normalized = digitsOnly.replace(/^0+(?=\d)/, '');
    const allZero = /^0+$/.test(normalized);
    return allZero ? '0' : normalized;
  }

  private formatCurrencyDisplayValue(
    value: number,
    preserveZero: boolean,
  ): string {
    if (!value && !preserveZero) {
      return '';
    }

    if (!this.showInlineCurrencyPrefix) {
      return formatCurrencyPlain(value);
    }

    const normalizedPrefix = this.prefix.trim();
    const inlinePrefix = normalizedPrefix ? `${normalizedPrefix} ` : '';
    return formatCurrencyWithPrefix(value, inlinePrefix);
  }
}
