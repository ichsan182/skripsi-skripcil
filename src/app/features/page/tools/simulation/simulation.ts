import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin, Subscription } from 'rxjs';
import {
  PriceData,
  YahooFinanceService,
} from '../../../../core/services/historical-data.service';

type CurrencyCode = 'usd' | 'idr';

interface AssetOption {
  id: string;
  name: string;
  symbol: string;
}

interface SimulationCalculation {
  startValue: number;
  endValue: number;
  totalReturn: number;
  percentageReturn: number;
  annualizedReturn: number;
  investmentDays: number;
  investmentYears: number;
}

interface ChartPoint {
  date: string;
  value: number;
}

@Component({
  selector: 'app-simulation',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './simulation.html',
  styleUrl: './simulation.css',
  providers: [],
})
export class ToolsSimulation implements OnInit, OnDestroy {
  protected readonly availableAssets: AssetOption[] = [
    { id: 'GC=F', name: 'Emas (Gold)', symbol: 'GC=F' },
    { id: 'SI=F', name: 'Perak (Silver)', symbol: 'SI=F' },
    { id: 'BTC-USD', name: 'Bitcoin', symbol: 'BTC-USD' },
    { id: '^GSPC', name: 'S&P 500', symbol: '^GSPC' },
    { id: '^IXIC', name: 'NASDAQ', symbol: '^IXIC' },
    { id: 'AAPL', name: 'Saham US (Apple)', symbol: 'AAPL' },
    { id: 'BBCA.JK', name: 'Saham IDX (BBCA)', symbol: 'BBCA.JK' },
  ];

  protected selectedAsset = this.availableAssets[0].id;
  protected investmentAmount = '1000000';
  protected startDate = this.formatDateForInput(this.getDateYearsAgo(1));
  protected currency: CurrencyCode = 'idr';

  protected isLoading = false;
  protected showChart = false;
  protected errorMessage = '';
  protected calculation: SimulationCalculation | null = null;

  protected chartPath = '';
  protected assetCurrentPrice = 0;
  protected chartCurrentValue = 0;
  protected chartDeltaValue = 0;
  protected chartMaxValue = 0;
  protected chartMinValue = 0;
  protected chartStartLabel = '-';
  protected chartEndLabel = '-';
  protected chartYearTicks: string[] = [];

  private activeRequest?: Subscription;

  constructor(private readonly yf: YahooFinanceService) {}

  ngOnInit(): void {
    this.simulateInvestment();
  }

  ngOnDestroy(): void {
    this.activeRequest?.unsubscribe();
  }

  protected simulateInvestment(): void {
    const amount = this.parseNumberInput(this.investmentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      this.handleSimulationError(
        'Jumlah investasi awal harus lebih besar dari 0.',
      );
      return;
    }

    const startInputDate = this.parseDateInput(this.startDate);
    if (!startInputDate) {
      this.handleSimulationError('Tanggal mulai investasi tidak valid.');
      return;
    }

    const today = this.startOfDay(new Date());
    if (startInputDate > today) {
      this.handleSimulationError(
        'Tanggal mulai investasi tidak boleh di masa depan.',
      );
      return;
    }

    const minSupportedDate = this.getDateYearsAgo(5);
    if (startInputDate < minSupportedDate) {
      this.handleSimulationError(
        `Data historis Yahoo Finance pada endpoint ini tersedia sekitar 5 tahun terakhir. Pilih tanggal mulai setelah ${this.formatDateDisplay(minSupportedDate)}.`,
      );
      return;
    }

    const interval = this.resolveInterval(startInputDate, today);

    this.isLoading = true;
    this.errorMessage = '';
    this.showChart = false;
    this.activeRequest?.unsubscribe();

    this.activeRequest = forkJoin({
      history: this.yf.getHistoricalPrices(this.selectedAsset, '5y', interval),
      quote: this.yf.getCurrentPrice(this.selectedAsset),
    }).subscribe({
      next: ({ history, quote }) => {
        this.isLoading = false;
        this.processSimulationData(
          history,
          amount,
          startInputDate,
          quote.price,
        );
      },
      error: () => {
        this.isLoading = false;
        this.handleSimulationError(
          'Gagal mengambil data dari Yahoo Finance API. Coba lagi dalam beberapa saat.',
        );
      },
    });
  }

