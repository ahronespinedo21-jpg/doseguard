import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AdminService } from '../../../services/admin.service';

@Component({
  selector: 'app-device-management',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './devices.component.html',
  styleUrl: './devices.component.css'
})
export class DeviceManagementComponent {
  menuOpen = false;
  constructor(private router: Router, private adminService: AdminService) {}

  goToDashboard(): void { this.router.navigate(['/admin/dashboard']); }
  goToUsers(): void { this.router.navigate(['/admin/users']); }
  goToMedications(): void { this.router.navigate(['/admin/medications']); }
  goToAnalytics(): void { this.router.navigate(['/admin/analytics']); }
  goToAlerts(): void { this.router.navigate(['/admin/alerts']); }
  goToSettings(): void { this.router.navigate(['/admin/settings']); }
  
  logout(): void {
    this.adminService.adminLogout();
    this.router.navigate(['/login']);
  }
}
