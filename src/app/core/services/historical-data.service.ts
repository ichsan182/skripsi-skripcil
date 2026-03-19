import { Injectable } from '@angular/core';

export interface AssetOption {
  id: string;
  name: string;
  symbol: string;
  category: 'crypto' | 'stock' | 'commodity';
}

export interface HistoricalDataPoint {
  date: Date;
  price: number;
  timestamp: number;
}

export interface AssetHistoricalData {
  asset: AssetOption;
  currency: 'usd' | 'idr';
  data: HistoricalDataPoint[];
  startDate: Date;
  endDate: Date;
}

export interface CalculationResult {
  startValue: number;
  endValue: number;
  totalReturn: number;
  percentageReturn: number;
  annualizedReturn: number;
  investmentDays: number;
  investmentYears: number;
}

@Injectable({
  providedIn: 'root',
})
export class HistoricalDataService {
  private readonly CACHE_PREFIX = 'asset_historical_';
  private readonly CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

  readonly AVAILABLE_ASSETS: AssetOption[] = [
    {
      id: 'bitcoin',
      name: 'Bitcoin',
      symbol: 'BTC',
      category: 'crypto',
    },
    {
      id: 'ethereum',
      name: 'Ethereum',
      symbol: 'ETH',
      category: 'crypto',
    },
    {
      id: 'gold',
      name: 'Gold (Emas)',
      symbol: 'XAU',
      category: 'commodity',
    },
    {
      id: 'silver',
      name: 'Silver (Perak)',
      symbol: 'XAG',
      category: 'commodity',
    },
    {
      id: 'sp500',
      name: 'S&P 500',
      symbol: '^GSPC',
      category: 'stock',
    },
    {
      id: 'nasdaq',
      name: 'NASDAQ-100',
      symbol: '^NDX',
      category: 'stock',
    },
  ];

  // Realistic mock data based on historical trends (2020-2026)
  private mockData: Record<string, { price: number; date: string }[]> = {
    bitcoin: [
      { date: '2020-01-01', price: 9380 },
      { date: '2020-06-01', price: 9320 },
      { date: '2020-12-31', price: 28949 },
      { date: '2021-06-01', price: 31722 },
      { date: '2021-12-31', price: 46306 },
      { date: '2022-06-01', price: 20650 },
      { date: '2022-12-31', price: 16550 },
      { date: '2023-06-01', price: 25400 },
      { date: '2023-12-31', price: 42272 },
      { date: '2024-06-01', price: 63456 },
      { date: '2024-12-31', price: 99890 },
      { date: '2025-06-01', price: 85650 },
      { date: '2026-03-19', price: 105320 },
    ],
    ethereum: [
      { date: '2020-01-01', price: 130 },
      { date: '2020-06-01', price: 228 },
      { date: '2020-12-31', price: 738 },
      { date: '2021-06-01', price: 1895 },
      { date: '2021-12-31', price: 3061 },
      { date: '2022-06-01', price: 1050 },
      { date: '2022-12-31', price: 1196 },
      { date: '2023-06-01', price: 1840 },
      { date: '2023-12-31', price: 2273 },
      { date: '2024-06-01', price: 3850 },
      { date: '2024-12-31', price: 3540 },
      { date: '2025-06-01', price: 3120 },
      { date: '2026-03-19', price: 3680 },
    ],
    gold: [
      { date: '2020-01-01', price: 1771 },
      { date: '2020-06-01', price: 1791 },
      { date: '2020-12-31', price: 1769 },
      { date: '2021-06-01', price: 1784 },
      { date: '2021-12-31', price: 1799 },
      { date: '2022-06-01', price: 1800 },
      { date: '2022-12-31', price: 1920 },
      { date: '2023-06-01', price: 1965 },
      { date: '2023-12-31', price: 2076 },
      { date: '2024-06-01', price: 2430 },
      { date: '2024-12-31', price: 2783 },
      { date: '2025-06-01', price: 2650 },
      { date: '2026-03-19', price: 2895 },
    ],
    silver: [
      { date: '2020-01-01', price: 18.22 },
      { date: '2020-06-01', price: 17.45 },
      { date: '2020-12-31', price: 26.53 },
      { date: '2021-06-01', price: 26.02 },
      { date: '2021-12-31', price: 23.66 },
      { date: '2022-06-01', price: 19.92 },
      { date: '2022-12-31', price: 19.39 },
      { date: '2023-06-01', price: 24.63 },
      { date: '2023-12-31', price: 29.93 },
      { date: '2024-06-01', price: 32.65 },
      { date: '2024-12-31', price: 35.80 },
      { date: '2025-06-01', price: 33.45 },
      { date: '2026-03-19', price: 37.22 },
    ],
    sp500: [
      { date: '2020-01-01', price: 3258.71 },
      { date: '2020-06-01', price: 3100.29 },
      { date: '2020-12-31', price: 3756.07 },
      { date: '2021-06-01', price: 4211.47 },
      { date: '2021-12-31', price: 4766.18 },
      { date: '2022-06-01', price: 3785.38 },
      { date: '2022-12-31', price: 3839.50 },
      { date: '2023-06-01', price: 4288.05 },
      { date: '2023-12-31', price: 4769.83 },
      { date: '2024-06-01', price: 5460.48 },
      { date: '2024-12-31', price: 5878.44 },
      { date: '2025-06-01', price: 5650.23 },
      { date: '2026-03-19', price: 5950.75 },
    ],
    nasdaq: [
      { date: '2020-01-01', price: 9838.37 },
      { date: '2020-06-01', price: 10058.27 },
      { date: '2020-12-31', price: 12888.13 },
      { date: '2021-06-01', price: 14503.92 },
      { date: '2021-12-31', price: 15644.97 },
      { date: '2022-06-01', price: 11099.15 },
      { date: '2022-12-31', price: 10088.96 },
      { date: '2023-06-01', price: 13366.02 },
      { date: '2023-12-31', price: 16561.29 },
      { date: '2024-06-01', price: 18942.18 },
      { date: '2024-12-31', price: 21589.35 },
      { date: '2025-06-01', price: 20650.89 },
      { date: '2026-03-19', price: 22450.50 },
    ],
  };