  protected getAssetLabel(assetId: string): string {
    const asset = this.availableAssets.find((item) => item.id === assetId);
    return asset ? asset.name : assetId;
  }

  protected formatCurrency(value: number): string {
    const normalized = Number.isFinite(value) ? value : 0;

    if (this.currency === 'idr') {
      return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(normalized);
    }

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(normalized);
  }

  protected formatPercent(value: number): string {
    const normalized = Number.isFinite(value) ? value : 0;
    const sign = normalized > 0 ? '+' : '';
    return `${sign}${normalized.toFixed(2)}`;
  }

  protected getTodayFormatted(): string {
    return this.formatDateDisplay(this.startOfDay(new Date()));
  }

  private processSimulationData(
    rows: PriceData[],
    amount: number,
    startDate: Date,
    currentQuotePrice: number,
  ): void {
    const usableRows = this.extractUsableRows(rows, startDate);

    if (usableRows.length < 2) {
      this.handleSimulationError(
        'Data historis untuk periode yang dipilih tidak cukup. Coba pilih tanggal mulai yang lebih awal.',
      );
      return;
    }

    const firstRow = usableRows[0];
    const lastRow = usableRows[usableRows.length - 1];
    const startPrice = firstRow.close;
    const endPrice = lastRow.close;
    const displayedCurrentPrice =
      Number.isFinite(currentQuotePrice) && currentQuotePrice > 0
        ? currentQuotePrice
        : endPrice;

    if (startPrice <= 0 || endPrice <= 0) {
      this.handleSimulationError(
        'Harga aset tidak valid untuk proses simulasi.',
      );
      return;
    }

    const startPointDate = this.parseDateInput(firstRow.date);
    const endPointDate = this.parseDateInput(lastRow.date);
    if (!startPointDate || !endPointDate) {
      this.handleSimulationError('Format tanggal data historis tidak valid.');
      return;
    }

    const investmentDays = Math.max(
      1,
      this.diffInDays(startPointDate, endPointDate),
    );
    const growthRatio = endPrice / startPrice;
    const endValue = amount * growthRatio;
    const totalReturn = endValue - amount;
    const percentageReturn = (totalReturn / amount) * 100;
    const annualizedReturn =
      growthRatio > 0
        ? (Math.pow(growthRatio, 365 / investmentDays) - 1) * 100
        : 0;

    this.calculation = {
      startValue: amount,
      endValue,
      totalReturn,
      percentageReturn,
      annualizedReturn,
      investmentDays,
      investmentYears: Number((investmentDays / 365).toFixed(2)),
    };

    const chartSeries: ChartPoint[] = usableRows.map((row) => ({
      date: row.date,
      value: amount * (row.close / startPrice),
    }));
    this.assetCurrentPrice = this.normalizeAssetDisplayPrice(
      displayedCurrentPrice,
    );
    this.updateChartState(chartSeries, amount);
    this.showChart = true;
  }

  protected getAssetPriceCaption(): string {
    if (this.isIdxStock(this.selectedAsset)) {
      return 'Harga aset terakhir per lot (100 lembar)';
    }

    return 'Harga aset terakhir dari Yahoo Finance';
  }

  private updateChartState(series: ChartPoint[], startValue: number): void {
    const values = series.map((point) => point.value);
    const first = series[0];
    const last = series[series.length - 1];

    this.chartPath = this.buildLinePath(values);
    this.chartCurrentValue = last.value;
    this.chartDeltaValue = last.value - startValue;
    this.chartMaxValue = Math.max(...values);
    this.chartMinValue = Math.min(...values);
    this.chartStartLabel = this.formatDateShort(first.date);
    this.chartEndLabel = this.formatDateShort(last.date);
    this.chartYearTicks = this.buildTimelineTicks(series);
  }

