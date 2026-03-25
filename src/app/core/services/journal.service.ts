import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export type ChatSender = 'user' | 'assistant';
export type ExpenseCategory =
  | 'makanan'
  | 'travel'
  | 'entertainment'
  | 'subscription'
  | 'bills';

export interface ChatMessage {
  id: number;
  sender: ChatSender;
  text: string;
  time: string;
}

export interface ExpenseEntry {
  amount: number;
  description: string;
  category: ExpenseCategory;
}

export interface IncomeEntry {
  amount: number;
  description: string;
  source: string;
}

export interface UserJournal {
  nextChatMessageId: number;
  chatByDate: Record<string, ChatMessage[]>;
  expensesByDate: Record<string, ExpenseEntry[]>;
  incomesByDate: Record<string, IncomeEntry[]>;
}

interface StoredUser {
  id?: number | string;
}

interface UserRecord {
  id: number | string;
  journal?: Partial<UserJournal>;
}

@Injectable({
  providedIn: 'root',
})
export class JournalService {
  private readonly httpClient = inject(HttpClient);
  private readonly usersApiUrl = 'http://localhost:3000/users';

  async loadCurrentUserJournal(): Promise<UserJournal> {
    const userId = this.getCurrentUserId();
    if (!userId) {
      return this.createEmptyJournal();
    }

    const user = await firstValueFrom(
      this.httpClient.get<UserRecord>(`${this.usersApiUrl}/${userId}`),
    );

    const journal = this.normalizeJournal(user.journal);

    if (!user.journal) {
      await this.patchJournal(userId, journal);
    }

    return journal;
  }

  async saveCurrentUserJournal(journal: UserJournal): Promise<UserJournal> {
    const userId = this.getCurrentUserId();
    const normalized = this.normalizeJournal(journal);

    if (!userId) {
      return normalized;
    }

    await this.patchJournal(userId, normalized);
    return normalized;
  }

  async addChatMessageWithAutoExpense(
    dateKey: string,
    text: string,
    selectedDateLabel: string,
  ): Promise<UserJournal> {
    const journal = await this.loadCurrentUserJournal();
    const trimmedText = text.trim();
    if (!trimmedText) {
      return journal;
    }

    this.ensureChatBucket(journal, dateKey).push({
      id: journal.nextChatMessageId++,
      sender: 'user',
      text: trimmedText,
      time: this.getCurrentTimeLabel(),
    });

    const parsedExpense = this.parseExpenseFromMessage(trimmedText);
    if (parsedExpense) {
      this.ensureExpenseBucket(journal, dateKey).unshift(parsedExpense);
    }

    const assistantText = parsedExpense
      ? `Dicatat: ${this.formatCurrency(parsedExpense.amount)} untuk "${parsedExpense.description}" kategori ${parsedExpense.category}.`
      : `Catatan untuk ${selectedDateLabel} sudah disimpan.`;

    this.ensureChatBucket(journal, dateKey).push({
      id: journal.nextChatMessageId++,
      sender: 'assistant',
      text: assistantText,
      time: this.getCurrentTimeLabel(),
    });

    return this.saveCurrentUserJournal(journal);
  }

  async addExpense(dateKey: string, entry: ExpenseEntry): Promise<UserJournal> {
    const journal = await this.loadCurrentUserJournal();
    this.ensureExpenseBucket(journal, dateKey).unshift(entry);
    return this.saveCurrentUserJournal(journal);
  }

