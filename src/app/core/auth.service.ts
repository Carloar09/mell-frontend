import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AuthResponse {
  token: string;
  userId: number;
  email: string;
  firstName: string;
}

const KEY = 'mell_session';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private session = signal<AuthResponse | null>(this.load());

  readonly user = this.session.asReadonly();
  readonly isLoggedIn = computed(() => !!this.session());

  constructor(private http: HttpClient) {}

  login(email: string, password: string) {
    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/auth/login`, { email, password })
      .pipe(tap((r) => this.save(r)));
  }

  register(firstName: string, email: string, password: string) {
    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/auth/register`, { firstName, email, password })
      .pipe(tap((r) => this.save(r)));
  }

  loginWithGoogle(idToken: string) {
    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/auth/google`, { idToken })
      .pipe(tap((r) => this.save(r)));
  }

  logout() {
    try { localStorage.removeItem(KEY); } catch {}
    this.session.set(null);
  }

  get token(): string | null {
    return this.session()?.token ?? null;
  }

  private save(r: AuthResponse) {
    try { localStorage.setItem(KEY, JSON.stringify(r)); } catch {}
    this.session.set(r);
  }

  private load(): AuthResponse | null {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
}
