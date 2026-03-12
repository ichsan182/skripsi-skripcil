import { Component } from '@angular/core';
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
  protected profileName = 'John Doe';
  protected profileEmail = 'john@example.com';
  protected profileImage = 'assets/profile-avatar.png';

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
