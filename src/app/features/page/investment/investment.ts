import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Sidebar } from '../../../shared/components/sidebar/sidebar';
import {
  AlphaDailyPoint,
  AlphaEconomicPoint,
  AlphaNewsItem,
  AlphaOverview,
  AlphaSearchMatch,
  AlphaTechnicalValue,
  MarketDataService,
} from '../../../core/services/market-data.service';
import {
  InvestmentWatchlistService,
  WatchlistItem,
} from '../../../core/services/investment-watchlist.service';
import { firstValueFrom } from 'rxjs';
import {
  ECONOMIC_CATEGORY_OPTIONS,
  ECONOMIC_INDICATORS,
  EconomicCategory,
  EconomicIndicatorConfig,
} from './investment-economic-indicators.config';

interface QuoteSummary {
  price: number;
  change: number;
  changePercent: number;
  latestDate: string;
}

interface TechnicalCard {
  label: string;
  value: number;
  date: string;
}

interface EconomicCard {
  key: string;
  seriesId: string;
  category: EconomicCategory;
  group: string;
  description: string;
  unit: string;
  label: string;
  latest: number;
  previous: number;
  delta: number;
  latestDate: string;
}

@Component({
  selector: 'app-investment',
  standalone: true,
  imports: [CommonModule, FormsModule, Sidebar],
  templateUrl: './investment.html',
  styleUrl: './investment.css',
})
export class Investment implements OnInit {
  protected searchQuery = '';
  protected searchResults: AlphaSearchMatch[] = [];
  protected watchlist: WatchlistItem[] = [];

  protected selectedSymbol: string | null = null;
  protected selectedCompanyName = '';

  protected quoteSummary: QuoteSummary | null = null;
  protected overview: AlphaOverview | null = null;
  protected news: AlphaNewsItem[] = [];
  protected technicalCards: TechnicalCard[] = [];
  protected economicCards: EconomicCard[] = [];
  protected selectedEconomicCategory: EconomicCategory | 'ALL' = 'ALL';

  protected isSearching = false;
  protected isLoadingSymbol = false;
  protected isLoadingEconomic = false;
  protected globalError = '';
  protected searchError = '';

  protected chartPath = '';
  protected chartMin = 0;
  protected chartMax = 0;
  protected chartStartLabel = '-';
  protected chartEndLabel = '-';

  protected readonly economicCategoryOptions = ECONOMIC_CATEGORY_OPTIONS;

  private readonly economicIndicators: ReadonlyArray<EconomicIndicatorConfig> =
    ECONOMIC_INDICATORS;

  constructor(
    private readonly marketDataService: MarketDataService,
    private readonly watchlistService: InvestmentWatchlistService,
  ) {}

  async ngOnInit(): Promise<void> {
    await this.initializeWatchlist();
    await this.loadEconomicIndicators();
  }

  protected async onSearchSubmit(): Promise<void> {
    const keyword = this.searchQuery.trim();
    this.searchError = '';

    if (keyword.length < 2) {
      this.searchError = 'Ketik minimal 2 karakter untuk mencari symbol.';
      this.searchResults = [];
      return;
    }

    this.isSearching = true;
    try {
      const result = await firstValueFrom(
        this.marketDataService.searchSymbols(keyword),
      );
      this.searchResults = result.slice(0, 8);
      if (!this.searchResults.length) {
        this.searchError = 'Symbol tidak ditemukan. Coba kata kunci lain.';
      }
    } catch {
      this.searchResults = [];
      this.searchError =
        'Gagal mencari symbol. Periksa koneksi atau tunggu limit API reset.';
    } finally {
      this.isSearching = false;
    }
  }

  protected async addToWatchlist(result: AlphaSearchMatch): Promise<void> {
    const state = await this.watchlistService.addItem({
      symbol: result.symbol,
      name: result.name,
      type: result.type,
      region: result.region,
      currency: result.currency,
    });

    this.watchlist = state.items;
    this.searchResults = [];
    this.searchQuery = '';
    await this.selectSymbol(result.symbol);
  }

