import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { CurrentUserService } from '../../../core/services/current-user.service';

@Component({
  selector: 'app-login',
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly currentUserService = inject(CurrentUserService);

  protected isSubmitting = false;
  protected isPasswordVisible = false;
  protected successMessage = '';
  protected errorMessage = '';

  constructor() {
    const registered =
      this.activatedRoute.snapshot.queryParamMap.get('registered');
    if (registered === 'success') {
      this.successMessage =
        'Registrasi berhasil. Silakan login menggunakan akun baru.';
    }

    const changed = this.activatedRoute.snapshot.queryParamMap.get('changed');
    if (changed === 'success') {
      this.successMessage = 'Password berhasil diperbarui. Silakan login.';
    }
  }

  protected loginForm = this.formBuilder.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  protected forgotForm = this.formBuilder.group({
    email: ['', [Validators.required, Validators.email]],
    newPassword: ['', [Validators.required, Validators.minLength(6)]],
  });

  protected isForgotPasswordVisible = false;

  protected get isForgotMode(): boolean {
    return this.activatedRoute.routeConfig?.path === 'forgot-password';
  }

  protected async onSubmit(): Promise<void> {
    this.successMessage = '';
    this.errorMessage = '';

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;

    try {
      const { email, password } = this.loginForm.getRawValue();
      const normalizedEmail = (email ?? '').trim().toLowerCase();
      const normalizedPassword = (password ?? '').trim();

      const users = await this.authService.getAllUsers();

      const user = users.find(
        (item) =>
          item.email.trim().toLowerCase() === normalizedEmail &&
          item.password.trim() === normalizedPassword,
      );

      if (!user) {
        this.errorMessage = 'Email atau password tidak valid.';
        return;
      }

      this.currentUserService.setCurrentUser(user);

      if (!user.onboardingCompleted) {
        await this.router.navigateByUrl('/welcome');
      } else {
        await this.router.navigateByUrl('/home');
      }
    } catch {
      this.errorMessage =
        'Gagal terhubung ke server. Pastikan backend Spring Boot berjalan.';
    } finally {
      this.isSubmitting = false;
    }
  }

  protected async onForgotPassword(): Promise<void> {
    this.successMessage = '';
    this.errorMessage = '';

    if (this.forgotForm.invalid) {
      this.forgotForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;

    try {
      const { email, newPassword } = this.forgotForm.getRawValue();
      const normalizedEmail = (email ?? '').trim().toLowerCase();
      const trimmedPassword = (newPassword ?? '').trim();

      const users = await this.authService.getAllUsers();

      const user = users.find(
        (item) => item.email.trim().toLowerCase() === normalizedEmail,
      );

      if (!user) {
        this.errorMessage = 'Email tidak ditemukan.';
        return;
      }

      await this.authService.updatePassword(user, trimmedPassword);

      this.forgotForm.reset();
      await this.router.navigateByUrl('/login?changed=success');
    } catch {
      this.errorMessage =
        'Gagal terhubung ke server. Pastikan backend Spring Boot berjalan.';
    } finally {
      this.isSubmitting = false;
    }
  }

  protected toggleForgotPasswordVisibility(): void {
    this.isForgotPasswordVisible = !this.isForgotPasswordVisible;
  }

  protected showError(
    controlName: 'email' | 'password' | 'newPassword',
    formType: 'login' | 'forgot' = 'login',
  ): boolean {
    if (formType === 'forgot') {
      const forgotControl = this.forgotForm.get(controlName);
      return Boolean(
        forgotControl &&
        forgotControl.invalid &&
        (forgotControl.dirty || forgotControl.touched),
      );
    }

    const control = this.loginForm.get(controlName);
    return Boolean(
      control && control.invalid && (control.dirty || control.touched),
    );
  }

  protected togglePasswordVisibility(): void {
    this.isPasswordVisible = !this.isPasswordVisible;
  }
}
