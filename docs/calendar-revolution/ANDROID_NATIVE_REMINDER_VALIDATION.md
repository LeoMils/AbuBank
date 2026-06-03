# Android Native Reminder Validation

## Prerequisites

1. **Android Studio** — download from https://developer.android.com/studio
   - During install: include Android SDK, Android SDK Platform, Android Virtual Device
   - After install: open Android Studio once to finish SDK setup
2. **An Android phone** with USB debugging enabled:
   - Settings → About Phone → tap "Build Number" 7 times → Developer Options appear
   - Settings → Developer Options → enable "USB Debugging"
   - Connect phone via USB cable
3. **USB driver** — Windows may need the OEM USB driver for your phone brand

## Setup

```bash
cd C:\Users\Lmilstein\ClaudeCode\Abu-Bank

# Build web app
npm run build

# Sync into Android project
npx cap sync android

# Open in Android Studio
npx cap open android
```

## Android Studio Steps

1. Android Studio opens the project at `android/`
2. Wait for Gradle sync to complete (bottom progress bar)
3. In the top toolbar, your connected phone should appear as a device
4. Click the green **Run** button (▶) or press **Shift+F10**
5. App installs and opens on the phone
6. On Android 13+: the app will ask for notification permission — tap **Allow**

## Locked-Phone Notification Test

1. Open AbuBank on the Android phone
2. Go to AbuCalendar
3. Tap mic → say: **"תזכירי לי בעוד שתי דקות לבדוק דלת"**
4. Confirm → tap **"כן, לשמור"**
5. Verify: confirmation card says **"גם כשהטלפון נעול"** (not the web limitation)
6. **Lock the phone** (press power button)
7. **Wait 2 minutes**

### Expected Result
- Notification appears on lock screen:
  - Title: "תזכורת"
  - Body: "לבדוק דלת"
  - Default notification sound plays
- Tapping the notification opens AbuBank

### Pass Criteria
- Notification visible on lock screen within 2.5 minutes
- Sound plays
- App opens when notification tapped

### Fail Criteria
- No notification after 3 minutes
- Notification without sound
- App doesn't open on tap

## If It Fails — What to Check

1. **Notification permission**: Settings → Apps → AbuBank → Notifications → must be ON
2. **Battery optimization**: Settings → Apps → AbuBank → Battery → set to "Unrestricted" (not "Optimized")
3. **Exact alarm permission** (Android 12+): Settings → Apps → AbuBank → Alarms & Reminders → must be ON
4. **Confirmation card text**: does it say "גם כשהטלפון נעול" or "כשהאפליקציה פתוחה"? If the latter, Capacitor is not detecting native platform.
5. **Android Studio Logcat**: filter by "LocalNotification" or "Capacitor" for errors

Screenshot all of the above and send for diagnosis.

## Android-Specific Notes

- **Android 13+ (API 33)**: POST_NOTIFICATIONS permission required — app requests it on first reminder save
- **Battery optimization**: some phone brands (Samsung, Xiaomi, Huawei) aggressively kill background apps. The user may need to disable battery optimization for AbuBank.
- **Exact alarms**: SCHEDULE_EXACT_ALARM permission declared in manifest. Android 12+ requires it for precise notification timing.
- **Notification channel**: Capacitor LocalNotifications creates a default channel automatically.

## No Mac Required

This entire flow works on Windows with Android Studio. No Apple Developer account, no Xcode, no TestFlight.
