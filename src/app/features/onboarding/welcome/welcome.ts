import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-welcome',
  standalone: true,
  templateUrl: './welcome.html',
  styleUrl: './welcome.css',
})
export class Welcome {
  private readonly router = inject(Router);

  get userName(): string {
    try {
      const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
      return user.name || 'User';
    } catch {
      return 'User';
    }
  }

  startOnboarding(): void {
    this.router.navigateByUrl('/questionnaire');
  }
}
