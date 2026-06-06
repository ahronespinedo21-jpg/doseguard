import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginPageComponent implements OnInit {
  isLoading = false;
  errorMessage = '';
  successMessage = '';
  loginForm: FormGroup;

  constructor(
    private authService: AuthService,
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
    });
  }

  ngOnInit() {
    // Pre-fill email if redirected from signup
    this.route.queryParams.subscribe(params => {
      if (params['registered'] === 'true' && params['email']) {
        this.successMessage = 'Account created successfully! Please log in.';
        this.loginForm.patchValue({ email: params['email'] });
      }
    });
  }

  onSubmit() {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      this.errorMessage = 'Please enter a valid email and password (min 6 characters).';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    const { email, password } = this.loginForm.value;
    console.log('[AUTH] Login attempt for:', email);

    // The backend login also triggers Firebase Auth sync in AuthService.
    // No connectivity pre-check — let the backend handle errors directly
    // so we get accurate error messages and avoid false "offline" blocks.
    this.authService.login(email, password).subscribe({
      next: () => {
        this.isLoading = false;
        console.log('[AUTH] Login successful — navigating to dashboard');
        // Navigation is already handled inside authService.login() tap().
        // This next() is here for safety if navigation fires before subscribe.
      },
      error: (error: any) => {
        this.isLoading = false;
        const msg = error?.message || error?.error?.message || '';

        // Translate common backend/Firebase error codes into friendly messages
        if (msg.includes('Invalid email or password') || msg.includes('401') || msg.includes('invalid-credential')) {
          this.errorMessage = 'Incorrect email or password. Please try again.';
        } else if (msg.includes('Network') || msg.includes('offline') || error?.status === 0) {
          this.errorMessage = 'Cannot reach the server. Please check your network connection.';
        } else if (msg.includes('too-many-requests') || msg.includes('rate')) {
          this.errorMessage = 'Too many login attempts. Please wait a few minutes and try again.';
        } else {
          this.errorMessage = msg || 'Login failed. Please try again.';
        }

        console.error('[AUTH] Login error:', error?.status, msg);
      }
    });
  }

  loginWithGoogle() {
    this.isLoading = true;
    this.errorMessage = '';
    this.authService.signInWithGoogle().subscribe({
      next: () => { this.isLoading = false; },
      error: (error: any) => {
        this.isLoading = false;
        this.errorMessage = error.message || 'Google login failed. Please try again.';
      }
    });
  }

  loginWithFacebook() {
    this.isLoading = true;
    this.errorMessage = '';
    this.authService.signInWithFacebook().subscribe({
      next: () => { this.isLoading = false; },
      error: (error: any) => {
        this.isLoading = false;
        this.errorMessage = error.message || 'Facebook login failed. Please try again.';
      }
    });
  }

  goToSignup() {
    this.router.navigate(['/signup']);
  }

  goToAdminLogin() {
    this.router.navigate(['/admin-login']);
  }
}
