import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Sidebar } from '../shared/components/sidebar/sidebar';

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

  get currentLevelImage(): string {
    return this.levelImages[this.currentLevel - 1];
  }

  get nextLevelImage(): string | null {
    return this.currentLevel < 7 ? this.levelImages[this.currentLevel] : null;
  }

  get currentLevelTask(): string {
    return this.levelTasks[this.currentLevel - 1];
  }

  private generatePercentage(): number {
    return Math.floor(Math.random() * 100) + 1;
  }
}
