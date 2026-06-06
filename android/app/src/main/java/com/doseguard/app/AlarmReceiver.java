package com.doseguard.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.PowerManager;
import android.util.Log;
import androidx.core.app.NotificationCompat;

/**
 * AlarmReceiver — fired by AlarmManager when a scheduled PendingIntent triggers.
 *
 * KEY FIXES APPLIED:
 *  1. Removed direct context.startActivity() — blocked on Android 10+ from background.
 *  2. Relies exclusively on fullScreenIntent notification for AlarmActivity launch.
 *  3. New channel "doseguard-alarms-v3" forces IMPORTANCE_HIGH (old channels are cached).
 *  4. PowerManager.WakeLock prevents CPU sleep before AlarmForegroundService starts.
 *  5. AlarmForegroundService is the SOLE audio owner — no audio here.
 */
public class AlarmReceiver extends BroadcastReceiver {

    private static final String TAG = "AlarmReceiver";
    // Versioned ID — Android caches channel importance; a new ID forces a fresh channel.
    private static final String CHANNEL_ID = "doseguard-alarms-v3";
    private static final int WAKELOCK_TIMEOUT_MS = 60_000;

    public static final String ACTION_TAKE = "com.doseguard.ACTION_TAKE";
    public static final String ACTION_SNOOZE = "com.doseguard.ACTION_SNOOZE";
    public static final String ACTION_SKIP = "com.doseguard.ACTION_SKIP";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();

        if (ACTION_TAKE.equals(action) || ACTION_SNOOZE.equals(action) || ACTION_SKIP.equals(action)) {
            Log.d(TAG, "Notification action tapped: " + action);

            try {
                context.stopService(new Intent(context, AlarmForegroundService.class));
            } catch (Exception e) {
                Log.e(TAG, "Error stopping service from notification", e);
            }

            int id = intent.getIntExtra("id", -1);
            String medicationName = intent.getStringExtra("medicationName");
            String dosage = intent.getStringExtra("dosage");
            String medicationId = intent.getStringExtra("medicationId");
            String timeString = intent.getStringExtra("timeString");

            NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                nm.cancel(id);
                nm.cancel(9999); // FOREGROUND_NOTIFICATION_ID
            }

            String actionToApp = "";
            if (ACTION_SNOOZE.equals(action)) {
                actionToApp = "snooze";
                long snoozeTime = System.currentTimeMillis() + (10 * 60_000L);
                int snoozeId = id + 50_000;
                Intent snoozeIntent = new Intent(context, AlarmReceiver.class);
                snoozeIntent.putExtra("id", snoozeId);
                snoozeIntent.putExtra("medicationName", medicationName);
                snoozeIntent.putExtra("dosage", "Snoozed: " + dosage);
                snoozeIntent.putExtra("medicationId", medicationId);
                snoozeIntent.putExtra("timeString", timeString);

                PendingIntent pi = PendingIntent.getBroadcast(
                        context, snoozeId, snoozeIntent,
                        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                );
                android.app.AlarmManager am = (android.app.AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
                if (am != null) {
                    android.app.AlarmManager.AlarmClockInfo info = new android.app.AlarmManager.AlarmClockInfo(snoozeTime, pi);
                    am.setAlarmClock(info, pi);
                }
            } else if (ACTION_TAKE.equals(action)) {
                actionToApp = "mark_taken";
            } else if (ACTION_SKIP.equals(action)) {
                actionToApp = "skip";
            }

            Intent launch = new Intent(context, MainActivity.class);
            launch.setAction("com.doseguard.ALARM_ACTION");
            launch.putExtra("action", actionToApp);
            launch.putExtra("id", id);
            launch.putExtra("medicationId", medicationId);
            launch.putExtra("timeString", timeString);
            launch.putExtra("medicationName", medicationName);
            launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            context.startActivity(launch);

            context.sendBroadcast(new Intent("com.doseguard.CLOSE_ALARM_ACTIVITY"));
            return;
        }

        Log.d(TAG, ">>> [ALARM RECEIVED] onReceive() FIRED at " + new java.util.Date() + " <<<");

