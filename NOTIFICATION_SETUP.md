# Medication Reminder Notifications Setup Guide

This guide explains how to set up real-time medication reminders using Capacitor Local Notifications.

## Prerequisites

- Capacitor already installed in the project
- Android Studio (for Android development)
- Xcode (for iOS development)

## Installation Steps

### 1. Install the Local Notifications Plugin

```bash
npm install @capacitor/local-notifications
```

### 2. Sync Native Projects

After installing the plugin, sync your native projects:

```bash
npx cap sync android
npx cap sync ios
```

### 3. Android Setup

#### Notification Icons

Add notification icons to your Android project:

1. Create or add notification icons to:
   - `android/app/src/main/res/drawable/ic_stat_icon_config_sample.png` (small icon, 24x24px white with transparency)
   - `android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png` (large icon)

2. The small icon should be:
   - 24x24 pixels
   - White with transparency
   - Simple design (no complex details)

3. The large icon can be your app's regular icon

#### Sound File

Add a custom notification sound:
1. Place `beep.wav` in `android/app/src/main/res/raw/`
2. If the `raw` folder doesn't exist, create it

#### Permissions

The plugin automatically handles permissions. When the app first runs, it will request notification permission from the user.

### 4. iOS Setup

#### Notification Icons

iOS uses the app icon for notifications by default. The small icon configuration in `capacitor.config.json` is mainly for Android.

#### Sound File

Add a custom notification sound:
1. Place `beep.wav` in your iOS project's bundle
2. Add it to your Xcode project

#### Permissions

iOS requires you to request notification permission. The `NotificationService` handles this automatically when initialized.

#### Background Modes

For notifications to work when the app is in the background or closed:

1. Open your iOS project in Xcode:
   ```bash
   npx cap open ios
   ```

2. Select your app target

3. Go to "Signing & Capabilities"

4. Click "+ Capability"

5. Add "Background Modes"

6. Check:
   - Background fetch
   - Remote notifications

## How It Works

### Adding a Medication

When a user adds a medication with reminder times:

1. The medication is saved to the database
2. The `NotificationService` schedules local notifications for each reminder time
3. Each notification:
   - Triggers at the specified time (e.g., 06:00 AM)
   - Repeats daily
   - Shows the medication name and dosage
   - Includes action buttons (Snooze, Mark as Taken)

### Notification Actions

Users can interact with notifications:

1. **Snooze**: Delays the reminder by 10 minutes
2. **Mark as Taken**: Cancels the notification and logs the medication as taken
3. **Tap**: Opens the app to the reminders page

### Editing a Medication

When a user edits a medication:

1. Old notifications for that medication are cancelled
2. New notifications are scheduled based on the updated reminder times

### Deleting a Medication

When a user deletes a medication:

1. All notifications for that medication are cancelled
2. The medication is removed from the database

## Testing

### On Android

1. Build and run the app:
   ```bash
   npx cap run android
   ```

2. Add a medication with a reminder time close to the current time

3. Wait for the notification to trigger

4. Test the notification actions

### On iOS

1. Build and run the app:
   ```bash
   npx cap run ios
   ```

2. Add a medication with a reminder time close to the current time

3. Wait for the notification to trigger

4. Test the notification actions

### On Web

The Capacitor Local Notifications plugin has limited support on web. For web, consider using:
- Web Notifications API
- Service Workers

## Troubleshooting

### Notifications Not Showing

1. Check if permission was granted
2. Verify the notification channel is created (Android)
3. Check the scheduled time is in the future
4. Review console logs for errors

### Sound Not Playing

1. Verify the sound file exists in the correct location
2. Check the file format (should be .wav or .mp3)
3. Ensure the sound file is not too large

### Notifications Not Triggering in Background

1. Verify background modes are enabled (iOS)
2. Check battery optimization settings (Android)
3. Ensure the app is not being killed by the system

## Advanced Features

### Custom Notification Times

You can customize the snooze duration by modifying the `snoozeNotification` method in `NotificationService`.

```typescript
private async snoozeNotification(notificationId: number): Promise<void> {
  // Change 10 to your desired snooze duration in minutes
  snoozeDate.setMinutes(snoozeDate.getMinutes() + 10);
}
```

### Custom Notification Sound

To use a different sound:

1. Add your sound file to the native project
2. Update the sound name in `capacitor.config.json`:
   ```json
   "LocalNotifications": {
     "sound": "your_sound.wav"
   }
   ```

### Vibration Patterns

You can customize vibration patterns in the notification channel configuration (Android).

## API Reference

### NotificationService Methods

- `initializeNotifications()`: Initialize the notification system
- `scheduleReminder(reminder)`: Schedule a single reminder
- `scheduleMultipleReminders(...)`: Schedule multiple reminders for a medication
- `cancelReminder(medicationId, time)`: Cancel a specific reminder
- `cancelAllRemindersForMedication(medicationId)`: Cancel all reminders for a medication
- `cancelAllReminders()`: Cancel all reminders
- `getScheduledReminders()`: Get all scheduled notifications

## Security Considerations

- Notification IDs are stored in localStorage
- Medication IDs are included in notification extras
- Ensure sensitive information is not exposed in notification content

## Future Enhancements

- Add medication adherence tracking based on notification actions
- Support for different notification sounds per medication
- Custom snooze duration per medication
- Reminder history and analytics
- Push notification support for cross-device sync
