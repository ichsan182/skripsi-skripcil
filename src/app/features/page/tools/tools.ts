import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Sidebar } from '../../../shared/components/sidebar/sidebar';
import { RollingBudgetService } from '../../../core/utils/rolling-budget.service';

@Component({
  selector: 'app-tools',
  standalone: true,
  imports: [CommonModule, Sidebar, RouterLink],
  templateUrl: './tools.html',
  styleUrl: './tools.css',
})
export class Tools implements OnInit {
  protected readonly rollingBudgetService = inject(RollingBudgetService);

  async ngOnInit(): Promise<void> {
    await this.rollingBudgetService.refresh();
  }
}
