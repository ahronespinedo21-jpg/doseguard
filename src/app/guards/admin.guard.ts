import { Injectable } from '@angular/core';
import { Router, CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { AdminService } from '../services/admin.service';

@Injectable({
  providedIn: 'root'
})
export class AdminGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private adminService: AdminService,
    private router: Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): boolean {
    // Two layers of protection:
    // 1. AuthService.isAdmin  — checks user.role === 'admin' from stored session
    // 2. AdminService.isAdminAuthenticated — checks doseguard_admin key in localStorage
    const hasAdminRole    = this.authService.isAdmin;
    const hasAdminSession = this.adminService.isAdminAuthenticated;

    console.log('[ADMIN] Guard check for:', state.url);
    console.log('[ADMIN] hasAdminRole:', hasAdminRole, '| hasAdminSession:', hasAdminSession);

    if (hasAdminRole || hasAdminSession) {
      console.log('[ADMIN] Access granted to:', state.url);
      return true;
    }

    console.warn('[ADMIN] Access denied — not an admin. Redirecting to /admin-login.');
    console.log('[ROUTER] navigate → /admin-login');
    this.router.navigate(['/admin-login']);
    return false;
  }
}
