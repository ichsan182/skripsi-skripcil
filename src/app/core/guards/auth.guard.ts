import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { CurrentUserService } from '../services/current-user.service';

/**
 * Protects routes that require authentication.
 * Redirects unauthenticated users to /login.
 */
export const authGuard: CanActivateFn = () => {
  const currentUserService = inject(CurrentUserService);
  const router = inject(Router);

  if (currentUserService.getCurrentUser()) {
    return true;
  }

  return router.createUrlTree(['/login']);
};
