import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { USERS_API_URL } from '../../../core/config/app-api.config';

interface ProfileUpdatePayload {
  name: string;
  email: string;
  profileImage: string;
}

interface StoredUser {
  id?: string | number;
  name?: string;
  email?: string;
  profileImage?: string;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
})
export class Sidebar implements OnInit, OnChanges {
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);

  @Input() showRollingBudgetPanel = false;
  @Input() rollingTotalBudget = 0;
  @Input() rollingUsedBudget = 0;
  @Input() rollingBudgetRemaining = 0;
  @Input() rollingDaysRemaining = 0;
  @Input() rollingBudgetToday = 0;
  @Input() rollingSpentToday = 0;
  @Input() profileName = '';
  @Input() profileEmail = '';
  @Input() profileImage = '';

  @Output() profileUpdated = new EventEmitter<ProfileUpdatePayload>();
  @Input() formatRupiahFn: (amount: number) => string = (amount: number) => {
    const abs = Math.abs(amount);
    const formatted = new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(abs);
    return amount < 0 ? `-${formatted}` : formatted;
  };

  get rollingRemainingToday(): number {
    return this.rollingBudgetToday - this.rollingSpentToday;
  }

  get rollingTodayUsagePercent(): number {
    if (this.rollingBudgetToday <= 0) {
      return this.rollingSpentToday > 0 ? 100 : 0;
    }
    return Math.min(
      100,
      Math.round((this.rollingSpentToday / this.rollingBudgetToday) * 100),
    );
  }

  protected readonly defaultProfileName = 'User';
  protected readonly defaultProfileEmail = 'user@example.com';
  protected readonly defaultProfileImage = 'assets/user.svg';

  protected activeProfileName = this.defaultProfileName;
  protected activeProfileEmail = this.defaultProfileEmail;
  protected activeProfileImage = this.defaultProfileImage;

  protected showProfileModal = false;
  protected editProfileName = '';
  protected editProfileEmail = '';
  protected profileFormError = '';
  protected isMobileMenuOpen = false;

  protected readonly navItems = [
    {
      path: '/home',
      label: 'Home',
      icon: 'assets/material-symbols_home.svg',
    },
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
  ];

  ngOnInit(): void {
    this.refreshProfileIdentity();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes['profileName'] ||
      changes['profileEmail'] ||
      changes['profileImage']
    ) {
      this.refreshProfileIdentity();
    }
  }

  protected openProfileModal(): void {
    this.editProfileName = this.activeProfileName;
    this.editProfileEmail = this.activeProfileEmail;
    this.profileFormError = '';
    this.isMobileMenuOpen = false;
    this.showProfileModal = true;
  }

  protected closeProfileModal(): void {
    this.showProfileModal = false;
    this.profileFormError = '';
  }

  protected toggleMobileMenu(): void {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
  }

  protected closeMobileMenu(): void {
    this.isMobileMenuOpen = false;
  }

  protected async saveProfile(): Promise<void> {
    const name = this.editProfileName.trim();
    const email = this.editProfileEmail.trim().toLowerCase();

    if (!name) {
      this.profileFormError = 'Nama wajib diisi.';
      return;
    }

    if (!this.isEmailValid(email)) {
      this.profileFormError = 'Email tidak valid.';
      return;
    }

    const profileImage = this.activeProfileImage || this.defaultProfileImage;

    this.activeProfileName = name;
    this.activeProfileEmail = email;

    const user = this.getCurrentUser();
    const updatedUser: StoredUser = {
      ...user,
      name,
      email,
      profileImage,
    };

    localStorage.setItem('currentUser', JSON.stringify(updatedUser));
    sessionStorage.setItem('currentUser', JSON.stringify(updatedUser));

    if (updatedUser.id) {
      try {
        const serverUser = await firstValueFrom(
          this.http.get<Record<string, unknown>>(
            `${USERS_API_URL}/${updatedUser.id}`,
          ),
        );
        await firstValueFrom(
          this.http.put(`${USERS_API_URL}/${updatedUser.id}`, {
            ...serverUser,
            name,
            email,
            profileImage,
            id: updatedUser.id,
          }),
        );
      } catch {
        // keep local changes even when server update fails
      }
    }

    this.profileUpdated.emit({ name, email, profileImage });
    this.closeProfileModal();
  }

  protected onLogoutClick(event: Event): void {
    event.stopPropagation();
    this.logout();
  }

  private refreshProfileIdentity(): void {
    const user = this.getCurrentUser();
    this.activeProfileName =
      this.profileName.trim() || user.name?.trim() || this.defaultProfileName;
    this.activeProfileEmail =
      this.profileEmail.trim() ||
      user.email?.trim() ||
      this.defaultProfileEmail;
    this.activeProfileImage =
      this.profileImage.trim() ||
      user.profileImage?.trim() ||
      this.defaultProfileImage;
  }

  private getCurrentUser(): StoredUser {
    try {
      return JSON.parse(
        localStorage.getItem('currentUser') || '{}',
      ) as StoredUser;
    } catch {
      return {};
    }
  }

  private isEmailValid(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  protected logout(): void {
    localStorage.removeItem('currentUser');
    sessionStorage.removeItem('currentUser');
    void this.router.navigate(['/login']);
  }
}
