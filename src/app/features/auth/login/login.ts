import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

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
  private readonly usersApiUrl = 'http://localhost:3000/users';
  private readonly formBuilder = inject(FormBuilder);
  private readonly httpClient = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);

  protected isSubmitting = false;
  protected isPasswordVisible = false;
  protected successMessage = '';
  protected errorMessage = '';

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

      const users = await firstValueFrom(
        this.httpClient.get<User[]>(this.usersApiUrl),
      );
      const user = users.find(
        (item) =>
          item.email.trim().toLowerCase() === normalizedEmail &&
          item.password.trim() === normalizedPassword,
      );

      if (!user) {
        this.errorMessage = 'Email atau password tidak valid.';
        return;
      }

      localStorage.setItem('currentUser', JSON.stringify(user));

      if (!user.onboardingCompleted) {
        await this.router.navigateByUrl('/welcome');
      } else {
        await this.router.navigateByUrl('/home');
      }
    } catch {
      this.errorMessage =
        'Gagal terhubung ke server. Pastikan json-server berjalan.';
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
      const users = await firstValueFrom(
        this.httpClient.get<User[]>(this.usersApiUrl),
      );
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
        'Gagal terhubung ke server. Pastikan json-server berjalan.';
    } finally {
      this.isSubmitting = false;
    }
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
