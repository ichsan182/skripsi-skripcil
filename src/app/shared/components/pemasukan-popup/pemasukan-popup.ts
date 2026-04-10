import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { IncomeEntry } from '../../../core/services/journal.service';
import {
  CurrencyAmountLimitTier,
  MAX_CURRENCY_AMOUNT,
} from '../../../core/utils/format.utils';
import { InputField } from '../input-field/input-field';

export interface PemasukanPopupSubmitPayload extends IncomeEntry {}

@Component({
  selector: 'app-pemasukan-popup',
  standalone: true,
  imports: [CommonModule, InputField],
  templateUrl: './pemasukan-popup.html',
  styleUrl: './pemasukan-popup.css',
})
export class PemasukanPopup implements OnChanges {
  @Input() isOpen = false;
  @Input() isSubmitting = false;
  @Input() currentSaldoAmount = 0;
  @Input() amountLimitTier: CurrencyAmountLimitTier =
    CurrencyAmountLimitTier.ONE_BILLION;

  @Output() closeRequested = new EventEmitter<void>();
  @Output() submitRequested = new EventEmitter<PemasukanPopupSubmitPayload>();

  draft: { amount: number | null; description: string; source: string } = {
    amount: null,
    description: '',
    source: '',
  };
  amountDisplay = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen']?.currentValue && !changes['isOpen']?.previousValue) {
      this.resetDraft();
    }
  }

  get isSaveDisabled(): boolean {
    const amount = this.draft.amount;
    return (
      this.isSubmitting ||
      !amount ||
      amount <= 0 ||
      amount > MAX_CURRENCY_AMOUNT ||
      !this.draft.description.trim()
    );
  }

  get projectedSaldoAmount(): number {
    return this.currentSaldoAmount + (this.draft.amount || 0);
  }

  onClose(): void {
    if (this.isSubmitting) {
      return;
    }
    this.closeRequested.emit();
  }

  onAmountChange(value: number): void {
    this.draft.amount = value > 0 ? value : null;
  }

  onDraftValueChange(field: 'description' | 'source', value: string): void {
    this.draft[field] = value;
  }

  onSubmit(): void {
    if (this.isSaveDisabled || !this.draft.amount) {
      return;
    }

    this.submitRequested.emit({
      amount: this.draft.amount,
      description: this.draft.description.trim(),
      source: this.draft.source.trim(),
    });
  }

  formatRupiah(amount: number): string {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  private resetDraft(): void {
    this.draft = { amount: null, description: '', source: '' };
    this.amountDisplay = '';
  }
}
