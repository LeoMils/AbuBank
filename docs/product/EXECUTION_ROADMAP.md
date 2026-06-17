# EXECUTION ROADMAP
## AbuBank — Highest ROI Order of Work

**Principle:** Every decision is made from Martita's perspective, not an engineer's.
A reminder she can trust is worth 10 polished animations.
An accessible delete button matters more than an extra service tile.

---

## WHAT MUST NEVER BE BUILT

Before the roadmap: things that must not enter the product.

1. **Complex gesture navigation** — Swipe-to-delete, pull-to-refresh, long-press menus as primary actions.
2. **Multi-step flows deeper than 3 screens** — If it takes more than 3 taps to complete any core task, the design is wrong.
3. **Modals that stack on modals** — If Martita gets two confirmation dialogs in one flow, the flow is broken.
4. **Gamification** — Points, streaks, achievements. She is not a child.
5. **Notification spam** — More than one push per reminder topic per day.
6. **Dark patterns** — "Are you sure?" twice. "You might miss out." Countdown timers.
7. **Onboarding flow longer than 2 screens** — She needs to use it immediately.
8. **Social features** — Sharing reminders with others, collaborative calendars.
9. **Ads or cross-promotion of any kind.**
10. **Font sizes below 15px anywhere in the product.**

---

## WHAT MUST BE REMOVED

Before building new things: remove what hurts.

| Remove | Reason | Risk |
|--------|--------|------|
| Cormorant Garamond font | Serifs are harder for seniors; extra load weight | Low — swap to Heebo Bold |
| DM Sans font | Third font is unnecessary complexity | Low — swap to Heebo |
| Single-tap delete on calendar events | Catastrophic for seniors — irrecoverable | Low risk to remove |
| Admin PIN gate on Family contacts | Wrong information architecture | Medium — clarify what PIN should guard |
| Admin PIN gate on Settings | Settings are Martita's settings, not admin | Medium — move admin-only items separately |
| "Processing…" spinner after voice (too cold) | Replace with warm "מנתחת..." (1 line, warm dot) | Low |
| AbuAI screen name "AbuAI" | Technical, cold, meaningless to Martita | Low — rename to "עוזרת" |
| ReminderDueEngine setInterval in React | Fatal — silently fails on unmount | Critical — replace entirely |

---

## WHAT MUST BE SIMPLIFIED

Things to make radically simpler before any new work.

| Simplify | Current | Target |
|----------|---------|--------|
| Voice flow states | 9+ states | 3 states |
| Reminder creation | Voice only (if even available) | Voice + 3-tap manual |
| Calendar default view | Month grid | This Week list |
| Event editing | Delete + recreate | Tap → inline edit |
| Time input | HH:MM text field | Clock face picker |
| Date input | YYYY-MM-DD text | Tap-a-day grid |
| Reminder board location | Inside Calendar tab | Dedicated screen |

---

## THE 30-DAY SPRINT: EXACT PRODUCT TO SHIP

If we have one engineer and 30 days, this is the exact order.

### Days 1–3: Remove the damage
**Goal:** Stop actively harming Martita. Zero new features.

- Day 1: Add confirmation dialog to calendar event delete. Change delete target to ≥ 60px. Remove Admin PIN gate from Family contacts.
- Day 2: Remove Admin PIN gate from Settings (move only data-sensitive admin actions behind PIN). Fix muted text contrast (4.5:1).
- Day 3: Remove Cormorant Garamond + DM Sans. Set Heebo as sole font. Audit and fix all text below 16px.

**Outcome:** App no longer damages trust. Accidental delete gone. Family accessible. Readable.

---

### Days 4–7: Fix the core reliability failure
**Goal:** Reminders fire when the app is closed.

- Day 4–5: Implement Service Worker. Register on app load. Set up periodic background sync.
- Day 6: Migrate reminder storage from localStorage → IndexedDB (with localStorage read-fallback for existing data).
- Day 7: Wire Service Worker to show `self.registration.showNotification()` for due reminders. Basic notification: title + done/snooze actions.

**Outcome:** The product's most critical safety failure is closed. Martita's medication reminder fires.

---

### Days 8–10: Push notifications (the full loop)
**Goal:** Notifications survive browser close, phone sleep.

- Day 8: Generate VAPID keys. Build minimal push server (or use Supabase Edge Functions). Subscribe device via `pushManager.subscribe()`.
- Day 9: Wire reminder save → push server → push event → Service Worker notification.
- Day 10: Permission request flow. If denied: explain why, show in-app fallback.

**Outcome:** Reminders are genuinely reliable. The product earns Martita's trust.

---

### Days 11–14: Calendar default view — This Week
**Goal:** Calendar shows what matters without any tapping.

- Day 11: Build WeekListView component. Chronological list, section headers by day.
- Day 12: Make it the default view. Add toggle to month grid. Implement swipe left/right for previous/next week.
- Day 13: Add event type system (5 types: medical, family, birthday, personal, reminder-prep). Auto-detect from title keywords.
- Day 14: Fix floating voice button (always visible, not inside DayDetailSheet).

**Outcome:** Martita opens Calendar and immediately sees today's events without any tapping.

---

### Days 15–17: Voice flow — 3 states
**Goal:** Voice goes from tap to saved in one breath.

- Day 15: Collapse 9-state voice flow to 3: Listening → Confirmation → Success. Remove intermediate states.
- Day 16: Implement 4s auto-stop on silence (AudioContext silence detection). Add auto-stop countdown bar.
- Day 17: Add AM/PM disambiguation dialog when time is ambiguous. Add missing-field recovery (friendly question, not error).

