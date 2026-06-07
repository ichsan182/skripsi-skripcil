import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse)) {
        return throwError(() => error);
      }

      if (error.status === 0) {
        console.error(
          '[API] Tidak bisa terhubung ke backend. Pastikan Spring Boot berjalan di port 12653.',
        );
      } else if (error.status >= 500) {
        console.error(`[API] Server error ${error.status}:`, error.message);
      } else if (error.status === 401 || error.status === 403) {
        console.warn(`[API] Auth error ${error.status}:`, error.message);
      }

      return throwError(() => error);
    }),
  );
};
