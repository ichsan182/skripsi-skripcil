import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CurrentUserService } from '../../../core/services/current-user.service';

interface FinancialData {
  pendapatan: number;
  pengeluaranWajib: number;
  tanggalPemasukan: number;
  hutangWajib: number;
  estimasiTabungan: number;
  danaDarurat: number;
}

@Component({
  selector: 'app-result',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './result.html',
  styleUrl: './result.css',
})
export class Result {
  private readonly router = inject(Router);
  private readonly currentUserService = inject(CurrentUserService);

  get user(): {
    name: string;
    level: number;
    financialData: FinancialData;
  } {
    return this.currentUserService.getCurrentUserOrDefault({
      name: 'User',
      level: 1,
      financialData: {} as FinancialData,
    });
  }

  get userName(): string {
    return this.user.name || 'User';
  }

  get userLevel(): number {
    return this.user.level || 1;
  }

  get financialData(): FinancialData {
    return (
      this.user.financialData ||
      ({
        pendapatan: 0,
        pengeluaranWajib: 0,
        tanggalPemasukan: 1,
        hutangWajib: 0,
        estimasiTabungan: 0,
        danaDarurat: 0,
      } as FinancialData)
    );
  }

  get uangSisa(): number {
    const fd = this.financialData;
    return fd.pendapatan - fd.pengeluaranWajib - fd.hutangWajib;
  }

  get resultDescription(): string {
    const level = this.userLevel;
    const fd = this.financialData;

    switch (level) {
      case 2:
        return `Kamu masih memiliki hutang sebesar ${this.formatRupiah(fd.hutangWajib)} per bulan. Fokus lunasi hutang terlebih dahulu agar keuanganmu lebih sehat. Setelah hutang lunas, kamu bisa naik ke Level 3!`;
      case 4:
        return `Luar biasa! Tabunganmu sudah mencapai ${this.formatRupiah(fd.estimasiTabungan)} dan dana daruratmu ${this.formatRupiah(fd.danaDarurat)}. Kamu siap untuk mulai berinvestasi dan mengembangkan kekayaanmu!`;
      default:
        return `Mantap! Kamu sudah bebas dari hutang wajib. Sekarang fokus bangun tabungan (minimal Rp 10.000.000) dan dana darurat (minimal ${this.formatRupiah(fd.pendapatan * 3)}) untuk naik ke Level 4.`;
    }
  }

  get levelLabel(): string {
    switch (this.userLevel) {
      case 2:
        return 'Pelunasan Hutang';
      case 3:
        return 'Membangun Fondasi';
      case 4:
        return 'Siap Investasi';
      default:
        return 'Pemula';
    }
  }

  formatRupiah(amount: number): string {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  }

  goToHome(): void {
    this.router.navigateByUrl('/home');
  }
}