**Outcome:** Voice creation feels effortless for the first time.

---

### Days 18–20: Dedicated Reminders screen
**Goal:** Reminders have their own home, accessible from main navigation.

- Day 18: Create ReminderScreen component. Add to main navigation (5th tab or prominent button). Move ReminderBoard out of Calendar.
- Day 19: Add manual reminder creation: title field + time shortcuts ("בעוד 30 דקות", "מחר בבוקר") + one-tap save.
- Day 20: Add "overdue" section to reminder board. Fix full-screen due popup (actual full-screen takeover). Add sound + haptic on due.

**Outcome:** Reminders are a first-class feature, not a side-feature of Calendar.

---

### Days 21–23: Home screen briefing
**Goal:** Open app, know what's happening today, no tapping.

- Day 21: Add today's appointments card to home screen (top 2 events, always visible).
- Day 22: Add upcoming reminder pill (next due reminder, ambient warm display).
- Day 23: Restructure home: 3 primary actions (Voice, Calendar, Family) at 72px. Services in secondary row below.

**Outcome:** Home screen is Martita's morning briefing, not a tile grid.

---

### Days 24–26: Family screen improvements
**Goal:** Family is one tap from anywhere.

- Day 24: Add upcoming birthdays section (from family_data.json). Birthday events auto-populate calendar.
- Day 25: Build per-member profile screen (photo, birthday, one-tap WhatsApp, call).
- Day 26: Add 7-day and 1-day birthday reminders automatically.

**Outcome:** Martita always knows upcoming birthdays. Family feels central.

---

### Days 27–28: Error, empty, and loading states
**Goal:** Every failure is friendly, not technical.

- Day 27: Audit all error messages. Replace any technical text with plain Hebrew. Replace all loading spinners with warm Hebrew ("רגע אחד...").
- Day 28: Add empty-state invitations to Calendar (empty day → "✨ יום פנוי — רוצי להוסיף?") and Reminders (empty board → "אין תזכורות — רוצי להוסיף אחת?").

**Outcome:** The app never leaves Martita stranded or confused.

---

### Days 29–30: Polish pass + accessibility
**Goal:** Everything feels right, nothing breaks.

- Day 29: Touch target audit across all screens. Fix any remaining items below 60px. Add reduced-motion support.
- Day 30: Manual QA pass: voice flow end-to-end, reminder fire end-to-end, calendar CRUD, family screen, AbuAI in Hebrew.

**Outcome:** Shippable product that earns Martita's trust.

---

## FULL ROADMAP (BEYOND 30 DAYS)

### Weeks 5–7: Depth pass
- Edit in place for calendar events (inline editing in list view)
- Recurring reminder engine (daily/weekly/yearly)
- "Skip today" for recurring reminders
- Category override UI (tap emoji to change)
- Voice readback of saved items (TTS)
- AbuAI renamed to "עוזרת", tone audit

### Weeks 8–10: Intelligence pass
- Voice: improve AM/PM detection with context
- Calendar: month Hebrew name parsing fix
- Reminder: annual type (birthdays/anniversaries)
- Home: "good morning" contextual greeting
- Weather integration on home screen
- Pre-appointment reminder (15 min before)

### Weeks 11–13: Infrastructure pass
- Full Service Worker with cache-first for static assets
- Offline mode: read calendar + reminders without API
- Performance audit: bundle size, first paint, voice response time
- ARIA audit + fix
- Screen reader manual test

### Weeks 14–16: Experience pass
- Sound design: mic press chime, save chime, reminder bell
- Motion design: card pop-in (200ms), page transition (250ms fade+slide)
- Haptic patterns via Vibration API
- Analog clock time picker
- Tap-a-day grid date picker

### Month 5+: Vision features
- Auto-morning briefing push at 7am
- Appointment sharing via native Share → WhatsApp pre-fill
- Family photo gallery from shared album
- WhatsApp integration for family messaging
- Full voice control of all features ("פתחי את היומן")

---

## WHAT NEVER TO BUILD

Already stated above, plus:

- **Settings complexity** — 3 settings max visible to Martita. Everything else is hidden.
- **Account management flows** — No "change your password." No "delete account." These happen in a support channel.
- **In-app tutorial walkthroughs** — The app must be self-evident. Tutorials mean the design failed.
- **Multiple themes / appearance settings** — One design, optimized for her. Choice paralysis is the enemy.
- **"Smart" suggestions that auto-act** — Martita must always initiate. The app responds, never acts autonomously.
- **Calendar sync with external services** — Google Calendar sync introduces unreliable third-party state. Not worth the complexity.
- **Social sharing of calendar events** — Not needed, adds clutter.
- **Any feature requiring more than 3 taps to complete** — Redesign before adding.

---

## ROI DECISION FRAMEWORK

For every proposed feature, answer these 4 questions:

1. **Does Martita encounter this need at least weekly?** (If no → deprioritize)
2. **Can she complete it in < 3 taps or < 10 seconds?** (If no → simplify first)
3. **Does it work when the phone is in her purse?** (If no → fix notification architecture first)
4. **Will she understand it without asking anyone?** (If no → redesign, don't document)

All 4 must be YES before a feature enters development.

---

## NORTH STAR METRIC

**The only metric that matters in the first 90 days:**

> Percentage of reminders that fire when Martita's phone is in her bag, app closed.

Everything else — beautiful animations, perfect Hebrew, AM/PM disambiguation — is secondary.
A reminder that doesn't fire is a healthcare safety failure.
Get that to 95%+ first. Then everything else.