  private buildLinePath(values: number[]): string {
    if (values.length === 0) {
      return '';
    }

    const minX = 20;
    const maxX = 550;
    const minY = 14;
    const maxY = 202;
    const valueMin = Math.min(...values);
    const valueMax = Math.max(...values);
    const span = valueMax - valueMin || 1;

    const path = values
      .map((value, index) => {
        const x =
          values.length === 1
            ? minX
            : minX + (index / (values.length - 1)) * (maxX - minX);
        const y = maxY - ((value - valueMin) / span) * (maxY - minY);
        const command = index === 0 ? 'M' : 'L';
        return `${command} ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(' ');

    return path;
  }

  private buildTimelineTicks(series: ChartPoint[]): string[] {
    if (series.length === 0) {
      return [];
    }

    if (series.length === 1) {
      return [this.formatMonthYear(series[0].date)];
    }

    const tickCount = Math.min(6, series.length);
    const ticks: string[] = [];

    for (let index = 0; index < tickCount; index += 1) {
      const pointIndex = Math.round(
        (index * (series.length - 1)) / (tickCount - 1),
      );
      const label = this.formatMonthYear(series[pointIndex].date);
      if (!ticks.includes(label)) {
        ticks.push(label);
      }
    }

    return ticks;
  }

  private extractUsableRows(rows: PriceData[], startDate: Date): PriceData[] {
    const normalizedRows = rows
      .filter((row) => {
        const parsed = this.parseDateInput(row.date);
        return Boolean(parsed) && Number.isFinite(row.close) && row.close > 0;
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    const fromIndex = normalizedRows.findIndex((row) => {
      const parsed = this.parseDateInput(row.date);
      return Boolean(parsed && parsed >= startDate);
    });

    if (fromIndex === -1) {
      return [];
    }

    return normalizedRows.slice(fromIndex);
  }

  private parseNumberInput(value: string | number): number {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : Number.NaN;
    }

    const raw = value.trim();
    if (!raw) {
      return Number.NaN;
    }

    const cleaned = raw.replace(/\s/g, '').replace(/[^\d,.-]/g, '');
    if (!cleaned) {
      return Number.NaN;
    }

    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');

    let normalized = cleaned;
    if (lastComma !== -1 && lastDot !== -1) {
      if (lastComma > lastDot) {
        normalized = cleaned.replace(/\./g, '').replace(',', '.');
      } else {
        normalized = cleaned.replace(/,/g, '');
      }
    } else if (lastComma !== -1) {
      normalized = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      const dotCount = (cleaned.match(/\./g) ?? []).length;
      normalized = dotCount > 1 ? cleaned.replace(/\./g, '') : cleaned;
    }

    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }

  private parseDateInput(value: string): Date | null {
    const parts = value.split('-').map((part) => Number.parseInt(part, 10));
    if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) {
      return null;
    }

    const [year, month, day] = parts;
    const date = new Date(year, month - 1, day);
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }

    return this.startOfDay(date);
  }

  private resolveInterval(startDate: Date, endDate: Date): '1d' | '1wk' {
    const dayDiff = this.diffInDays(startDate, endDate);
    return dayDiff <= 365 ? '1d' : '1wk';
  }

  private getDateYearsAgo(years: number): Date {
    const now = this.startOfDay(new Date());
    return new Date(now.getFullYear() - years, now.getMonth(), now.getDate());
  }

  private normalizeAssetDisplayPrice(price: number): number {
    if (!Number.isFinite(price)) {
      return 0;
    }

    if (this.isIdxStock(this.selectedAsset)) {
      return price * 100;
    }

    return price;
  }

  private isIdxStock(symbol: string): boolean {
    return symbol.endsWith('.JK');
  }

  private formatDateForInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private formatDateShort(dateText: string): string {
    const date = this.parseDateInput(dateText);
    if (!date) {
      return dateText;
    }

    return date.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  private formatMonthYear(dateText: string): string {
    const date = this.parseDateInput(dateText);
    if (!date) {
      return dateText;
    }

    return date.toLocaleDateString('id-ID', {
      month: 'short',
      year: '2-digit',
    });
  }

  private formatDateDisplay(date: Date): string {
    return date.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }

  private diffInDays(start: Date, end: Date): number {
    const msPerDay = 24 * 60 * 60 * 1000;
    const delta = end.getTime() - start.getTime();
    return Math.max(0, Math.round(delta / msPerDay));
  }

  private startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private handleSimulationError(message: string): void {
    this.errorMessage = message;
    this.showChart = false;
    this.calculation = null;
    this.chartPath = '';
    this.assetCurrentPrice = 0;
    this.chartCurrentValue = 0;
    this.chartDeltaValue = 0;
    this.chartMaxValue = 0;
    this.chartMinValue = 0;
    this.chartStartLabel = '-';
    this.chartEndLabel = '-';
    this.chartYearTicks = [];
  }
}
