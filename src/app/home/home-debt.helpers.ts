/**
 * Pure helper functions for debt-related computation in the Home dashboard.
 * None of these functions access component state — all inputs are passed explicitly.
 */

import { formatCurrency as formatRupiahUtil } from '../core/utils/format.utils';
import { startOfDay } from './home-date.helpers';
import {
  DebtCardModes,
  DebtCardState,
  DebtCategories,
  DebtCategory,
  DebtChangeDirection,
  DebtItemSnapshot,
  DebtMonthlySnapshot,
} from './home.models';

// ─── Low-level numeric / day utilities ───────────────────────────────────────

export function toPositiveInt(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.round(parsed);
}

export function normalizeDueDay(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.min(31, Math.floor(parsed)));
}

export function resolveDayInMonth(
  year: number,
  monthIndex: number,
  intendedDay: number,
): number {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return Math.min(Math.max(1, intendedDay), lastDay);
}

// ─── Debt normalization ───────────────────────────────────────────────────────

export function normalizeSingleDebt(raw: unknown): DebtItemSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<DebtItemSnapshot> & {
    dueDate?: unknown;
    status?: unknown;
  };
  return {
    id: (value.id || `${Date.now()}`) as string,
    name: String(value.name || 'Hutang').trim(),
    category: value.category === DebtCategories.PRODUKTIF ? DebtCategories.PRODUKTIF : DebtCategories.KONSUMTIF,
    remainingAmount: toPositiveInt(value.remainingAmount),
    monthlyInstallment: toPositiveInt(value.monthlyInstallment),
    dueDay: normalizeDueDay(value.dueDay),
    dueDate: typeof value.dueDate === 'string' ? value.dueDate : '',
    status: typeof value.status === 'string' ? value.status : '',
  };
}

export function normalizeDebts(rawDebts: unknown): DebtItemSnapshot[] {
  if (!Array.isArray(rawDebts)) return [];
  return rawDebts
    .map((item) => normalizeSingleDebt(item))
    .filter((item): item is DebtItemSnapshot => Boolean(item));
}

export function computeDebtSummaryFromRawDebts(
  rawDebts: unknown,
): { totalPrincipalAmount: number; totalRemainingAmount: number } | undefined {
  if (!Array.isArray(rawDebts) || !rawDebts.length) return undefined;
  const konsumtif = rawDebts.filter(
    (d) =>
      d &&
      typeof d === 'object' &&
      (d as Record<string, unknown>)['category'] === DebtCategories.KONSUMTIF,
  );
  if (!konsumtif.length) return undefined;
  const totalPrincipalAmount = konsumtif.reduce(
    (sum, d) =>
      sum +
      Math.max(
        0,
        Number((d as Record<string, unknown>)['principalAmount']) || 0,
      ),
    0,
  );
  const totalRemainingAmount = konsumtif.reduce(
    (sum, d) =>
      sum +
      Math.max(
        0,
        Number((d as Record<string, unknown>)['remainingAmount']) || 0,
      ),
    0,
  );
  if (totalPrincipalAmount <= 0) return undefined;
  return { totalPrincipalAmount, totalRemainingAmount };
}

export function buildLegacyConsumptiveDebt(
  amount: number,
  dueDay: number,
): DebtItemSnapshot {
  return {
    id: 'legacy-consumptive-debt',
    name: 'Hutang Konsumtif',
    category: DebtCategories.KONSUMTIF,
    remainingAmount: Math.max(0, Math.round(amount)),
    monthlyInstallment: Math.max(1, Math.round(amount * 0.1)),
    dueDay,
    dueDate: '',
    status: 'aktif',
  };
}

// ─── Active-debt queries ──────────────────────────────────────────────────────

export function isDebtActive(item: DebtItemSnapshot): boolean {
  if (item.remainingAmount <= 0) return false;
  const normalizedStatus = item.status.trim().toLowerCase();
  return (
    normalizedStatus !== 'lunas' &&
    normalizedStatus !== 'paid' &&
    normalizedStatus !== 'settled'
  );
}

export function getActiveDebtsByCategory(
  debts: DebtItemSnapshot[],
  category: DebtCategory,
): DebtItemSnapshot[] {
  return debts.filter(
    (item) => item.category === category && isDebtActive(item),
  );
}

export function sumDebtRemaining(items: DebtItemSnapshot[]): number {
  return items.reduce((sum, item) => sum + item.remainingAmount, 0);
}

// ─── Due-date resolution ──────────────────────────────────────────────────────

