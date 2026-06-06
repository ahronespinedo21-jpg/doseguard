import { Component, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { BottomNavigationComponent } from '../../components/bottom-navigation/bottom-navigation.component';
import { MedicationService, Medication } from '../../services/medication.service';
import { Subscription } from 'rxjs';
import { RefreshService } from '../../services/refresh.service';
import { IonContent, IonRefresher, IonRefresherContent } from '@ionic/angular/standalone';

interface LowStockItem {
  id: string;
  medication: string;
  remaining: number;
  maxCapacity: number;
  category: string;
  level: 'critical' | 'low';
  icon: string;
  alertMessage: string;
}

@Component({
  selector: 'app-low-stock',
  standalone: true,
  imports: [CommonModule, RouterModule, BottomNavigationComponent, IonContent, IonRefresher, IonRefresherContent],
  templateUrl: './low-stock.component.html',
  styleUrl: './low-stock.component.css'
})
export class LowStockComponent implements OnInit {
  lowStockItems: LowStockItem[] = [];
  criticalCount = 0;
  lowCount = 0;
  canGoBack = true;
  isLoading = true;
  private subscription: Subscription = new Subscription();

  constructor(
    private location: Location,
    private medicationService: MedicationService,
    private router: Router,
    private refreshService: RefreshService
  ) {}

  handleRefresh(event: any) {
    this.refreshService.handleRefresh(event);
  }

  ngOnInit() {
    this.subscription.add(
      this.medicationService.medications$.subscribe(meds => {
        this.processMedications(meds);
        this.isLoading = false;
      })
    );
    // Initial fetch
    this.medicationService.getMedications().subscribe();
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  processMedications(meds: Medication[]) {
    // Filter for low stock (remaining <= half of maxCapacity) in real-time
    this.lowStockItems = meds
      .filter(m => {
        if (m.isActive === false) return false;
        const remaining = m.currentStock !== undefined ? m.currentStock : (m.stockLevel !== undefined ? m.stockLevel : (m.stock !== undefined ? m.stock : 30));
        const maxCapacity = m.maxCapacity || 30;
        return remaining <= (maxCapacity / 2);
      })
      .map(m => {
        const remaining = m.currentStock !== undefined ? m.currentStock : (m.stockLevel !== undefined ? m.stockLevel : (m.stock || 0));
        const maxCapacity = m.maxCapacity || 30;
        
        // Critical: 1 to 3 tablets (or 0)
        // Running Low: 4 to half capacity
        const level: 'critical' | 'low' = remaining <= 3 ? 'critical' : 'low';
        
        const alertMessage = level === 'critical'
          ? 'Your medication is critically low. Refill immediately to avoid missing scheduled doses.'
          : 'Refill your pillbox soon to ensure continuous adherence to your prescription.';

        return {
          id: m.id || '',
          medication: m.name || m.medicationName || 'Medication',
          remaining: remaining,
          maxCapacity: maxCapacity,
          category: m.category || 'General',
          level: level,
          icon: level === 'critical' ? '🚨' : '⚠️',
          alertMessage: alertMessage
        };
      });

    this.criticalCount = this.lowStockItems.filter(item => item.level === 'critical').length;
    this.lowCount = this.lowStockItems.filter(item => item.level === 'low').length;
  }

  refillMedication(item: LowStockItem) {
    this.router.navigate(['/edit-medication', item.id]);
  }

  getProgressColor(level: string): string {
    return level === 'critical' ? 'from-red-500 to-red-600' : 'from-amber-500 to-amber-600';
  }

  getLevelBadge(level: string): string {
    return level === 'critical' ? '🚨 Immediate Refill Required' : '⚠ Refill Soon';
  }

  goBack() {
    if (this.canGoBack) {
      this.location.back();
    }
  }

  getLevelBadgeColor(level: string): string {
    if (level === 'critical') {
      return 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/50';
    }
    return 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/50';
  }
}
