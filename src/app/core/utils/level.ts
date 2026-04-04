import { FinancialData } from '../services/journal.service';

export type FinancialLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface LevelSignals {
  monthlyIncome: number;
  averageMonthlyExpense: number;
  emergencyFund: number;
  savingsBalance: number;
  consumptiveDebtTotal: number;
  productiveDebtTotal: number;
  hasNewConsumptiveDebt: boolean;
  investmentAllocationRate: number;
  consecutiveInvestmentMonths: number;
  pausedInvestmentMonths: number;
  bigGoalDefined: boolean;
  bigGoalProgressPercent: number;
  hasMortgage: boolean;
  mortgageRemaining: number;
  passiveIncomeRatioToIncome: number;
  passiveIncomeRatioToNeeds: number;
  passiveIncomeConsistentMonths: number;
  netWorthDrawdownPercent: number;
  hasRoutineDonation: boolean;
}

export interface LevelEvaluation {
  level: FinancialLevel;
  title: string;
  focus: string;
  nextTarget: string;
  progressPercent: number;
  status: 'stable' | 'in-progress' | 'warning';
}

const LEVEL_META: Record<FinancialLevel, { title: string; focus: string }> = {
  1: {
    title: 'Pondasi Pertama',
    focus: 'Bentuk dana darurat mini Rp1.000.000.',
  },
  2: {
    title: 'Bersihkan Beban',
    focus: 'Lunasi hutang konsumtif tanpa menguras dana darurat mini.',
  },
  3: {
    title: 'Bangun Benteng Darurat',
    focus: 'Naikkan dana darurat hingga minimal 3 bulan pengeluaran.',
  },
  4: {
    title: 'Mulai Bekerja untuk Masa Depan',
    focus: 'Rutin alokasikan investasi minimal 15% dari pendapatan.',
  },
  5: {
    title: 'Tujuan Besar',
    focus: 'Capai minimal 20% progress tujuan finansial besar.',
  },
  6: {
    title: 'Bebaskan Diri dari Kewajiban Terbesar',
    focus: 'Lunasi KPR atau dorong passive income >= 30% pendapatan.',
  },
  7: {
    title: 'Kebebasan dan Dampak',
    focus: 'Jaga pertumbuhan net worth, passive income, dan donasi rutin.',
  },
};

export function buildLevelSignals(
  financialData: FinancialData | null,
): LevelSignals {
  const income = Math.max(0, financialData?.pendapatan ?? 0);
  const monthlyExpense = Math.max(
    0,
    financialData?.currentPengeluaranLimit ??
      financialData?.pengeluaranWajib ??
      0,
  );
  const emergencyFund = Math.max(0, financialData?.danaDarurat ?? 0);
  const savingsBalance = Math.max(0, financialData?.estimasiTabungan ?? 0);
  const consumptiveDebt = Math.max(0, financialData?.hutangWajib ?? 0);

  return {
    monthlyIncome: income,
    averageMonthlyExpense: monthlyExpense,
    emergencyFund,
    savingsBalance,
    consumptiveDebtTotal: consumptiveDebt,
    productiveDebtTotal: 0,
    hasNewConsumptiveDebt: consumptiveDebt > 0,
    investmentAllocationRate: 0,
    consecutiveInvestmentMonths: 0,
    pausedInvestmentMonths: 0,
    bigGoalDefined: false,
    bigGoalProgressPercent: 0,
    hasMortgage: false,
    mortgageRemaining: 0,
    passiveIncomeRatioToIncome: 0,
    passiveIncomeRatioToNeeds: 0,
    passiveIncomeConsistentMonths: 0,
    netWorthDrawdownPercent: 0,
    hasRoutineDonation: false,
  };
}

