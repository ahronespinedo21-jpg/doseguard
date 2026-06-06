import { Component, OnInit, OnDestroy, isDevMode } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { AdminService, DoseGuardUser } from '../../../services/admin.service';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Firestore, collection, onSnapshot } from '@angular/fire/firestore';
import { ConfirmationModalComponent } from '../../../components/confirmation-modal/confirmation-modal.component';

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ReactiveFormsModule, IonicModule, ConfirmationModalComponent],
  templateUrl: './users.component.html',
  styleUrl: './users.component.css'
})
export class UserManagementComponent implements OnInit, OnDestroy {
  users: DoseGuardUser[] = [];
  showAddForm = false;
  showEditForm = false;
  private receiptSubscription: any = null;
  selectedUser: DoseGuardUser | null = null;
  userForm: FormGroup;
  searchTerm = '';
  menuOpen = false;
  isLoading = true;

  // Custom Modal & Alert state
  showConfirmModal = false;
  modalTitle = '';
  modalMessage = '';
  modalType: 'danger' | 'warning' | 'info' = 'warning';
  pendingUserIdToDelete: string | null = null;
  successMessage = '';
  errorMessage = '';

  // Receipt Modal State
  showReceiptModal = false;
  selectedReceiptUser: DoseGuardUser | null = null;
  userMedicationsForReceipt: any[] = [];
  userReminderLogs: any[] = [];
  receiptDate: Date = new Date();
  receiptId: string = '';
  isReceiptLoading = false;
  userAdherenceStats: any = null;
  reportGeneratedAt: Date = new Date();

