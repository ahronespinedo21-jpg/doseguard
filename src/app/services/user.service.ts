import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError, EMPTY } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { ApiConfigService } from './api-config.service';

export interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  dateOfBirth?: string;
  address?: string;
  role?: string;
  createdAt?: string;
  updatedAt?: string;
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private API_URL: string;
  private userProfileSubject = new BehaviorSubject<UserProfile | null>(null);
  public userProfile$ = this.userProfileSubject.asObservable();

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private apiConfig: ApiConfigService
  ) {
    this.API_URL = this.apiConfig.getBaseUrl();
    this.loadCurrentProfile();
  }

  private loadCurrentProfile(): void {
    // ── Step 1: Restore cached profile from localStorage for instant display.
    const storedUser = localStorage.getItem('doseguard_user');
    if (storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        this.userProfileSubject.next({
          id: userData.id,
          firstName: userData.firstName || '',
          lastName: userData.lastName || '',
          email: userData.email,
          role: userData.role
        });
      } catch (e) {
        console.warn('[PROFILE] Failed to parse stored user data:', e);
      }
    }

    // ── Step 2: Only fetch fresh profile from backend if a JWT token exists.
    // Without a token the interceptor will send an unauthenticated request,
    // which always returns 401 and triggers a logout loop.
    const token = this.authService.getToken();
    if (!token) {
      console.warn('[PROFILE] No auth token — skipping backend profile fetch to prevent 401 loop.');
      return;
    }

    this.getProfile().subscribe({
      next: (profile) => {
        console.log('[PROFILE] User profile loaded:', profile.email);
      },
      error: (err) => {
        // Non-fatal: cached profile is still usable.
        // 401 is handled by the interceptor (logout + redirect).
        if (err?.status !== 401) {
          console.warn('[PROFILE] Backend profile fetch failed (non-fatal):', err?.status, err?.message || err);
        }
      }
    });
  }

  getProfile(): Observable<UserProfile> {
    // Authorization header is attached automatically by AuthInterceptor.
    return this.http.get<any>(`${this.API_URL}/user/profile`).pipe(
      map((response: any) => response.user || response),
      tap((profile: UserProfile) => {
        this.userProfileSubject.next(profile);
        // Keep localStorage in sync with the latest backend data
        localStorage.setItem('doseguard_user', JSON.stringify({
          id: profile.id,
          firstName: profile.firstName,
          lastName: profile.lastName,
          email: profile.email,
          role: profile.role
        }));
      }),
      catchError((error) => {
        console.error('[PROFILE] ❌ Failed to fetch profile:', error?.status, error?.message || error);
        return throwError(() => error);
      })
    );
  }

  updateProfile(updates: Partial<UserProfile>): Observable<UserProfile> {
    // Authorization header is attached automatically by AuthInterceptor.
    const payload = {
      firstName: updates.firstName,
      lastName: updates.lastName,
      phone: updates.phone,
      dateOfBirth: updates.dateOfBirth,
      address: updates.address
    };

    return this.http.put<any>(`${this.API_URL}/user/profile`, payload).pipe(
      map((response: any) => response.user || response),
      tap((profile: UserProfile) => {
        this.userProfileSubject.next(profile);
      }),
      catchError((error) => {
        console.error('[PROFILE] ❌ Failed to update profile:', error?.status, error?.message || error);
        return throwError(() => error);
      })
    );
  }

  getCurrentProfile(): UserProfile | null {
    return this.userProfileSubject.value;
  }
}
