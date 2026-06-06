import { Component, OnInit, OnDestroy, Input, Output, EventEmitter, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { MedicationService } from '../../services/medication.service';
import { AuthService } from '../../services/auth.service';
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css'
})
export class SidebarComponent implements OnInit, OnDestroy {
  @Input() sidebarOpen = false;
  @Output() toggleSidebar = new EventEmitter<void>();
  
  isDarkMode = false;
  currentRoute = '';
  isDesktop = window.innerWidth >= 768;
  remindersCount$: Observable<number>;
  remindersCount = 0;

  private destroy$ = new Subject<void>();

  menuItems = [
    { label: 'Dashboard', icon: 'dashboard', route: '/dashboard', badge: null as number | null },
    { label: 'AI Chatbot', icon: 'chatbot', route: '/chatbot', badge: null as number | null },
    { label: 'Upcoming Reminders', icon: 'reminders', route: '/upcoming-reminders', badge: null as number | null },
    { label: 'Low Stock', icon: 'lowstock', route: '/low-stock', badge: null as number | null },
    { label: 'Settings', icon: 'settings', route: '/settings', badge: null as number | null }
  ];

  constructor(
    private router: Router, 
    private medicationService: MedicationService,
    private authService: AuthService
  ) {
    this.currentRoute = this.router.url;
    this.remindersCount$ = new Observable(observer => {
      observer.next(0);
    });
  }

  ngOnInit() {
    this.router.events.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.currentRoute = this.router.url;
    });

    // Subscribe to master medications$ stream for real-time pending badges
    this.medicationService.medications$
      .pipe(takeUntil(this.destroy$))
      .subscribe((medications) => {
        const pending = medications.reduce((count, med: any) => {
          if (med.isActive === false) return count;
          const schedules: string[] = Array.isArray(med.schedule) && med.schedule.length > 0
            ? med.schedule
            : (med.reminderTime ? [med.reminderTime] : []);
          
          const pendingSlots = schedules.filter(time => 
            this.medicationService.checkAndGetReminderStatus(med, time) === 'pending'
          ).length;
          
          return count + pendingSlots;
        }, 0);

        this.remindersCount = pending;
        const reminderItem = this.menuItems.find(item => item.route === '/upcoming-reminders');
        if (reminderItem) {
          reminderItem.badge = pending > 0 ? pending : null;
        }
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: Event): void {
    this.isDesktop = window.innerWidth >= 768;
  }

  closeSidebar() {
    this.toggleSidebar.emit();
  }

  navigateTo(route: string) {
    this.router.navigate([route]);
    if (window.innerWidth < 768) {
      this.toggleSidebar.emit();
    }
  }

  toggleDarkMode() {
    this.isDarkMode = !this.isDarkMode;
    if (this.isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }

  logout() {
    if (confirm('Are you sure you want to log out?')) {
      this.authService.logout();
    }
  }

  getIcon(iconName: string): string {
    const icons: { [key: string]: string } = {
      dashboard: 'M3 13h2v8H3zm4-8h2v16H7zm4-5h2v21h-2zm4 5h2v16h-2zm4-5h2v21h-2z',
      chatbot: 'M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z',
      settings: 'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.62l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.48.1.62l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.1.62l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.62l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z'
    };
    return icons[iconName] || '';
  }
}
