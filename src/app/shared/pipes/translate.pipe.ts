import { Pipe, PipeTransform, inject } from '@angular/core';
import { LanguageService } from '../../core/services/language.service';

/**
 * Translate a key to the currently active language.
 *
 * Usage:  {{ 'profile.save' | translate }}
 *
 * The pipe is intentionally impure (`pure: false`) so Angular re-evaluates it
 * whenever the language signal changes.
 */
@Pipe({
  name: 'translate',
  standalone: true,
  pure: false,
})
export class TranslatePipe implements PipeTransform {
  private readonly langSvc = inject(LanguageService);

  transform(key: string): string {
    return this.langSvc.t(key);
  }
}
