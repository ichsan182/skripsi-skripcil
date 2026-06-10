import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { USERS_API_URL } from '../config/app-api.config';
import { User, RegisterPayload } from '../models/user.model';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);

  async getAllUsers(): Promise<User[]> {
    const response = await firstValueFrom(this.http.get<unknown>(USERS_API_URL));
    return this.extractUsers(response);
  }

  async registerUser(payload: RegisterPayload): Promise<void> {
    await firstValueFrom(this.http.post(USERS_API_URL, payload));
  }

  async updatePassword(user: User, newPassword: string): Promise<void> {
    await firstValueFrom(
      this.http.put(`${USERS_API_URL}/${user.id}`, {
        ...user,
        password: newPassword,
      }),
    );
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
}
