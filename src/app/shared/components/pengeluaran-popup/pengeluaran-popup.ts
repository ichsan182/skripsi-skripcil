import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { ExpenseCategory } from '../../utils/expense-category';
import {
  CurrencyAmountLimitTier,
  MAX_CURRENCY_AMOUNT,
} from '../../../core/utils/format.utils';
import { InputField } from '../input-field/input-field';

export interface PengeluaranPopupSubmitPayload {
  amount: number;
  description: string;
  category: ExpenseCategory;
}

@Component({
  selector: 'app-pengeluaran-popup',
  standalone: true,
  imports: [CommonModule, InputField],
  templateUrl: './pengeluaran-popup.html',
  styleUrl: './pengeluaran-popup.css',
})
export class PengeluaranPopup implements OnChanges {
  @Input() isOpen = false;
  @Input() isSubmitting = false;
  @Input() saveError = '';
  @Input() amountLimitTier: CurrencyAmountLimitTier =
    CurrencyAmountLimitTier.ONE_BILLION;
  @Input() budgetLimit = 0;
  @Input() budgetUsed = 0;

  @Output() closeRequested = new EventEmitter<void>();
  @Output() submitRequested = new EventEmitter<PengeluaranPopupSubmitPayload>();

  readonly categoryLabels: Record<ExpenseCategory, string> = {
    [ExpenseCategory.Makanan]: 'Makanan & Minuman',
    [ExpenseCategory.Travel]: 'Transport & Perjalanan',
    [ExpenseCategory.Entertainment]: 'Hiburan & Rekreasi',
    [ExpenseCategory.Subscription]: 'Langganan',
    [ExpenseCategory.Bills]: 'Tagihan & Cicilan',
    [ExpenseCategory.Other]: 'Lainnya',
  };

  readonly categoryKeywords: Record<ExpenseCategory, string[]> = {
    [ExpenseCategory.Makanan]: [
      'makan',
      'restoran',
      'warung',
      'snack',
      'kopi',
      'grocery',
    ],
    [ExpenseCategory.Travel]: [
      'transport',
      'bensin',
      'parkir',
      'tol',
      'ojek',
      'taksi',
    ],
    [ExpenseCategory.Entertainment]: [
      'hiburan',
      'nonton',
      'game',
      'liburan',
      'gym',
      'hobi',
    ],
    [ExpenseCategory.Subscription]: [
      'netflix',
      'spotify',
      'langganan',
      'premium',
      'membership',
    ],
    [ExpenseCategory.Bills]: [
      'listrik',
      'air',
      'internet',
      'pulsa',
      'tagihan',
      'cicilan',
    ],
    [ExpenseCategory.Other]: ['lainnya'],
  };

  draft: {
    amount: number | null;
    description: string;
    category: ExpenseCategory | null;
    keyword: string;
  } = {
    amount: null,
    description: '',
    category: null,
    keyword: '',
  };

  amountDisplay = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen']?.currentValue && !changes['isOpen']?.previousValue) {
      this.resetDraft();
    }
  }

  get categoryOptions(): { value: ExpenseCategory; label: string }[] {
    return Object.values(ExpenseCategory).map((category) => ({
      value: category,
      label: this.categoryLabels[category],
    }));
  }

  get keywordOptions(): string[] {
    if (!this.draft.category) {
      return [];
    }
    return this.categoryKeywords[this.draft.category] ?? [];
  }

  get isSaveDisabled(): boolean {
    const amount = this.draft.amount;
    return (
      this.isSubmitting ||
      !amount ||
      amount <= 0 ||
      amount > MAX_CURRENCY_AMOUNT ||
      !this.draft.description.trim() ||
      !this.draft.category
    );
  }

  get projectedRemainingBudget(): number {
    if (!this.draft.amount) {
      return this.budgetLimit - this.budgetUsed;
    }
    return this.budgetLimit - this.budgetUsed - this.draft.amount;
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

  onDescriptionChange(value: string): void {
    this.draft.description = value;
  }

  onCategoryChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.draft.category = (select.value as ExpenseCategory) || null;
    this.draft.keyword = '';
  }

  onKeywordChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.draft.keyword = select.value;
    if (select.value && !this.draft.description.trim()) {
      this.draft.description =
        select.value.charAt(0).toUpperCase() + select.value.slice(1);
    }
  }

  onSubmit(): void {
    if (this.isSaveDisabled || !this.draft.amount || !this.draft.category) {
      return;
    }

    this.submitRequested.emit({
      amount: this.draft.amount,
      description: this.draft.description.trim(),
      category: this.draft.category,
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
    this.draft = {
      amount: null,
      description: '',
      category: null,
      keyword: '',
    };
    this.amountDisplay = '';
  }
}
