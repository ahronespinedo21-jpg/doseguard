import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DataViewerService } from '../../../services/data-viewer.service';
import { AdminService } from '../../../services/admin.service';
import { ConfirmationModalComponent } from '../../../components/confirmation-modal/confirmation-modal.component';

@Component({
  selector: 'app-database-viewer',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmationModalComponent],
  templateUrl: './database-viewer.component.html',
  styleUrl: './database-viewer.component.css'
})
export class DatabaseViewerComponent implements OnInit {
  allData: { [key: string]: any } = {};
  users: any[] = [];
  medications: any[] = [];
  currentView: 'users' | 'medications' | 'all' = 'users';
  jsonView: string = '';
  menuOpen = false;
  isLoading = false;

  // Custom Modal & Alert state
  showConfirmModal = false;
  modalTitle = '';
  modalMessage = '';
  modalType: 'danger' | 'warning' | 'info' = 'warning';
  successMessage = '';
  errorMessage = '';

  constructor(
    private dataViewerService: DataViewerService,
    private adminService: AdminService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.users = this.dataViewerService.getAllStoredUsers();
    this.medications = this.dataViewerService.getAllStoredMedications();
    this.allData = this.dataViewerService.getAllStorageData();
    this.jsonView = JSON.stringify(this.allData, null, 2);
  }

  switchView(view: 'users' | 'medications' | 'all') {
    this.currentView = view;
  }

  downloadUsersAsCSV() {
    const csv = this.dataViewerService.exportUsersAsCSV();
    this.dataViewerService.downloadFile(csv, 'doseguard-users.csv', 'text/csv');
  }

  downloadMedicationsAsCSV() {
    const csv = this.dataViewerService.exportMedicationsAsCSV();
    this.dataViewerService.downloadFile(csv, 'doseguard-medications.csv', 'text/csv');
  }

  downloadAllAsJSON() {
    const json = this.dataViewerService.exportDataAsJson();
    this.dataViewerService.downloadFile(json, 'doseguard-database.json', 'application/json');
  }

  copyToClipboard() {
    navigator.clipboard.writeText(this.jsonView).then(() => {
      this.successMessage = '✓ Data copied to clipboard!';
      setTimeout(() => this.successMessage = '', 4000);
    });
  }

  clearAllData() {
    this.modalTitle = 'Clear Local Database';
    this.modalMessage = 'Are you sure you want to clear ALL locally stored database and cached state data? This action cannot be undone and will reset the administration database viewer.';
    this.modalType = 'danger';
    this.showConfirmModal = true;
  }

  onConfirmClear() {
    this.showConfirmModal = false;
    this.dataViewerService.clearAllData();
    this.loadData();
    this.successMessage = '✓ All database and cache data cleared successfully!';
    setTimeout(() => this.successMessage = '', 4000);
  }

  onCancelClear() {
    this.showConfirmModal = false;
  }

  refreshData() {
    this.loadData();
  }

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
