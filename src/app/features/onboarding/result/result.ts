import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CurrentUserService } from '../../../core/services/current-user.service';
import { FinancialData } from '../../../core/services/journal.service';

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
      this.user.financialData || {
        pendapatan: 0,
        pengeluaranWajib: 0,
        tanggalPemasukan: 1,
        hutangWajib: 0,
        estimasiTabungan: 0,
        danaDarurat: 0,
      }
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
      case 1:
        return `Yuk mulai perjalanan finansialmu! Fokus kumpulkan dana darurat mini minimal Rp1.000.000 sebagai pondasi pertama keuanganmu.`;
      case 2:
        return `Kamu masih memiliki hutang konsumtif sebesar ${this.formatRupiah(fd.hutangWajib)} per bulan. Fokus lunasi hutang terlebih dahulu agar keuanganmu lebih sehat. Setelah hutang lunas, kamu bisa naik ke Level 3!`;
      case 3:
        return `Bagus! Kamu bebas dari hutang konsumtif. Sekarang fokus bangun dana darurat minimal ${this.formatRupiah(fd.pengeluaranWajib * 3)} (3x pengeluaran bulanan) untuk naik ke Level 4.`;
      case 4:
        return `Luar biasa! Dana daruratmu sudah terpenuhi. Tabunganmu saat ini ${this.formatRupiah(fd.estimasiTabungan)}. Mulai alokasikan investasi minimal 15% dari pendapatan secara konsisten selama 3 bulan berturut-turut!`;
      case 5:
        return `Kerja bagus! Investasimu sudah konsisten. Saatnya tetapkan tujuan finansial besar dan capai minimal 20% progressnya untuk naik ke Level 6.`;
      case 6:
        return `Hampir ke puncak! Fokus bebaskan diri dari kewajiban terbesar — lunasi KPR atau bangun passive income hingga minimal 30% dari pendapatanmu secara konsisten.`;
      case 7:
        return `Luar biasa! Kamu telah mencapai level kebebasan finansial tertinggi. Pertahankan passive income, kelola risiko, dan terus beri dampak melalui donasi rutin.`;
      default:
        return `Yuk mulai perjalanan finansialmu dengan langkah-langkah yang tepat!`;
    }
  }

  get levelLabel(): string {
    switch (this.userLevel) {
      case 1:
        return 'Pondasi Pertama';
      case 2:
        return 'Pelunasan Hutang';
      case 3:
        return 'Membangun Fondasi';
      case 4:
        return 'Siap Investasi';
      case 5:
        return 'Tujuan Besar';
      case 6:
        return 'Bebaskan dari Kewajiban';
      case 7:
        return 'Kebebasan Finansial';
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
