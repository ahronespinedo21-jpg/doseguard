import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AdminService } from '../../../services/admin.service';

@Component({
  selector: 'app-alerts-reports',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './alerts.component.html',
  styleUrl: './alerts.component.css'
})
export class AlertsReportsComponent implements OnInit {
  menuOpen = false;
  alerts: any[] = [];
  filteredAlerts: any[] = [];
  activeFilter: 'all' | 'critical' | 'warning' | 'activity' = 'all';
  isLoading = true;

  constructor(
    private router: Router,
    private adminService: AdminService
  ) { }

  ngOnInit() {
    this.loadAlerts();
  }

  loadAlerts() {
    this.isLoading = true;
    this.adminService.getAllReminderLogs().subscribe({
      next: (response: any) => {
        const logs = response.logs || [];
        // Map and sort reminder logs by time (newest first)
        this.alerts = logs.map((log: any) => {
          let severity: 'critical' | 'warning' | 'info' = 'info';
          let title = 'Medication Adherence';
          let icon = '💊';

          if (log.status === 'missed') {
            severity = 'critical';
            title = 'Missed Dosage Alert';
            icon = '⚠️';
          } else if (log.status === 'taken') {
            severity = 'info';
            title = 'Medication Adherence Event';
            icon = '✓';
          } else {
            severity = 'warning';
            title = 'Pending Medication Dosage';
            icon = '⏳';
          }

          // Format time for display
          let formattedTime = 'Recently';
          if (log.timestamp || log.loggedAt || log.createdAt) {
            const date = new Date(log.timestamp || log.loggedAt || log.createdAt);
            if (!isNaN(date.getTime())) {
              formattedTime = date.toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
              });
            }
          }

          const userName = log.userName || log.patientName || 'Patient';
          const medName = log.medicationName || log.name || 'Medication';
          const dosage = log.dosage || '1 pill';
          const schedTime = log.reminderTime || 'scheduled time';

          let description = '';
          if (log.status === 'missed') {
            description = `Patient ${userName} missed their scheduled dose of ${medName} (${dosage}) at ${schedTime}.`;
          } else if (log.status === 'taken') {
            description = `Patient ${userName} successfully took their dose of ${medName} (${dosage}) at ${schedTime}.`;
          } else {
            description = `Scheduled dose of ${medName} (${dosage}) for ${userName} at ${schedTime} is currently pending.`;
          }

          return {
            id: log.id,
            title,
            description,
            status: log.status,
            time: formattedTime,
            severity,
            icon,
            userName,
            medicationName: medName,
            dosage,
            reminderTime: schedTime
          };
        });

        // Sort: newest first
        this.alerts.sort((a: any, b: any) => {
          const timeA = new Date(a.time).getTime() || 0;
          const timeB = new Date(b.time).getTime() || 0;
          return timeB - timeA;
        });

        // Also put critical items at the absolute top for immediate visibility
        this.alerts.sort((a: any, b: any) => {
          if (a.severity === 'critical' && b.severity !== 'critical') return -1;
          if (a.severity !== 'critical' && b.severity === 'critical') return 1;
          return 0;
        });

        this.applyFilter(this.activeFilter);
        this.isLoading = false;
      },
      error: (err) => {
        console.error('❌ Failed to load alerts:', err);
        this.isLoading = false;
      }
    });
  }

  applyFilter(filter: 'all' | 'critical' | 'warning' | 'activity') {
    this.activeFilter = filter;
    if (filter === 'all') {
      this.filteredAlerts = this.alerts;
    } else if (filter === 'critical') {
      this.filteredAlerts = this.alerts.filter(a => a.severity === 'critical' || a.status === 'missed');
    } else if (filter === 'warning') {
      this.filteredAlerts = this.alerts.filter(a => a.severity === 'warning');
    } else {
      this.filteredAlerts = this.alerts.filter(a => a.severity === 'info' || a.status === 'taken');
    }
  }

  toggleMenu() {
    this.menuOpen = !this.menuOpen;
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

  goToAnalytics(): void {
    this.router.navigate(['/admin/analytics']);
  }

  goToSettings(): void {
    this.router.navigate(['/admin/settings']);
  }

  logout(): void {
    this.adminService.adminLogout();
    this.router.navigate(['/login']);
  }
}
