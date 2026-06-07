import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule],
  templateUrl: './signup.component.html',
  styleUrl: './signup.component.css'
})
export class SignupPageComponent {
  isLoading = false;
  showPassword = false;
  errorMessage = '';
  successMessage = '';
  signupForm: FormGroup;

  // Password strength properties
  passwordStrengthScore = 0;
  passwordStrengthLabel = '';
  passwordStrengthColor = 'bg-slate-200 dark:bg-slate-800';

  constructor(
    private authService: AuthService,
    private fb: FormBuilder,
    private router: Router
  ) {
    this.signupForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName:  ['', [Validators.required, Validators.minLength(2)]],
      email:     ['', [Validators.required, Validators.email]],
      password:  ['', [Validators.required, Validators.minLength(6)]],
    });
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  onPasswordInput(event: Event) {
    const password = (event.target as HTMLInputElement).value;
    this.calculatePasswordStrength(password);
  }

  calculatePasswordStrength(password: string) {
    if (!password) {
      this.passwordStrengthScore = 0;
      this.passwordStrengthLabel = '';
      this.passwordStrengthColor = 'bg-slate-200 dark:bg-slate-800';
      return;
    }

    let score = 0;
    
    // 5 criteria for strength scoring
    if (password.length >= 6) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    this.passwordStrengthScore = score;

    switch (score) {
      case 1:
        this.passwordStrengthLabel = 'Weak';
        this.passwordStrengthColor = 'bg-rose-500';
        break;
      case 2:
      case 3:
        this.passwordStrengthLabel = 'Fair';
        this.passwordStrengthColor = 'bg-amber-500';
        break;
      case 4:
        this.passwordStrengthLabel = 'Good';
        this.passwordStrengthColor = 'bg-indigo-500';
        break;
      case 5:
        this.passwordStrengthLabel = 'Strong';
        this.passwordStrengthColor = 'bg-emerald-500';
        break;
      default:
        this.passwordStrengthLabel = '';
        this.passwordStrengthColor = 'bg-slate-200 dark:bg-slate-800';
    }
  }

  onSubmit() {
    if (this.signupForm.invalid) {
      this.signupForm.markAllAsTouched();
      this.errorMessage = 'Please fill in all required fields correctly.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    const { firstName, lastName, email, password } = this.signupForm.value;
    console.log('[SIGNUP] Submitting signup for:', email);

    this.authService.signup(firstName, lastName, email, password).subscribe({
      next: () => {
        this.isLoading = false;
        this.successMessage = 'Account created successfully! Redirecting to login...';
        setTimeout(() => {
          this.router.navigate(['/']);
        }, 2500);
      },
      error: (error: any) => {
        this.isLoading = false;
        this.errorMessage = error?.message || 'Signup failed. Please try again.';
        console.error('[SIGNUP] ❌ Error displayed to user:', this.errorMessage);
      }
    });
  }

  goToLogin() {
    this.router.navigate(['/']);
  }
}
