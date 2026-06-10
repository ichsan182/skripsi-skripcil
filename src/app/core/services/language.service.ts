import { Injectable, signal } from '@angular/core';

export type Language = 'id' | 'en';

type TranslationMap = Record<string, string>;

const TRANSLATIONS: Record<Language, TranslationMap> = {
  id: {
    // Sidebar shell
    'sidebar.mainMenu': 'Main Menu',
    'sidebar.logout': 'Keluar',
    'sidebar.openMenu': 'Buka menu',
    'sidebar.closeMenu': 'Tutup menu',

    // Rolling budget panel
    'rolling.title': 'Rolling Budget',
    'rolling.budgetPeriod': 'Budget periode',
    'rolling.used': 'Terpakai',
    'rolling.remaining': 'Sisa budget',
    'rolling.daysLeft': 'Sisa hari',
    'rolling.days': 'hari',
    'rolling.safe': 'Aman ✓',
    'rolling.over': 'Over !',
    'rolling.todayTitle': 'Hari Ini',
    'rolling.percentUsed': 'terpakai',
    'rolling.todaySub': 'sisa dari jatah hari ini',
    'rolling.quota': 'Jatah',

    // Navigation
    'nav.home': 'Home',
    'nav.transactions': 'Transaksi',
    'nav.investment': 'Investasi',
    'nav.tools': 'Tools',
    'nav.education': 'Edukasi',

    // Profile modal
    'profile.editTitle': 'Edit Profil',
    'profile.name': 'Nama',
    'profile.email': 'Email',
    'profile.namePlaceholder': 'Masukkan nama',
    'profile.emailPlaceholder': 'Masukkan email',
    'profile.language': 'Bahasa',
    'profile.cancel': 'Batal',
    'profile.save': 'Simpan Profil',
    'profile.close': 'Tutup',

    // Validation messages
    'profile.nameRequired': 'Nama wajib diisi.',
    'profile.emailInvalid': 'Email tidak valid.',
  },
  en: {
    // Sidebar shell
    'sidebar.mainMenu': 'Main Menu',
    'sidebar.logout': 'Logout',
    'sidebar.openMenu': 'Open menu',
    'sidebar.closeMenu': 'Close menu',

    // Rolling budget panel
    'rolling.title': 'Rolling Budget',
    'rolling.budgetPeriod': 'Budget period',
    'rolling.used': 'Used',
    'rolling.remaining': 'Remaining budget',
    'rolling.daysLeft': 'Days left',
    'rolling.days': 'days',
    'rolling.safe': 'Safe ✓',
    'rolling.over': 'Over !',
    'rolling.todayTitle': 'Today',
    'rolling.percentUsed': 'used',
    'rolling.todaySub': "remaining from today's budget",
    'rolling.quota': 'Quota',

    // Navigation
    'nav.home': 'Home',
    'nav.transactions': 'Transactions',
    'nav.investment': 'Investment',
    'nav.tools': 'Tools',
    'nav.education': 'Education',

    // Profile modal
    'profile.editTitle': 'Edit Profile',
    'profile.name': 'Name',
    'profile.email': 'Email',
    'profile.namePlaceholder': 'Enter name',
    'profile.emailPlaceholder': 'Enter email',
    'profile.language': 'Language',
    'profile.cancel': 'Cancel',
    'profile.save': 'Save Profile',
    'profile.close': 'Close',

    // Validation messages
    'profile.nameRequired': 'Name is required.',
    'profile.emailInvalid': 'Invalid email address.',
  },
};

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly _lang = signal<Language>(
    (localStorage.getItem('appLang') as Language | null) === 'en' ? 'en' : 'id',
  );

  /** Read-only signal — use in templates with `langSvc.lang()` */
  readonly lang = this._lang.asReadonly();

  /** Translate a key to the current language. Returns the key if not found. */
  t(key: string): string {
    return TRANSLATIONS[this._lang()][key] ?? key;
  }

  setLanguage(lang: Language): void {
    this._lang.set(lang);
    localStorage.setItem('appLang', lang);
  }
}
