import { Injectable } from '@angular/core';

export type StreakTestMode = 'realistic' | 'always-streak';

@Injectable({
  providedIn: 'root',
})
export class TestingTimeService {
  private readonly storageKey = 'testingReferenceDate';
  private readonly streakModeKey = 'testingStreakMode';
  private readonly checkpointKey = 'testingCheckpoint';

  getReferenceDate(): Date {
    const raw = localStorage.getItem(this.storageKey);
    if (!raw) {
      return this.startOfDay(new Date());
    }

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      return this.startOfDay(new Date());
    }

    return this.startOfDay(parsed);
  }

  isCustomDateActive(): boolean {
    return Boolean(localStorage.getItem(this.storageKey));
  }

  setReferenceDate(date: Date): void {
    const normalized = this.startOfDay(date);
    const dateKey = this.toDateKey(normalized);
    localStorage.setItem(this.storageKey, dateKey);
  }

  clearReferenceDate(): void {
    localStorage.removeItem(this.storageKey);
  }

  toDateInputValue(date: Date): string {
    return this.toDateKey(this.startOfDay(date));
  }

  private startOfDay(date: Date): Date {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
  }

  private toDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  getStreakTestMode(): StreakTestMode {
    const raw = localStorage.getItem(this.streakModeKey);
    return raw === 'always-streak' ? 'always-streak' : 'realistic';
  }

  setStreakTestMode(mode: StreakTestMode): void {
    localStorage.setItem(this.streakModeKey, mode);
  }

  saveCheckpoint(data: string): void {
    localStorage.setItem(this.checkpointKey, data);
  }

  loadCheckpoint(): string | null {
    return localStorage.getItem(this.checkpointKey);
  }

  hasCheckpoint(): boolean {
    return Boolean(localStorage.getItem(this.checkpointKey));
  }
}
