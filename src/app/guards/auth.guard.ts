import { Injectable } from '@angular/core';
import { Router, CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): boolean {
    const token = this.authService.getToken();
    const hasSession = !!token;

    console.log('[AUTH] Guard check for:', state.url, '| Session active:', hasSession);

    if (hasSession) {
      // Admin should not access user-only pages (all pages protected by AuthGuard)
      if (this.authService.isAdmin) {
        console.log('[AUTH] Admin tried to access user route:', state.url, '— redirecting to /admin-dashboard.');
        console.log('[ROUTER] navigate → /admin-dashboard');
        this.router.navigate(['/admin-dashboard']);
        return false;
      }
      return true;
    }

    console.warn('[AUTH] No active session. Redirecting to login.');
    console.log('[ROUTER] navigate → /');
    this.router.navigate(['/']);
    return false;
  }
}
