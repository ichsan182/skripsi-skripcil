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

type EconomicCategory = 'Sektor Riil' | 'Keuangan & Pasar' | 'Ekonomi Makro';

interface EconomicIndicatorConfig {
  key: string;
  label: string;
  seriesId: string;
  category: EconomicCategory;
  group: string;
  description: string;
  unit: string;
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

  protected readonly economicCategoryOptions: Array<{
    key: EconomicCategory | 'ALL';
    label: string;
  }> = [
    { key: 'ALL', label: 'Semua Kategori' },
    { key: 'Sektor Riil', label: 'Sektor Riil' },
    { key: 'Keuangan & Pasar', label: 'Keuangan & Pasar' },
    { key: 'Ekonomi Makro', label: 'Ekonomi Makro' },
  ];

  private readonly economicIndicators: EconomicIndicatorConfig[] = [
    {
      key: 'indpro',
      label: 'Industrial Production',
      seriesId: 'INDPRO',
      category: 'Sektor Riil',
      group: 'Produksi',
      description: 'Indeks produksi industri total.',
      unit: 'index',
    },
    {
      key: 'tcu',
      label: 'Capacity Utilization',
      seriesId: 'TCU',
      category: 'Sektor Riil',
      group: 'Produksi',
      description: 'Kapasitas utilisasi sektor industri.',
      unit: '%',
    },
    {
      key: 'rsxfs',
      label: 'Retail Sales Ex Food Services',
      seriesId: 'RSXFS',
      category: 'Sektor Riil',
      group: 'Retail & Konsumsi',
      description: 'Retail sales tanpa food services.',
      unit: 'USD bn',
    },
    {
      key: 'umcsent',
      label: 'Consumer Sentiment',
      seriesId: 'UMCSENT',
      category: 'Sektor Riil',
      group: 'Retail & Konsumsi',
      description: 'Indeks sentimen konsumen Michigan.',
      unit: 'index',
    },
    {
      key: 'pce',
      label: 'Personal Consumption Expenditures',
      seriesId: 'PCE',
      category: 'Sektor Riil',
      group: 'Retail & Konsumsi',
      description: 'Total pengeluaran konsumsi personal.',
      unit: 'USD bn',
    },
    {
      key: 'bopgstb',
      label: 'Trade Balance',
      seriesId: 'BOPGSTB',
      category: 'Sektor Riil',
      group: 'Perdagangan',
      description: 'Neraca perdagangan barang dan jasa.',
      unit: 'USD mn',
    },
    {
      key: 'ieabcaa',
      label: 'Current Account Balance',
      seriesId: 'IEABCAA',
      category: 'Sektor Riil',
      group: 'Perdagangan',
      description: 'Saldo current account Amerika Serikat.',
      unit: 'USD bn',
    },
    {
      key: 'gfdebtn',
      label: 'Federal Debt Total Public Debt',
      seriesId: 'GFDEBTN',
      category: 'Sektor Riil',
      group: 'Fiskal',
      description: 'Total utang publik federal.',
      unit: 'USD mn',
    },
    {
      key: 'mtsds133fms',
      label: 'Federal Surplus or Deficit',
      seriesId: 'MTSDS133FMS',
      category: 'Sektor Riil',
      group: 'Fiskal',
      description: 'Surplus/defisit anggaran federal bulanan.',
      unit: 'USD mn',
    },
    {
      key: 'ophnfb',
      label: 'Labor Productivity Nonfarm',
      seriesId: 'OPHNFB',
      category: 'Sektor Riil',
      group: 'Produktivitas',
      description: 'Produktivitas tenaga kerja nonfarm business.',
      unit: 'index',
    },
    {
      key: 'ces0500000003',
      label: 'Average Hourly Earnings',
      seriesId: 'CES0500000003',
      category: 'Sektor Riil',
      group: 'Produktivitas',
      description: 'Rata-rata upah per jam sektor private.',
      unit: 'USD/hour',
    },
    {
      key: 'usrec',
      label: 'NBER Recession Indicator',
      seriesId: 'USREC',
      category: 'Sektor Riil',
      group: 'Resesi',
      description: 'Indikator biner fase resesi NBER.',
      unit: 'binary',
    },
    {
      key: 't10y2y',
      label: '10Y-2Y Treasury Spread',
      seriesId: 'T10Y2Y',
      category: 'Sektor Riil',
      group: 'Resesi',
      description: 'Selisih yield 10 tahun dan 2 tahun.',
      unit: 'bps',
    },
    {
      key: 'sp500',
      label: 'S&P 500',
      seriesId: 'SP500',
      category: 'Keuangan & Pasar',
      group: 'Pasar Saham',
      description: 'Indeks saham S&P 500.',
      unit: 'index',
    },
    {
      key: 'nasdaqcom',
      label: 'NASDAQ Composite',
      seriesId: 'NASDAQCOM',
      category: 'Keuangan & Pasar',
      group: 'Pasar Saham',
      description: 'Indeks saham NASDAQ Composite.',
      unit: 'index',
    },
    {
      key: 'vixcls',
      label: 'VIX Volatility Index',
      seriesId: 'VIXCLS',
      category: 'Keuangan & Pasar',
      group: 'Pasar Saham',
      description: 'Indeks volatilitas implied CBOE VIX.',
      unit: 'index',
    },
    {
      key: 'totalsl',
      label: 'Total Consumer Credit',
      seriesId: 'TOTALSL',
      category: 'Keuangan & Pasar',
      group: 'Kredit & Perbankan',
      description: 'Total outstanding consumer credit.',
      unit: 'USD bn',
    },
    {
      key: 'dpsacbw027sbog',
      label: 'Deposits at All Commercial Banks',
      seriesId: 'DPSACBW027SBOG',
      category: 'Keuangan & Pasar',
      group: 'Kredit & Perbankan',
      description: 'Total simpanan di bank komersial.',
      unit: 'USD bn',
    },
    {
      key: 'bamlh0a0hym2',
      label: 'US High Yield Spread',
      seriesId: 'BAMLH0A0HYM2',
      category: 'Keuangan & Pasar',
      group: 'Spread & Risiko',
      description: 'Option-adjusted spread obligasi high yield.',
      unit: 'bps',
    },
    {
      key: 'tedrate',
      label: 'TED Spread',
      seriesId: 'TEDRATE',
      category: 'Keuangan & Pasar',
      group: 'Spread & Risiko',
      description: 'Selisih 3M LIBOR dan 3M T-Bill.',
      unit: 'bps',
    },
    {
      key: 'csushpisa',
      label: 'Case-Shiller Home Price Index',
      seriesId: 'CSUSHPISA',
      category: 'Keuangan & Pasar',
      group: 'Properti',
      description: 'Indeks harga rumah S&P CoreLogic Case-Shiller.',
      unit: 'index',
    },
    {
      key: 'mortgage30us',
      label: '30-Year Mortgage Rate',
      seriesId: 'MORTGAGE30US',
      category: 'Keuangan & Pasar',
      group: 'Properti',
      description: 'Rata-rata suku bunga KPR 30 tahun fixed.',
      unit: '%',
    },
    {
      key: 'dcoilwtico',
      label: 'WTI Crude Oil Price',
      seriesId: 'DCOILWTICO',
      category: 'Keuangan & Pasar',
      group: 'Komoditas',
      description: 'Harga minyak mentah WTI spot.',
      unit: 'USD/barrel',
    },
    {
      key: 'goldamgbd228nlbm',
      label: 'Gold Price (London AM)',
      seriesId: 'GOLDAMGBD228NLBM',
      category: 'Keuangan & Pasar',
      group: 'Komoditas',
      description: 'Harga emas London Bullion Market AM.',
      unit: 'USD/troy oz',
    },
    {
      key: 'stlfsi4',
      label: 'St. Louis Financial Stress Index',
      seriesId: 'STLFSI4',
      category: 'Keuangan & Pasar',
      group: 'Financial Stress',
      description: 'Indeks tekanan finansial dari St. Louis Fed.',
      unit: 'index',
    },
    {
      key: 'nfci',
      label: 'Chicago Fed NFCI',
      seriesId: 'NFCI',
      category: 'Keuangan & Pasar',
      group: 'Financial Stress',
      description: 'National Financial Conditions Index.',
      unit: 'index',
    },
    {
      key: 'gdp',
      label: 'Gross Domestic Product',
      seriesId: 'GDP',
      category: 'Ekonomi Makro',
      group: 'GDP',
      description: 'Nominal gross domestic product.',
      unit: 'USD bn',
    },
    {
      key: 'gdpc1',
      label: 'Real GDP',
      seriesId: 'GDPC1',
      category: 'Ekonomi Makro',
      group: 'GDP',
      description: 'Real GDP chain-type quantity index.',
      unit: 'USD bn (real)',
    },
    {
      key: 'a191rl1q225sbea',
      label: 'Real GDP Growth Rate',
      seriesId: 'A191RL1Q225SBEA',
      category: 'Ekonomi Makro',
      group: 'GDP',
      description: 'Pertumbuhan real GDP quarter-over-quarter annualized.',
      unit: '%',
    },
    {
      key: 'cpiaucsl',
      label: 'CPI All Items',
      seriesId: 'CPIAUCSL',
      category: 'Ekonomi Makro',
      group: 'Inflasi',
      description: 'Consumer price index all urban consumers.',
      unit: 'index',
    },
    {
      key: 'cpilfesl',
      label: 'Core CPI (Less Food & Energy)',
      seriesId: 'CPILFESL',
      category: 'Ekonomi Makro',
      group: 'Inflasi',
      description: 'Core CPI tanpa food dan energy.',
      unit: 'index',
    },
    {
      key: 'pcepi',
      label: 'PCE Price Index',
      seriesId: 'PCEPI',
      category: 'Ekonomi Makro',
      group: 'Inflasi',
      description: 'Indeks harga personal consumption expenditures.',
      unit: 'index',
    },
    {
      key: 'unrate',
      label: 'Unemployment Rate',
      seriesId: 'UNRATE',
      category: 'Ekonomi Makro',
      group: 'Ketenagakerjaan',
      description: 'Tingkat pengangguran nasional.',
      unit: '%',
    },
    {
      key: 'payems',
      label: 'Nonfarm Payrolls',
      seriesId: 'PAYEMS',
      category: 'Ekonomi Makro',
      group: 'Ketenagakerjaan',
      description: 'Total payroll karyawan nonfarm.',
      unit: 'thousand persons',
    },
    {
      key: 'jtsjol',
      label: 'Job Openings (JOLTS)',
      seriesId: 'JTSJOL',
      category: 'Ekonomi Makro',
      group: 'Ketenagakerjaan',
      description: 'Jumlah lowongan kerja dari survei JOLTS.',
      unit: 'thousand jobs',
    },
    {
      key: 'fedfunds',
      label: 'Federal Funds Effective Rate',
      seriesId: 'FEDFUNDS',
      category: 'Ekonomi Makro',
      group: 'Suku Bunga',
      description: 'Suku bunga acuan efektif federal funds.',
      unit: '%',
    },
    {
      key: 'dgs10',
      label: '10-Year Treasury Yield',
      seriesId: 'DGS10',
      category: 'Ekonomi Makro',
      group: 'Suku Bunga',
      description: 'Yield treasury tenor 10 tahun.',
      unit: '%',
    },
    {
      key: 'dgs2',
      label: '2-Year Treasury Yield',
      seriesId: 'DGS2',
      category: 'Ekonomi Makro',
      group: 'Suku Bunga',
      description: 'Yield treasury tenor 2 tahun.',
      unit: '%',
    },
    {
      key: 'm1sl',
      label: 'M1 Money Stock',
      seriesId: 'M1SL',
      category: 'Ekonomi Makro',
      group: 'Moneter',
      description: 'Uang beredar M1.',
      unit: 'USD bn',
    },
    {
      key: 'm2sl',
      label: 'M2 Money Stock',
      seriesId: 'M2SL',
      category: 'Ekonomi Makro',
      group: 'Moneter',
      description: 'Uang beredar M2.',
      unit: 'USD bn',
    },
    {
      key: 'bogmbase',
      label: 'Monetary Base',
      seriesId: 'BOGMBASE',
      category: 'Ekonomi Makro',
      group: 'Moneter',
      description: 'St. Louis adjusted monetary base.',
      unit: 'USD mn',
    },
    {
      key: 'dexuseu',
      label: 'USD/EUR Exchange Rate',
      seriesId: 'DEXUSEU',
      category: 'Ekonomi Makro',
      group: 'Nilai Tukar',
      description: 'Nilai tukar dolar AS terhadap euro.',
      unit: 'USD per EUR',
    },
    {
      key: 'dexjpus',
      label: 'JPY/USD Exchange Rate',
      seriesId: 'DEXJPUS',
      category: 'Ekonomi Makro',
      group: 'Nilai Tukar',
      description: 'Nilai tukar yen Jepang terhadap dolar AS.',
      unit: 'JPY per USD',
    },
    {
      key: 'dexchus',
      label: 'CNY/USD Exchange Rate',
      seriesId: 'DEXCHUS',
      category: 'Ekonomi Makro',
      group: 'Nilai Tukar',
      description: 'Nilai tukar yuan Tiongkok terhadap dolar AS.',
      unit: 'CNY per USD',
    },
  ];

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
