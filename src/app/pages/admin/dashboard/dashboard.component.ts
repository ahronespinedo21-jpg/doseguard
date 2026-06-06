import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AdminService, DoseGuardUser } from '../../../services/admin.service';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { RefreshService } from '../../../services/refresh.service';
import { IonContent, IonRefresher, IonRefresherContent } from '@ionic/angular/standalone';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, IonContent, IonRefresher, IonRefresherContent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class AdminDashboardComponent implements OnInit {
  stats = {
    totalUsers: 0,
    totalMedications: 0,
    activeMedications: 0,
    usersWithReminders: 0
  };

  recentUsers: any[] = [];
  recentMedications: any[] = [];
  allUsers: any[] = [];
  allMedications: any[] = [];
  menuOpen = false;
  isLoading = true;
  private pendingRequests = 3;

  // ── Report Modal State ──
  showReportModal = false;
  selectedReportUser: DoseGuardUser | null = null;
  reportMedications: any[] = [];
  reportLogs: any[] = [];
  reportDate: Date = new Date();
  reportGeneratedAt: Date = new Date();
  reportId: string = '';
  isReportLoading = false;
  reportAdherenceStats: any = null;

  // Computed adherence getters
  get totalReminders(): number {
    return (this.reportAdherenceStats?.taken || 0) + (this.reportAdherenceStats?.missed || 0) + (this.reportAdherenceStats?.pending || 0);
  }
  get totalTaken(): number { return this.reportAdherenceStats?.taken || 0; }
  get totalMissed(): number { return this.reportAdherenceStats?.missed || 0; }
  get adherenceRate(): number { return this.reportAdherenceStats?.adherenceRate || 0; }
  get adherenceCircumference(): number { return 2 * Math.PI * 36; }
  get adherenceDashOffset(): number {
    return this.adherenceCircumference * (1 - this.adherenceRate / 100);
  }
  get adherenceLabel(): string {
    const r = this.adherenceRate;
    if (r >= 90) return 'Excellent';
    if (r >= 75) return 'Good';
    if (r >= 50) return 'Fair';
    return 'Needs Attention';
  }

  constructor(
    private adminService: AdminService,
    private router: Router,
    private refreshService: RefreshService
  ) {}

  handleRefresh(event: any) {
    // Refresh stats by reloading data, then completing event via RefreshService
    this.pendingRequests = 3;
    this.loadDashboardData();
    this.refreshService.handleRefresh(event);
  }

  ngOnInit() {
    this.loadDashboardData();
  }

  loadDashboardData() {
    this.adminService.getDashboardStats().subscribe({
      next: (response: any) => {
        const backendStats = response.stats || {};
        this.stats = {
          ...this.stats,
          totalUsers: backendStats.totalUsers || 0,
          totalMedications: backendStats.totalMedications || 0
        };
        this.checkLoading();
      },
      error: (err) => {
        console.error('Error loading stats:', err);
        this.checkLoading();
      }
    });

    this.adminService.getAllUsers().subscribe({
      next: (response: any) => {
        this.recentUsers = response.users?.slice(0, 5) || [];
        this.allUsers = response.users || [];
        this.checkLoading();
      },
      error: (err) => {
        console.error('Error loading users:', err);
        this.checkLoading();
      }
    });

    this.adminService.getAllMedications().subscribe({
      next: (response: any) => {
        const medications = Array.isArray(response) ? response : (response?.medications || []);
        const mappedMeds = medications.map((med: any) => ({
          id: med.id,
          medicationName: med.name || 'Unknown',
          userName: med.patientName || med.userName || (med.User ? `${med.User.firstName} ${med.User.lastName}` : 'Unknown User'),
          dosage: med.dosage || 'N/A',
          frequency: med.frequency || 'N/A',
          time: med.timeSchedule ? (typeof med.timeSchedule === 'string' ? med.timeSchedule : med.timeSchedule.join(', ')) : (med.schedule ? med.schedule.join(', ') : 'N/A'),
          status: med.isActive ? 'Active' : 'Inactive'
        }));
        this.recentMedications = mappedMeds.slice(0, 5);
        this.allMedications = mappedMeds;
        this.stats.totalMedications = medications.length;
        this.stats.activeMedications = medications.filter((m: any) => m.isActive === true || m.status === 'active').length;
        const uniqueUsers = new Set();
        medications.forEach((m: any) => {
          if (m.userId) uniqueUsers.add(m.userId);
          else if (m.User && m.User.id) uniqueUsers.add(m.User.id);
        });
        this.stats.usersWithReminders = uniqueUsers.size;
        this.checkLoading();
      },
      error: (err) => {
        console.error('Error loading medications:', err);
        this.checkLoading();
      }
    });
  }

  private checkLoading() {
    this.pendingRequests--;
    if (this.pendingRequests <= 0) {
      this.isLoading = false;
    }
  }

  // ── Report Modal Methods ──
  openReportModal(user: any) {
    this.selectedReportUser = user;
    this.showReportModal = true;
    this.isReportLoading = true;
    this.reportDate = new Date();
    this.reportGeneratedAt = new Date();
    this.reportId = 'REC-' + Math.floor(100000 + Math.random() * 900000);
    this.reportMedications = [];
    this.reportLogs = [];
    this.reportAdherenceStats = null;

    this.adminService.getUserMedicationRecords(user.id).subscribe({
      next: (response: any) => {
        this.reportMedications = (response.medications || []).map((med: any) => ({
          ...med,
          formattedSchedule: this.formatSchedule(med.timeSchedule),
        }));
        this.isReportLoading = false;
      },
      error: () => { this.isReportLoading = false; }
    });

    this.adminService.getUserAdherence(user.id).subscribe({
      next: (response: any) => { this.reportAdherenceStats = response.stats; },
      error: () => {}
    });

    this.adminService.getUserReminderLogs(user.id).subscribe({
      next: (response: any) => { this.reportLogs = (response.logs || []).slice(0, 20); },
      error: () => { this.reportLogs = []; }
    });
  }

  closeReportModal() {
    this.showReportModal = false;
    this.selectedReportUser = null;
  }

  formatTime(time: string): string {
    if (!time || typeof time !== 'string') return '';
    try {
      const parts = time.split(':');
      if (parts.length < 2) return time;
      const hour = parseInt(parts[0], 10);
      if (isNaN(hour)) return time;
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const h12 = hour % 12 || 12;
      return `${h12.toString().padStart(2, '0')}:${parts[1].substring(0, 2)} ${ampm}`;
    } catch { return time; }
  }

  formatSchedule(schedule: string[] | string | any): string {
    if (!schedule) return 'No schedule set';
    const times = Array.isArray(schedule) ? schedule : [String(schedule)];
    const valid = times.filter((t: any) => t && typeof t === 'string' && t.trim() !== '');
    return valid.length === 0 ? 'No schedule set' : valid.map((t: string) => this.formatTime(t)).join(' • ');
  }

  getLogStatusClass(status: string): string {
    const s = (status || '').toLowerCase();
    if (s === 'taken') return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
    if (s === 'missed') return 'bg-red-100 text-red-700 border border-red-200';
    if (s === 'snoozed') return 'bg-amber-100 text-amber-700 border border-amber-200';
    return 'bg-orange-100 text-orange-700 border border-orange-200';
  }

  getLogStatusDot(status: string): string {
    const s = (status || '').toLowerCase();
    if (s === 'taken') return 'bg-emerald-500';
    if (s === 'missed') return 'bg-red-500';
    if (s === 'snoozed') return 'bg-amber-500';
    return 'bg-orange-500';
  }

  printReport() { window.print(); }

  downloadReportPDF() {
    const element = document.getElementById('dashboard-report-area');
    if (!element) return;
    html2canvas(element, { scale: 2 }).then(canvas => {
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Monitoring_Report_${this.selectedReportUser?.firstName || 'Patient'}.pdf`);
    });
  }

  toggleMenu() { this.menuOpen = !this.menuOpen; }

  logout() {
    this.adminService.adminLogout();
    this.router.navigate(['/']);
  }

  goToUsers() { this.router.navigate(['/admin/users']); }
  goToMedications() { this.router.navigate(['/admin/medications']); }
}