export function evaluateFinancialLevel(signals: LevelSignals): LevelEvaluation {
  const oneMonthExpense = Math.max(1, signals.averageMonthlyExpense);
  const threeMonthEmergency = oneMonthExpense * 3;
  const liquidAssets = signals.savingsBalance + signals.emergencyFund;

  // LEVEL 1
  if (signals.emergencyFund < 1_000_000) {
    return {
      level: 1,
      title: LEVEL_META[1].title,
      focus: LEVEL_META[1].focus,
      nextTarget: 'Kumpulkan dana darurat mini sampai Rp1.000.000.',
      progressPercent: toPercent(signals.emergencyFund / 1_000_000),
      status: 'in-progress',
    };
  }

  // LEVEL 2
  if (signals.consumptiveDebtTotal > 0) {
    const canStayLevel2 = signals.emergencyFund >= 500_000;
    return {
      level: canStayLevel2 ? 2 : 1,
      title: LEVEL_META[canStayLevel2 ? 2 : 1].title,
      focus: LEVEL_META[canStayLevel2 ? 2 : 1].focus,
      nextTarget: canStayLevel2
        ? 'Lunasi seluruh hutang konsumtif hingga nol.'
        : 'Isi ulang dana darurat mini minimal Rp500.000 sambil menahan hutang baru.',
      progressPercent: toInversePercent(
        signals.consumptiveDebtTotal,
        Math.max(1, signals.consumptiveDebtTotal + 1),
      ),
      status: canStayLevel2 ? 'in-progress' : 'warning',
    };
  }

  // LEVEL 3
  const meetsEmergencyFund = signals.emergencyFund >= threeMonthEmergency;
  if (!meetsEmergencyFund) {
    return {
      level: 3,
      title: LEVEL_META[3].title,
      focus: LEVEL_META[3].focus,
      nextTarget: `Capai dana darurat minimal 3x pengeluaran (${formatCompact(threeMonthEmergency)}).`,
      progressPercent: toPercent(signals.emergencyFund / threeMonthEmergency),
      status: 'in-progress',
    };
  }

  if (liquidAssets < oneMonthExpense && signals.hasNewConsumptiveDebt) {
    return {
      level: 2,
      title: LEVEL_META[2].title,
      focus: LEVEL_META[2].focus,
      nextTarget:
        'Pulihkan aset liquid ke >= 1 bulan pengeluaran dan hentikan hutang konsumtif baru.',
      progressPercent: toPercent(liquidAssets / oneMonthExpense),
      status: 'warning',
    };
  }

  // LEVEL 4
  const hasInvestmentRate = signals.investmentAllocationRate >= 15;
  const hasInvestmentStreak = signals.consecutiveInvestmentMonths >= 3;
  const emergencyAbove2Months = signals.emergencyFund >= oneMonthExpense * 2;
  if (!(hasInvestmentRate && hasInvestmentStreak && emergencyAbove2Months)) {
    return {
      level: 4,
      title: LEVEL_META[4].title,
      focus: LEVEL_META[4].focus,
      nextTarget:
        'Jaga alokasi investasi >=15% selama 3 bulan berturut-turut dan pertahankan dana darurat > 2 bulan pengeluaran.',
      progressPercent: Math.max(
        toPercent(signals.investmentAllocationRate / 15),
        toPercent(signals.consecutiveInvestmentMonths / 3),
      ),
      status: signals.pausedInvestmentMonths > 2 ? 'warning' : 'in-progress',
    };
  }

  if (signals.pausedInvestmentMonths > 2 || liquidAssets < oneMonthExpense) {
    return {
      level: 3,
      title: LEVEL_META[3].title,
      focus: LEVEL_META[3].focus,
      nextTarget: 'Pulihkan konsistensi investasi dan stabilkan aset liquid.',
      progressPercent: toPercent(liquidAssets / oneMonthExpense),
      status: 'warning',
    };
  }

  // LEVEL 5
  const level5Ready =
    signals.bigGoalDefined &&
    signals.bigGoalProgressPercent >= 20 &&
    hasInvestmentRate;
  if (!level5Ready) {
    return {
      level: 5,
      title: LEVEL_META[5].title,
      focus: LEVEL_META[5].focus,
      nextTarget:
        'Definisikan tujuan besar dan capai minimal 20% progress target.',
      progressPercent: toPercent(signals.bigGoalProgressPercent / 20),
      status: 'in-progress',
    };
  }

  // LEVEL 6
  const level6Ready = signals.hasMortgage
    ? signals.mortgageRemaining <= 0
    : signals.passiveIncomeRatioToIncome >= 30 &&
      signals.passiveIncomeConsistentMonths >= 3;

  if (!level6Ready) {
    return {
      level: 6,
      title: LEVEL_META[6].title,
      focus: LEVEL_META[6].focus,
      nextTarget: signals.hasMortgage
        ? 'Fokus percepat pelunasan KPR.'
        : 'Tingkatkan passive income hingga >=30% pendapatan selama 3 bulan konsisten.',
      progressPercent: signals.hasMortgage
        ? toInversePercent(
            signals.mortgageRemaining,
            Math.max(1, signals.mortgageRemaining + 1),
          )
        : toPercent(signals.passiveIncomeRatioToIncome / 30),
      status: 'in-progress',
    };
  }

  // LEVEL 7
  const isLevel7Stable =
    signals.passiveIncomeRatioToNeeds >= 50 &&
    signals.hasRoutineDonation &&
    signals.netWorthDrawdownPercent < 40;

  if (!isLevel7Stable) {
    return {
      level: 7,
      title: LEVEL_META[7].title,
      focus: LEVEL_META[7].focus,
      nextTarget: 'Jaga passive income >=50% kebutuhan dan catat donasi rutin.',
      progressPercent: toPercent(signals.passiveIncomeRatioToNeeds / 50),
      status: 'in-progress',
    };
  }

  if (
    signals.netWorthDrawdownPercent > 40 ||
    signals.passiveIncomeRatioToNeeds < 20
  ) {
    return {
      level: 6,
      title: LEVEL_META[6].title,
      focus: LEVEL_META[6].focus,
      nextTarget: 'Pulihkan net worth dan stabilkan passive income.',
      progressPercent: 35,
      status: 'warning',
    };
  }

  return {
    level: 7,
    title: LEVEL_META[7].title,
    focus: LEVEL_META[7].focus,
    nextTarget: 'Pertahankan sistem keuangan yang sehat dan berdampak.',
    progressPercent: 100,
    status: 'stable',
  };
}

function toPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(value * 100)));
}

function toInversePercent(value: number, maxValue: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(maxValue) || maxValue <= 0) {
    return 0;
  }

  const ratio = 1 - value / maxValue;
  return Math.max(0, Math.min(100, Math.round(ratio * 100)));
}

function formatCompact(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(Math.max(0, value));
}
