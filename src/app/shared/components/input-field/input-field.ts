import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
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
export class InputField implements OnChanges {
  @ViewChild('nativeInput')
  private readonly nativeInput?: ElementRef<HTMLInputElement>;
  @Input() label = '';
  @Input() value = '';
  @Input() type: 'text' | 'number' | 'email' | 'password' | 'date' = 'text';
  @Input() placeholder = '';
  @Input() inputmode: 'text' | 'decimal' | 'numeric' | 'email' | 'tel' = 'text';
  @Input() maxlength?: number;

  @Input() min?: number; // ada g befungsi
  @Input() max?: number; // ada g befungsi
  @Input() step?: number; // ada g befungsi
  @Input() disabled = false; // ada g befungsi
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

  /**
   * When the parent externally changes `value` (e.g. after clamping or sync),
   * Angular's template binding alone sometimes misses the update because
   * onInput() already mutated the @Input. Directly writing the native element
   * mirrors what home.ts does: `input.value = String(value)` after clamping.
   */
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['value'] && !changes['value'].firstChange) {
      const incoming = (changes['value'].currentValue as string) ?? '';
      const native = this.nativeInput?.nativeElement;
      if (native && native.value !== incoming) {
        native.value = incoming;
      }
    }
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
