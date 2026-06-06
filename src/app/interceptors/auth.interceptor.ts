import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError, TimeoutError } from 'rxjs';
import { timeout, catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    // Skip Firebase SDK internal requests (auth, firestore, rtdb) — they use
    // their own token handling and must NOT get the backend JWT header.
    const isFirebaseRequest =
      request.url.includes('firebaseio.com') ||
      request.url.includes('googleapis.com') ||
      request.url.includes('firebaseapp.com') ||
      request.url.includes('identitytoolkit') ||
      request.url.includes('securetoken');

    if (!isFirebaseRequest) {
      const token = this.authService.getToken();

      if (token && !request.headers.has('Authorization')) {
        request = request.clone({
          setHeaders: {
            Authorization: `Bearer ${token}`
          }
        });
        console.log('[AUTH] Backend token attached to:', request.url.split('?')[0]);
      } else if (!token) {
        console.warn('[AUTH] No token available for request:', request.url.split('?')[0]);
      }
    }

    return next.handle(request).pipe(
      timeout(10000), // Global 10-second timeout
      catchError((error) => {
        if (error instanceof TimeoutError) {
          console.error('⏳ API Timeout:', request.url);
          return throwError(() => new Error('Connection to the server timed out. Please check your network.'));
        }

        if (error.status === 0) {
          console.error('🚫 Backend Unreachable:', request.url);
          return throwError(() => new Error('Network unavailable or backend offline. Verify your local network connection.'));
        }

        // 401 Unauthorized — token is expired or invalid.
        // Log out cleanly and redirect to login. Do NOT create any new session.
        if (error instanceof HttpErrorResponse && error.status === 401) {
          if (!isFirebaseRequest) {
            console.warn('[AUTH] 401 Unauthorized on:', request.url.split('?')[0], '— clearing session.');
            const isAdmin = this.authService.isAdmin;
            this.authService.logout(isAdmin ? '/admin-login' : '/');
          }
        }

        return throwError(() => error);
      })
    );
  }
}
