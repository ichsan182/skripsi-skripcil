import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

export interface AlphaSearchMatch {
  symbol: string;
  name: string;
  type: string;
  region: string;
  currency: string;
  matchScore: number;
}

export interface AlphaDailyPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface AlphaOverview {
  symbol: string;
  name: string;
  description: string;
  sector: string;
  industry: string;
  marketCapitalization: number;
  peRatio: number;
  dividendYield: number;
  eps: number;
}

export interface AlphaNewsItem {
  title: string;
  source: string;
  url: string;
  timePublished: string;
  summary: string;
}

export interface AlphaTechnicalValue {
  date: string;
  value: number;
}

export interface AlphaEconomicPoint {
  date: string;
  value: number;
}

type GenericRecord = Record<string, unknown>;

@Injectable({ providedIn: 'root' })
export class AlphaVantageService {
  private readonly twelveDataBaseUrl = '/twelvedata';
  private readonly fredBaseUrl = '/fred/fred';
  private readonly newsApiBaseUrl = '/newsapi/v2';
  private readonly twelveDataApiKey = '841550e787a3463d8d0103ae144e6573';
  private readonly fredApiKey = '841550e787a3463d8d0103ae144e6573';
  private readonly newsApiKey = '841550e787a3463d8d0103ae144e6573';

  constructor(private readonly http: HttpClient) {}

  searchSymbols(keywords: string): Observable<AlphaSearchMatch[]> {
    return this.callTwelveDataApi('/symbol_search', {
      symbol: keywords,
      outputsize: '20',
    }).pipe(
      map((raw) => {
        const rows = this.toArray<GenericRecord>(raw['data']);
        return rows
          .map((row) => ({
            symbol: this.toText(row['symbol']),
            name: this.toText(row['instrument_name']),
            type:
              this.toText(row['instrument_type']) || this.toText(row['type']),
            region: this.toText(row['country']) || this.toText(row['exchange']),
            currency: this.toText(row['currency']) || 'USD',
            matchScore: 1,
          }))
          .filter((row) => row.symbol && row.name)
          .sort((a, b) => a.symbol.localeCompare(b.symbol));
      }),
    );
  }

  getDailySeries(symbol: string): Observable<AlphaDailyPoint[]> {
    return this.callTwelveDataApi('/time_series', {
      symbol,
      interval: '1day',
      outputsize: '100',
    }).pipe(
      map((raw) => {
        const values = this.toArray<GenericRecord>(raw['values']);
        return values
          .map((row) => {
            const datetime = this.toText(row['datetime']);
            return {
              date: this.normalizeDate(datetime),
              open: this.toNumber(row['open']),
              high: this.toNumber(row['high']),
              low: this.toNumber(row['low']),
              close: this.toNumber(row['close']),
              volume: this.toNumber(row['volume']),
            };
          })
          .filter((row) => row.date && row.close > 0)
          .sort((a, b) => a.date.localeCompare(b.date));
      }),
    );
  }

  getOverview(symbol: string): Observable<AlphaOverview> {
    return this.callTwelveDataApi('/profile', {
      symbol,
    }).pipe(
      map((raw) => ({
        symbol,
        name: this.toText(raw['name']) || symbol,
        description: this.toText(raw['description']),
        sector: this.toText(raw['sector']),
        industry: this.toText(raw['industry']),
        marketCapitalization: this.toNumber(raw['market_cap']),
        peRatio: this.toNumber(raw['pe']),
        dividendYield: this.toNumber(raw['dividend_yield']),
        eps: this.toNumber(raw['eps']),
      })),
    );
  }

  getNews(symbol: string, limit = 8): Observable<AlphaNewsItem[]> {
    return this.callNewsApi('/everything', {
      q: `${symbol} stock`,
      sortBy: 'publishedAt',
      language: 'en',
      pageSize: String(limit),
    }).pipe(
      map((raw) => {
        const feed = this.toArray<GenericRecord>(raw['articles']);
        return feed
          .map((item) => ({
            title: this.toText(item['title']),
            source: this.toText(this.toRecord(item['source'])['name']),
            url: this.toText(item['url']),
            timePublished: this.normalizeDateTime(
              this.toText(item['publishedAt']),
            ),
            summary:
              this.toText(item['description']) || this.toText(item['content']),
          }))
          .filter((item) => item.title && item.url);
      }),
    );
  }

