import { FinancialData } from '../services/journal.service';
import { buildLevelSignals, evaluateFinancialLevel } from './level';

describe('level utilities', () => {
  function createFinancialData(
    overrides: Partial<FinancialData> = {},
  ): FinancialData {
    return {
      pendapatan: 10_000_000,
      pengeluaranWajib: 2_000_000,
      tanggalPemasukan: 1,
      hutangWajib: 0,
      estimasiTabungan: 2_000_000,
      danaDarurat: 8_000_000,
      currentPengeluaranLimit: 2_000_000,
      currentCycleStart: '2026-04-01',
      ...overrides,
    };
  }

  it('calculates investment rate from current cycle allocation against income', () => {
    const financialData = createFinancialData({
      investmentTracking: {
        cycleAmounts: {
          '2026-04-01': 1_500_000,
        },
      },
    });

    const signals = buildLevelSignals(financialData);

    expect(signals.investmentAllocationRate).toBe(15);
    expect(signals.consecutiveInvestmentMonths).toBe(1);
  });

  it('shows 33% progress after the first qualifying investment cycle', () => {
    const financialData = createFinancialData({
      investmentTracking: {
        cycleAmounts: {
          '2026-04-01': 1_500_000,
        },
      },
    });

    const evaluation = evaluateFinancialLevel(buildLevelSignals(financialData));

    expect(evaluation.level).toBe(4);
    expect(evaluation.progressPercent).toBe(33);
  });

  it('increases progress to 67% on the second consecutive qualifying cycle', () => {
    const financialData = createFinancialData({
      investmentTracking: {
        cycleAmounts: {
          '2026-03-01': 1_500_000,
          '2026-04-01': 1_500_000,
        },
      },
    });

    const evaluation = evaluateFinancialLevel(buildLevelSignals(financialData));

    expect(evaluation.level).toBe(4);
    expect(evaluation.progressPercent).toBe(67);
  });

  it('keeps progress at 67% right after reset when current cycle has no input yet', () => {
    const financialData = createFinancialData({
      currentCycleStart: '2026-05-01',
      investmentTracking: {
        cycleAmounts: {
          '2026-03-01': 1_500_000,
          '2026-04-01': 1_500_000,
        },
      },
    });

    const evaluation = evaluateFinancialLevel(buildLevelSignals(financialData));

    expect(evaluation.level).toBe(4);
    expect(evaluation.progressPercent).toBe(67);
  });
});
