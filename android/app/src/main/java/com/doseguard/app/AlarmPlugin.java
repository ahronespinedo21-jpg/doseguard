package com.doseguard.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONException;

import java.util.HashSet;
import java.util.Set;

/**
 * AlarmPlugin — Capacitor bridge between Angular/TypeScript and Android AlarmManager.
 *
 * KEY FIXES APPLIED:
 *  1. Fallback scheduling: if canScheduleExactAlarms() is false (user never granted
 *     "Alarms & reminders" permission), falls back to setExactAndAllowWhileIdle()
 *     instead of rejecting the call outright. This ensures alarms still fire even
 *     without the user visiting Settings.
 *  2. Added testAlarm() — schedules a 30-second test alarm, bypassing all scheduling
 *     logic to directly verify the native alarm pipeline works.
 *  3. Comprehensive Logcat logging at every stage for easy adb debugging.
 */
@CapacitorPlugin(name = "AlarmPlugin")
public class AlarmPlugin extends Plugin {

    private static final String TAG = "AlarmPlugin";
    public static final String PREFS_NAME = "DoseGuardAlarms";

    // ─────────────────────────────────────────────────────────────────────────
    // schedule()  —  Called from notification.service.ts
    // ─────────────────────────────────────────────────────────────────────────
    @PluginMethod
    public void schedule(PluginCall call) {
        Log.d(TAG, ">>> schedule() CALLED <<<");

        if (!call.hasOption("id") || !call.hasOption("time") || !call.hasOption("medicationName")) {
            Log.e(TAG, "schedule() REJECTED: missing required params (id, time, medicationName).");
            call.reject("Must provide id, time, and medicationName");
            return;
        }

        int id = call.getInt("id");
        long time = call.getLong("time");
        String medicationName = call.getString("medicationName");
        String dosage = call.getString("dosage", "");
        String medicationId = call.getString("medicationId", "");
        String timeString = call.getString("timeString", "");

        Log.d(TAG, "Params → ID=" + id
                + " | Name=" + medicationName
                + " | Time=" + time + " (" + new java.util.Date(time) + ")"
                + " | MedID=" + medicationId
                + " | TimeString=" + timeString);

        // Validate timestamp — reject alarms scheduled in the past
        long now = System.currentTimeMillis();
        if (time <= now) {
            Log.w(TAG, "schedule() SKIPPED: timestamp is in the past. Now=" + now + " Alarm=" + time);
            call.reject("Alarm time is in the past");
            return;
        }

        Context context = getContext();
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);

        if (alarmManager == null) {
            Log.e(TAG, "schedule() FAILED: AlarmManager is null!");
            call.reject("AlarmManager unavailable");
            return;
        }

        Intent intent = new Intent(context, AlarmReceiver.class);
        intent.putExtra("id", id);
        intent.putExtra("medicationName", medicationName);
        intent.putExtra("dosage", dosage);
        intent.putExtra("medicationId", medicationId);
        intent.putExtra("timeString", timeString);

        PendingIntent pendingIntent = PendingIntent.getBroadcast(
                context, id, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // Persist alarm data for reboot recovery (BootReceiver)
        saveAlarm(context, id, time, medicationName, dosage, medicationId, timeString);

        boolean usedExact = false;

        // Path A: setAlarmClock — strongest guarantee, shown in system alarm tray.
        // Requires SCHEDULE_EXACT_ALARM permission to be granted by user (Android 12+).
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (alarmManager.canScheduleExactAlarms()) {
                AlarmManager.AlarmClockInfo info = new AlarmManager.AlarmClockInfo(time, pendingIntent);
                alarmManager.setAlarmClock(info, pendingIntent);
                usedExact = true;
                Log.d(TAG, "[ALARM REGISTERED — setAlarmClock()] ID=" + id + " at " + new java.util.Date(time));
            } else {
                Log.w(TAG, "canScheduleExactAlarms()=false. Falling back to setExactAndAllowWhileIdle().");
            }
        } else {
            // Pre-Android 12: setAlarmClock always works
            AlarmManager.AlarmClockInfo info = new AlarmManager.AlarmClockInfo(time, pendingIntent);
            alarmManager.setAlarmClock(info, pendingIntent);
            usedExact = true;
            Log.d(TAG, "[ALARM REGISTERED — setAlarmClock()] ID=" + id + " at " + new java.util.Date(time));
        }

