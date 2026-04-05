import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import {
  CurrencyAmountLimitTier,
  formatCurrencyInputValue,
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
      const state = formatCurrencyInputValue(nextRawValue, {
        maxAmount: maxCurrencyAmount,
        allowZeroValue: this.allowZeroValue,
        includePrefix: this.showInlineCurrencyPrefix,
        prefix: this.prefix,
      });

      this.value = state.formattedValue;
      input.value = state.formattedValue;
      this.valueChange.emit(state.formattedValue);
      this.currencyValueChange.emit(state.value);
      this.currencyStateChange.emit({
        value: state.value,
        formattedValue: state.formattedValue,
        exceededMax: state.exceededMax,
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
}
