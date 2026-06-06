import { Component, OnInit, OnDestroy, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { MedicationService, Medication } from '../../services/medication.service';
import { NotificationService } from '../../services/notification.service';
import { Observable, Subscription } from 'rxjs';
import { BottomNavigationComponent } from '../../components/bottom-navigation/bottom-navigation.component';
import { RefreshService } from '../../services/refresh.service';
import { IonContent, IonRefresher, IonRefresherContent } from '@ionic/angular/standalone';
import { ConfirmationModalComponent } from '../../components/confirmation-modal/confirmation-modal.component';

interface HealthTip {
  title: string;
  description: string;
  category: 'medication' | 'nutrition' | 'mental';
  icon: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, BottomNavigationComponent, IonContent, IonRefresher, IonRefresherContent, ConfirmationModalComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardPageComponent implements OnInit, OnDestroy {
  medications$: Observable<Medication[]>;
  medications: Medication[] = [];
  pendingCount = 0;
  takenCount = 0;
  missedCount = 0;
  hasNotifications = false;
  recentActivity: any[] = [];
  adherenceStats = { taken: 0, missed: 0, pending: 0, adherenceRate: 0 };
  showYourMedications = true;
  isLoading = true;
  recentLogs: any[] = [];
  allLogs: any[] = [];
  medicationsMap: Map<string, string> = new Map();
  private recentLogsSub?: Subscription;
  criticalCount = 0;
  runningLowCount = 0;

  // Custom Confirmation Modal & Banner State
  showConfirmModal = false;
  modalTitle = '';
  modalMessage = '';
  modalType: 'danger' | 'warning' | 'info' = 'warning';
  pendingMedIdToDelete: string | null = null;
  successMessage = '';
  errorMessage = '';

  // Health Tips Data
  allTips: HealthTip[] = [
    {
      title: 'Take Your Meds On Time',
      description: 'Set reminders and follow your prescription schedule consistently for best results.',
      category: 'medication',
      icon: '💊'
    },
    {
      title: 'Never Skip Medications',
      description: 'Missing doses can reduce effectiveness. Keep a backup reminder on your phone.',
      category: 'medication',
      icon: '⏰'
    },
    {
      title: 'Store Meds Properly',
      description: 'Keep medicines in a cool, dry place away from sunlight and moisture.',
      category: 'medication',
      icon: '🗄️'
    },
    {
      title: 'Check Expiry Dates',
      description: 'Regularly review your medications and dispose of expired ones safely.',
      category: 'medication',
      icon: '📅'
    },
    {
      title: 'Eat a Balanced Diet',
      description: 'Include vegetables, fruits, whole grains, and protein in every meal.',
      category: 'nutrition',
      icon: '🥗'
    },
    {
      title: 'Stay Hydrated',
      description: 'Drink at least 8 glasses of water daily for optimal health.',
      category: 'nutrition',
      icon: '💧'
    },
    {
      title: 'Limit Sugar Intake',
      description: 'Reduce sugary drinks and snacks to maintain healthy blood sugar levels.',
      category: 'nutrition',
      icon: '🍬'
    },
    {
      title: 'Eat Fiber-Rich Foods',
      description: 'Include whole grains, beans, and vegetables for better digestion.',
      category: 'nutrition',
      icon: '🌾'
    },
    {
      title: 'Get Quality Sleep',
      description: 'Aim for 7-9 hours of consistent sleep each night for better health.',
      category: 'mental',
      icon: '😴'
    },
    {
      title: 'Practice Meditation',
      description: 'Spend 10-15 minutes daily meditating to reduce stress and anxiety.',
      category: 'mental',
      icon: '🧘'
    },
    {
      title: 'Exercise Regularly',
      description: 'Get at least 30 minutes of physical activity daily to boost mood.',
      category: 'mental',
      icon: '🏃'
    },
    {
      title: 'Stay Connected',
      description: 'Spend time with loved ones - social interaction improves mental health.',
      category: 'mental',
      icon: '👥'
    },
    {
      title: 'Manage Your Stress',
      description: 'Use breathing techniques, yoga, or journaling to handle daily stress.',
      category: 'mental',
      icon: '🌸'
    },
    {
      title: 'Keep a Health Journal',
      description: 'Track your symptoms and how you feel to spot patterns and improvements.',
      category: 'medication',
      icon: '📔'
    },
    {
      title: 'Talk to Your Doctor',
      description: 'Never hesitate to ask questions about your medications or health concerns.',
      category: 'medication',
      icon: '👨‍⚕️'
    }
  ];

  randomTip: HealthTip | null = null;
  filteredTips: HealthTip[] = [];
  activeFilter: 'all' | 'medication' | 'nutrition' | 'mental' = 'all';

  constructor(
    public medicationService: MedicationService,
    private notificationService: NotificationService,
    private router: Router,
    private refreshService: RefreshService,
    private cdr: ChangeDetectorRef,
    private zone: NgZone
  ) {
    // Assign directly from service so the reference tracks the live BehaviorSubject
    this.medications$ = this.medicationService.medications$;
  }

  handleRefresh(event: any) {
    this.refreshService.handleRefresh(event);
  }

  private medicationsSub?: Subscription;

  ngOnInit() {
    // Initialize health tips
    this.selectRandomTip();
    this.filterTips('all');

    // Subscribe directly to the service's BehaviorSubject-backed observable.
    // This fires on EVERY medicationsSubject.next() call — including RTDB
    // optimistic pushes — without waiting for a Firestore round-trip.
    this.medicationsSub = this.medicationService.medications$.subscribe((medications) => {
      console.log('[DASHBOARD] REALTIME UPDATE', medications);

      this.medications = medications;
      this.isLoading = false;

      const activeMeds = medications.filter(m => m.isActive !== false);

      // Calculate low stock metrics
      this.criticalCount = activeMeds.filter(m => {
        const stock = m.currentStock !== undefined ? m.currentStock : (m.stockLevel !== undefined ? m.stockLevel : (m.stock !== undefined ? m.stock : 30));
        return stock <= 3;
      }).length;

      this.runningLowCount = activeMeds.filter(m => {
        const stock = m.currentStock !== undefined ? m.currentStock : (m.stockLevel !== undefined ? m.stockLevel : (m.stock !== undefined ? m.stock : 30));
        const max = m.maxCapacity || 30;
        return stock > 3 && stock <= (max / 2);
      }).length;

      // Expand all active medications into their individual reminder slots
      const allSlots = activeMeds.flatMap(med => {
        const schedules = med.schedule || [];
        return schedules.map((time: string) => {
          const status = this.medicationService.checkAndGetReminderStatus(med, time);
          return { med, time, status };
        });
      });

      this.takenCount = allSlots.filter(s => s.status === 'taken').length;
      this.pendingCount = allSlots.filter(s => s.status === 'pending').length;
      this.missedCount = allSlots.filter(s => s.status === 'missed').length;

      this.hasNotifications = this.pendingCount > 0;

      const totalScheduledToday = allSlots.length;
      const adherenceRate = totalScheduledToday > 0
        ? (this.takenCount / totalScheduledToday) * 100
        : 0;

      this.adherenceStats = {
        taken: this.takenCount,
        missed: this.missedCount,
        pending: this.pendingCount,
        adherenceRate: Math.min(100, Math.round(adherenceRate))
      };

      // Recent activity feed — per-slot for badge display
      this.recentActivity = activeMeds
        .flatMap(med =>
          (med.schedule || []).map(time => ({
            name: med.name,
            dosage: med.dosage,
            category: med.category || 'General',
            reminderTime: time,
            status: this.medicationService.checkAndGetReminderStatus(med, time)
          }))
        )
        .sort((a, b) => (a.reminderTime || '').localeCompare(b.reminderTime || ''))
        .slice(0, 5);

      console.log('[DASHBOARD] Taken: ' + this.takenCount + ' Pending: ' + this.pendingCount + ' Missed: ' + this.missedCount);

      // Force Angular change detection — required when emission comes from
      // NgZone.run() inside a Firebase native callback (Ionic may cache view).
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy() {
    if (this.medicationsSub) {
      this.medicationsSub.unsubscribe();
    }
    if (this.recentLogsSub) {
      this.recentLogsSub.unsubscribe();
    }
  }

  updateRecentLogs(medications: Medication[] = [], backendLogs: any[] = [], localRecords: any[] = []) {
    if (!medications || medications.length === 0) {
      this.recentLogs = [];
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];

    // Helper to normalize any time string to HH:mm
    const normalizeTime = (timeStr: string): string => {
      if (!timeStr) return '';
      // Already HH:mm or HH:mm:ss
      if (/^\d{2}:\d{2}/.test(timeStr)) {
        return timeStr.substring(0, 5);
      }
      // Full ISO date — extract HH:mm
      if (timeStr.includes('T')) {
        return timeStr.split('T')[1].substring(0, 5);
      }
      return timeStr;
    };

    // STATUS PRIORITY: taken > missed > snoozed > skipped > pending
    const statusPriority: Record<string, number> = {
      taken: 4, missed: 3, snoozed: 2, skipped: 1, pending: 0
    };

    // Build unified log map — key: medicationId_normalizedTime
    // Higher-priority status wins for same slot
    const logsMap = new Map<string, any>();

    const addToMap = (log: any, dateStr: string) => {
      if (!dateStr || dateStr !== todayStr) return;
      const normTime = normalizeTime(log.scheduledTime || '');
      if (!normTime || normTime.length < 5) return; // skip if no valid time
      const key = `${log.medicationId}_${normTime}`;
      const existing = logsMap.get(key);
      const newPri = statusPriority[log.status] ?? 0;
      const existPri = existing ? (statusPriority[existing.status] ?? 0) : -1;
      if (newPri > existPri) logsMap.set(key, { ...log, _normTime: normTime });
    };

    // Add backend logs
    backendLogs.forEach(log => {
      const dateStr = log.date ? new Date(log.date).toISOString().split('T')[0] : '';
      addToMap(log, dateStr);
    });

    // Add local adherence records (override backend — they are updated immediately on action)
    localRecords.forEach(record => {
      const dateStr = record.date ? new Date(record.date).toISOString().split('T')[0] : '';
      addToMap({
        medicationId: record.medicationId,
        scheduledTime: record.scheduledTime,
        status: record.status,
        date: record.date
      }, dateStr);
    });

    // Build activities from medication schedules
    const activities = medications.flatMap(med => {
      // Only skip if explicitly inactive
      if (med.isActive === false) return [];

      let schedules: string[] = [];
      try {
        if (typeof med.timeSchedule === 'string') {
          schedules = JSON.parse(med.timeSchedule);
        } else if (Array.isArray(med.timeSchedule)) {
          schedules = med.timeSchedule;
        }
        if (schedules.length === 0 && med.reminderTimes?.length) {
          schedules = med.reminderTimes;
        }
      } catch { schedules = []; }

      return schedules.map(time => {
        const normTime = normalizeTime(time);
        const logEntry = logsMap.get(`${med.id}_${normTime}`);
        const status = logEntry ? logEntry.status : 'pending';

        return {
          medicationId: med.id,
          medicationName: med.name || 'Unknown',
          scheduledTime: normTime,
          displayTime: this.formatTime(time),
          status,
          statusClass: this.getStatusClass(status)
        };
      });
    });

    // Deduplicate by medicationId + scheduled time
    const seen = new Set<string>();
    const unique = activities.filter(act => {
      const key = `${act.medicationId}_${act.scheduledTime}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Sort chronologically, limit to 5
    this.recentLogs = unique
      .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime))
      .slice(0, 5);
  }

  formatTime(isoString: string): string {
    if (!isoString) return '--:--';
    if (isoString.includes(':') && !isoString.includes('T')) {
       // already HH:mm
       const [h, m] = isoString.split(':');
       const date = new Date();
       date.setHours(Number(h), Number(m));
       return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    try {
      return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoString;
    }
  }

  getStatusClass(status: string): string {
    if (status === 'taken') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (status === 'missed') return 'bg-rose-100 text-rose-700 border-rose-200';
    if (status === 'snoozed') return 'bg-amber-100 text-amber-700 border-amber-200';
    if (status === 'skipped') return 'bg-slate-100 text-slate-700 border-slate-200';
    return 'bg-blue-100 text-blue-700 border-blue-200';
  }

  /**
   * Select a random health tip to display
   */
  selectRandomTip(): void {
    const randomIndex = Math.floor(Math.random() * this.allTips.length);
    this.randomTip = this.allTips[randomIndex];
  }

  /**
   * Filter tips by category
   */
  filterTips(category: 'all' | 'medication' | 'nutrition' | 'mental'): void {
    this.activeFilter = category;
    if (category === 'all') {
      this.filteredTips = this.allTips;
    } else {
      this.filteredTips = this.allTips.filter(tip => tip.category === category);
    }
  }

  /**
   * Get color and label for category badge
   */
  getCategoryColor(category: string): { bg: string; text: string } {
    const colors: Record<string, { bg: string; text: string }> = {
      medication: { bg: '#EFF6FF', text: '#0369A1' },
      nutrition: { bg: '#FEFCE8', text: '#854D0E' },
      mental: { bg: '#F3F0FF', text: '#7C3AED' }
    };
    return colors[category] || { bg: '#F1F5F9', text: '#64748B' };
  }

  /**
   * Get category label for display
   */
  getCategoryLabel(category: string): string {
    const labels: Record<string, string> = {
      medication: '💊 Medication',
      nutrition: '🥗 Nutrition',
      mental: '🧠 Mental Health'
    };
    return labels[category] || category;
  }

  getLowStockClass(level: number): string {
    if (level < 10) return 'text-red-600 font-semibold';
    if (level < 20) return 'text-yellow-600';
    return 'text-green-600';
  }

  markMedicationTaken(medId: string) {
    this.medicationService.logMedicationTaken(medId).subscribe({
      next: (response) => {
        this.successMessage = '✓ Medication marked as taken!';
        setTimeout(() => this.successMessage = '', 4000);
        // Refresh stats
        this.medicationService.getAdherenceStats().subscribe({
          next: (response: any) => {
            this.adherenceStats = response.stats || { taken: 0, missed: 0, pending: 0, adherenceRate: 0 };
          }
        });
      },
      error: (error: any) => {
        console.error('❌ Error marking medication:', error);
        this.errorMessage = '❌ Failed to mark medication. Please try again.';
        setTimeout(() => this.errorMessage = '', 4000);
      }
    });
  }

  goToLowStock() {
    this.router.navigate(['/low-stock']);
  }

  toggleYourMedications() {
    this.showYourMedications = !this.showYourMedications;
  }

  addMedication() {
    this.router.navigate(['/add-medication']);
  }

  editMedication(medId: string) {
    this.router.navigate(['/edit-medication', medId]);
  }

  deleteMedication(medId: string) {
    this.pendingMedIdToDelete = medId;
    this.modalTitle = 'Delete Medication';
    this.modalMessage = 'Are you sure you want to delete this medication? This action cannot be undone.';
    this.modalType = 'danger';
    this.showConfirmModal = true;
  }

  onConfirmDelete() {
    if (this.pendingMedIdToDelete) {
      const medId = this.pendingMedIdToDelete;
      this.pendingMedIdToDelete = null;
      this.showConfirmModal = false;
      this.isLoading = true;
      this.medicationService.deleteMedication(medId).subscribe({
        next: async (response) => {
          try {
            await this.notificationService.cancelAllRemindersForMedication(medId);
          } catch (error) {
            console.error('⚠️ Failed to cancel notifications:', error);
          }
          this.isLoading = false;
          this.successMessage = '✓ Medication deleted successfully!';
          setTimeout(() => this.successMessage = '', 4000);
          this.medicationService.getMedications().subscribe();
        },
        error: (error: any) => {
          this.isLoading = false;
          console.error('❌ Error deleting medication:', error);
          this.errorMessage = '❌ Failed to delete medication. Please try again.';
          setTimeout(() => this.errorMessage = '', 4000);
        }
      });
    }
  }

  onCancelDelete() {
    this.pendingMedIdToDelete = null;
    this.showConfirmModal = false;
  }
}