  getTechnicalLatest(
    symbol: string,
    indicatorFunction: 'RSI' | 'SMA',
    timePeriod: number,
  ): Observable<AlphaTechnicalValue | null> {
    return this.callTwelveDataApi(`/${indicatorFunction.toLowerCase()}`, {
      symbol,
      interval: '1day',
      time_period: String(timePeriod),
      series_type: 'close',
    }).pipe(
      map((raw) => {
        const values = this.toArray<GenericRecord>(raw['values']);
        if (!values.length) {
          return null;
        }

        const latestRow = values[0];
        const latestDate = this.normalizeDate(
          this.toText(latestRow['datetime']),
        );
        const metricKey = indicatorFunction.toLowerCase();
        const metricValue = this.toNumber(latestRow[metricKey]);
        if (!latestDate || !Number.isFinite(metricValue) || metricValue === 0) {
          return null;
        }

        return {
          date: latestDate,
          value: metricValue,
        };
      }),
    );
  }

  getEconomicSeries(
    indicatorFunction: 'CPI' | 'FEDERAL_FUNDS_RATE' | 'UNEMPLOYMENT',
  ): Observable<AlphaEconomicPoint[]> {
    const fredSeriesMap: Record<typeof indicatorFunction, string> = {
      CPI: 'CPIAUCSL',
      FEDERAL_FUNDS_RATE: 'FEDFUNDS',
      UNEMPLOYMENT: 'UNRATE',
    };

    return this.callFredApi('/series/observations', {
      series_id: fredSeriesMap[indicatorFunction],
      file_type: 'json',
      sort_order: 'asc',
    }).pipe(
      map((raw) => {
        const rows = this.toArray<GenericRecord>(raw['observations']);
        return rows
          .map((row) => ({
            date: this.toText(row['date']),
            value: this.toNumber(row['value']),
          }))
          .filter((row) => row.date && Number.isFinite(row.value))
          .sort((a, b) => a.date.localeCompare(b.date));
      }),
    );
  }

  private callTwelveDataApi(
    path: string,
    params: Record<string, string>,
  ): Observable<GenericRecord> {
    let httpParams = new HttpParams().set('apikey', this.twelveDataApiKey);
    for (const [key, value] of Object.entries(params)) {
      httpParams = httpParams.set(key, value);
    }

    return this.http
      .get<GenericRecord>(`${this.twelveDataBaseUrl}${path}`, {
        params: httpParams,
      })
      .pipe(map((raw) => this.assertTwelveDataResponse(raw)));
  }

  private callFredApi(
    path: string,
    params: Record<string, string>,
  ): Observable<GenericRecord> {
    let httpParams = new HttpParams().set('api_key', this.fredApiKey);
    for (const [key, value] of Object.entries(params)) {
      httpParams = httpParams.set(key, value);
    }

    return this.http
      .get<GenericRecord>(`${this.fredBaseUrl}${path}`, {
        params: httpParams,
      })
      .pipe(map((raw) => this.assertFredResponse(raw)));
  }

  private callNewsApi(
    path: string,
    params: Record<string, string>,
  ): Observable<GenericRecord> {
    let httpParams = new HttpParams().set('apiKey', this.newsApiKey);
    for (const [key, value] of Object.entries(params)) {
      httpParams = httpParams.set(key, value);
    }

    return this.http
      .get<GenericRecord>(`${this.newsApiBaseUrl}${path}`, {
        params: httpParams,
      })
      .pipe(map((raw) => this.assertValidResponse(raw)));
  }

  private assertTwelveDataResponse(raw: GenericRecord): GenericRecord {
    const status = this.toText(raw['status']);
    if (status === 'error') {
      throw new Error(
        this.toText(raw['message']) ||
          'Request ke Twelve Data gagal. Coba lagi beberapa saat.',
      );
    }

    return raw;
  }

  private assertFredResponse(raw: GenericRecord): GenericRecord {
    const errorCode = this.toText(raw['error_code']);
    if (errorCode) {
      throw new Error(
        this.toText(raw['error_message']) || 'Request ke FRED gagal.',
      );
    }

    return raw;
  }

  private assertValidResponse(raw: GenericRecord): GenericRecord {
    const status = this.toText(raw['status']);
    if (status === 'error') {
      throw new Error(
        this.toText(raw['message']) || 'Request news gagal. Coba lagi nanti.',
      );
    }

    return raw;
  }

  private normalizeDate(value: string): string {
    if (!value) {
      return '';
    }

    const match = value.match(/^\d{4}-\d{2}-\d{2}/);
    return match ? match[0] : value;
  }

  private normalizeDateTime(value: string): string {
    if (!value) {
      return '';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toISOString().replace('T', ' ').slice(0, 16);
  }

  private toRecord(value: unknown): GenericRecord {
    return typeof value === 'object' && value !== null
      ? (value as GenericRecord)
      : {};
  }

  private toArray<T>(value: unknown): T[] {
    return Array.isArray(value) ? (value as T[]) : [];
  }

  private toText(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private toNumber(value: unknown): number {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0;
    }

    const parsed = Number.parseFloat(this.toText(value));
    return Number.isFinite(parsed) ? parsed : 0;
  }
}
