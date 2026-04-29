import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Sidebar } from '../../../shared/components/sidebar/sidebar';
import {
  FinancialData,
  JournalService,
  UserJournal,
} from '../../../core/services/journal.service';
import { RollingBudgetService } from '../../../core/utils/rolling-budget.service';

export interface EducationCard {
  id: string;
  title: string;
  description: string;
  image: string;
}

@Component({
  selector: 'app-education',
  standalone: true,
  imports: [CommonModule, Sidebar],
  templateUrl: './education.html',
  styleUrl: './education.css',
})
export class Education implements OnInit {
  private readonly journalService = inject(JournalService);
  private readonly rollingBudgetService = inject(RollingBudgetService);
  private readonly router = inject(Router);

  rollingBudgetToday = 0;
  rollingBudgetRemaining = 0;
  rollingDaysRemaining = 0;
  rollingTotalBudget = 0;
  rollingUsedBudget = 0;

  readonly cards: EducationCard[] = [
    {
      id: 'mindset-keuangan',
      title: 'Mindset Keuangan & Literasi Finansial',
      description:
        '  Mindset keuangan adalah cara seseorang memandang uang: bagaimana mereka mengelola,mengambil keputusan, dan merencanakan masa depan. Literasi finansial adalah kemampuan memahami konsep keuangan seperti menabung, berinvestasi, mengelola utang, dan melindungi aset.',
      image: 'assets/education-assets/investing.png',
    },
    {
      id: 'Manajemen Uang (Cashflow 101)',
      title: 'Manajemen Uang (Cashflow 101)',
      description:
        '    Manajemen uang atau cashflow management adalah fondasi utama dalam membangun kehidupan finansial yang sehat. Cashflow bukan sekadar tentang berapa banyak uang yang kita hasilkan, tetapi bagaimana kita memastikan bahwa uang tersebut mengalir dengan benar untuk memenuhi kebutuhan, mewujudkan tujuan, dan memberikan rasa aman.',
      image: 'assets/education-assets/investing.png',
    },
    {
      id: 'perencanaan-keuangan',
      title: 'Perencanaan Keuangan',
      description:
        'Pelajari cara merencanakan keuangan Anda dengan baik untuk mencapai stabilitas dan kebebasan finansial.',
      image: 'assets/education-assets/investing.png',
    },
    {
      id: 'investasi',
      title: 'Investasi',
      description:
        'Pelajari cara mengelola investasi Anda dengan bijak untuk mencapai tujuan keuangan jangka panjang.',
      image: 'assets/education-assets/investing.png',
    },
    {
      id: 'manajemen-utang',
      title: 'Manajemen Utang & Kredit',
      description:
        'Pelajari cara mengelola utang dan kredit secara bijak agar tidak menjadi beban finansial jangka panjang.',
      image: 'assets/education-assets/investing.png',
    },
    {
      id: 'perlindungan-aset',
      title: 'Perlindungan Aset & Asuransi',
      description:
        'Lindungi kekayaan Anda dari risiko tak terduga dengan strategi asuransi dan diversifikasi yang tepat.',
      image: 'assets/education-assets/investing.png',
    },
  ];

  private journal: UserJournal = {
    nextChatMessageId: 1,
    chatByDate: {},
    expensesByDate: {},
    incomesByDate: {},
  };
  private currentFinancialData: FinancialData | null = null;

  async ngOnInit(): Promise<void> {
    await this.loadRollingBudgetState();
  }

  navigateTo(id: string): void {
    this.router.navigate(['/education/content', id]);
  }

  private async loadRollingBudgetState(): Promise<void> {
    try {
      this.journal = await this.journalService.loadCurrentUserJournal();
      const summary = await this.journalService.getCurrentCycleSummary();
      this.currentFinancialData = summary.financialData;
      this.computeRollingBudgetToday();
    } catch {
      this.rollingBudgetToday = 0;
      this.rollingBudgetRemaining = 0;
      this.rollingDaysRemaining = 0;
      this.rollingTotalBudget = 0;
      this.rollingUsedBudget = 0;
    }
  }

  private computeRollingBudgetToday(): void {
    const state = this.rollingBudgetService.computeRollingBudgetState(
      this.currentFinancialData,
      this.journal,
    );

    this.rollingTotalBudget = state.rollingTotalBudget;
    this.rollingUsedBudget = state.rollingUsedBudget;
    this.rollingBudgetRemaining = state.rollingBudgetRemaining;
    this.rollingDaysRemaining = state.rollingDaysRemaining;
    this.rollingBudgetToday = state.rollingBudgetToday;
  }
}
