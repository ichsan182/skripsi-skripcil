import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { USERS_API_URL } from '../../../core/config/app-api.config';

interface RegisterPayload {
  id: string;
  name: string;
  email: string;
  phone: string;
  password: string;
  onboardingCompleted: boolean;
  level: number;
  investmentWatchlist: null;
  journal: null;
  financialData: null;
  streak: null;
  debts: never[];
}

interface ExistingUser {
  email: string;
}

@Component({
  selector: 'app-register',
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: './register.css',
})
export class Register {
  private readonly formBuilder = inject(FormBuilder);
  private readonly httpClient = inject(HttpClient);

  protected isSubmitting = false;
  protected isPasswordVisible = false;
  protected successMessage = '';
  protected errorMessage = '';

  protected registerForm = this.formBuilder.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.required, Validators.pattern('^[0-9]{9,15}$')]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  protected async onSubmit(): Promise<void> {
    this.successMessage = '';
    this.errorMessage = '';

    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;

    try {
      const formValues = this.registerForm.getRawValue();
      const payload: RegisterPayload = {
        id: this.generateUserId(),
        name: formValues.name ?? '',
        email: (formValues.email ?? '').trim().toLowerCase(),
        phone: formValues.phone ?? '',
        password: formValues.password ?? '',
        onboardingCompleted: false,
        level: 1,
        investmentWatchlist: null,
        journal: null,
        financialData: null,
        streak: null,
        debts: [],
      };

      const existingUsersResponse = await firstValueFrom(
        this.httpClient.get<unknown>(USERS_API_URL),
      );
      const existingUsers = this.extractUsers(existingUsersResponse);

      const isEmailTaken = existingUsers.some(
        (user) => user.email.trim().toLowerCase() === payload.email,
      );

      if (isEmailTaken) {
        this.errorMessage =
          'Email sudah terdaftar. Silakan gunakan email lain.';
        return;
      }

      await firstValueFrom(this.httpClient.post(USERS_API_URL, payload));

      this.successMessage =
        'Registrasi berhasil. Silakan login menggunakan akun baru.';
      this.registerForm.reset();
    } catch (error) {
      this.errorMessage = this.buildHttpErrorMessage(error);
    } finally {
      this.isSubmitting = false;
    }
  }

  private extractUsers(response: unknown): ExistingUser[] {
    if (Array.isArray(response)) {
      return response as ExistingUser[];
    }

    if (
      response &&
      typeof response === 'object' &&
      'content' in response &&
      Array.isArray((response as { content: unknown }).content)
    ) {
      return (response as { content: ExistingUser[] }).content;
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
      return (response as { _embedded: { users: ExistingUser[] } })._embedded
        .users;
    }

    return [];
  }

  private buildHttpErrorMessage(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) {
      return 'Terjadi kesalahan tidak terduga. Silakan coba lagi.';
    }

    if (error.status === 0) {
      return 'Tidak bisa terhubung ke backend (cek http://localhost:8081 dan restart ng serve).';
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

  private generateUserId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return `user-${crypto.randomUUID()}`;
    }

    return `user-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  }

  protected showError(
    controlName: 'name' | 'email' | 'phone' | 'password',
  ): boolean {
    const control = this.registerForm.get(controlName);
    return Boolean(
      control && control.invalid && (control.dirty || control.touched),
    );
  }

  protected togglePasswordVisibility(): void {
    this.isPasswordVisible = !this.isPasswordVisible;
  }
}
