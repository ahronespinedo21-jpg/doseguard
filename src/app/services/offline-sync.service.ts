import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ApiConfigService } from './api-config.service';

export interface OfflineAdherenceLog {
  id: string;
  medicationId: string;
  medicationName?: string;
  status: 'taken' | 'missed' | 'snoozed';
  scheduledTime: string;
  actualTime: string;
  date: string;
  synced: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class OfflineSyncService {
  private readonly QUEUE_KEY = 'doseguard_offline_queue';

  constructor(private http: HttpClient, private apiConfig: ApiConfigService) {
    this.setupNetworkListener();
    // Try syncing on startup
    this.syncOfflineQueue();
  }

  /**
   * Listen to browser/capacitor online events to trigger sync
   */
  private setupNetworkListener(): void {
    window.addEventListener('online', () => {
      console.log('🌐 Network online, attempting to sync offline adherence logs...');
      this.syncOfflineQueue();
    });
  }

  /**
   * Log adherence offline, and try to sync immediately if possible.
   */
  public async logAdherenceAction(
    medicationId: string, 
    status: 'taken' | 'missed' | 'snoozed', 
    scheduledTime: string,
    medicationName?: string
  ): Promise<void> {
    const log: OfflineAdherenceLog = {
      id: `${medicationId}_${scheduledTime}_${Date.now()}`,
      medicationId,
      medicationName,
      status,
      scheduledTime,
      actualTime: new Date().toTimeString().split(' ')[0], // HH:MM:SS
      date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
      synced: false
    };

    // Save to queue
    const queue = this.getQueue();
    queue.push(log);
    this.saveQueue(queue);

    console.log(`💾 Saved offline adherence action: ${status} for medication ${medicationId}`);

    // Attempt to sync immediately
    if (navigator.onLine) {
      await this.syncOfflineQueue();
    }
  }

  /**
   * Get current queue from localStorage
   */
  private getQueue(): OfflineAdherenceLog[] {
    const data = localStorage.getItem(this.QUEUE_KEY);
    return data ? JSON.parse(data) : [];
  }

  /**
   * Save queue to localStorage
   */
  private saveQueue(queue: OfflineAdherenceLog[]): void {
    localStorage.setItem(this.QUEUE_KEY, JSON.stringify(queue));
  }

  /**
   * Push pending logs to backend
   */
  public async syncOfflineQueue(): Promise<void> {
    if (!navigator.onLine) return;

    const queue = this.getQueue().filter(log => !log.synced);
    if (queue.length === 0) return;

    try {
      console.log(`🔄 Syncing ${queue.length} offline adherence logs to backend...`);
      
      const token = localStorage.getItem('token');
      if (!token) {
        console.warn('⚠️ No auth token found. Cannot sync adherence logs.');
        return;
      }

      // Send to backend /sync endpoint
      await this.http.post(`${this.apiConfig.getBaseUrl()}/reminders/sync`, { logs: queue }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }).toPromise();

      // Clear synced logs from queue
      const allLogs = this.getQueue();
      const updatedQueue = allLogs.filter(log => {
        // Keep logs that weren't in this sync batch (e.g. newly added while syncing)
        return !queue.find(q => q.id === log.id);
      });
      this.saveQueue(updatedQueue);
      
      console.log('✅ Offline sync successful.');
    } catch (error) {
      console.error('❌ Failed to sync offline queue:', error);
      // Logs remain in queue to be retried later
    }
  }
}
