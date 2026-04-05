import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CurrentUserService } from '../../../core/services/current-user.service';

@Component({
  selector: 'app-welcome',
  standalone: true,
  templateUrl: './welcome.html',
  styleUrl: './welcome.css',
})
export class Welcome {
  private readonly router = inject(Router);
  private readonly currentUserService = inject(CurrentUserService);

  get userName(): string {
    const user = this.currentUserService.getCurrentUser<{ name?: string }>();
    return user?.name || 'User';
  }

  startOnboarding(): void {
    this.router.navigateByUrl('/questionnaire');
  }
}
