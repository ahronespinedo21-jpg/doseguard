import { registerPlugin, PluginListenerHandle } from '@capacitor/core';

export interface AlarmPluginEvent {
  actionId: string;
  notification: {
    id: number;
    extra: {
      medicationId: string;
      time: string;
      medicationName: string;
    };
  };
}

export interface AlarmPluginInterface {
  /** Schedule a native AlarmManager exact alarm. */
  schedule(options: {
    id: number;
    time: number;          // UTC milliseconds
    medicationName: string;
    dosage?: string;
    medicationId?: string;
    timeString?: string;   // HH:MM display string
  }): Promise<void>;

  /** Cancel a previously scheduled alarm by its numeric ID. */
  cancel(options: { id: number }): Promise<void>;

  /** Check whether the exact-alarm permission is granted (Android 12+). */
  checkPermissions(): Promise<{ exactAlarm: boolean }>;

  /** Open system Settings → Alarms & Reminders so the user can grant permission. */
  requestExactAlarmPermission(): Promise<void>;

  /**
   * Schedule a 30-second test alarm that bypasses all UI/DB logic.
   * Use this to verify the native alarm pipeline works end-to-end.
   */
  testAlarm(): Promise<{ scheduledAt: number; message: string }>;

  /** Listen for alarm actions (Take / Snooze / Skip) emitted from AlarmActivity. */
  addListener(
    eventName: 'alarmActionPerformed',
    listenerFunc: (event: AlarmPluginEvent) => void
  ): Promise<PluginListenerHandle> & PluginListenerHandle;
}

const AlarmPlugin = registerPlugin<AlarmPluginInterface>('AlarmPlugin');

export default AlarmPlugin;
