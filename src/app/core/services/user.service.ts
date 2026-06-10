/**
 * UserService — facade antara komponen dan backend Spring Boot.
 *
 * SEKARANG: semua operasi menggunakan localStorage sebagai storage lokal.
 * MIGRASI KE SPRING BOOT: ganti isi tiap method dengan HTTP call — interface
 * yang dipanggil komponen tidak perlu berubah sama sekali.
 *
 * Pemetaan endpoint Spring Boot (untuk referensi migrasi):
 *   getCurrentUser()     → GET  /api/users/{id}
 *   saveStreak()         → PUT  /api/users/{id}  (field: streak)
 *   syncFinancialData()  → PATCH /api/users/{id}/financial-data
 *   getDebtSnapshots()   → GET  /api/users/{id}/debt-snapshots
 *   saveDebtSnapshot()   → POST /api/users/{id}/debt-snapshots
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { USERS_API_URL } from '../config/app-api.config';
import { CurrentUserService } from './current-user.service';
import { User } from '../models/user.model';
import { FinancialData } from './journal.service';

// Tipe lokal agar tidak ada circular dependency ke home/
interface StreakRecord {
  current: number;
  longest: number;
  lastActiveDate: string;
  freezeUsed: boolean;
}

interface DebtMonthlySnapshot {
  consumptiveActiveTotal: number;
  productiveActiveTotal: number;
}

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private readonly http = inject(HttpClient);
  private readonly currentUserService = inject(CurrentUserService);
  private readonly debtSnapshotKey = 'homeDebtMonthlySnapshots';

  // Baca profil user dari cache lokal.
  // Migrasi: GET /api/users/{id}
  getCurrentUser(): User | null {
    return this.currentUserService.getCurrentUser<User>();
  }

  // Simpan streak ke cache lokal, lalu sync ke server secara async (non-blocking).
  // Migrasi: ganti patchCurrentUser + syncStreakToServer dengan PATCH /api/users/{id}/streak
  saveStreak(userId: string | number | null, streak: StreakRecord): void {
    this.currentUserService.patchCurrentUser({ streak });
    if (userId != null) {
      this.syncStreakToServer(userId, streak);
    }
  }

  // Tulis ulang financialData di cache lokal agar cold-start selalu baca data terbaru.
  // Migrasi: tidak perlu — server sudah jadi source of truth via JournalService.
  syncFinancialData(financialData: FinancialData): void {
    this.currentUserService.patchCurrentUser({ financialData });
  }

  // Baca snapshot hutang bulanan dari storage lokal.
  // Migrasi: GET /api/users/{id}/debt-snapshots
  getDebtSnapshots(): Record<string, DebtMonthlySnapshot> {
    try {
      const raw = localStorage.getItem(this.debtSnapshotKey);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (!parsed || typeof parsed !== 'object') return {};
      const result: Record<string, DebtMonthlySnapshot> = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (!value || typeof value !== 'object') continue;
        const snap = value as Partial<DebtMonthlySnapshot>;
        result[key] = {
          consumptiveActiveTotal: this.toPositiveInt(snap.consumptiveActiveTotal),
          productiveActiveTotal: this.toPositiveInt(snap.productiveActiveTotal),
        };
      }
      return result;
    } catch {
      return {};
    }
  }

  // Simpan snapshot hutang bulan tertentu ke storage lokal.
  // Migrasi: POST /api/users/{id}/debt-snapshots
  saveDebtSnapshot(monthKey: string, snapshot: DebtMonthlySnapshot): void {
    const existing = this.getDebtSnapshots();
    existing[monthKey] = snapshot;
    localStorage.setItem(this.debtSnapshotKey, JSON.stringify(existing));
  }

  // Sync streak ke server secara async — gagal dengan silent karena lokal sudah updated.
  // Saat migrasi: method ini dihapus, saveStreak langsung HTTP.
  private syncStreakToServer(userId: string | number, streak: StreakRecord): void {
    void (async () => {
      try {
        const serverUser = await firstValueFrom(
          this.http.get<Record<string, unknown>>(`${USERS_API_URL}/${userId}`),
        );
        await firstValueFrom(
          this.http.put(`${USERS_API_URL}/${userId}`, {
            ...serverUser,
            streak,
            id: userId,
          }),
        );
      } catch {
        // silent — state lokal sudah terupdate
      }
    })();
  }

  private toPositiveInt(value: unknown): number {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
  }
}
