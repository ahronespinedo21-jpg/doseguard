package com.doseguard.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.util.Log;

import androidx.core.app.NotificationCompat;

/**
 * AlarmForegroundService — the SOLE owner of alarm audio playback.
 *
 * KEY FIXES APPLIED:
 *  - This is the single MediaPlayer source. AlarmActivity no longer plays audio.
 *    This eliminates the double-audio bug (two simultaneous MediaPlayer instances).
 *  - foregroundServiceType="mediaPlayback|alarm" is declared in AndroidManifest,
 *    allowing this service to start from background on Android 14+.
 *  - Audio loops continuously until stopService() is called (from AlarmActivity
 *    when user taps Take / Snooze / Skip).
 *  - Uses USAGE_ALARM AudioAttributes so audio plays even in DND/silent mode.
 *  - Sets alarm stream to maximum volume on start.
 *  - Restores original volume on stop.
 *  - Uses same channel ID "doseguard-alarms-v3" for consistent notification behavior.
 */
public class AlarmForegroundService extends Service {

    private static final String TAG = "AlarmForegroundSvc";
    private static final String CHANNEL_ID = "doseguard-alarms-v3";
    private static final int FOREGROUND_NOTIFICATION_ID = 9999;

    private TextToSpeech tts;
    private AudioManager audioManager;
    private int originalAlarmVolume = -1;
    private Handler ttsHandler = new Handler(Looper.getMainLooper());
    private boolean isAlarmActive = false;
    private String speechText = "It's time to take your medication.";

    // ─────────────────────────────────────────────────────────────────────────
    // onStartCommand
    // ─────────────────────────────────────────────────────────────────────────
    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.d(TAG, ">>> AlarmForegroundService.onStartCommand() STARTED <<<");

        String medicationName = (intent != null) ? intent.getStringExtra("medicationName") : null;
        String dosage         = (intent != null) ? intent.getStringExtra("dosage") : null;
        String medicationId   = (intent != null) ? intent.getStringExtra("medicationId") : null;
        String timeString     = (intent != null) ? intent.getStringExtra("timeString") : null;
        int id                = (intent != null) ? intent.getIntExtra("id", FOREGROUND_NOTIFICATION_ID) : FOREGROUND_NOTIFICATION_ID;

        if (medicationName == null || medicationName.isEmpty()) medicationName = "Medication";
        if (dosage == null) dosage = "";

        speechText = "It's time to take " + medicationName + ".";
        if (!dosage.isEmpty()) {
            speechText += " Dosage: " + dosage + ".";
        }

        Log.d(TAG, "Service params → ID=" + id + " | Name=" + medicationName + " | Dosage=" + dosage);

        // Must call startForeground() within 5 seconds of onStartCommand() on Android 8+.
        startForeground(FOREGROUND_NOTIFICATION_ID, buildForegroundNotification(medicationName, dosage, medicationId, timeString, id));
        Log.d(TAG, "startForeground() called — service is now foreground.");

        isAlarmActive = true;

        // Stop any existing TTS before starting fresh
        stopAudio();

        // Maximize alarm stream volume
        setMaxAlarmVolume();

        // Initialize and start TTS loop
        initAndPlayTTS();

        // START_STICKY: if killed by OS, restart with last intent so alarm keeps going
        return START_STICKY;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Audio control
    // ─────────────────────────────────────────────────────────────────────────
    private void setMaxAlarmVolume() {
        audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        if (audioManager != null) {
            originalAlarmVolume = audioManager.getStreamVolume(AudioManager.STREAM_ALARM);
            int maxVol = audioManager.getStreamMaxVolume(AudioManager.STREAM_ALARM);
            audioManager.setStreamVolume(AudioManager.STREAM_ALARM, maxVol, 0);
            Log.d(TAG, "Alarm volume set to max: " + maxVol + "/" + maxVol);
        } else {
            Log.w(TAG, "AudioManager is null — cannot set volume.");
        }
    }