  // Computed stat getters
  get totalReminders(): number {
    return (this.userAdherenceStats?.taken || 0) + (this.userAdherenceStats?.missed || 0) + (this.userAdherenceStats?.pending || 0);
  }
  get totalTaken(): number { return this.userAdherenceStats?.taken || 0; }
  get totalMissed(): number { return this.userAdherenceStats?.missed || 0; }
  get adherenceRate(): number { return this.userAdherenceStats?.adherenceRate || 0; }
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
    private fb: FormBuilder,
    private router: Router,
    private firestore: Firestore
  ) {
    this.userForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['']
    });
  }

  ngOnInit() {
    this.loadUsers();
  }

  ngOnDestroy() {
    if (this.receiptSubscription) {
      this.receiptSubscription();
      this.receiptSubscription = null;
    }
  }

  loadUsers() {
    this.adminService.getAllUsers().subscribe({
      next: (response: any) => {
        this.users = response.users || [];
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading users:', err);
        this.isLoading = false;
      }
    });
  }

  get filteredUsers() {
    if (!this.searchTerm) return this.users;
    return this.users.filter(user => {
      const name = `${user.firstName || ''} ${user.lastName || ''}`.toLowerCase();
      const email = (user.email || '').toLowerCase();
      const search = this.searchTerm.toLowerCase();
      return name.includes(search) || email.includes(search);
    });
  }

  openAddForm() {
    this.showAddForm = true;
    this.userForm.reset();
  }

  closeAddForm() {
    this.showAddForm = false;
    this.userForm.reset();
  }

  openEditForm(user: DoseGuardUser) {
    this.selectedUser = user;
    this.showEditForm = true;
    this.userForm.patchValue({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone
    });
  }

  closeEditForm() {
    this.showEditForm = false;
    this.selectedUser = null;
    this.userForm.reset();
  }

  deleteUser(id: string) {
    const user = this.users.find(u => u.id === id);
    const name = `${user?.firstName || ''} ${user?.lastName || ''}`;
    this.pendingUserIdToDelete = id;
    this.modalTitle = 'Delete Patient';
    this.modalMessage = `Are you sure you want to delete patient "${name}"? This action cannot be undone and will permanently remove all medication and adherence logs associated with this patient.`;
    this.modalType = 'danger';
    this.showConfirmModal = true;
  }

  onConfirmDelete() {
    if (this.pendingUserIdToDelete) {
      const id = this.pendingUserIdToDelete;
      this.pendingUserIdToDelete = null;
      this.showConfirmModal = false;
      this.isLoading = true;
      this.adminService.deleteUser(id).subscribe({
        next: (response) => {
          this.isLoading = false;
          this.successMessage = 'Patient deleted successfully!';
          setTimeout(() => this.successMessage = '', 4000);
          this.loadUsers();
        },
        error: (err) => {
          this.isLoading = false;
          console.error('Error deleting user:', err);
          this.errorMessage = 'Failed to delete patient.';
          setTimeout(() => this.errorMessage = '', 4000);
        }
      });
    }
  }

  onCancelDelete() {
    this.pendingUserIdToDelete = null;
    this.showConfirmModal = false;
  }

  addUser() {
    if (this.userForm.invalid) {
      this.errorMessage = 'Please fill in all required fields correctly';
      setTimeout(() => this.errorMessage = '', 4000);
      return;
    }

    const formData = this.userForm.value;

    this.adminService.addUser({
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      phone: formData.phone
    }).subscribe({
      next: (response) => {
        this.successMessage = 'Patient added successfully!';
        setTimeout(() => this.successMessage = '', 4000);
        this.closeAddForm();
        this.loadUsers();
      },
      error: (error) => {
        console.error('❌ Error adding user:', error);
        this.errorMessage = error.error?.message || error.message || 'Failed to add patient';
        setTimeout(() => this.errorMessage = '', 4000);
      }
    });
  }

  updateUser() {
    if (!this.selectedUser || this.userForm.invalid) {
      this.errorMessage = 'Please fill in all required fields correctly';
      setTimeout(() => this.errorMessage = '', 4000);
      return;
    }

    const formData = this.userForm.value;

    this.adminService.updateUser(this.selectedUser.id, {
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      phone: formData.phone
    }).subscribe({
      next: (response) => {
        this.successMessage = 'Patient updated successfully!';
        setTimeout(() => this.successMessage = '', 4000);
        this.closeEditForm();
        this.loadUsers();
      },
      error: (error) => {
        console.error('❌ Error updating user:', error);
        this.errorMessage = error.error?.message || error.message || 'Failed to update patient';
        setTimeout(() => this.errorMessage = '', 4000);
      }
    });
  }

  // --- Receipt Modal Methods ---

  openReceiptModal(user: DoseGuardUser) {
    if (!user || !user.id) {
      console.error('❌ Cannot open receipt: Invalid user data', user);
      alert('Error: Could not load patient data for receipt.');
      return;
    }

    if (this.receiptSubscription) {
      this.receiptSubscription();
      this.receiptSubscription = null;
    }

    const isDev = isDevMode();
    if (isDev) {
      console.log('[REPORT] Opening Monitoring Report for:', user.firstName, user.lastName);
    }

    this.selectedReceiptUser = user;
    this.showReceiptModal = true;
    this.isReceiptLoading = true;
    this.receiptDate = new Date();
    this.reportGeneratedAt = new Date();
    this.receiptId = 'REC-' + Math.floor(100000 + Math.random() * 900000);
    this.userMedicationsForReceipt = [];
    this.userReminderLogs = [];
    this.userAdherenceStats = { taken: 0, missed: 0, pending: 0, adherenceRate: 0 };

    try {
      const medsRef = collection(this.firestore, `users/${user.id}/medications`);
      if (isDev) {
        console.log('[FIRESTORE] Subscribing to user medications path:', `users/${user.id}/medications`);
      }

      this.receiptSubscription = onSnapshot(medsRef, 
        (snapshot) => {
          try {
            const meds: any[] = [];
            snapshot.forEach(doc => {
              meds.push({ id: doc.id, ...doc.data() });
            });

            if (isDev) {
              console.log('[MEDICATIONS] Realtime medications updated, count:', meds.length);
            }

            // Safe Medication Summary Rendering
            this.userMedicationsForReceipt = meds.map((med: any) => {
              const schedules: string[] = Array.isArray(med.schedule) && med.schedule.length > 0
                ? med.schedule
                : (med.reminderTime ? [med.reminderTime] : []);
              return {
                ...med,
                name: med.name || med.medicationName || '—',
                dosage: med.dosage || '—',
                frequency: med.frequency || 'Daily',
                formattedSchedule: this.formatSchedule(schedules),
                displayStatus: med.isActive !== false ? 'Active' : 'Inactive'
              };
            });

            // Safe Adherence and Activity Generation
            let totalSlots = 0;
            let takenCount = 0;
            let missedCount = 0;
            let pendingCount = 0;
            const activityRows: any[] = [];

            meds.forEach((med: any) => {
              if (med.isActive === false) return;
              
              // Safe reminder parsing
              const schedules: string[] = Array.isArray(med.schedule) && med.schedule.length > 0
                ? med.schedule
                : (med.reminderTime ? [med.reminderTime] : []);
              
              const reminders = Array.isArray(med.reminders) ? med.reminders : [];

              schedules.forEach((time: string) => {
                totalSlots++;
                
                // Get status from reminders array or compute it
                const existing = reminders.find((r: any) => r.reminderTime === time);
                let status: 'pending' | 'taken' | 'missed' = 'pending';
                if (existing && (existing.status === 'taken' || existing.status === 'missed')) {
                  status = existing.status;
                } else {
                  // check past grace
                  try {
                    const now = new Date();
                    const parts = time.split(' ');
                    if (parts.length >= 2) {
                      let [hours, minutes] = parts[0].split(':').map(Number);
                      const period = parts[1];
                      if (period === 'PM' && hours < 12) hours += 12;
                      if (period === 'AM' && hours === 12) hours = 0;

                      const scheduledDate = new Date();
                      scheduledDate.setHours(hours, minutes, 0, 0);

                      const createdDate = med.createdAt ? new Date(med.createdAt) : new Date();
                      if (scheduledDate.getTime() >= createdDate.getTime()) {
                        const gracePeriodMs = 30 * 60 * 1000;
                        if (now.getTime() > (scheduledDate.getTime() + gracePeriodMs)) {
                          status = 'missed';
                        }
                      }
                    }
                  } catch (err) {
                    if (isDev) {
                      console.error('[REPORT] Error checking schedule time grace:', err);
                    }
                  }
                }

                if (status === 'taken') takenCount++;
                else if (status === 'missed') missedCount++;
                else pendingCount++;

                // Generate Activity Row
                activityRows.push({
                  scheduledAt: new Date(),
                  time: time,
                  medicationName: med.name || med.medicationName || '—',
                  action: status === 'taken' ? 'Taken' : (status === 'missed' ? 'Missed' : 'Pending'),
                  status: status === 'taken' ? 'taken' : (status === 'missed' ? 'missed' : 'pending'),
                  notes: status === 'taken' ? 'Dose taken on time' : (status === 'missed' ? 'Overdue threshold' : 'Awaiting schedule')
                });
              });
            });

            // Sort Activity Rows by time chronologically
            this.userReminderLogs = activityRows.sort((a, b) => (a.time || '').localeCompare(b.time || '')).slice(0, 20);

            if (isDev) {
              console.log('[ACTIVITY] Generated activity history count:', this.userReminderLogs.length);
            }

            // Safe Adherence Rate Calculation
            const adherence = totalSlots > 0 ? Math.round((takenCount / totalSlots) * 100) : 0;
            this.userAdherenceStats = {
              taken: takenCount,
              missed: missedCount,
              pending: pendingCount,
              adherenceRate: Math.min(100, Math.max(0, adherence))
            };

            this.isReceiptLoading = false;
            this.reportGeneratedAt = new Date();
          } catch (innerError) {
            console.error('❌ [REPORT] Error processing snapshot data:', innerError);
            this.isReceiptLoading = false;
          }
        },
        (error) => {
          console.error('❌ [FIRESTORE] Realtime report subscription failed:', error);
          this.isReceiptLoading = false;
        }
      );
    } catch (e) {
      console.error('❌ [REPORT] Exception raised during real-time subscription setup:', e);
      this.isReceiptLoading = false;
    }
  }

  closeReceiptModal() {
    if (this.receiptSubscription) {
      this.receiptSubscription();
      this.receiptSubscription = null;
    }
    this.showReceiptModal = false;
    this.selectedReceiptUser = null;
    this.userMedicationsForReceipt = [];
    this.userReminderLogs = [];
  }

  formatTime(time: string): string {
    if (!time || typeof time !== 'string') return '';
    try {
      const parts = time.split(':');
      if (parts.length < 2) return time;
      const hours = parts[0];
      const minutes = parts[1].substring(0, 2); // handle potential seconds
      const hour = parseInt(hours, 10);
      if (isNaN(hour)) return time;
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const hour12 = hour % 12 || 12;
      return `${hour12.toString().padStart(2, '0')}:${minutes} ${ampm}`;
    } catch (e) {
      return time;
    }
  }

  formatSchedule(schedule: string[] | string | any): string {
    if (!schedule) return 'No schedule set';
    const times = Array.isArray(schedule) ? schedule : [String(schedule)];
    const validTimes = times.filter((t: any) => t && typeof t === 'string' && t.trim() !== '');
    if (validTimes.length === 0) return 'No schedule set';
    return validTimes.map((t: string) => this.formatTime(t)).join(' • ');
  }

  printReceipt() {
    window.print();
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

  downloadReceiptPDF() {
    const element = document.getElementById('receipt-content-area');
    if (!element) {
      console.error('❌ Cannot export PDF: Element not found');
      alert('Error: Could not locate the report content area.');
      return;
    }

    try {
      html2canvas(element, { scale: 2 }).then(canvas => {
        try {
          const imgData = canvas.toDataURL('image/png');
          const pdf = new jsPDF('p', 'mm', 'a4');

          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

          pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
          pdf.save(`Medication_Receipt_${this.selectedReceiptUser?.firstName || 'User'}.pdf`);
        } catch (pdfErr) {
          console.error('❌ [REPORT] PDF export compression failed:', pdfErr);
          alert('Failed to generate PDF file. Please try again.');
        }
      }).catch(err => {
        console.error('❌ [REPORT] html2canvas rendering failed:', err);
        alert('Failed to render the document image.');
      });
    } catch (e) {
      console.error('❌ [REPORT] Exception raised during PDF creation:', e);
      alert('An unexpected error occurred during PDF generation.');
    }
  }

  toggleMenu() {
    this.menuOpen = !this.menuOpen;
  }

  logout() {
    this.adminService.adminLogout();
    this.router.navigate(['/']);
  }

  goToDashboard() {
    this.router.navigate(['/admin']);
  }

  goToMedications() {
    this.router.navigate(['/admin/medications']);
  }

  goToUsers() {
    this.menuOpen = false;
  }

  addMedicationForUser(user: DoseGuardUser) {
    this.router.navigate(['/add-medication'], { queryParams: { patientId: user.id } });
  }
}
