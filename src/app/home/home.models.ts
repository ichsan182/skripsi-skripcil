import { ExpenseCategory } from '../shared/utils/expense-category';

export interface ExpenseRow {
  date: string;
  amount: string;
  description: string;
  categoryLabel: ExpenseCategory;
  categoryClass: string;
  day: number;
}

export type SavingsField = 'tabungan' | 'danaDarurat' | 'danaInvestasi';
export const SavingsFields = {
  TABUNGAN: 'tabungan',
  DANA_DARURAT: 'danaDarurat',
  DANA_INVESTASI: 'danaInvestasi',
} as const satisfies Record<string, SavingsField>;
export const ALL_SAVINGS_FIELDS: readonly SavingsField[] = [
  SavingsFields.TABUNGAN,
  SavingsFields.DANA_DARURAT,
  SavingsFields.DANA_INVESTASI,
];

export type BudgetField = 'pengeluaran' | 'wants' | 'savings';
export const BudgetFields = {
  PENGELUARAN: 'pengeluaran',
  WANTS: 'wants',
  SAVINGS: 'savings',
} as const satisfies Record<string, BudgetField>;
export const ALL_BUDGET_FIELDS: readonly BudgetField[] = [
  BudgetFields.PENGELUARAN,
  BudgetFields.WANTS,
  BudgetFields.SAVINGS,
];

export type NoExpensePolicy = 'allow-no-expense' | 'require-entry';
export const NoExpensePolicies = {
  ALLOW: 'allow-no-expense',
  REQUIRE: 'require-entry',
} as const satisfies Record<string, NoExpensePolicy>;

export type DebtCategory = 'konsumtif' | 'produktif';
export const DebtCategories = {
  KONSUMTIF: 'konsumtif',
  PRODUKTIF: 'produktif',
} as const satisfies Record<string, DebtCategory>;

export type DebtCardMode = 'consumptive' | 'productive' | 'clear';
export const DebtCardModes = {
  CONSUMPTIVE: 'consumptive',
  PRODUCTIVE: 'productive',
  CLEAR: 'clear',
} as const satisfies Record<string, DebtCardMode>;

export type DebtChangeDirection = 'up' | 'down';

export interface DebtItemSnapshot {
  id: string;
  name: string;
  category: DebtCategory;
  remainingAmount: number;
  monthlyInstallment: number;
  dueDay: number;
  dueDate: string;
  status: string;
}

export interface DebtMonthlySnapshot {
  consumptiveActiveTotal: number;
  productiveActiveTotal: number;
}

export interface DebtCardState {
  mode: DebtCardMode;
  total: number;
  activeCount: number;
  changePercent: number | null;
  changeDirection: DebtChangeDirection | null;
  urgentLine: string;
  payoffLabel: string;
}
