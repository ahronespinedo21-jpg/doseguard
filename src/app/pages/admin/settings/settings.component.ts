import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-system-settings',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css'
})
export class SystemSettingsComponent {
  menuOpen = false;
  constructor(private router: Router) {}

  goToDashboard(): void {
    this.router.navigate(['/admin/dashboard']);
  }

  goToUsers(): void {
    this.router.navigate(['/admin/users']);
  }

  goToMedications(): void {
    this.router.navigate(['/admin/medications']);
  }

  goToAnalytics(): void {
    this.router.navigate(['/admin/analytics']);
  }

  goToAlerts(): void {
    this.router.navigate(['/admin/alerts']);
  }

  logout(): void {
    localStorage.removeItem('adminToken');
    this.router.navigate(['/login']);
  }
}
