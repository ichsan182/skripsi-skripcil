import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { USERS_API_URL } from '../config/app-api.config';

export interface WatchlistItem {
  symbol: string;
  name: string;
  type: string;
  region: string;
  currency: string;
  createdAt: string;
}

export interface InvestmentWatchlistState {
  items: WatchlistItem[];
  selectedSymbol: string | null;
  updatedAt: string;
}

interface StoredUser {
  id?: number | string;
  investmentWatchlist?: Partial<InvestmentWatchlistState>;
}

interface UserRecord {
  id: number | string;
  investmentWatchlist?: Partial<InvestmentWatchlistState>;
}

@Injectable({ providedIn: 'root' })
export class InvestmentWatchlistService {
  private readonly httpClient = inject(HttpClient);

  async loadCurrentUserWatchlist(): Promise<InvestmentWatchlistState> {
    const userId = this.getCurrentUserId();
    if (!userId) {
      return this.createDefaultState();
    }

    const user = await firstValueFrom(
      this.httpClient.get<UserRecord>(`${USERS_API_URL}/${userId}`),
    );

    const state = this.normalizeState(user.investmentWatchlist);

    if (!user.investmentWatchlist) {
      await this.patchState(userId, state);
    }

    return state;
  }

  async addItem(
    item: Omit<WatchlistItem, 'createdAt'>,
  ): Promise<InvestmentWatchlistState> {
    const current = await this.loadCurrentUserWatchlist();
    const symbol = item.symbol.trim().toUpperCase();
    if (!symbol) {
      return current;
    }

    const exists = current.items.some((entry) => entry.symbol === symbol);
    const nextItems = exists
      ? current.items
      : [
          {
            ...item,
            symbol,
            createdAt: new Date().toISOString(),
          },
          ...current.items,
        ];

    const nextState: InvestmentWatchlistState = {
      items: nextItems,
      selectedSymbol: current.selectedSymbol ?? symbol,
      updatedAt: new Date().toISOString(),
    };

    return this.saveCurrentUserWatchlist(nextState);
  }

  async removeItem(symbol: string): Promise<InvestmentWatchlistState> {
    const current = await this.loadCurrentUserWatchlist();
    const normalizedSymbol = symbol.trim().toUpperCase();

    const nextItems = current.items.filter(
      (item) => item.symbol !== normalizedSymbol,
    );

    const nextState: InvestmentWatchlistState = {
      items: nextItems,
      selectedSymbol:
        current.selectedSymbol === normalizedSymbol
          ? (nextItems[0]?.symbol ?? null)
          : current.selectedSymbol,
      updatedAt: new Date().toISOString(),
    };

    return this.saveCurrentUserWatchlist(nextState);
  }

  async setSelectedSymbol(
    symbol: string | null,
  ): Promise<InvestmentWatchlistState> {
    const current = await this.loadCurrentUserWatchlist();
    const normalized = symbol?.trim().toUpperCase() ?? null;

    const nextState: InvestmentWatchlistState = {
      ...current,
      selectedSymbol: normalized,
      updatedAt: new Date().toISOString(),
    };

    return this.saveCurrentUserWatchlist(nextState);
  }

  async saveCurrentUserWatchlist(
    state: InvestmentWatchlistState,
  ): Promise<InvestmentWatchlistState> {
    const userId = this.getCurrentUserId();
    const normalized = this.normalizeState(state);
    if (!userId) {
      return normalized;
    }

    await this.patchState(userId, normalized);
    return normalized;
  }

  private getCurrentUserId(): number | string | null {
    const rawCurrentUser = localStorage.getItem('currentUser');
    if (!rawCurrentUser) {
      return null;
    }

    try {
      const currentUser = JSON.parse(rawCurrentUser) as StoredUser;
      return currentUser.id ?? null;
    } catch {
      return null;
    }
  }

  private async patchState(
    userId: number | string,
    state: InvestmentWatchlistState,
  ): Promise<void> {
    await firstValueFrom(
      this.httpClient.patch(`${USERS_API_URL}/${userId}`, {
        investmentWatchlist: state,
      }),
    );

    const rawCurrentUser = localStorage.getItem('currentUser');
    if (!rawCurrentUser) {
      return;
    }

    try {
      const currentUser = JSON.parse(rawCurrentUser) as StoredUser;
      currentUser.investmentWatchlist = state;
      localStorage.setItem('currentUser', JSON.stringify(currentUser));
    } catch {
      // no-op
    }
  }

  private createDefaultState(): InvestmentWatchlistState {
    return {
      items: [],
      selectedSymbol: null,
      updatedAt: new Date().toISOString(),
    };
  }

  private normalizeState(
    raw?: Partial<InvestmentWatchlistState>,
  ): InvestmentWatchlistState {
    const items = Array.isArray(raw?.items)
      ? raw.items
          .map((item) => ({
            symbol: (item.symbol ?? '').trim().toUpperCase(),
            name: (item.name ?? '').trim(),
            type: (item.type ?? '').trim(),
            region: (item.region ?? '').trim(),
            currency: (item.currency ?? '').trim(),
            createdAt: item.createdAt ?? new Date().toISOString(),
          }))
          .filter((item) => item.symbol && item.name)
      : [];

    const uniqueItems = Array.from(
      new Map(items.map((item) => [item.symbol, item])).values(),
    );

    const selected = raw?.selectedSymbol?.trim().toUpperCase() ?? null;
    const selectedSymbol = uniqueItems.some((item) => item.symbol === selected)
      ? selected
      : (uniqueItems[0]?.symbol ?? null);

    return {
      items: uniqueItems,
      selectedSymbol,
      updatedAt: raw?.updatedAt ?? new Date().toISOString(),
    };
  }
}