  constructor() {}

  async getHistoricalData(
    asset: AssetOption,
    startDate: Date,
    endDate: Date,
    currency: 'usd' | 'idr' = 'usd',
  ): Promise<AssetHistoricalData> {
    const cacheKey = `${this.CACHE_PREFIX}${asset.id}_${currency}_${startDate.getTime()}_${endDate.getTime()}`;

    // Check cache
    const cached = this.getCachedData(cacheKey);
    if (cached) {
      return cached;
    }

    // Generate interpolated data from mock keypoints
    const data = this.generateInterpolatedData(
      asset.id,
      startDate,
      endDate,
      currency,
    );

    const result: AssetHistoricalData = {
      asset,
      currency,
      data: data.sort((a, b) => a.timestamp - b.timestamp),
      startDate,
      endDate,
    };

    // Cache result
    this.setCachedData(cacheKey, result);

    return result;
  }

  private generateInterpolatedData(
    assetId: string,
    startDate: Date,
    endDate: Date,
    currency: 'usd' | 'idr',
  ): HistoricalDataPoint[] {
    const mockKeypoints = this.mockData[assetId];
    if (!mockKeypoints || mockKeypoints.length === 0) {
      throw new Error(`Mock data not available for ${assetId}`);
    }

    const result: HistoricalDataPoint[] = [];
    const msPerWeek = 7 * 24 * 60 * 60 * 1000;
    let currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      // Find nearest keypoints for interpolation
      let price = this.interpolatePrice(mockKeypoints, currentDate);

      // Apply currency conversion if needed
      if (currency === 'idr') {
        price = price * 15500; // Mock conversion rate: 1 USD = 15500 IDR
      }

      result.push({
        date: new Date(currentDate),
        price,
        timestamp: currentDate.getTime(),
      });

      currentDate = new Date(currentDate.getTime() + msPerWeek);
    }

    return result;
  }

  private interpolatePrice(
    keypoints: { price: number; date: string }[],
    targetDate: Date,
  ): number {
    const target = targetDate.getTime();

    // Find surrounding keypoints
    let before: { price: number; date: Date } | null = null;
    let after: { price: number; date: Date } | null = null;

    for (const point of keypoints) {
      const pointDate = new Date(point.date);
      const pointTime = pointDate.getTime();

      if (
        pointTime <= target &&
        (!before || pointTime > before.date.getTime())
      ) {
        before = { price: point.price, date: pointDate };
      }

      if (
        pointTime >= target &&
        (!after || pointTime < after.date.getTime())
      ) {
        after = { price: point.price, date: pointDate };
      }
    }

    // If exact match or only one side available
    if (!before) return after?.price || keypoints[0].price;
    if (!after) return before.price;
    if (before.date.getTime() === after.date.getTime()) return before.price;

    // Linear interpolation between two keypoints
    const ratio =
      (target - before.date.getTime()) /
      (after.date.getTime() - before.date.getTime());
    return before.price + (after.price - before.price) * ratio;
  }

  calculateGrowth(
    initialInvestment: number,
    historicalData: HistoricalDataPoint[],
    endDate: Date,
  ): CalculationResult {
    if (historicalData.length === 0) {
      throw new Error('No historical data available for calculation');
    }

    const startPrice = historicalData[0].price;
    const endPrice = historicalData[historicalData.length - 1].price;

    const startValue = initialInvestment;
    const endValue = (initialInvestment / startPrice) * endPrice;
    const totalReturn = endValue - startValue;
    const percentageReturn = (totalReturn / startValue) * 100;

    const investmentDays = Math.floor(
      (historicalData[historicalData.length - 1].timestamp -
        historicalData[0].timestamp) /
        (24 * 60 * 60 * 1000),
    );
    const investmentYears = investmentDays / 365;

    const annualizedReturn =
      investmentYears > 0
        ? (Math.pow(endPrice / startPrice, 1 / investmentYears) - 1) * 100
        : percentageReturn;

    return {
      startValue,
      endValue,
      totalReturn,
      percentageReturn,
      annualizedReturn,
      investmentDays,
      investmentYears: Math.floor(investmentYears * 100) / 100,
    };
  }

  private getCachedData(key: string): AssetHistoricalData | null {
    try {
      const cached = localStorage.getItem(key);
      if (!cached) return null;

      const parsed = JSON.parse(cached);
      if (Date.now() - parsed.timestamp > this.CACHE_EXPIRY) {
        localStorage.removeItem(key);
        return null;
      }

      // Reconstruct Date objects
      return {
        ...parsed.data,
        startDate: new Date(parsed.data.startDate),
        endDate: new Date(parsed.data.endDate),
        data: parsed.data.data.map((d: any) => ({
          ...d,
          date: new Date(d.date),
        })),
      };
    } catch (error) {
      console.error('Error reading cache:', error);
      return null;
    }
  }

  private setCachedData(key: string, data: AssetHistoricalData): void {
    try {
      localStorage.setItem(
        key,
        JSON.stringify({
          timestamp: Date.now(),
          data,
        }),
      );
    } catch (error) {
      console.error('Error caching data:', error);
    }
  }

  formatCurrency(value: number, currency: 'usd' | 'idr'): string {
    if (currency === 'idr') {
      return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }
}
