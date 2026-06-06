import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { AdminService } from '../../services/admin.service';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule],
  templateUrl: './admin-login.component.html',
  styleUrl: './admin-login.component.css'
})
export class AdminLoginComponent {
  isLoading = false;
  loginForm: FormGroup;
  errorMessage = '';
  showPassword = false;

  constructor(
    private adminService: AdminService,
    private fb: FormBuilder,
    private router: Router
  ) {
    this.loginForm = this.fb.group({
      email:    ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
    });
  }

  onSubmit() {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      this.errorMessage = 'Please enter a valid admin email and password.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const { email, password } = this.loginForm.value;
    console.log('[ADMIN] Login attempt for:', email);

    // adminService.adminLogin() calls authService.login() which:
    //   1. Authenticates against backend
    //   2. Signs into Firebase Auth
    //   3. Calls navigateAfterLogin() → routes admin to /admin
    this.adminService.adminLogin(email, password).subscribe({
      next: () => {
        this.isLoading = false;
        console.log('[ADMIN] Login successful. Proceeding to admin dashboard.');
        // Primary navigation is in adminService.adminLogin() tap()
        // This is a safety fallback in case tap() navigation is blocked
        this.router.navigate(['/admin-dashboard']);
      },
      error: (error: any) => {
        this.isLoading = false;
        const msg = error?.message || '';
        if (msg.includes('admin privileges') || msg.includes('admin role')) {
          this.errorMessage = 'This account does not have admin privileges.';
        } else if (msg.includes('Invalid') || msg.includes('credentials')) {
          this.errorMessage = 'Incorrect email or password. Please try again.';
        } else {
          this.errorMessage = msg || 'Admin login failed. Please try again.';
        }
        console.error('[ADMIN] ❌ Login failed:', error?.status, msg);
      }
    });
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  goBack() {
    this.router.navigate(['/']);
  }
}