    private void initAndPlayTTS() {
        tts = new TextToSpeech(this, status -> {
            if (status == TextToSpeech.SUCCESS) {
                int langResult = tts.setLanguage(java.util.Locale.US);
                if (langResult == TextToSpeech.LANG_MISSING_DATA || langResult == TextToSpeech.LANG_NOT_SUPPORTED) {
                    Log.e(TAG, "TTS Language not supported");
                } else {
                    Log.d(TAG, "TTS Initialized successfully. Preparing to speak: " + speechText);
                    // USAGE_ALARM bypasses silent/DND mode and forces alarm stream
                    AudioAttributes attrs = new AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_ALARM)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                            .build();
                    tts.setAudioAttributes(attrs);

                    tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                        @Override
                        public void onStart(String utteranceId) {
                            Log.d(TAG, "TTS started speaking.");
                        }

                        @Override
                        public void onDone(String utteranceId) {
                            Log.d(TAG, "TTS finished speaking.");
                            if (isAlarmActive) {
                                // Loop audio safely every 4 seconds without overlapping
                                ttsHandler.postDelayed(() -> speakText(), 4000);
                            }
                        }

                        @Override
                        public void onError(String utteranceId) {
                            Log.e(TAG, "TTS Error occurred during playback.");
                            // Safe retry mechanism
                            if (isAlarmActive) {
                                ttsHandler.postDelayed(() -> speakText(), 5000);
                            }
                        }
                    });

                    speakText();
                }
            } else {
                Log.e(TAG, "CRITICAL: TTS Initialization failed!");
            }
        });
    }

    private void speakText() {
        if (tts != null && isAlarmActive) {
            // QUEUE_FLUSH ensures we never stack or overlap speech instances
            tts.speak(speechText, TextToSpeech.QUEUE_FLUSH, null, "AlarmTTS_ID");
        }
    }

    private void stopAudio() {
        isAlarmActive = false;
        ttsHandler.removeCallbacksAndMessages(null);
        if (tts != null) {
            try {
                if (tts.isSpeaking()) {
                    tts.stop();
                }
                tts.shutdown();
                Log.d(TAG, "TTS stopped and safely shutdown.");
            } catch (Exception e) {
                Log.e(TAG, "Error shutting down TTS", e);
            }
            tts = null;
        }
        restoreVolume();
    }

    private void restoreVolume() {
        if (audioManager != null && originalAlarmVolume >= 0) {
            try {
                audioManager.setStreamVolume(AudioManager.STREAM_ALARM, originalAlarmVolume, 0);
                Log.d(TAG, "Alarm volume restored to: " + originalAlarmVolume);
            } catch (Exception e) {
                Log.e(TAG, "Error restoring volume", e);
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Foreground notification (keeps service alive in Android's eyes)
    // ─────────────────────────────────────────────────────────────────────────
    private Notification buildForegroundNotification(String medicationName, String dosage, String medicationId, String timeString, int alarmId) {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && nm != null) {
            NotificationChannel ch = new NotificationChannel(
                    CHANNEL_ID, "DoseGuard Alarms", NotificationManager.IMPORTANCE_HIGH);
            ch.setBypassDnd(true);
            nm.createNotificationChannel(ch);
        }

        Intent relaunch = new Intent(this, AlarmActivity.class);
        relaunch.putExtra("id", alarmId);
        relaunch.putExtra("medicationName", medicationName);
        relaunch.putExtra("dosage", dosage);
        relaunch.putExtra("medicationId", medicationId);
        relaunch.putExtra("timeString", timeString);
        relaunch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);

        PendingIntent tapPI = PendingIntent.getActivity(this, alarmId + 200_000, relaunch,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        // Action Intents
        Intent takeIntent = new Intent(this, AlarmReceiver.class);
        takeIntent.setAction(AlarmReceiver.ACTION_TAKE);
        takeIntent.putExtras(relaunch); // re-use the extras from relaunch intent
        PendingIntent takePi = PendingIntent.getBroadcast(this, alarmId + 10, takeIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Intent snoozeIntent = new Intent(this, AlarmReceiver.class);
        snoozeIntent.setAction(AlarmReceiver.ACTION_SNOOZE);
        snoozeIntent.putExtras(relaunch);
        PendingIntent snoozePi = PendingIntent.getBroadcast(this, alarmId + 20, snoozeIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Intent skipIntent = new Intent(this, AlarmReceiver.class);
        skipIntent.setAction(AlarmReceiver.ACTION_SKIP);
        skipIntent.putExtras(relaunch);
        PendingIntent skipPi = PendingIntent.getBroadcast(this, alarmId + 30, skipIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
                .setContentTitle("💊 Alarm Active")
                .setContentText("Time to take: " + medicationName)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setOngoing(true)
                .setContentIntent(tapPI)
                .addAction(0, "Take", takePi)
                .addAction(0, "Snooze 10m", snoozePi)
                .addAction(0, "Skip", skipPi)
                .build();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Lifecycle
    // ─────────────────────────────────────────────────────────────────────────
    @Override
    public void onDestroy() {
        super.onDestroy();
        stopAudio();
        Log.d(TAG, "AlarmForegroundService destroyed — audio stopped.");
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null; // Not a bound service
    }
}
