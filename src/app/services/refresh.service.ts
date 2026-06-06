import { Injectable } from '@angular/core';
import { BehaviorSubject, timer } from 'rxjs';
import { take } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class RefreshService {
  private refreshTrigger = new BehaviorSubject<number>(Date.now());
  public refreshAction$ = this.refreshTrigger.asObservable();

  constructor() {}

  /**
   * Triggers a global refresh of realtime streams.
   */
  triggerRefresh(): void {
    console.log('🔄 [REFRESH] Triggering realtime data resync...');
    this.refreshTrigger.next(Date.now());
  }

  /**
   * Handles the IonRefresher event, triggers resync, and safely completes the refresher.
   * @param event The IonRefresher custom event
   * @param fallbackMs Safe fallback duration to ensure the spinner dismisses
   */
  handleRefresh(event: any, fallbackMs: number = 1000): void {
    this.triggerRefresh();

    // Safely complete the refresher animation after streams have had time to re-initialize
    timer(fallbackMs).pipe(take(1)).subscribe(() => {
      if (event && event.target && event.target.complete) {
        event.target.complete();
        console.log('✅ [REFRESH] Refresher animation completed safely.');
      }
    });
  }
}
