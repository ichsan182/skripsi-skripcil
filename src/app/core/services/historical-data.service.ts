// src/app/services/yahoo-finance.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

export interface PriceData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface YahooHistoryItem {
  date: string;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
}

interface YahooHistoryResponse {
  body?: Record<string, YahooHistoryItem>;
}

interface YahooQuoteItem {
  regularMarketPrice?: number;
  regularMarketChange?: number;
  regularMarketChangePercent?: number;
}

interface YahooQuoteResponse {
  body?: YahooQuoteItem[];
}

@Injectable({ providedIn: 'root' })
export class YahooFinanceService {
  // Lewat proxy saat dev — ubah ke backend URL saat production
  private readonly BASE = '/rapidapi';

  constructor(private http: HttpClient) {}

  // Ambil data historis EOD
  // symbol: 'GC=F' (gold), 'SI=F' (silver), 'BTC-USD', '^GSPC' (S&P500), '^IXIC' (NASDAQ)
  getHistoricalPrices(
    symbol: string,
    range = '5y',
    interval = '1wk',
  ): Observable<PriceData[]> {
    void range;

    const url = `${this.BASE}/api/v1/markets/stock/history`;
    const params = {
      symbol,
      interval,
      diffandsplits: 'false',
    };

    return this.http.get<YahooHistoryResponse>(url, { params }).pipe(
      map((res) => {
        const body = res.body ?? {};
        const rows = Object.values(body);

        return rows
          .filter((item) => Boolean(item.date))
          .map((item) => ({
            date: item.date,
            open: item.open ?? 0,
            high: item.high ?? 0,
            low: item.low ?? 0,
            close: item.close ?? 0,
            volume: item.volume ?? 0,
          }))
          .filter((item) => Number.isFinite(item.close) && item.close > 0)
          .sort((a, b) => a.date.localeCompare(b.date));
      }),
    );
  }

  // Harga terkini (quote)
  getCurrentPrice(
    symbol: string,
  ): Observable<{ price: number; change: number; changePercent: number }> {
    const url = `${this.BASE}/api/v1/markets/stock/quotes`;
    return this.http
      .get<YahooQuoteResponse>(url, { params: { ticker: symbol } })
      .pipe(
        map((res) => {
          const p = res.body?.[0];
          return {
            price: p?.regularMarketPrice ?? 0,
            change: p?.regularMarketChange ?? 0,
            changePercent: p?.regularMarketChangePercent ?? 0,
          };
        }),
      );
  }
}
