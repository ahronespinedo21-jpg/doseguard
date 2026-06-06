import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { MedicationService } from '../../services/medication.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-bottom-navigation',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './bottom-navigation.component.html',
  styleUrl: './bottom-navigation.component.css'
})
export class BottomNavigationComponent implements OnInit, OnDestroy {
  currentRoute = '';
  navItems: any[] = [];
  pendingCount = 0;
  private destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private sanitizer: DomSanitizer,
    private medicationService: MedicationService
  ) {
    this.initNavItems();
  }

  private initNavItems() {
    this.navItems = [
      {
        route: '/dashboard',
        label: 'Home',
        icon: this.sanitizer.bypassSecurityTrustHtml(`<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="stroke-width: 2;">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-3m0 0l7-4 7 4M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
        </svg>`)
      },
      {
        route: '/add-medication',
        label: 'Add Med',
        icon: this.sanitizer.bypassSecurityTrustHtml(`<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="stroke-width: 2;">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>`)
      },
      {
        route: '/chatbot',
        label: 'Chat',
        icon: this.sanitizer.bypassSecurityTrustHtml(`<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="stroke-width: 2;">
          <path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
        </svg>`)
      },
      {
        route: '/settings',
        label: 'Settings',
        icon: this.sanitizer.bypassSecurityTrustHtml(`<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="stroke-width: 2;">
          <path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
        </svg>`)
      }
    ];
  }

  ngOnInit() {
    this.updateCurrentRoute();
    this.router.events.subscribe(() => {
      this.updateCurrentRoute();
    });

    this.medicationService.medications$
      .pipe(takeUntil(this.destroy$))
      .subscribe((medications) => {
        this.pendingCount = medications.reduce((count, med: any) => {
          if (med.isActive === false) return count;
          const schedules: string[] = Array.isArray(med.schedule) && med.schedule.length > 0
            ? med.schedule
            : (med.reminderTime ? [med.reminderTime] : []);
          const pendingSlots = schedules.filter(time =>
            this.medicationService.checkAndGetReminderStatus(med, time) === 'pending'
          ).length;
          return count + pendingSlots;
        }, 0);
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private updateCurrentRoute() {
    this.currentRoute = this.router.url;
  }

  isActive(route: string): boolean {
    return this.currentRoute === route;
  }

  getActiveIndex(): number {
    return this.navItems.findIndex(item => item.route === this.currentRoute);
  }
}
