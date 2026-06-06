package com.doseguard.app;

import android.app.Activity;
import android.app.AlarmManager;
import android.app.KeyguardManager;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.TextView;

/**
 * AlarmActivity — full-screen alarm UI launched via fullScreenIntent notification.
 *
 * KEY FIX (Bug #6 — Double Audio):
 *   This class NO LONGER owns a MediaPlayer.
 *   AlarmForegroundService is the SOLE source of audio.
 *   AlarmActivity only controls UI and sends stop/action signals to the service.
 *
 *   Previous issue: both AlarmActivity and AlarmForegroundService independently
 *   created MediaPlayer instances, causing simultaneous overlapping audio and a
 *   race condition on stop (service audio kept playing after activity's player stopped).
 */
public class AlarmActivity extends Activity {

    private static final String TAG = "AlarmActivity";
    private static final int SNOOZE_MINUTES = 10;

    private int alarmId;
    private String medicationId;
    private String timeString;
    private String medicationName;
    private String dosage;

    private BroadcastReceiver closeReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if ("com.doseguard.CLOSE_ALARM_ACTIVITY".equals(intent.getAction())) {
                Log.d(TAG, "Received CLOSE_ALARM_ACTIVITY broadcast. Finishing.");
                finish();
            }
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Log.d(TAG, ">>> AlarmActivity.onCreate() STARTED <<<");

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(closeReceiver, new IntentFilter("com.doseguard.CLOSE_ALARM_ACTIVITY"), Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(closeReceiver, new IntentFilter("com.doseguard.CLOSE_ALARM_ACTIVITY"));
        }

        // ── Lockscreen / screen-wake flags ────────────────────────────────────
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
            KeyguardManager km = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
            if (km != null) km.requestDismissKeyguard(this, null);
        } else {
            //noinspection deprecation
            getWindow().addFlags(
                    WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                    | WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
                    | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                    | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
            );
        }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        setContentView(R.layout.activity_alarm);

        // ── Extract alarm data ────────────────────────────────────────────────
        Intent intent = getIntent();
        alarmId       = intent.getIntExtra("id", -1);
        medicationName = intent.getStringExtra("medicationName");
        dosage        = intent.getStringExtra("dosage");
        medicationId  = intent.getStringExtra("medicationId");
        timeString    = intent.getStringExtra("timeString");

        if (medicationName == null) medicationName = "Medication";
        if (dosage == null)        dosage = "";
        if (medicationId == null)  medicationId = "";
        if (timeString == null)    timeString = "";

        Log.d(TAG, "Alarm data → ID=" + alarmId + " | Name=" + medicationName
                + " | Dosage=" + dosage + " | Time=" + timeString);

        // ── Dismiss the triggering notification ───────────────────────────────
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.cancel(alarmId);

        // ── Bind UI ───────────────────────────────────────────────────────────
        TextView tvName   = findViewById(R.id.tvMedicationName);
        TextView tvDosage = findViewById(R.id.tvDosage);
        if (tvName   != null) tvName.setText(medicationName);
        if (tvDosage != null) tvDosage.setText(dosage);

        Button btnTake   = findViewById(R.id.btnTake);
        Button btnSnooze = findViewById(R.id.btnSnooze);
        Button btnSkip   = findViewById(R.id.btnSkip);

        if (btnTake   != null) btnTake.setOnClickListener(v -> sendActionToApp("mark_taken"));
        if (btnSnooze != null) btnSnooze.setOnClickListener(v -> doSnooze());
        if (btnSkip   != null) btnSkip.setOnClickListener(v -> sendActionToApp("skip"));

        // NOTE: Audio is NOT started here.
        // AlarmForegroundService (started by AlarmReceiver) is the sole audio owner.
        Log.d(TAG, "AlarmActivity ready. Audio is owned by AlarmForegroundService.");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // doSnooze — schedule a native AlarmClock alarm SNOOZE_MINUTES from now.
    // ─────────────────────────────────────────────────────────────────────────
    private void doSnooze() {
        Log.d(TAG, "Snooze tapped — rescheduling alarm in " + SNOOZE_MINUTES + " min.");
        stopAlarmService();

        long snoozeTime = System.currentTimeMillis() + (SNOOZE_MINUTES * 60_000L);
        int snoozeId = alarmId + 50_000; // Offset to avoid collision with original alarm

        Intent snoozeIntent = new Intent(this, AlarmReceiver.class);
        snoozeIntent.putExtra("id", snoozeId);
        snoozeIntent.putExtra("medicationName", medicationName);
        snoozeIntent.putExtra("dosage", "Snoozed: " + dosage);
        snoozeIntent.putExtra("medicationId", medicationId);
        snoozeIntent.putExtra("timeString", timeString);

        PendingIntent pi = PendingIntent.getBroadcast(
                this, snoozeId, snoozeIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        AlarmManager am = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
        if (am != null) {
            AlarmManager.AlarmClockInfo info = new AlarmManager.AlarmClockInfo(snoozeTime, pi);
            am.setAlarmClock(info, pi);
            Log.d(TAG, "Snooze alarm set → ID=" + snoozeId + " at " + new java.util.Date(snoozeTime));
        }

        sendActionToApp("snooze");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // sendActionToApp — stop audio, notify Angular app, finish this activity.
    // ─────────────────────────────────────────────────────────────────────────
    private void sendActionToApp(String action) {
        Log.d(TAG, "Action: " + action + " — stopping alarm and returning to app.");
        stopAlarmService();

        Intent launch = new Intent(this, MainActivity.class);
        launch.setAction("com.doseguard.ALARM_ACTION");
        launch.putExtra("action", action);
        launch.putExtra("id", alarmId);
        launch.putExtra("medicationId", medicationId);
        launch.putExtra("timeString", timeString);
        launch.putExtra("medicationName", medicationName);
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK
                | Intent.FLAG_ACTIVITY_CLEAR_TOP
                | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        startActivity(launch);
        finish();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // stopAlarmService — stop the foreground service (stops audio + foreground notif).
    // ─────────────────────────────────────────────────────────────────────────
    private void stopAlarmService() {
        try {
            stopService(new Intent(this, AlarmForegroundService.class));
            Log.d(TAG, "AlarmForegroundService stopped.");
        } catch (Exception e) {
            Log.e(TAG, "Error stopping AlarmForegroundService", e);
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        try {
            unregisterReceiver(closeReceiver);
        } catch (Exception e) {
            Log.e(TAG, "Error unregistering closeReceiver", e);
        }
        Log.d(TAG, "AlarmActivity onDestroy().");
    }

    @Override
    public void onBackPressed() {
        // Prevent back-button dismissal — user must tap Take / Snooze / Skip.
        Log.d(TAG, "Back press ignored.");
    }
}
