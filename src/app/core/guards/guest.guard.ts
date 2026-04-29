import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { CurrentUserService } from '../services/current-user.service';

/**
 * Prevents authenticated users from accessing guest-only routes (login, register).
 * Redirects logged-in users to /home.
 */
export const guestGuard: CanActivateFn = () => {
  const currentUserService = inject(CurrentUserService);
  const router = inject(Router);

  if (!currentUserService.getCurrentUser()) {
    return true;
  }

  return router.createUrlTree(['/home']);
};