        // STEP 1 — Acquire WakeLock so CPU cannot sleep before the foreground service starts.
        PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        PowerManager.WakeLock wakeLock = null;
        if (pm != null) {
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "DoseGuard:AlarmWakeLock");
            wakeLock.acquire(WAKELOCK_TIMEOUT_MS);
            Log.d(TAG, "WakeLock acquired.");
        } else {
            Log.w(TAG, "PowerManager unavailable — WakeLock NOT acquired.");
        }

        try {
            // STEP 2 — Extract alarm data from intent.
            int id = intent.getIntExtra("id", -1);
            String medicationName = intent.getStringExtra("medicationName");
            String dosage = intent.getStringExtra("dosage");
            String medicationId = intent.getStringExtra("medicationId");
            String timeString = intent.getStringExtra("timeString");

            if (medicationName == null || medicationName.isEmpty()) medicationName = "Medication";
            if (dosage == null) dosage = "";
            if (medicationId == null) medicationId = "";
            if (timeString == null) timeString = "";

            Log.d(TAG, "Alarm ID=" + id + " | Name=" + medicationName
                    + " | Dosage=" + dosage + " | Time=" + timeString);

            // STEP 3 — Start AlarmForegroundService (sole audio owner).
            // startForegroundService() guarantees the service will run even in Doze.
            // Android 14: requires foregroundServiceType="alarm" in manifest (already set).
            try {
                Intent svc = new Intent(context, AlarmForegroundService.class);
                svc.putExtra("id", id);
                svc.putExtra("medicationName", medicationName);
                svc.putExtra("dosage", dosage);
                svc.putExtra("medicationId", medicationId);
                svc.putExtra("timeString", timeString);

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(svc);
                    Log.d(TAG, "startForegroundService() called.");
                } else {
                    context.startService(svc);
                    Log.d(TAG, "startService() called (pre-Oreo).");
                }
            } catch (Exception e) {
                Log.e(TAG, "CRITICAL: Failed to start AlarmForegroundService!", e);
            }

            // STEP 4 — Post fullScreenIntent notification.
            // Android 10+: cannot startActivity() from background. The correct path is:
            //   - Screen OFF → Android fires fullScreenIntent → AlarmActivity launches.
            //   - Screen ON  → Android shows heads-up (peek) notification.
            postFullScreenNotification(context, id, medicationName, dosage, medicationId, timeString);

        } finally {
            // STEP 5 — Release WakeLock; foreground service now holds the OS wake.
            if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
                Log.d(TAG, "WakeLock released.");
            }
        }
    }

    private void postFullScreenNotification(Context context, int id,
            String medicationName, String dosage, String medicationId, String timeString) {
        try {
            NotificationManager nm =
                    (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) {
                Log.e(TAG, "CRITICAL: NotificationManager is null!");
                return;
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                // Delete stale cached channels so their importance cannot override ours.
                for (String old : new String[]{
                        "doseguard-alarms-v2", "doseguard-alarms-v1",
                        "doseguard-reminders", "doseguard-reminders-v2",
                        "doseguard-reminders-v3", "doseguard-reminders-v4",
                        "doseguard-reminders-v5", "doseguard-foreground-alarm"}) {
                    try { nm.deleteNotificationChannel(old); } catch (Exception ignored) {}
                }

                NotificationChannel ch = new NotificationChannel(
                        CHANNEL_ID, "DoseGuard Alarms", NotificationManager.IMPORTANCE_HIGH);
                ch.setDescription("Full-screen medication alarm notifications");
                ch.enableVibration(true);
                ch.setVibrationPattern(new long[]{0, 600, 200, 600, 200, 600});
                ch.setBypassDnd(true);
                ch.setShowBadge(true);
                ch.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
                nm.createNotificationChannel(ch);
                Log.d(TAG, "Channel '" + CHANNEL_ID + "' created.");
            }

            Intent activityIntent = new Intent(context, AlarmActivity.class);
            activityIntent.putExtra("id", id);
            activityIntent.putExtra("medicationName", medicationName);
            activityIntent.putExtra("dosage", dosage);
            activityIntent.putExtra("medicationId", medicationId);
            activityIntent.putExtra("timeString", timeString);
            activityIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK
                    | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);

            PendingIntent fullScreenPI = PendingIntent.getActivity(context, id,
                    activityIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            PendingIntent contentPI = PendingIntent.getActivity(context, id + 100_000,
                    activityIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

            Intent takeIntent = new Intent(context, AlarmReceiver.class);
            takeIntent.setAction(ACTION_TAKE);
            takeIntent.putExtras(activityIntent);
            PendingIntent takePi = PendingIntent.getBroadcast(context, id + 1, takeIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

            Intent snoozeIntent = new Intent(context, AlarmReceiver.class);
            snoozeIntent.setAction(ACTION_SNOOZE);
            snoozeIntent.putExtras(activityIntent);
            PendingIntent snoozePi = PendingIntent.getBroadcast(context, id + 2, snoozeIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

            Intent skipIntent = new Intent(context, AlarmReceiver.class);
            skipIntent.setAction(ACTION_SKIP);
            skipIntent.putExtras(activityIntent);
            PendingIntent skipPi = PendingIntent.getBroadcast(context, id + 3, skipIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

            String body = "Time to take: " + medicationName
                    + (dosage.isEmpty() ? "" : "\nDosage: " + dosage);

            NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                    .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
                    .setContentTitle("💊 Medication Reminder")
                    .setContentText("Time to take: " + medicationName)
                    .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                    .setPriority(NotificationCompat.PRIORITY_MAX)
                    .setCategory(NotificationCompat.CATEGORY_ALARM)
                    .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                    .setFullScreenIntent(fullScreenPI, true)
                    .setContentIntent(contentPI)
                    .addAction(0, "Take", takePi)
                    .addAction(0, "Snooze 10m", snoozePi)
                    .addAction(0, "Skip", skipPi)
                    .setOngoing(true)
                    .setAutoCancel(false)
                    .setDefaults(NotificationCompat.DEFAULT_VIBRATE);

            nm.notify(id, builder.build());
            Log.d(TAG, ">>> fullScreenIntent notification posted for ID=" + id + " <<<");

        } catch (Exception e) {
            Log.e(TAG, "CRITICAL: postFullScreenNotification failed!", e);
        }
    }
}
