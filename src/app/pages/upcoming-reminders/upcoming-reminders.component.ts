import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { RouterModule } from '@angular/router';
import { BottomNavigationComponent } from '../../components/bottom-navigation/bottom-navigation.component';
import { MedicationService } from '../../services/medication.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { RefreshService } from '../../services/refresh.service';
import { IonContent, IonRefresher, IonRefresherContent } from '@ionic/angular/standalone';

@Component({
  selector: 'app-upcoming-reminders',
  standalone: true,
  imports: [CommonModule, RouterModule, BottomNavigationComponent, IonContent, IonRefresher, IonRefresherContent],
  templateUrl: './upcoming-reminders.component.html',
  styleUrl: './upcoming-reminders.component.css'
})
export class UpcomingRemindersComponent implements OnInit, OnDestroy {
  upcomingReminders: any[] = [];
  notificationCount = 0;
  isLoading = true;

  private destroy$ = new Subject<void>();

  constructor(
    private location: Location,
    private medicationService: MedicationService,
    private refreshService: RefreshService
  ) { }

  handleRefresh(event: any) {
    this.refreshService.handleRefresh(event);
  }

  ngOnInit() {
    this.medicationService.medications$
      .pipe(takeUntil(this.destroy$))
      .subscribe((medications) => {
        console.log('[DASHBOARD] REALTIME UPDATE (upcoming)', medications.length, 'medications');

        // Expand each medication into one slot per schedule time.
        // Skip inactive meds.
        const allSlots = medications.flatMap((med: any) => {
          if (med.isActive === false) return [];

          const schedules: string[] = Array.isArray(med.schedule) && med.schedule.length > 0
            ? med.schedule
            : (med.reminderTime ? [med.reminderTime] : []);

          return schedules.map((time: string) => {
            const status = this.medicationService.checkAndGetReminderStatus(med, time);
            const medName = med.name || med.medicationName || 'Medication';
            return {
              ...med,
              medicationId: med.id,
              medicationName: medName,
              name: medName,
              reminderTime: time,
              status: status
            };
          });
        });

        // Only show pending slots in Upcoming Reminders
        this.upcomingReminders = allSlots.filter(slot => slot.status === 'pending');
        this.notificationCount = this.upcomingReminders.length;

        console.log('[SYNC] [UPCOMING] Realtime sync completed:', this.upcomingReminders.length, 'pending slots');
        this.isLoading = false;
      });
  }

  ionViewWillEnter() {
    this.medicationService.refreshMedications();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  goBack() {
    this.location.back();
  }

  markAsTaken(slot: any) {
    const medId = slot.medicationId || slot.id;
    if (!medId || !slot.reminderTime) return;

    // Call service to update Firestore and local cache reactively
    this.medicationService.markReminderAsTaken(medId, slot.reminderTime).subscribe({
      next: () => {
        // Get updated stats
        this.medicationService.getAdherenceStats().subscribe();
        console.log('[SYNC] [UPCOMING] Marked as taken:', slot.name, '@', slot.reminderTime);
      },
      error: (err) => console.error('[SYNC] [UPCOMING] Failed to mark as taken:', err)
    });
  }
}
