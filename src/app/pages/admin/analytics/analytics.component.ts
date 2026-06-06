import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AdminService } from '../../../services/admin.service';

@Component({
  selector: 'app-adherence-analytics',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './analytics.component.html',
  styleUrl: './analytics.component.css'
})
export class AdherenceAnalyticsComponent implements OnInit {
  menuOpen = false;
  isLoading = true;
  
  stats = {
    totalUsers: 0,
    activePrescriptions: 0,
    complianceRate: 0,
    missedReminders: 0,
    onTimeDosesRate: 0,
    missedDosesRate: 0
  };

  constructor(private router: Router, private adminService: AdminService) {}

  ngOnInit() {
    this.adminService.getDashboardStats().subscribe({
      next: (response: any) => {
        const backendStats = response.stats || {};
        const totalReminders = backendStats.totalReminders || 0;
        const taken = backendStats.takenReminders || 0;
        const missed = backendStats.missedReminders || 0;
        
        let compliance = 0;
        let missedRate = 0;
        
        if (totalReminders > 0) {
          compliance = Math.round((taken / totalReminders) * 100);
          missedRate = Math.round((missed / totalReminders) * 100);
        }

        this.stats = {
          totalUsers: backendStats.totalUsers || 0,
          activePrescriptions: backendStats.totalMedications || 0,
          complianceRate: compliance,
          missedReminders: missed,
          onTimeDosesRate: compliance,
          missedDosesRate: missedRate
        };
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading analytics stats:', err);
        this.isLoading = false;
      }
    });
  }

  goToDashboard(): void {
    this.router.navigate(['/admin/dashboard']);
  }

  goToUsers(): void {
    this.router.navigate(['/admin/users']);
  }

  goToMedications(): void {
    this.router.navigate(['/admin/medications']);
  }

  goToAlerts(): void {
    this.router.navigate(['/admin/alerts']);
  }

  goToSettings(): void {
    this.router.navigate(['/admin/settings']);
  }

  logout(): void {
    localStorage.removeItem('adminToken');
    this.router.navigate(['/login']);
  }
}
