import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import {
  HistoricalDataService,
  AssetOption,
  HistoricalDataPoint,
  CalculationResult,
} from '../../../../core/services/historical-data.service';

@Component({
  selector: 'app-simulation',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule, RouterLink],
  templateUrl: './simulation.html',
  styleUrl: './simulation.css',
  providers: [HistoricalDataService],
})
export class ToolsSimulation implements OnInit, OnDestroy {
  // Form inputs
  selectedAsset: string = 'bitcoin';
  investmentAmount: number = 1000000;
  startDate: string = '2020-01-01';
  currency: 'usd' | 'idr' = 'usd';

  // Data
  availableAssets: AssetOption[] = [];
  historicalData: HistoricalDataPoint[] = [];
  calculation: CalculationResult | null = null;
  chartPath: string = '';
  chartYearTicks: string[] = [];
  chartMaxValue: number = 0;
  chartMinValue: number = 0;
  chartStartLabel: string = '';
  chartEndLabel: string = '';

  // UI states
  isLoading: boolean = false;
  errorMessage: string = '';
  showChart: boolean = false;

  // Computed values
  chartCurrentValue: number = 0;
  chartDeltaValue: number = 0;

  constructor(private historicalDataService: HistoricalDataService) {}

  ngOnInit(): void {
    this.availableAssets = this.historicalDataService.AVAILABLE_ASSETS;
    this.setDefaultDates();
  }

  ngOnDestroy(): void {
    // Cleanup if needed
  }

  setDefaultDates(): void {
    const today = new Date();
    const fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(today.getFullYear() - 5);

    this.startDate = this.formatDateForInput(fiveYearsAgo);
  }

  private formatDateForInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private parseInputDate(dateString: string): Date {
    return new Date(dateString + 'T00:00:00Z');
  }

  async simulateInvestment(): Promise<void> {
    try {
      this.isLoading = true;
      this.errorMessage = '';
      this.showChart = false;

      // Validate inputs
      if (this.investmentAmount <= 0) {
        throw new Error('Investment amount harus lebih dari 0');
      }

      const asset = this.availableAssets.find(
        (a) => a.id === this.selectedAsset,
      );
      if (!asset) {
        throw new Error('Asset tidak ditemukan');
      }

      const startDate = this.parseInputDate(this.startDate);
      const today = new Date();

      // Validate date range
      if (startDate >= today) {
        throw new Error('Start date harus di masa lalu');
      }

      if (
        (today.getTime() - startDate.getTime()) / (365 * 24 * 60 * 60 * 1000) <
        0.5
      ) {
        throw new Error('Range waktu minimal 6 bulan');
      }

      // Fetch historical data
      const data = await this.historicalDataService.getHistoricalData(
        asset,
        startDate,
        today,
        this.currency,
      );

      this.historicalData = data.data;

      // Calculate results
      this.calculation = this.historicalDataService.calculateGrowth(
        this.investmentAmount,
        this.historicalData,
        today,
      );

      // Generate chart
      this.generateChart();
      this.showChart = true;
    } catch (error) {
      this.errorMessage =
        error instanceof Error ? error.message : 'Terjadi kesalahan';
      console.error('Simulation error:', error);
    } finally {
      this.isLoading = false;
    }
  }

  private generateChart(): void {
    if (this.historicalData.length < 2 || !this.calculation) {
      return;
    }

    // Prepare data for chart
    const minPrice = Math.min(...this.historicalData.map((d) => d.price));
    const maxPrice = Math.max(...this.historicalData.map((d) => d.price));
    const priceRange = maxPrice - minPrice;

    this.chartMinValue = minPrice;
    this.chartMaxValue = maxPrice;
    this.chartCurrentValue =
      this.historicalData[this.historicalData.length - 1].price;
    this.chartDeltaValue =
      this.chartCurrentValue *
        (this.investmentAmount / this.historicalData[0].price) -
      this.investmentAmount;

    // Generate path for SVG line chart
    const chartWidth = 540;
    const chartHeight = 200;
    const padding = 10;

    const points: string[] = [];

    this.historicalData.forEach((point, index) => {
      // Normalize price to chart coordinates
      const normalizedPrice =
        priceRange > 0 ? (point.price - minPrice) / priceRange : 0.5;

      const x =
        padding +
        ((chartWidth - 2 * padding) / (this.historicalData.length - 1)) * index;
      const y =
        chartHeight - padding - (chartHeight - 2 * padding) * normalizedPrice;

      if (index === 0) {
        points.push(`M ${x} ${y}`);
      } else {
        points.push(`L ${x} ${y}`);
      }
    });

    this.chartPath = points.join(' ');

    // Generate year ticks for x-axis
    this.generateChartTicks();

    // Prepare labels
    const startFormatted = this.historicalData[0].date.toLocaleDateString(
      'id-ID',
      { year: 'numeric', month: 'short' },
    );
    const endFormatted = this.historicalData[
      this.historicalData.length - 1
    ].date.toLocaleDateString('id-ID', { year: 'numeric', month: 'short' });

    this.chartStartLabel = startFormatted;
    this.chartEndLabel = endFormatted;
  }

  private generateChartTicks(): void {
    if (this.historicalData.length < 2) {
      this.chartYearTicks = [];
      return;
    }

    const startDate = this.historicalData[0].date;
    const endDate = this.historicalData[this.historicalData.length - 1].date;
    const yearRange = endDate.getFullYear() - startDate.getFullYear() || 1;

    const ticks: string[] = [];
    for (let i = 0; i <= Math.min(yearRange, 5); i++) {
      const tickYear =
        startDate.getFullYear() + (i * yearRange) / Math.min(yearRange, 5);
      ticks.push(Math.floor(tickYear).toString());
    }

    this.chartYearTicks = ticks;
  }

  formatCurrency(value: number): string {
    return this.historicalDataService.formatCurrency(value, this.currency);
  }

  formatPercent(value: number): string {
    return new Intl.NumberFormat('id-ID', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  getAssetLabel(assetId: string): string {
    return this.availableAssets.find((a) => a.id === assetId)?.name || assetId;
  }

  getTodayFormatted(): string {
    return new Date().toLocaleDateString('id-ID');
  }
}
