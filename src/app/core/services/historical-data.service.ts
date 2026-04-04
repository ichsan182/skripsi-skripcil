// src/app/services/yahoo-finance.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { MARKET_DATA_API } from '../config/app-api.config';

const YAHOO_FINANCE_API = MARKET_DATA_API.yahooFinance;

export type YahooHistoryInterval = '1d' | '1wk' | '1mo';

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
  constructor(private http: HttpClient) {}

  // Ambil data historis EOD
  // symbol: 'GC=F' (gold), 'SI=F' (silver), 'BTC-USD', '^GSPC' (S&P500), '^IXIC' (NASDAQ)
  getHistoricalPrices(
    symbol: string,
    range = '5y',
    interval: YahooHistoryInterval = '1wk',
  ): Observable<PriceData[]> {
    const url = `${YAHOO_FINANCE_API.baseUrl}${YAHOO_FINANCE_API.endpoints.history}`;
    const params = {
      symbol,
      range,
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
    const url = `${YAHOO_FINANCE_API.baseUrl}${YAHOO_FINANCE_API.endpoints.quotes}`;
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
