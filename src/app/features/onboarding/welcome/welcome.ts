import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { CurrentUserService } from '../../../core/services/current-user.service';

@Component({
  selector: 'app-welcome',
  standalone: true,
  templateUrl: './welcome.html',
  styleUrl: './welcome.css',
})
export class Welcome implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly currentUserService = inject(CurrentUserService);

  // Arrow function so `this` is stable for removeEventListener
  private readonly blockBack = (): void => {
    history.pushState(null, '', window.location.href);
  };

  get userName(): string {
    const user = this.currentUserService.getCurrentUser<{ name?: string }>();
    return user?.name || 'User';
  }

  ngOnInit(): void {
    // Push a dummy state so the browser has something to "go back" to here —
    // the popstate listener immediately re-pushes it, trapping the user on this page.
    history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', this.blockBack);
  }

  ngOnDestroy(): void {
    window.removeEventListener('popstate', this.blockBack);
  }

  startOnboarding(): void {
    // Remove the guard before navigating so the transition is clean.
    window.removeEventListener('popstate', this.blockBack);
    void this.router.navigateByUrl('/questionnaire');
  }
}
