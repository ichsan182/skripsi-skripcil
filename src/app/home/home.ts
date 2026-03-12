import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Sidebar } from '../shared/components/sidebar/sidebar';

type ExpenseCategory = 'makanan' | 'travel' | 'entertainment' | 'subscription';

interface ExpenseRow {
  date: string;
  amount: string;
  description: string;
  categoryLabel: ExpenseCategory;
  categoryClass: string;
  day: number;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, Sidebar],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  showMentions = {
    saldo: false,
    pemasukan: true,
    pengeluaran: true,
    hutang: true,
  };

  saldoPercentage = this.generatePercentage();
  pemasukanPercentage = this.generatePercentage();
  pengeluaranPercentage = this.generatePercentage();
  hutangPercentage = this.generatePercentage();

  currentLevel = 2;
  levelProgress = 60;

  readonly monthNames = [
    'Januari',
    'Februari',
    'Maret',
    'April',
    'Mei',
    'Juni',
    'Juli',
    'Agustus',
    'September',
    'Oktober',
    'November',
    'Desember',
  ];

  selectedMonthIndex = new Date().getMonth();
  selectedYear = new Date().getFullYear();
  selectedMonthValue = this.toMonthInputValue(
    this.selectedYear,
    this.selectedMonthIndex,
  );
  monthlyExpenses: ExpenseRow[] = [];

  readonly levelImages = [
    'assets/level/level_1.svg',
    'assets/level/level_2.svg',
    'assets/level/level_3.svg',
    'assets/level/level_4.svg',
    'assets/level/level_5.svg',
    'assets/level/level-6.svg',
    'assets/level/level_7.svg',
  ];

  readonly levelTasks = [
    'Mulai mencatat pengeluaran harianmu',
    'Catat transaksi selama 7 hari berturut-turut',
    'Mengosongkan hutang',
    'Capai tabungan darurat 3x pengeluaran',
    'Mulai investasi pertama kamu',
    'Raih streak 100 hari berturut-turut',
    'Capai semua target keuangan',
  ];

  constructor() {
    this.refreshMonthlyExpenses();
  }

  get currentLevelImage(): string {
    return this.levelImages[this.currentLevel - 1];
  }

  get nextLevelImage(): string | null {
    return this.currentLevel < 7 ? this.levelImages[this.currentLevel] : null;
  }

  get currentLevelTask(): string {
    return this.levelTasks[this.currentLevel - 1];
  }

  get currentMonthYearLabel(): string {
    return `${this.monthNames[this.selectedMonthIndex]} ${this.selectedYear}`;
  }

  changeMonth(step: number): void {
    const totalMonths = this.selectedYear * 12 + this.selectedMonthIndex + step;
    this.selectedYear = Math.floor(totalMonths / 12);
    this.selectedMonthIndex = ((totalMonths % 12) + 12) % 12;
    this.selectedMonthValue = this.toMonthInputValue(
      this.selectedYear,
      this.selectedMonthIndex,
    );
    this.refreshMonthlyExpenses();
  }

  onPickMonth(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.value) {
      return;
    }

    const [yearRaw, monthRaw] = input.value.split('-');
    const year = Number(yearRaw);
    const month = Number(monthRaw) - 1;

    if (Number.isNaN(year) || Number.isNaN(month) || month < 0 || month > 11) {
      return;
    }

    this.selectedYear = year;
    this.selectedMonthIndex = month;
    this.selectedMonthValue = this.toMonthInputValue(year, month);
    this.refreshMonthlyExpenses();
  }

  private refreshMonthlyExpenses(): void {
    const daysInMonth = new Date(
      this.selectedYear,
      this.selectedMonthIndex + 1,
      0,
    ).getDate();
    const totalRows = this.randomInRange(10, 18);

    this.monthlyExpenses = Array.from({ length: totalRows }, () =>
      this.createRandomExpense(daysInMonth),
    ).sort((a, b) => a.day - b.day);
  }

  private createRandomExpense(daysInMonth: number): ExpenseRow {
    const day = this.randomInRange(1, daysInMonth);
    const categories: Array<{
      label: ExpenseCategory;
      className: string;
      descriptions: string[];
    }> = [
      {
        label: 'makanan',
        className: 'category-makanan',
        descriptions: [
          'Makan siang kantor',
          'Belanja bahan dapur',
          'Ngopi sore',
          'Makan malam keluarga',
        ],
      },
      {
        label: 'travel',
        className: 'category-travel',
        descriptions: [
          'Tiket perjalanan',
          'Biaya hotel',
          'Transportasi bandara',
          'Biaya tol perjalanan',
        ],
      },
      {
        label: 'entertainment',
        className: 'category-entertainment',
        descriptions: [
          'Nonton bioskop',
          'Main game online',
          'Langganan streaming',
          'Beli buku hiburan',
        ],
      },
      {
        label: 'subscription',
        className: 'category-subscription',
        descriptions: [
          'Langganan aplikasi',
          'Paket cloud storage',
          'Biaya premium musik',
          'Langganan tools kerja',
        ],
      },
    ];

    const chosenCategory =
      categories[this.randomInRange(0, categories.length - 1)];
    const description =
      chosenCategory.descriptions[
        this.randomInRange(0, chosenCategory.descriptions.length - 1)
      ];
    const amount = this.randomInRange(25000, 850000);

    return {
      day,
      date: `${String(day).padStart(2, '0')} ${
        this.monthNames[this.selectedMonthIndex]
      } ${this.selectedYear}`,
      amount: this.formatRupiah(amount),
      description,
      categoryLabel: chosenCategory.label,
      categoryClass: chosenCategory.className,
    };
  }

  private formatRupiah(amount: number): string {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  private toMonthInputValue(year: number, monthIndex: number): string {
    return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
  }

  private randomInRange(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private generatePercentage(): number {
    return Math.floor(Math.random() * 100) + 1;
  }
}