export function resolveDebtDueDate(
  item: DebtItemSnapshot,
  reference: Date,
): Date {
  if (item.dueDate) {
    const parsed = new Date(item.dueDate);
    if (!Number.isNaN(parsed.getTime())) return startOfDay(parsed);
  }
  const year = reference.getFullYear();
  const month = reference.getMonth();
  const dayThisMonth = resolveDayInMonth(year, month, item.dueDay);
  const dueThisMonth = startOfDay(new Date(year, month, dayThisMonth));
  if (dueThisMonth >= reference) return dueThisMonth;
  const nextMonth = new Date(year, month + 1, 1);
  const dayNextMonth = resolveDayInMonth(
    nextMonth.getFullYear(),
    nextMonth.getMonth(),
    item.dueDay,
  );
  return startOfDay(
    new Date(nextMonth.getFullYear(), nextMonth.getMonth(), dayNextMonth),
  );
}

export function findMostUrgentDebt(
  debts: DebtItemSnapshot[],
  today: Date,
): DebtItemSnapshot | null {
  if (!debts.length) return null;
  const sorted = [...debts].sort((a, b) => {
    const aDue = resolveDebtDueDate(a, today).getTime();
    const bDue = resolveDebtDueDate(b, today).getTime();
    if (aDue !== bDue) return aDue - bDue;
    return b.remainingAmount - a.remainingAmount;
  });
  return sorted[0] ?? null;
}

// ─── Payoff estimation ────────────────────────────────────────────────────────

export function buildProductivePayoffLabel(
  debts: DebtItemSnapshot[],
  today: Date,
): string {
  const totalRemaining = sumDebtRemaining(debts);
  const totalInstallment = debts.reduce(
    (sum, item) => sum + Math.max(0, item.monthlyInstallment),
    0,
  );
  if (totalRemaining <= 0 || totalInstallment <= 0) return '-';
  const months = Math.ceil(totalRemaining / totalInstallment);
  const projected = new Date(today);
  projected.setMonth(projected.getMonth() + months);
  return `${months} bulan (~${projected.toLocaleDateString('id-ID', {
    month: 'long',
    year: 'numeric',
  })})`;
}

// ─── Debt card state builder ──────────────────────────────────────────────────

/**
 * Derives the full DebtCardState from the given debt list and previous-month
 * snapshot (used for the change-percent/direction indicator).
 * Pass `null` for `previousMonthSnapshot` when no prior data is available.
 */
export function computeDebtCardState(
  debts: DebtItemSnapshot[],
  previousMonthSnapshot: DebtMonthlySnapshot | null,
  today: Date,
): DebtCardState {
  const consumptiveActive = getActiveDebtsByCategory(debts, DebtCategories.KONSUMTIF);
  const productiveActive = getActiveDebtsByCategory(debts, DebtCategories.PRODUKTIF);
  const consumptiveTotal = sumDebtRemaining(consumptiveActive);
  const productiveTotal = sumDebtRemaining(productiveActive);

  if (consumptiveActive.length > 0) {
    const urgent = findMostUrgentDebt(consumptiveActive, today);
    const prevConsumptive = previousMonthSnapshot?.consumptiveActiveTotal ?? 0;
    return {
      mode: DebtCardModes.CONSUMPTIVE,
      total: consumptiveTotal,
      activeCount: consumptiveActive.length,
      changePercent: computeChangePercent(consumptiveTotal, prevConsumptive),
      changeDirection: computeChangeDirection(
        consumptiveTotal,
        prevConsumptive,
      ),
      urgentLine: urgent
        ? `Paling mendesak: ${urgent.name} jatuh tempo ${resolveDebtDueDate(urgent, today).toLocaleDateString('id-ID', { day: 'numeric', month: 'long' })} (${formatRupiahUtil(urgent.remainingAmount)}).`
        : 'Masih ada hutang konsumtif aktif yang perlu diprioritaskan.',
      payoffLabel: '',
    };
  }

  if (productiveActive.length > 0) {
    const prevProductive = previousMonthSnapshot?.productiveActiveTotal ?? 0;
    return {
      mode: DebtCardModes.PRODUCTIVE,
      total: productiveTotal,
      activeCount: productiveActive.length,
      changePercent: computeChangePercent(productiveTotal, prevProductive),
      changeDirection: computeChangeDirection(productiveTotal, prevProductive),
      urgentLine: '',
      payoffLabel: buildProductivePayoffLabel(productiveActive, today),
    };
  }

  return {
    mode: DebtCardModes.CLEAR,
    total: 0,
    activeCount: 0,
    changePercent: null,
    changeDirection: null,
    urgentLine: '',
    payoffLabel: '',
  };
}

function computeChangePercent(
  currentTotal: number,
  previousTotal: number,
): number | null {
  if (previousTotal <= 0 || previousTotal === currentTotal) return null;
  const deltaPercent = Math.round(
    (Math.abs(currentTotal - previousTotal) / previousTotal) * 100,
  );
  return deltaPercent > 0 ? deltaPercent : null;
}

function computeChangeDirection(
  currentTotal: number,
  previousTotal: number,
): DebtChangeDirection | null {
  if (previousTotal <= 0 || previousTotal === currentTotal) return null;
  return currentTotal > previousTotal ? 'up' : 'down';
}
