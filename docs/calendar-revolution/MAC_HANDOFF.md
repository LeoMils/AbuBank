# MAC HANDOFF — AbuBank Native Reminders

## Current State

- **Branch:** `feat/native-reminders-capacitor`
- **HEAD:** `1c67ce4`
- **Remote:** `origin/feat/native-reminders-capacitor` (pushed)

## What Is Already Done (on Windows)

1. Capacitor installed: `@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`, `@capacitor/local-notifications`
2. Capacitor initialized: `capacitor.config.ts` (appId: `com.abubank.app`, webDir: `dist`)
3. iOS platform added: `ios/App/` Xcode project created
4. Web assets synced to iOS project: `npx cap sync ios` completed
5. LocalNotifications plugin registered in iOS project (detected automatically)
6. `reminderDelivery.ts` imports real Capacitor APIs and calls `LocalNotifications.schedule/cancel`
7. Every reminder create/done/snooze/cancel/reschedule calls the native API
8. Permission request fires on first reminder save
9. Web build works unchanged (2792 tests pass)
10. UX copy switches automatically: web shows "כשהאפליקציה פתוחה", native shows "גם כשהטלפון נעול"

## What Must Be Done on Mac

### Prerequisites

- Mac with Xcode 15+ installed
- Apple Developer account (free account works for personal device sideloading; $99/year account needed for TestFlight)
- Martita's iPhone connected via USB (or same WiFi for wireless deploy)

### Commands

```bash
# 1. Clone and checkout
git clone https://github.com/LeoMils/AbuBank.git
cd AbuBank
git checkout feat/native-reminders-capacitor

# 2. Install dependencies
npm install

# 3. Build web app
npm run build

# 4. Sync web build into iOS project
npx cap sync ios

# 5. Open in Xcode
npx cap open ios
```

### Xcode Steps

1. Xcode opens the project at `ios/App/App.xcodeproj`
2. In the left sidebar, click **App** (top-level project)
3. Under **Signing & Capabilities** tab:
   - Set **Team** to your Apple Developer account
   - Set **Bundle Identifier** to `com.abubank.app` (should already be set)
   - If using free account: connect iPhone via USB, select it as the run target
4. In the top toolbar, select your target device (Leo's iPhone or Martita's iPhone)
5. Press **Cmd+R** (Build and Run)
6. If prompted "Untrusted Developer" on iPhone:
   - On the iPhone: Settings → General → VPN & Device Management → find the developer certificate → Trust

### TestFlight (if using paid $99 Apple Developer account)

1. In Xcode: Product → Archive
2. After archive completes: Distribute App → App Store Connect (TestFlight)
3. Follow the upload wizard
4. In App Store Connect web: add Martita's Apple ID email as an internal tester
5. Martita receives TestFlight invite → installs from TestFlight app

## iPhone Locked-Screen Validation Test

### Setup
1. Open AbuBank on the iPhone (from Xcode run or TestFlight install)
2. Navigate to AbuCalendar

### Test
1. Tap mic → say: **"תזכירי לי בעוד שתי דקות לבדוק דלת"**
2. Confirm → tap **"כן, לשמור"**
3. Verify: confirmation card should now say **"אני אזכור בשבילך — גם כשהטלפון נעול"** (green text, not the web limitation)
4. Verify: success toast appears
5. **Lock the iPhone** (press side button)
6. **Wait 2 minutes**
7. Check the lock screen

### Expected Result
- **Notification appears on lock screen** with:
  - Title: "תזכורת"
  - Body: "לבדוק דלת"
  - Sound plays (default iOS notification sound)
- Tapping the notification opens AbuBank

### Pass Criteria
- Notification visible on lock screen within 2.5 minutes of creation
- Sound plays
- App opens when notification is tapped

### Fail Criteria
- No notification on lock screen after 3 minutes
- Notification appears but no sound
- App does not open when tapped

## If It Fails — What to Screenshot

1. **The confirmation card** — does it say "גם כשהטלפון נעול" or "כשהאפליקציה פתוחה"? If the latter, Capacitor is not detecting native platform.
2. **iPhone Settings → Notifications → AbuBank** — is notification permission granted? Are banners/sounds enabled?
3. **Xcode console output** — any errors from `[LocalNotifications]` or `[Capacitor]`?
4. **The reminder board** — is the reminder listed? What status does it show?

Send all screenshots for diagnosis.

## If It Succeeds

The reminder feature is complete. Martita can trust AbuBank to remind her even when the phone is locked.

Next: merge `feat/native-reminders-capacitor` → `feat/calendar-revolution` → `main`.
