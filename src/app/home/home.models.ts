import { ExpenseCategory } from '../shared/utils/expense-category';

export interface ExpenseRow {
  date: string;
  amount: string;
  description: string;
  categoryLabel: ExpenseCategory;
  categoryClass: string;
  day: number;
}

export type DebtCategory = 'konsumtif' | 'produktif';
export type DebtCardMode = 'consumptive' | 'productive' | 'clear';
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
