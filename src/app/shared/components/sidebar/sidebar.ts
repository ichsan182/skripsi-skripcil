import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
})
export class Sidebar {
  @Input() showRollingBudgetPanel = false;
  @Input() rollingTotalBudget = 0;
  @Input() rollingUsedBudget = 0;
  @Input() rollingBudgetRemaining = 0;
  @Input() rollingDaysRemaining = 0;
  @Input() rollingBudgetToday = 0;
  @Input() formatRupiahFn: (amount: number) => string = (amount: number) =>
    new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);

  protected profileName = 'John Doe';
  protected profileEmail = 'john@example.com';
  protected profileImage = 'assets/user.svg';

  protected navItems = [
    { path: '/home', label: 'Home', icon: 'assets/material-symbols_home.svg' },
    {
      path: '/transactions',
      label: 'Transaction',
      icon: 'assets/material-symbols_transaction.svg',
    },
    {
      path: '/investment',
      label: 'Investment',
      icon: 'assets/material-symbols_investation.svg',
    },
    {
      path: '/tools',
      label: 'Tools',
      icon: 'assets/material-symbols_tools.svg',
    },
    {
      path: '/education',
      label: 'Education',
      icon: 'assets/material-symbols_education.svg',
    },
    {
      path: '/chat',
      label: 'Chat',
      icon: 'assets/material-symbols_chat.svg',
    },
  ];
}
