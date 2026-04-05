import { Injectable } from '@angular/core';

interface CurrentUserRecord {
  id?: number | string;
}

interface SetCurrentUserOptions {
  syncSession?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class CurrentUserService {
  private readonly storageKey = 'currentUser';

  getCurrentUser<T extends object = CurrentUserRecord>(): T | null {
    const raw = localStorage.getItem(this.storageKey);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  getCurrentUserOrDefault<T extends object>(fallback: T): T {
    return this.getCurrentUser<T>() ?? fallback;
  }

  getCurrentUserId(): number | string | null {
    const user = this.getCurrentUser<CurrentUserRecord>();
    return user?.id ?? null;
  }

  setCurrentUser(user: object, options: SetCurrentUserOptions = {}): void {
    const serialized = JSON.stringify(user);
    localStorage.setItem(this.storageKey, serialized);

    if (options.syncSession) {
      sessionStorage.setItem(this.storageKey, serialized);
    }
  }

  patchCurrentUser(
    patch: Partial<object>,
    options: SetCurrentUserOptions = {},
  ): void {
    const current = this.getCurrentUser<object>() ?? {};
    this.setCurrentUser({ ...current, ...(patch as object) }, options);
  }

  clearCurrentUser(options: SetCurrentUserOptions = {}): void {
    localStorage.removeItem(this.storageKey);
    if (options.syncSession) {
      sessionStorage.removeItem(this.storageKey);
    }
  }
}
