package com.doseguard.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;

import org.json.JSONObject;

import java.util.HashSet;
import java.util.Set;

public class BootReceiver extends BroadcastReceiver {
    private static final String TAG = "BootReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) {
            Log.d(TAG, "Boot completed, rescheduling alarms...");
            rescheduleAlarms(context);
        }
    }

    private void rescheduleAlarms(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(AlarmPlugin.PREFS_NAME, Context.MODE_PRIVATE);
        Set<String> alarms = prefs.getStringSet("alarms", new HashSet<>());
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);

        boolean canScheduleExact = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            canScheduleExact = alarmManager.canScheduleExactAlarms();
            if (!canScheduleExact) {
                Log.w(TAG, "Exact alarm permission missing! Falling back to setAndAllowWhileIdle for rescheduled alarms.");
            }
        }

        long now = System.currentTimeMillis();
        Set<String> validAlarms = new HashSet<>();

        for (String alarmStr : alarms) {
            try {
                JSONObject alarmData = new JSONObject(alarmStr);
                int id = alarmData.getInt("id");
                long time = alarmData.getLong("time");
                String medicationName = alarmData.getString("medicationName");
                String dosage = alarmData.optString("dosage", "");
                String medicationId = alarmData.optString("medicationId", "");
                String timeString = alarmData.optString("timeString", "");

                if (time > now) {
                    Intent alarmIntent = new Intent(context, AlarmReceiver.class);
                    alarmIntent.putExtra("id", id);
                    alarmIntent.putExtra("medicationName", medicationName);
                    alarmIntent.putExtra("dosage", dosage);
                    alarmIntent.putExtra("medicationId", medicationId);
                    alarmIntent.putExtra("timeString", timeString);

                    PendingIntent pendingIntent = PendingIntent.getBroadcast(
                            context,
                            id,
                            alarmIntent,
                            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                    );

                    if (canScheduleExact) {
                        AlarmManager.AlarmClockInfo alarmClockInfo = new AlarmManager.AlarmClockInfo(time, pendingIntent);
                        alarmManager.setAlarmClock(alarmClockInfo, pendingIntent);
                        Log.d(TAG, "Rescheduled exact alarm ID " + id + " for time " + time);
                    } else {
                        // Safe fallback that doesn't crash on Android 12+ without exact alarm permission
                        alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, time, pendingIntent);
                        Log.w(TAG, "Rescheduled fallback inexact alarm ID " + id + " for time " + time);
                    }
                    
                    validAlarms.add(alarmStr);
                }
            } catch (Exception e) {
                Log.e(TAG, "Error rescheduling alarm: " + alarmStr, e);
            }
        }
        
        // Clean up passed alarms
        prefs.edit().putStringSet("alarms", validAlarms).apply();
    }
}