  protected async removeFromWatchlist(symbol: string): Promise<void> {
    const state = await this.watchlistService.removeItem(symbol);
    this.watchlist = state.items;

    if (!state.selectedSymbol) {
      this.resetSymbolPanels();
      return;
    }

    if (state.selectedSymbol !== this.selectedSymbol) {
      await this.selectSymbol(state.selectedSymbol);
    }
  }

  protected async selectSymbol(symbol: string): Promise<void> {
    const normalized = symbol.trim().toUpperCase();
    this.selectedSymbol = normalized;
    await this.watchlistService.setSelectedSymbol(normalized);
    await this.loadSelectedSymbolDashboard();
  }

  protected isActiveSymbol(symbol: string): boolean {
    return this.selectedSymbol === symbol;
  }

  protected formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    }).format(Number.isFinite(value) ? value : 0);
  }

  protected formatCompactNumber(value: number): string {
    if (!Number.isFinite(value) || value <= 0) {
      return '-';
    }

    return new Intl.NumberFormat('en-US', {
      notation: 'compact',
      maximumFractionDigits: 2,
    }).format(value);
  }

  protected formatPercent(value: number): string {
    const normalized = Number.isFinite(value) ? value : 0;
    return `${normalized >= 0 ? '+' : ''}${normalized.toFixed(2)}%`;
  }

  protected formatDate(dateText: string): string {
    const parsed = this.parseDate(dateText);
    if (!parsed) {
      return dateText;
    }

    return parsed.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  protected trackBySymbol(_index: number, item: WatchlistItem): string {
    return item.symbol;
  }

  protected trackByNewsLink(_index: number, item: AlphaNewsItem): string {
    return item.url;
  }

  protected trackByEconomicKey(_index: number, item: EconomicCard): string {
    return item.key;
  }

  protected setEconomicCategory(category: EconomicCategory | 'ALL'): void {
    this.selectedEconomicCategory = category;
  }

  protected get filteredEconomicCards(): EconomicCard[] {
    if (this.selectedEconomicCategory === 'ALL') {
      return this.economicCards;
    }

    return this.economicCards.filter(
      (item) => item.category === this.selectedEconomicCategory,
    );
  }

  protected get groupedEconomicCards(): Array<{
    group: string;
    items: EconomicCard[];
  }> {
    const groups = new Map<string, EconomicCard[]>();
    for (const card of this.filteredEconomicCards) {
      const existing = groups.get(card.group) ?? [];
      existing.push(card);
      groups.set(card.group, existing);
    }

    return Array.from(groups.entries()).map(([group, items]) => ({
      group,
      items,
    }));
  }

  private async initializeWatchlist(): Promise<void> {
    const state = await this.watchlistService.loadCurrentUserWatchlist();
    this.watchlist = state.items;

    if (!state.items.length) {
      return;
    }

    if (state.selectedSymbol) {
      await this.selectSymbol(state.selectedSymbol);
      return;
    }

    await this.selectSymbol(state.items[0].symbol);
  }

  private async loadSelectedSymbolDashboard(): Promise<void> {
    if (!this.selectedSymbol) {
      return;
    }

    this.globalError = '';
    this.isLoadingSymbol = true;

    const symbol = this.selectedSymbol;
    const watchlistItem = this.watchlist.find((item) => item.symbol === symbol);
    this.selectedCompanyName = watchlistItem?.name ?? symbol;

    try {
      const [dailyResult, overviewResult, newsResult, rsiResult, smaResult] =
        await Promise.allSettled([
          firstValueFrom(this.marketDataService.getDailySeries(symbol)),
          firstValueFrom(this.marketDataService.getOverview(symbol)),
          firstValueFrom(this.marketDataService.getNews(symbol, 6)),
          firstValueFrom(
            this.marketDataService.getTechnicalLatest(symbol, 'RSI', 14),
          ),
          firstValueFrom(
            this.marketDataService.getTechnicalLatest(symbol, 'SMA', 20),
          ),
        ]);

      const dailySeries =
        dailyResult.status === 'fulfilled' ? dailyResult.value : [];

      if (!dailySeries.length) {
        throw new Error('Data harga harian tidak tersedia untuk symbol ini.');
      }

      this.quoteSummary = this.buildQuoteSummary(dailySeries);
      this.updateChart(dailySeries.slice(-60));

      this.overview =
        overviewResult.status === 'fulfilled' ? overviewResult.value : null;
      if (this.overview?.name) {
        this.selectedCompanyName = this.overview.name;
      }

      this.news = newsResult.status === 'fulfilled' ? newsResult.value : [];

      const technicalCards: TechnicalCard[] = [];
      if (rsiResult.status === 'fulfilled' && rsiResult.value) {
        technicalCards.push(this.toTechnicalCard('RSI (14)', rsiResult.value));
      }

      if (smaResult.status === 'fulfilled' && smaResult.value) {
        technicalCards.push(this.toTechnicalCard('SMA (20)', smaResult.value));
      }

      this.technicalCards = technicalCards;
    } catch (error) {
      this.resetSymbolPanels();
      this.globalError =
        error instanceof Error
          ? error.message
          : 'Gagal mengambil data symbol dari Twelve Data.';
    } finally {
      this.isLoadingSymbol = false;
    }
  }

  private async loadEconomicIndicators(): Promise<void> {
    this.isLoadingEconomic = true;

    try {
      const settled = await Promise.allSettled(
        this.economicIndicators.map(async (entry) => {
          const series = await firstValueFrom(
            this.marketDataService.getEconomicSeries(entry.seriesId),
          );

          return this.toEconomicCard(entry, series);
        }),
      );

      this.economicCards = settled
        .filter(
          (result): result is PromiseFulfilledResult<EconomicCard | null> =>
            result.status === 'fulfilled',
        )
        .map((result) => result.value)
        .filter((value): value is EconomicCard => Boolean(value));
    } finally {
      this.isLoadingEconomic = false;
    }
  }

  private buildQuoteSummary(points: AlphaDailyPoint[]): QuoteSummary {
    const latest = points[points.length - 1];
    const previous = points[points.length - 2] ?? latest;
    const change = latest.close - previous.close;
    const changePercent =
      previous.close > 0 ? (change / previous.close) * 100 : 0;

    return {
      price: latest.close,
      change,
      changePercent,
      latestDate: latest.date,
    };
  }

  private updateChart(points: AlphaDailyPoint[]): void {
    const values = points.map((point) => point.close);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const spread = maxValue - minValue || 1;

    const minX = 16;
    const maxX = 544;
    const minY = 20;
    const maxY = 210;

    this.chartPath = points
      .map((point, index) => {
        const x =
          points.length === 1
            ? minX
            : minX + (index / (points.length - 1)) * (maxX - minX);
        const y = maxY - ((point.close - minValue) / spread) * (maxY - minY);
        return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(' ');

    this.chartMin = minValue;
    this.chartMax = maxValue;
    this.chartStartLabel = this.formatDate(points[0].date);
    this.chartEndLabel = this.formatDate(points[points.length - 1].date);
  }

  private toTechnicalCard(
    label: string,
    value: AlphaTechnicalValue,
  ): TechnicalCard {
    return {
      label,
      value: value.value,
      date: value.date,
    };
  }

  private toEconomicCard(
    indicator: EconomicIndicatorConfig,
    series: AlphaEconomicPoint[],
  ): EconomicCard | null {
    if (series.length < 2) {
      return null;
    }

    const latest = series[series.length - 1];
    const previous = series[series.length - 2];

    return {
      key: indicator.key,
      seriesId: indicator.seriesId,
      category: indicator.category,
      group: indicator.group,
      description: indicator.description,
      unit: indicator.unit,
      label: indicator.label,
      latest: latest.value,
      previous: previous.value,
      delta: latest.value - previous.value,
      latestDate: latest.date,
    };
  }

  private parseDate(value: string): Date | null {
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

    return date;
  }

  private resetSymbolPanels(): void {
    this.quoteSummary = null;
    this.overview = null;
    this.news = [];
    this.technicalCards = [];
    this.chartPath = '';
    this.chartMin = 0;
    this.chartMax = 0;
    this.chartStartLabel = '-';
    this.chartEndLabel = '-';
  }
}