        // Path B: fallback for Android 12+ when exact alarm permission is denied.
        // setExactAndAllowWhileIdle() works in Doze but may fire up to a few minutes late.
        // Still far better than silently failing (previous behaviour was to reject the call).
        if (!usedExact) {
            alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, time, pendingIntent);
            Log.w(TAG, "[ALARM REGISTERED — setExactAndAllowWhileIdle() FALLBACK] ID=" + id
                    + " at " + new java.util.Date(time)
                    + ". NOTE: may fire a few minutes late until exact alarm permission is granted.");
        }

        call.resolve();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // testAlarm()  —  Schedule a test alarm 30 seconds from now.
    // Use this to verify the native pipeline without UI interaction.
    // ─────────────────────────────────────────────────────────────────────────
    @PluginMethod
    public void testAlarm(PluginCall call) {
        Log.d(TAG, ">>> testAlarm() CALLED — scheduling alarm in 30 seconds <<<");

        long testTime = System.currentTimeMillis() + 30_000;
        int testId = 999999; // Fixed test ID

        Context context = getContext();
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);

        if (alarmManager == null) {
            Log.e(TAG, "testAlarm() FAILED: AlarmManager is null.");
            call.reject("AlarmManager unavailable");
            return;
        }

        Intent intent = new Intent(context, AlarmReceiver.class);
        intent.putExtra("id", testId);
        intent.putExtra("medicationName", "TEST ALARM");
        intent.putExtra("dosage", "30-second pipeline test");
        intent.putExtra("medicationId", "test-med-id");
        intent.putExtra("timeString", "00:30");

        PendingIntent pi = PendingIntent.getBroadcast(
                context, testId, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && alarmManager.canScheduleExactAlarms()) {
            AlarmManager.AlarmClockInfo info = new AlarmManager.AlarmClockInfo(testTime, pi);
            alarmManager.setAlarmClock(info, pi);
            Log.d(TAG, "[TEST ALARM REGISTERED — setAlarmClock()] at " + new java.util.Date(testTime));
        } else {
            alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, testTime, pi);
            Log.w(TAG, "[TEST ALARM REGISTERED — setExactAndAllowWhileIdle()] at " + new java.util.Date(testTime));
        }

        JSObject result = new JSObject();
        result.put("scheduledAt", testTime);
        result.put("message", "Test alarm scheduled for 30 seconds from now");
        call.resolve(result);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // cancel()
    // ─────────────────────────────────────────────────────────────────────────
    @PluginMethod
    public void cancel(PluginCall call) {
        if (!call.hasOption("id")) {
            call.reject("Must provide id");
            return;
        }

        int id = call.getInt("id");
        Log.d(TAG, "cancel() called for ID=" + id);

        Context context = getContext();
        Intent intent = new Intent(context, AlarmReceiver.class);
        PendingIntent pi = PendingIntent.getBroadcast(
                context, id, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager != null) alarmManager.cancel(pi);

        removeAlarm(context, id);
        Log.d(TAG, "Alarm ID=" + id + " cancelled.");
        call.resolve();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // checkPermissions()
    // ─────────────────────────────────────────────────────────────────────────
    @PluginMethod
    public void checkPermissions(PluginCall call) {
        Context context = getContext();
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);

        boolean canScheduleExact = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && alarmManager != null) {
            canScheduleExact = alarmManager.canScheduleExactAlarms();
        }

        Log.d(TAG, "checkPermissions() → exactAlarm=" + canScheduleExact);

        JSObject ret = new JSObject();
        ret.put("exactAlarm", canScheduleExact);
        call.resolve(ret);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // requestExactAlarmPermission()
    // ─────────────────────────────────────────────────────────────────────────
    @PluginMethod
    public void requestExactAlarmPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            Context context = getContext();
            AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (alarmManager != null && !alarmManager.canScheduleExactAlarms()) {
                Log.d(TAG, "requestExactAlarmPermission() — opening Settings.");
                Intent intent = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
                intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(intent);
            } else {
                Log.d(TAG, "requestExactAlarmPermission() — permission already granted.");
            }
        }
        call.resolve();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // handleOnNewIntent — handles actions from AlarmActivity (Take/Snooze/Skip)
    // ─────────────────────────────────────────────────────────────────────────
    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        if ("com.doseguard.ALARM_ACTION".equals(intent.getAction())) {
            JSObject data = new JSObject();
            data.put("actionId", intent.getStringExtra("action"));

            JSObject extra = new JSObject();
            extra.put("medicationId", intent.getStringExtra("medicationId"));
            extra.put("time", intent.getStringExtra("timeString"));
            extra.put("medicationName", intent.getStringExtra("medicationName"));

            JSObject notification = new JSObject();
            notification.put("id", intent.getIntExtra("id", -1));
            notification.put("extra", extra);

            data.put("notification", notification);

            Log.d(TAG, "Emitting alarmActionPerformed: " + data);
            notifyListeners("alarmActionPerformed", data, true);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SharedPreferences persistence for BootReceiver reboot recovery
    // ─────────────────────────────────────────────────────────────────────────
    private void saveAlarm(Context context, int id, long time, String medicationName,
                           String dosage, String medicationId, String timeString) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        Set<String> alarms = new HashSet<>(prefs.getStringSet("alarms", new HashSet<>()));

        try {
            JSObject obj = new JSObject();
            obj.put("id", id);
            obj.put("time", time);
            obj.put("medicationName", medicationName);
            obj.put("dosage", dosage);
            obj.put("medicationId", medicationId);
            obj.put("timeString", timeString);

            // Remove stale entry with same ID
            alarms.removeIf(entry -> entry.contains("\"id\":" + id + ","));
            alarms.add(obj.toString());
            prefs.edit().putStringSet("alarms", alarms).apply();
        } catch (Exception e) {
            Log.e(TAG, "saveAlarm() error", e);
        }
    }

    private void removeAlarm(Context context, int id) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        Set<String> alarms = new HashSet<>(prefs.getStringSet("alarms", new HashSet<>()));
        alarms.removeIf(entry -> entry.contains("\"id\":" + id + ","));
        prefs.edit().putStringSet("alarms", alarms).apply();
    }
}
