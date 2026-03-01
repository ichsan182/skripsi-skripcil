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

  private generatePercentage(): number {
    return Math.floor(Math.random() * 100) + 1;
  }
}
