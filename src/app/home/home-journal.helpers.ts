/**
 * Pure helper functions for journal queries and expense display in the Home dashboard.
 * None of these functions access component state — all inputs are passed explicitly.
 */

import { formatCurrency as formatRupiahUtil } from '../core/utils/format.utils';
import { UserJournal } from '../core/services/journal.service';
import { ExpenseCategory } from '../shared/utils/expense-category';
import { parseDateKey, toDateKey } from './home-date.helpers';
import { ExpenseRow } from './home.models';

// ─── Journal queries ──────────────────────────────────────────────────────────

export function getTotalExpenseByDate(journal: UserJournal, date: Date): number {
  const key = toDateKey(date);
  const expenses = journal.expensesByDate[key] || [];
  return expenses.reduce((sum, item) => sum + item.amount, 0);
}

export function getTotalEntryCountByDate(journal: UserJournal, date: Date): number {
  const key = toDateKey(date);
  const expenses = journal.expensesByDate[key]?.length || 0;
  const incomes = journal.incomesByDate[key]?.length || 0;
  return expenses + incomes;
}

export function sumExpensesInRange(
  journal: UserJournal,
  start: Date,
  end: Date,
): number {
  if (end < start) return 0;
  let total = 0;
  for (const [dateKey, expenses] of Object.entries(journal.expensesByDate)) {
    const date = parseDateKey(dateKey);
    if (!date) continue;
    if (date >= start && date <= end) {
      total += expenses.reduce((sum, item) => sum + item.amount, 0);
    }
  }
  return total;
}

export function getFirstRecordDate(journal: UserJournal): Date | null {
  const dateKeys = new Set<string>();
  for (const [key, entries] of Object.entries(journal.expensesByDate)) {
    if (entries.length > 0) dateKeys.add(key);
  }
  for (const [key, entries] of Object.entries(journal.incomesByDate)) {
    if (entries.length > 0) dateKeys.add(key);
  }
  let earliest: Date | null = null;
  for (const key of dateKeys) {
    const parsed = parseDateKey(key);
    if (!parsed) continue;
    if (!earliest || parsed < earliest) earliest = parsed;
  }
  return earliest;
}

// ─── Display helpers ──────────────────────────────────────────────────────────

export function getCategoryClass(category: ExpenseCategory): string {
  if (category === ExpenseCategory.Makanan) return 'category-makanan';
  if (category === ExpenseCategory.Travel) return 'category-travel';
  if (category === ExpenseCategory.Entertainment) return 'category-entertainment';
  if (category === ExpenseCategory.Subscription) return 'category-subscription';
  if (category === ExpenseCategory.Bills) return 'category-bills';
  return 'category-other';
}

export function buildMonthlyExpenseRows(
  journal: UserJournal,
  year: number,
  monthIndex: number,
  monthNames: string[],
): ExpenseRow[] {
  const rows: ExpenseRow[] = [];
  for (const [dateKey, expenses] of Object.entries(journal.expensesByDate)) {
    const [yearRaw, monthRaw, dayRaw] = dateKey.split('-');
    const y = Number(yearRaw);
    const m = Number(monthRaw) - 1;
    const d = Number(dayRaw);
    if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d) || y !== year || m !== monthIndex) {
      continue;
    }
    for (const expense of expenses) {
      rows.push({
        day: d,
        date: `${String(d).padStart(2, '0')} ${monthNames[monthIndex]} ${year}`,
        amount: formatRupiahUtil(expense.amount),
        description: expense.description,
        categoryLabel: expense.category,
        categoryClass: getCategoryClass(expense.category),
      });
    }
  }
  return rows.sort((a, b) => a.day - b.day);
}
