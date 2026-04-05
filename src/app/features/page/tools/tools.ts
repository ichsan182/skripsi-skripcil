import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Sidebar } from '../../../shared/components/sidebar/sidebar';
import {
  FinancialData,
  JournalService,
  UserJournal,
} from '../../../core/services/journal.service';
import { RollingBudgetService } from '../../../core/utils/rolling-budget.service';

@Component({
  selector: 'app-tools',
  standalone: true,
  imports: [CommonModule, Sidebar, RouterLink],
  templateUrl: './tools.html',
  styleUrl: './tools.css',
})
export class Tools implements OnInit {
  private readonly journalService = inject(JournalService);
  private readonly rollingBudgetService = inject(RollingBudgetService);

  rollingBudgetToday = 0;
  rollingBudgetRemaining = 0;
  rollingDaysRemaining = 0;
  rollingTotalBudget = 0;
  rollingUsedBudget = 0;

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
