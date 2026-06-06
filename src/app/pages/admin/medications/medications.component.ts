import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AdminService, MedicationReminder } from '../../../services/admin.service';
import { RefreshService } from '../../../services/refresh.service';
import { IonContent, IonRefresher, IonRefresherContent } from '@ionic/angular/standalone';
import { ConfirmationModalComponent } from '../../../components/confirmation-modal/confirmation-modal.component';

@Component({
  selector: 'app-medication-records',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, IonContent, IonRefresher, IonRefresherContent, ConfirmationModalComponent],
  templateUrl: './medications.component.html',
  styleUrl: './medications.component.css'
})
export class MedicationRecordsComponent implements OnInit {
  medications: MedicationReminder[] = [];
  searchTerm = '';
  menuOpen = false;
  filterStatus: 'all' | 'active' | 'inactive' = 'all';
  isLoading = true;

  // Custom Modal & Alert state
  showConfirmModal = false;
  modalTitle = '';
  modalMessage = '';
  modalType: 'danger' | 'warning' | 'info' = 'danger';
  pendingMedicationIdToDelete: string | null = null;
  pendingMedicationUserId: string | null = null;
  pendingMedicationName: string | null = null;
  successMessage = '';
  errorMessage = '';

  constructor(
    private adminService: AdminService,
    private router: Router,
    private refreshService: RefreshService
  ) {}

  handleRefresh(event: any) {
    this.isLoading = true;
    this.loadMedications();
    this.refreshService.handleRefresh(event);
  }

  ngOnInit() {
    this.loadMedications();
  }

  loadMedications() {
    this.adminService.getAllMedications().subscribe({
      next: (response: any) => {
        const medsList = Array.isArray(response) ? response : (response?.medications || []);
        // Map backend response to expected format
        this.medications = medsList.map((med: any) => {
          const patientName = med.patientName || med.userName || (med.User ? `${med.User.firstName} ${med.User.lastName}` : 'Unknown User');
          const patientEmail = med.patientEmail || (med.User ? med.User.email : 'N/A');
          return {
            id: med.id,
            name: med.name || med.medicationName || 'Unknown',
            medicationName: med.name || med.medicationName || 'Unknown',
            patientName: patientName,
            userName: patientName,
            patientEmail: patientEmail,
            dosage: med.dosage || 'N/A',
            frequency: med.frequency || 'N/A',
            time: med.timeSchedule ? (typeof med.timeSchedule === 'string' ? med.timeSchedule : med.timeSchedule.join(', ')) : (med.schedule ? med.schedule.join(', ') : 'N/A'),
            status: (med.isActive === true || med.status === 'active' || med.status === 'Active') ? 'active' : 'inactive',
            createdAt: med.createdAt ? new Date(med.createdAt).toLocaleDateString() : 'N/A',
            userId: med.userId || (med.User ? med.User.id : '')
          };
        });
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading medications:', err);
        this.isLoading = false;
      }
    });
  }

  deleteMedication(med: any) {
    if (!med || !med.id || !med.userId) {
      console.error('❌ Cannot delete medication: Invalid medication metadata', med);
      this.errorMessage = 'Failed to trigger deletion: Missing medication reference metadata.';
      setTimeout(() => this.errorMessage = '', 4000);
      return;
    }
    this.pendingMedicationIdToDelete = med.id;
    this.pendingMedicationUserId = med.userId;
    this.pendingMedicationName = med.name || med.medicationName || 'this medication';
    this.modalTitle = 'Delete Medication';
    this.modalMessage = `Are you sure you want to permanently remove this medication and its associated reminders?`;
    this.modalType = 'danger';
    this.showConfirmModal = true;
  }

  onConfirmDelete() {
    if (this.pendingMedicationIdToDelete && this.pendingMedicationUserId) {
      const id = this.pendingMedicationIdToDelete;
      const userId = this.pendingMedicationUserId;
      const name = this.pendingMedicationName || 'Unknown';

      // Reset state variables to prevent duplicate or double-click deletion
      this.pendingMedicationIdToDelete = null;
      this.pendingMedicationUserId = null;
      this.pendingMedicationName = null;
      this.showConfirmModal = false;
      this.isLoading = true;

      this.adminService.deleteMedication(userId, id, name).subscribe({
        next: (response) => {
          this.isLoading = false;
          this.successMessage = `Medication "${name}" deleted successfully!`;
          setTimeout(() => this.successMessage = '', 4000);
          this.loadMedications();
        },
        error: (err) => {
          this.isLoading = false;
          console.error('Error deleting medication:', err);
          this.errorMessage = err.error?.message || err.message || 'Failed to delete medication.';
          setTimeout(() => this.errorMessage = '', 4000);
        }
      });
    }
  }

  onCancelDelete() {
    this.pendingMedicationIdToDelete = null;
    this.pendingMedicationUserId = null;
    this.pendingMedicationName = null;
    this.showConfirmModal = false;
  }

  get filteredMedications() {
    let filtered = this.medications;

    // Apply search filter
    if (this.searchTerm) {
      filtered = filtered.filter(med => {
        const medName = (med.medicationName || '').toLowerCase();
        const userName = (med.userName || '').toLowerCase();
        const searchLower = this.searchTerm.toLowerCase();
        return medName.includes(searchLower) || userName.includes(searchLower);
      });
    }

    // Apply status filter
    if (this.filterStatus !== 'all') {
      filtered = filtered.filter(med => med.status === this.filterStatus);
    }

    return filtered;
  }

  getStatusBadgeColor(status: string): string {
    return status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700';
  }

  getActiveMedicationCount(): number {
    return this.medications.filter(m => m.status === 'active').length;
  }

  getFilteredMedicationCount(): number {
    return this.filteredMedications.length;
  }

  logout() {
    this.adminService.adminLogout();
    this.router.navigate(['/']);
  }

  goToDashboard() {
    this.router.navigate(['/admin']);
  }

  goToUsers() {
    this.router.navigate(['/admin/users']);
  }
}

