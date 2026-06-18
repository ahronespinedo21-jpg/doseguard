import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AdminService } from '../../../services/admin.service';
import { Firestore, collection, collectionGroup, onSnapshot } from '@angular/fire/firestore';

@Component({
  selector: 'app-adherence-analytics',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './analytics.component.html',
  styleUrl: './analytics.component.css'
})
export class AdherenceAnalyticsComponent implements OnInit, OnDestroy {
  menuOpen = false;
  isLoading = true;
  
  stats = {
    totalUsers: 0,
    activePrescriptions: 0,
    complianceRate: 0,
    missedReminders: 0,
    onTimeDosesRate: 0,
    lateDosesRate: 0,
    missedDosesRate: 0
  };

  monthlyTrend: { month: string; count: number; height: number; isCurrent: boolean }[] = [];

  private usersList: any[] = [];
  private medicationsList: any[] = [];
  private reminderLogsList: any[] = [];
  private unsubscribes: (() => void)[] = [];

  constructor(
    private router: Router, 
    private adminService: AdminService,
    private firestore: Firestore
  ) {}

  ngOnInit() {
    // 1. Listen to users collection
    const usersRef = collection(this.firestore, 'users');
    const unsubUsers = onSnapshot(usersRef, {
      next: (snapshot) => {
        this.usersList = [];
        snapshot.forEach(doc => {
          this.usersList.push({ id: doc.id, ...doc.data() });
        });
        this.calculateAnalytics();
      },
      error: (err) => {
        console.error('Error listening to users collection:', err);
      }
    });
    this.unsubscribes.push(unsubUsers);

    // 2. Listen to medications collection group
    const medsRef = collectionGroup(this.firestore, 'medications');
    const unsubMeds = onSnapshot(medsRef, {
      next: (snapshot) => {
        this.medicationsList = [];
        snapshot.forEach(doc => {
          this.medicationsList.push({ id: doc.id, ...doc.data() });
        });
        this.calculateAnalytics();
      },
      error: (err) => {
        console.error('Error listening to medications collection group:', err);
      }
    });
    this.unsubscribes.push(unsubMeds);

    // 3. Listen to reminderLogs collection group
    const logsRef = collectionGroup(this.firestore, 'reminderLogs');
    const unsubLogs = onSnapshot(logsRef, {
      next: (snapshot) => {
        this.reminderLogsList = [];
        snapshot.forEach(doc => {
          this.reminderLogsList.push({ id: doc.id, ...doc.data() });
        });
        this.calculateAnalytics();
      },
      error: (err) => {
        console.error('Error listening to reminderLogs collection group:', err);
      }
    });
    this.unsubscribes.push(unsubLogs);
  }

  ngOnDestroy() {
    this.unsubscribes.forEach(unsub => unsub());
  }

  private calculateAnalytics() {
    const totalUsers = this.usersList.length;
    const activePrescriptions = this.medicationsList.length;

    // Filter reminder logs
    const logs = this.reminderLogsList;
    const taken = logs.filter(l => l.status === 'taken').length;
    const missed = logs.filter(l => l.status === 'missed').length;
    const late = logs.filter(l => l.status === 'late').length;
    const pending = logs.filter(l => l.status === 'pending').length;

    // complianceRate = (takenRecords / allRecords) * 100
    // where allRecords = taken + missed + pending
    const complianceTotal = taken + missed + pending;
    const complianceRate = complianceTotal > 0 ? Math.round((taken / complianceTotal) * 100) : 0;

    // Detailed adherence breakdown rates: taken, late, missed
    const breakdownTotal = taken + late + missed;
    const onTimeDosesRate = breakdownTotal > 0 ? Math.round((taken / breakdownTotal) * 100) : 0;
    const lateDosesRate = breakdownTotal > 0 ? Math.round((late / breakdownTotal) * 100) : 0;
    const missedDosesRate = breakdownTotal > 0 ? Math.round((missed / breakdownTotal) * 100) : 0;

    this.stats = {
      totalUsers,
      activePrescriptions,
      complianceRate,
      missedReminders: missed,
      onTimeDosesRate,
      lateDosesRate,
      missedDosesRate
    };

    // Calculate Monthly compliance trend for the current year
    const currentYear = new Date().getFullYear();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentMonth = new Date().getMonth();
    const displayMonthsCount = Math.max(4, currentMonth + 1); // Display at least Jan-Apr
    const monthsToDisplay = monthNames.slice(0, displayMonthsCount);

    const monthlyCounts = monthsToDisplay.map((name, index) => {
      const count = logs.filter(l => {
        if (l.status !== 'taken') return false;
        try {
          const dateStr = l.date || l.timestamp || l.createdAt || l.loggedAt;
          if (!dateStr) return false;
          const d = new Date(dateStr);
          return !isNaN(d.getTime()) && d.getFullYear() === currentYear && d.getMonth() === index;
        } catch {
          return false;
        }
      }).length;
      return { name, count };
    });

    const maxCount = Math.max(...monthlyCounts.map(m => m.count), 1);

    this.monthlyTrend = monthlyCounts.map(m => {
      const height = Math.round((m.count / maxCount) * 208); // max height 208px (corresponds to h-52)
      return {
        month: m.name,
        count: m.count,
        height: Math.max(height, 8),
        isCurrent: m.name === monthNames[currentMonth]
      };
    });

    this.isLoading = false;
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
