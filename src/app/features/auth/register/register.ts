import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

interface RegisterPayload {
  name: string;
  email: string;
  phone: string;
  password: string;
  onboardingCompleted: boolean;
  level: number;
  investmentWatchlist: {
    items: never[];
    selectedSymbol: null;
    updatedAt: string;
  };
  journal: {
    nextChatMessageId: number;
    chatByDate: Record<string, never[]>;
    expensesByDate: Record<string, never[]>;
    incomesByDate: Record<string, never[]>;
  };
}

@Component({
  selector: 'app-register',
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: './register.css',
})
export class Register {
  private readonly usersApiUrl = 'http://localhost:3000/users';
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
        name: formValues.name ?? '',
        email: formValues.email ?? '',
        phone: formValues.phone ?? '',
        password: formValues.password ?? '',
        onboardingCompleted: false,
        level: 1,
        investmentWatchlist: {
          items: [],
          selectedSymbol: null,
          updatedAt: new Date().toISOString(),
        },
        journal: {
          nextChatMessageId: 1,
          chatByDate: {},
          expensesByDate: {},
          incomesByDate: {},
        },
      };

      const existingUser = await firstValueFrom(
        this.httpClient.get<RegisterPayload[]>(
          `${this.usersApiUrl}?email=${encodeURIComponent(payload.email)}`,
        ),
      );

      if (existingUser.length) {
        this.errorMessage =
          'Email sudah terdaftar. Silakan gunakan email lain.';
        return;
      }

      await firstValueFrom(this.httpClient.post(this.usersApiUrl, payload));

      this.successMessage =
        'Registrasi berhasil. Silakan login menggunakan akun baru.';
      this.registerForm.reset();
    } catch {
      this.errorMessage =
        'Gagal menyimpan data. Pastikan json-server berjalan.';
    } finally {
      this.isSubmitting = false;
    }
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
