# AbuBank Debug APK Build Handoff

## For: Any developer with Android Studio

## Goal
Build a debug APK of AbuBank so Leo can install it on an Android phone and test locked-phone medication reminders.

---

## 1. Clone and Checkout

```bash
git clone https://github.com/LeoMils/AbuBank.git
cd AbuBank
git checkout feat/calendar-revolution
# Verify HEAD is 62d0a83 or later
git log -1 --oneline
```

## 2. Install Dependencies

```bash
npm install
```

Requires Node.js 18+ and npm.

## 3. Build Web App

```bash
npm run build
```

Output goes to `dist/`.

## 4. Sync to Android Project

```bash
npx cap sync android
```

This copies the web build into `android/app/src/main/assets/public/` and updates plugin references.

## 5. Open in Android Studio

```bash
npx cap open android
```

Or manually: open Android Studio → Open → select the `android/` folder inside the repo.

## 6. Build Debug APK

In Android Studio:

1. Wait for Gradle sync to finish (bottom progress bar, may take 2-5 minutes on first open)
2. Menu: **Build → Build Bundle(s) / APK(s) → Build APK(s)**
3. Wait for build to complete (1-3 minutes)
4. A notification appears: **"APK(s) generated successfully"** → click **locate**

## 7. APK Output Path

```
android/app/build/outputs/apk/debug/app-debug.apk
```

This file is ~15-30 MB. Send it to Leo via WhatsApp, email, Google Drive, or any file transfer.

## 8. How Leo Installs the APK

On the Android phone:

1. Download `app-debug.apk` (from WhatsApp/email/Drive)
2. Tap the downloaded file
3. If prompted "Install unknown apps": tap Settings → allow for this source → go back → tap Install
4. Tap **Open** after install
5. If prompted for notification permission: tap **Allow**

No Google Play Store needed. No developer account needed.

---

## 9. Locked-Phone Medication Reminder Test

### Setup
1. Open AbuBank on the Android phone
2. Navigate to AbuCalendar (calendar icon)

### Test A — Lock Screen Notification
1. Tap the microphone button
2. Say: **"תזכירי לי בעוד שתי דקות לקחת כדור"**
3. On the confirmation card, verify it says: **"גם כשהטלפון נעול"** (green text)
4. Tap **"כן, לשמור"**
5. **Lock the phone** (press power button)
6. **Wait 2-3 minutes**
7. Check the lock screen

**PASS:** Notification appears: "תזכורת: לקחת כדור" with sound
**FAIL:** No notification after 3 minutes

### Test B — Follow-Up Re-Fire
1. Do NOT tap the notification from Test A
2. Do NOT unlock the phone
3. Wait 15 more minutes
4. Check the lock screen again

**PASS:** Second notification appears: "עדיין לא סומן — חשוב לקחת: לקחת כדור"
**FAIL:** No second notification

### Test C — Done Cancels Follow-Ups
1. Tap the notification → app opens
2. If reminder popup appears: tap **"לקחתי"**
3. Wait 5 minutes

**PASS:** No more notifications
**FAIL:** Notifications keep appearing after Done

### Test D — Recurring Survives Done
1. Say: **"כל יום בתשע בבוקר לקחת כדור"**
2. Confirm and save
3. If popup fires: tap **"לקחתי"**
4. Open the reminder board (scroll down in calendar)

**PASS:** Reminder still listed with tomorrow's date
**FAIL:** Reminder disappeared

---

## 10. What Leo Must Capture

Send back ALL of these:

| # | Capture | How |
|---|---------|-----|
| 1 | Confirmation card showing "גם כשהטלפון נעול" | Screenshot |
| 2 | Lock screen with notification | Screenshot (power + volume down) |
| 3 | Second notification (follow-up) if you waited 15 min | Screenshot |
| 4 | After tapping "לקחתי" — no more notifications | Text confirmation |
| 5 | Recurring reminder still in board after Done | Screenshot |
| 6 | If anything failed: phone Settings → Apps → AbuBank → Notifications | Screenshot |

---

## Troubleshooting

**App won't install:**
Settings → Security → enable "Install from unknown sources" for the app that sent the APK (WhatsApp/Chrome/Files)

**No notification on lock screen:**
- Settings → Apps → AbuBank → Notifications → must be ON
- Settings → Apps → AbuBank → Battery → set to "Unrestricted"
- Some Samsung/Xiaomi phones: Settings → Battery → App power management → add AbuBank to "Never sleeping"

**Confirmation card says "כשהאפליקציה פתוחה" instead of "גם כשהטלפון נעול":**
Capacitor is not detecting native platform. The APK may not have built correctly. Rebuild and resend.

**Build fails in Android Studio:**
- Make sure Android SDK is installed (SDK Manager → install Android 14 / API 34)
- Make sure Gradle sync completed without errors
- Try: Build → Clean Project → then Build APK again
