import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { USERS_API_URL } from '../../../core/config/app-api.config';
import { CurrentUserService } from '../../../core/services/current-user.service';

interface User {
  id?: number | string;
  name: string;
  email: string;
  phone: string;
  password: string;
  onboardingCompleted?: boolean;
  financialData?: {
    pendapatan: number;
    pengeluaranWajib: number;
    tanggalPemasukan: number;
    hutangWajib: number;
    estimasiTabungan: number;
    danaDarurat: number;
  };
  level?: number;
}

@Component({
  selector: 'app-login',
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private readonly formBuilder = inject(FormBuilder);
  private readonly httpClient = inject(HttpClient);
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
  }

  protected loginForm = this.formBuilder.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  protected forgotForm = this.formBuilder.group({
    email: ['', [Validators.required, Validators.email]],
  });

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

      const usersResponse = await firstValueFrom(
        this.httpClient.get<unknown>(USERS_API_URL),
      );
      const users = this.extractUsers(usersResponse);

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
      const email = (this.forgotForm.getRawValue().email ?? '')
        .trim()
        .toLowerCase();
      const usersResponse = await firstValueFrom(
        this.httpClient.get<unknown>(USERS_API_URL),
      );
      const users = this.extractUsers(usersResponse);

      const user = users.find(
        (item) => item.email.trim().toLowerCase() === email,
      );

      if (!user) {
        this.errorMessage = 'Email tidak ditemukan.';
        return;
      }

      alert('Reset password sudah terkirim');
      this.successMessage = 'Reset password sudah terkirim.';
      this.forgotForm.reset();
    } catch {
      this.errorMessage =
        'Gagal terhubung ke server. Pastikan backend Spring Boot berjalan.';
    } finally {
      this.isSubmitting = false;
    }
  }

  private extractUsers(response: unknown): User[] {
    if (Array.isArray(response)) {
      return response as User[];
    }

    if (
      response &&
      typeof response === 'object' &&
      'content' in response &&
      Array.isArray((response as { content: unknown }).content)
    ) {
      return (response as { content: User[] }).content;
    }

    if (
      response &&
      typeof response === 'object' &&
      '_embedded' in response &&
      typeof (response as { _embedded: unknown })._embedded === 'object' &&
      (response as { _embedded: { users?: unknown } })._embedded?.users &&
      Array.isArray(
        (response as { _embedded: { users: unknown[] } })._embedded.users,
      )
    ) {
      return (response as { _embedded: { users: User[] } })._embedded.users;
    }

    return [];
  }

  private buildHttpErrorMessage(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) {
      return 'Terjadi kesalahan tidak terduga. Silakan coba lagi.';
    }

    if (error.status === 0) {
      return 'Tidak bisa terhubung ke backend (cek http://localhost:12653 dan restart ng serve).';
    }

    if (typeof error.error === 'string' && error.error.trim().length > 0) {
      return `Gagal (${error.status}): ${error.error}`;
    }

    if (
      error.error &&
      typeof error.error === 'object' &&
      'message' in (error.error as Record<string, unknown>)
    ) {
      const message = (error.error as { message?: string }).message;
      if (message) {
        return `Gagal (${error.status}): ${message}`;
      }
    }

    return `Gagal request ke backend (status ${error.status}).`;
  }

  protected showError(
    controlName: 'email' | 'password',
    formType: 'login' | 'forgot' = 'login',
  ): boolean {
    if (formType === 'forgot') {
      const forgotControl = this.forgotForm.get('email');
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