  async addIncome(dateKey: string, entry: IncomeEntry): Promise<UserJournal> {
    const journal = await this.loadCurrentUserJournal();
    this.ensureIncomeBucket(journal, dateKey).unshift(entry);
    return this.saveCurrentUserJournal(journal);
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

  private async patchJournal(
    userId: number | string,
    journal: UserJournal,
  ): Promise<void> {
    await firstValueFrom(
      this.httpClient.patch(`${this.usersApiUrl}/${userId}`, {
        journal,
      }),
    );
  }

  private createEmptyJournal(): UserJournal {
    return {
      nextChatMessageId: 1,
      chatByDate: {},
      expensesByDate: {},
      incomesByDate: {},
    };
  }

  private normalizeJournal(journal?: Partial<UserJournal>): UserJournal {
    return {
      nextChatMessageId: Math.max(1, Number(journal?.nextChatMessageId) || 1),
      chatByDate: this.cloneRecordOfArrays(journal?.chatByDate),
      expensesByDate: this.cloneRecordOfArrays(journal?.expensesByDate),
      incomesByDate: this.cloneRecordOfArrays(journal?.incomesByDate),
    };
  }

  private cloneRecordOfArrays<T>(
    source?: Record<string, T[]>,
  ): Record<string, T[]> {
    if (!source) {
      return {};
    }

    const cloned: Record<string, T[]> = {};
    for (const [key, items] of Object.entries(source)) {
      cloned[key] = Array.isArray(items) ? [...items] : [];
    }
    return cloned;
  }

  private ensureChatBucket(
    journal: UserJournal,
    dateKey: string,
  ): ChatMessage[] {
    if (!journal.chatByDate[dateKey]) {
      journal.chatByDate[dateKey] = [];
    }

    return journal.chatByDate[dateKey];
  }

  private ensureExpenseBucket(
    journal: UserJournal,
    dateKey: string,
  ): ExpenseEntry[] {
    if (!journal.expensesByDate[dateKey]) {
      journal.expensesByDate[dateKey] = [];
    }

    return journal.expensesByDate[dateKey];
  }

  private ensureIncomeBucket(
    journal: UserJournal,
    dateKey: string,
  ): IncomeEntry[] {
    if (!journal.incomesByDate[dateKey]) {
      journal.incomesByDate[dateKey] = [];
    }

    return journal.incomesByDate[dateKey];
  }

  private parseExpenseFromMessage(text: string): ExpenseEntry | null {
    const trimmed = text.trim();

    // Support both "10000 makan" and "makan 10000"
    const numberFirst = /^(\d[\d.,]*)\s+(.+)$/.exec(trimmed);
    const numberLast = /^(.+?)\s+(\d[\d.,]*)$/.exec(trimmed);

    let rawAmount: string;
    let description: string;

    if (numberFirst) {
      rawAmount = numberFirst[1];
      description = numberFirst[2].trim().toLowerCase();
    } else if (numberLast) {
      rawAmount = numberLast[2];
      description = numberLast[1].trim().toLowerCase();
    } else {
      return null;
    }

    const amount = Number.parseInt(rawAmount.replace(/\D/g, ''), 10);

    if (!Number.isFinite(amount) || amount <= 0 || !description) {
      return null;
    }

    return {
      amount,
      description,
      category: this.inferCategory(description),
    };
  }

  private inferCategory(description: string): ExpenseCategory {
    if (/(makan|kuliner|sarapan|siang|malam|snack|kopi)/i.test(description)) {
      return 'makanan';
    }

    if (
      /(travel|transport|bensin|ojek|gojek|grab|tol|parkir)/i.test(description)
    ) {
      return 'travel';
    }

    if (
      /(entertainment|hiburan|nonton|bioskop|game|rekreasi)/i.test(description)
    ) {
      return 'entertainment';
    }

    if (
      /(subscription|langganan|netflix|spotify|youtube|chatgpt)/i.test(
        description,
      )
    ) {
      return 'subscription';
    }

    if (/(bill|tagihan|listrik|air|internet|pln|wifi|gas)/i.test(description)) {
      return 'bills';
    }

    return 'makanan';
  }

  private getCurrentTimeLabel(): string {
    return new Intl.DateTimeFormat('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date());
  }

  private formatCurrency(amount: number): string {
    return `Rp ${new Intl.NumberFormat('id-ID').format(amount)}`;
  }
}
