import { Injectable } from '@angular/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { OfflineSyncService } from './offline-sync.service';
import AlarmPlugin from './alarm-plugin';

export interface ReminderSchedule {
  id: string;
  medicationName: string;
  medicationId: string;
  time: string; // HH:MM 24-hour format
  dosage: string;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private isInitialized = false;

  constructor(private offlineSync: OfflineSyncService) {
    this.initializeNotifications();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // initializeNotifications
  // ──────────────────────────────────────────────────────────────────────────
  async initializeNotifications() {
    if (this.isInitialized) return;

    try {
      const permission = await LocalNotifications.requestPermissions();

      if (permission.display === 'granted') {
        if (Capacitor.getPlatform() === 'android') {
          console.log('[DoseGuard] 📱 Configuring Android notification channels...');

          // Delete all old stale channels (importance is cached — new ID required to change it)
          const oldChannels = [
            'medication-reminders', 'doseguard-reminders', 'doseguard-reminders-v2',
            'doseguard-reminders-v3', 'doseguard-reminders-v4', 'doseguard-reminders-v5',
            'doseguard-alarms-v1', 'doseguard-alarms-v2', 'doseguard-foreground-alarm'
          ];
          for (const id of oldChannels) {
            try { await LocalNotifications.deleteChannel({ id }); } catch (_) {}
          }

          // Create the fresh v3 channel to match AlarmReceiver's native channel
          await LocalNotifications.createChannel({
            id: 'doseguard-alarms-v3',
            name: 'DoseGuard Medication Alarms',
            description: 'Full-screen alarms for scheduled medication reminders',
            importance: 5,        // IMPORTANCE_MAX
            visibility: 1,        // VISIBILITY_PUBLIC
            vibration: true,
            lights: true,
            lightColor: '#7C3AED'
          });
          console.log('[DoseGuard] ✅ Channel doseguard-alarms-v3 created.');

          // Register actionable notification types
          await LocalNotifications.registerActionTypes({
            types: [{
              id: 'MEDICATION_REMINDER',
              actions: [
                { id: 'mark_taken', title: 'Take Medication' },
                { id: 'snooze',     title: 'Snooze 10m' },
                { id: 'skip',       title: 'Skip', destructive: true }
              ]
            }]
          });

          // Listen for native alarm actions (Take / Snooze / Skip from AlarmActivity)
          await AlarmPlugin.addListener('alarmActionPerformed', (action: any) => {
            console.log('[DoseGuard] 🔔 alarmActionPerformed received:', action);
            this.handleNotificationAction({
              actionId: action.actionId,
              notification: action.notification
            });
          });

          // Check and request exact alarm permission
          const permCheck = await AlarmPlugin.checkPermissions();
          console.log('[DoseGuard] 🔐 Exact alarm permission:', permCheck.exactAlarm ? '✅ GRANTED' : '⚠️ NOT GRANTED');
          if (!permCheck.exactAlarm) {
            console.warn('[DoseGuard] ⚠️ Exact alarm permission NOT granted. Requesting from user...');
            await AlarmPlugin.requestExactAlarmPermission();
          }
        }

        await LocalNotifications.addListener('localNotificationActionPerformed', (action: any) => {
          this.handleNotificationAction(action);
        });

        this.isInitialized = true;
        console.log('[DoseGuard] ✅ NotificationService initialized successfully.');
      } else {
        console.warn('[DoseGuard] ⚠️ Notification permission NOT granted.');
      }
    } catch (error) {
      console.error('[DoseGuard] ❌ Error initializing NotificationService:', error);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // scheduleReminder
  //
  // FIX #5 — Deterministic IDs:
  //   Previous implementation used Math.random() which created a NEW base ID
  //   on every call. This orphaned the previous 14 alarms (they could never be
  //   cancelled because their IDs were lost). After 5 saves: 70 leaked alarms.
  //
  //   Fix: use a stable djb2 hash of (medicationId + "_" + time).
  //   Same medication + same time slot always maps to the same base ID,
  //   so re-scheduling correctly overwrites (FLAG_UPDATE_CURRENT) the old alarm.
  // ──────────────────────────────────────────────────────────────────────────
  async scheduleReminder(reminder: ReminderSchedule): Promise<void> {
    if (!this.isInitialized) {
      await this.initializeNotifications();
    }

    try {
      const [hours, minutes] = reminder.time.split(':').map(Number);
      const baseNotificationId = this.deterministicId(reminder.medicationId, reminder.time);

      console.log(`[DoseGuard] 🔔 scheduleReminder() called`);
      console.log(`[DoseGuard]    → Med:    ${reminder.medicationName}`);
      console.log(`[DoseGuard]    → Time:   ${reminder.time} (${hours}h ${minutes}m local)`);
      console.log(`[DoseGuard]    → MedID:  ${reminder.medicationId}`);
      console.log(`[DoseGuard]    → BaseID: ${baseNotificationId}`);

      if (Capacitor.getPlatform() === 'android') {
        // Verify exact alarm permission before scheduling
        const permCheck = await AlarmPlugin.checkPermissions();
        if (!permCheck.exactAlarm) {
          console.warn('[DoseGuard] ⚠️ Exact alarm permission missing — requesting...');
          await AlarmPlugin.requestExactAlarmPermission();
          console.warn('[DoseGuard] ⚠️ Proceeding with setExactAndAllowWhileIdle() fallback.');
        } else {
          console.log('[DoseGuard] ✅ Exact alarm permission confirmed.');
        }

        const now = new Date();
        let scheduledCount = 0;

        // Schedule 14 days of alarms (one per day at the specified time)
        for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
          const scheduledDate = new Date();
          scheduledDate.setHours(hours, minutes, 0, 0);
          scheduledDate.setDate(scheduledDate.getDate() + dayOffset);

          // Skip if this slot is already in the past
          if (scheduledDate.getTime() <= now.getTime()) {
            console.log(`[DoseGuard]    ⏭️ Day +${dayOffset}: ${scheduledDate.toLocaleString()} is in the past — skipping.`);
            continue;
          }

          const alarmId = baseNotificationId + dayOffset;

          console.log(`[DoseGuard]    ⏰ Day +${dayOffset}: Scheduling ID=${alarmId}`
            + ` at ${scheduledDate.toLocaleString()}`
            + ` (UTC ms: ${scheduledDate.getTime()})`);

          try {
            await AlarmPlugin.schedule({
              id: alarmId,
              time: scheduledDate.getTime(),
              medicationName: reminder.medicationName,
              dosage: reminder.dosage,
              medicationId: reminder.medicationId,
              timeString: reminder.time
            });
            scheduledCount++;
            console.log(`[DoseGuard]    ✅ [ALARM REGISTERED] ID=${alarmId} → ${scheduledDate.toLocaleString()}`);
          } catch (scheduleErr) {
            console.error(`[DoseGuard]    ❌ Failed to schedule ID=${alarmId}:`, scheduleErr);
          }
        }

        console.log(`[DoseGuard] ✅ scheduleReminder() complete — ${scheduledCount}/14 alarms registered for "${reminder.medicationName}".`);

      } else {
        // ── Non-Android fallback (web / iOS) ──────────────────────────────────
        const notifications: any[] = [];
        const now = new Date();

        for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
          const scheduledDate = new Date();
          scheduledDate.setHours(hours, minutes, 0, 0);
          scheduledDate.setDate(scheduledDate.getDate() + dayOffset);

          if (dayOffset === 0 && scheduledDate <= now) continue;

          const hour12 = hours % 12 || 12;
          const ampm   = hours >= 12 ? 'PM' : 'AM';
          const formattedTime = `${String(hour12).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${ampm}`;

          notifications.push({
            id: baseNotificationId + dayOffset,
            title: `💊 DoseGuard: ${reminder.medicationName}`,
            body: `Time to take ${reminder.medicationName} — ${reminder.dosage}\nScheduled: ${formattedTime}`,
            schedule: { at: scheduledDate, allowWhileIdle: true },
            channelId: 'doseguard-alarms-v3',
            ongoing: true,
            autoCancel: false,
            extra: {
              medicationId: reminder.medicationId,
              reminderId: reminder.id,
              medicationName: reminder.medicationName,
              time: reminder.time
            },
            actionTypeId: 'MEDICATION_REMINDER'
          });
        }

        if (notifications.length > 0) {
          await LocalNotifications.schedule({ notifications });
          console.log(`[DoseGuard] ✅ ${notifications.length} local notifications scheduled (non-Android).`);
        }
      }

      // Persist the deterministic base ID so cancel/update works correctly
      this.saveNotificationId(reminder.medicationId, reminder.time, baseNotificationId);

    } catch (error) {
      console.error('[DoseGuard] ❌ scheduleReminder() error:', error);
      throw error;
    }
  }

  async scheduleMultipleReminders(
    medicationId: string, medicationName: string, times: string[], dosage: string
  ): Promise<void> {
    console.log(`[DoseGuard] 🔔 scheduleMultipleReminders() — ${times.length} time(s) for "${medicationName}"`);
    for (const time of times) {
      await this.scheduleReminder({ id: `${medicationId}-${time}`, medicationId, medicationName, time, dosage });
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // testAlarm — schedules a 30-second native alarm to verify the pipeline.
  // Call this from any component to bypass all scheduling/DB logic.
  // ──────────────────────────────────────────────────────────────────────────
  async testAlarm(): Promise<void> {
    if (Capacitor.getPlatform() !== 'android') {
      console.warn('[DoseGuard] testAlarm() is Android-only.');
      return;
    }
    try {
      console.log('[DoseGuard] 🧪 testAlarm() — scheduling 30-second native test alarm...');
      const result = await AlarmPlugin.testAlarm();
      console.log('[DoseGuard] ✅ testAlarm() registered:', result.message);
    } catch (e) {
      console.error('[DoseGuard] ❌ testAlarm() failed:', e);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Cancel helpers
  // ──────────────────────────────────────────────────────────────────────────
  async cancelReminder(medicationId: string, time: string): Promise<void> {
    try {
      const baseId = this.getNotificationId(medicationId, time);
      if (baseId === null) {
        console.warn(`[DoseGuard] cancelReminder(): no stored ID for ${medicationId} @ ${time}`);
        return;
      }

      console.log(`[DoseGuard] 🗑️ cancelReminder() — base ID=${baseId} for ${medicationId} @ ${time}`);

      if (Capacitor.getPlatform() === 'android') {
        for (let i = 0; i < 14; i++) {
          await AlarmPlugin.cancel({ id: baseId + i });
        }
      } else {
        const toCancel = Array.from({ length: 14 }, (_, i) => ({ id: baseId + i }));
        await LocalNotifications.cancel({ notifications: toCancel });
      }

      this.removeNotificationId(medicationId, time);
      console.log(`[DoseGuard] ✅ cancelReminder() complete.`);
    } catch (error) {
      console.error('[DoseGuard] ❌ cancelReminder() error:', error);
    }
  }

  async cancelAllRemindersForMedication(medicationId: string): Promise<void> {
    try {
      const allIds = this.getAllNotificationIdsForMedication(medicationId);
      console.log(`[DoseGuard] 🗑️ cancelAllRemindersForMedication() — ${allIds.length} IDs for ${medicationId}`);

      if (allIds.length === 0) return;

      if (Capacitor.getPlatform() === 'android') {
        for (const item of allIds) await AlarmPlugin.cancel({ id: item.id });
      } else {
        await LocalNotifications.cancel({ notifications: allIds });
      }

      this.removeAllNotificationIdsForMedication(medicationId);
      console.log(`[DoseGuard] ✅ cancelAllRemindersForMedication() complete.`);
    } catch (error) {
      console.error('[DoseGuard] ❌ cancelAllRemindersForMedication() error:', error);
    }
  }

  async cancelAllReminders(): Promise<void> {
    try {
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length > 0) {
        await LocalNotifications.cancel({
          notifications: pending.notifications.map(n => ({ id: n.id }))
        });
      }
      if (Capacitor.getPlatform() === 'android') {
        for (const id of this.getAllNotificationIds()) {
          await AlarmPlugin.cancel({ id });
        }
      }
      this.clearAllNotificationIds();
      console.log('[DoseGuard] ✅ cancelAllReminders() complete.');
    } catch (error) {
      console.error('[DoseGuard] ❌ cancelAllReminders() error:', error);
    }
  }

  async getScheduledReminders(): Promise<any[]> {
    try {
      const pending = await LocalNotifications.getPending();
      return pending.notifications;
    } catch (error) {
      console.error('[DoseGuard] ❌ getScheduledReminders() error:', error);
      return [];
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Notification action handling
  // ──────────────────────────────────────────────────────────────────────────
  private handleNotificationAction(action: any): void {
    const { notification, actionId } = action;
    const notificationId = notification?.id;

    console.log(`[DoseGuard] 🔔 handleNotificationAction() — actionId="${actionId}" notifID=${notificationId}`);

    if (actionId === 'snooze') {
      this.snoozeNotification(notificationId);
      this.dispatchAdherenceAction('snooze', notification);
    } else if (actionId === 'mark_taken') {
      this.markAsTaken(notificationId);
      this.dispatchAdherenceAction('mark_taken', notification);
    } else if (actionId === 'skip') {
      this.skipNotification(notificationId);
      this.dispatchAdherenceAction('skip', notification);
    } else if (actionId === 'tap') {
      this.navigateToReminders();
    }
  }

  private dispatchAdherenceAction(actionId: string, notification: any): void {
    if (!notification?.extra) return;
    const { medicationId, time, medicationName } = notification.extra;

    let status: 'pending' | 'taken' | 'missed' | 'snoozed' = 'pending';
    if (actionId === 'mark_taken') status = 'taken';
    else if (actionId === 'skip')  status = 'missed';
    else if (actionId === 'snooze') status = 'snoozed';

    if (status !== 'pending') {
      this.offlineSync.logAdherenceAction(medicationId, status, time, medicationName);
    }

    window.dispatchEvent(new CustomEvent('medication_adherence_action', {
      detail: { medicationId, time, status }
    }));
  }

  private async snoozeNotification(notificationId: number): Promise<void> {
    try {
      const snoozeDate = new Date();
      snoozeDate.setMinutes(snoozeDate.getMinutes() + 10);

      if (Capacitor.getPlatform() === 'android') {
        await AlarmPlugin.schedule({
          id: Math.abs(notificationId) + 20_000,
          time: snoozeDate.getTime(),
          medicationName: 'Snoozed Reminder',
          dosage: 'Snoozed 10 min',
          medicationId: '',
          timeString: ''
        });
      } else {
        const pending = await LocalNotifications.getPending();
        const notif = pending.notifications.find((n: any) => n.id === notificationId);
        if (notif) {
          await LocalNotifications.schedule({
            notifications: [{
              ...notif,
              id: Math.abs(notificationId) + 20_000,
              schedule: { at: snoozeDate, allowWhileIdle: true },
              title: `💊 Snoozed: ${notif.title}`,
              body: 'Reminder snoozed for 10 minutes'
            }]
          });
        }
      }
      console.log('[DoseGuard] ✅ Snooze scheduled for 10 min.');
    } catch (error) {
      console.error('[DoseGuard] ❌ snoozeNotification() error:', error);
    }
  }

  private async skipNotification(notificationId: number): Promise<void> {
    try {
      await LocalNotifications.cancel({ notifications: [{ id: notificationId }] });
    } catch (error) {
      console.error('[DoseGuard] ❌ skipNotification() error:', error);
    }
  }

  private async markAsTaken(notificationId: number): Promise<void> {
    try {
      await LocalNotifications.cancel({ notifications: [{ id: notificationId }] });
    } catch (error) {
      console.error('[DoseGuard] ❌ markAsTaken() error:', error);
    }
  }

  private navigateToReminders(): void {
    window.location.href = '/reminders';
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Deterministic ID generation  (Fix #5)
  //
  // djb2 hash of "medicationId_HH:MM" → always returns the same 32-bit int
  // for the same input, keeping alarm IDs stable across app restarts.
  // Stays within the safe PendingIntent request code range (positive int32).
  // ──────────────────────────────────────────────────────────────────────────
  private deterministicId(medicationId: string, time: string): number {
    const key = `${medicationId}_${time}`;
    let hash = 5381;
    for (let i = 0; i < key.length; i++) {
      hash = ((hash << 5) + hash) ^ key.charCodeAt(i);
      hash = hash & hash; // Keep as 32-bit signed int
    }
    // Map to positive range: 1 – 1,999,986 (leaves room for +14 day offsets)
    return (Math.abs(hash) % 1_999_986) + 1;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // LocalStorage helpers for persisting base notification IDs
  // ──────────────────────────────────────────────────────────────────────────
  private saveNotificationId(medicationId: string, time: string, notificationId: number): void {
    localStorage.setItem(`notification_${medicationId}_${time}`, notificationId.toString());
  }

  private getNotificationId(medicationId: string, time: string): number | null {
    const id = localStorage.getItem(`notification_${medicationId}_${time}`);
    return id ? parseInt(id, 10) : null;
  }

  private removeNotificationId(medicationId: string, time: string): void {
    localStorage.removeItem(`notification_${medicationId}_${time}`);
  }

  private getAllNotificationIdsForMedication(medicationId: string): { id: number }[] {
    const ids: { id: number }[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(`notification_${medicationId}_`)) {
        const baseId = parseInt(localStorage.getItem(key) || '0', 10);
        if (baseId) {
          for (let j = 0; j < 14; j++) ids.push({ id: baseId + j });
        }
      }
    }
    return ids;
  }

  private removeAllNotificationIdsForMedication(medicationId: string): void {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(`notification_${medicationId}_`)) keys.push(key);
    }
    keys.forEach(k => localStorage.removeItem(k));
  }

  private getAllNotificationIds(): number[] {
    const ids: number[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('notification_')) {
        const baseId = parseInt(localStorage.getItem(key) || '0', 10);
        if (baseId) {
          for (let j = 0; j < 14; j++) ids.push(baseId + j);
        }
      }
    }
    return ids;
  }

  private clearAllNotificationIds(): void {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('notification_')) keys.push(key);
    }
    keys.forEach(k => localStorage.removeItem(k));
  }
}
