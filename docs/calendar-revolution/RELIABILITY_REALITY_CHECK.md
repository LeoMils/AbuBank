# RELIABILITY REALITY CHECK
## What Actually Works When Martita's Phone Is in Her Bag

**Date:** 2026-05-30
**Branch:** `feat/calendar-revolution`
**Audience:** Operator. Read before any user-facing claim about reminders.

This document is brutally honest. It is not a marketing surface. It
states what currently works, what does not, and what is not safe to put
in front of Martita yet.

---

## 1. WHEN THE APP IS OPEN AND IN THE FOREGROUND

### Works
- Voice intent detection over Hebrew (250 fixtures, 0 divergences).
- Date / time / person parsing for 30 golden Martita sentences.
- Self-correction normalization ("X סליחה Y" → Y).
- AM / PM disambiguation flag (block save on ambiguous time).
- Family relation resolution against `knowledge/family_data.json`.
- Calendar query routing ("מה יש לי היום").
- Family query routing ("מי הבעל של אופיר") — NEVER saves.
- Reminder due popup (in-foreground only; see "Does NOT work" below).
- Reminder board (list of saved reminders).
- Appointment confirmation card with clean title (no raw transcript).
- Save gate blocks reminders / appointments with missing or ambiguous
  fields and emits a reason string.

### Confidence
- PROVEN_BY_TEST: 2407 / 2407 unit tests passing.
- STATIC_ONLY: most UI render tests are component-level; the live
  microphone path was NOT exercised in this session.
- NEEDS_BROWSER_QA: the full voice flow with a real microphone.

---

## 2. WHEN THE APP IS CLOSED, BACKGROUNDED, OR THE PHONE IS LOCKED

### Does NOT work
- **Reminder notifications do not fire.** Today's
  `ReminderDueEngine` is a React component that mounts a 30-second
  `setInterval`. When the component unmounts (tab close, navigation
  away, OS suspend, phone lock), the interval dies.
- **No system-level notification surface.** No Service Worker is
  registered. No PushManager subscription. No VAPID keys. No periodic
  background sync.
- **No reliable cross-session storage for reminders.** Today the store
  uses `localStorage`. A browser cache clear or aggressive eviction
  wipes Martita's reminder set without warning.

### Severity
- For a senior who depends on medication reminders: **CATASTROPHIC**.
- For appointment reminders: **HIGH** (silent miss of doctor visits).
- For non-critical reminders (water, calls): **MEDIUM**.

### Until fixed, do NOT say
- "AbuBank will remind you even when the app is closed."
- "Reliable medication reminders."
- "Safe to use for daily medication."

### Until fixed, you MAY say
- "AbuBank reminds you while the app is open."
- "We're building reliable notifications next."

---

## 3. NETWORK / OFFLINE BEHAVIOR

### Works
- App shell loads as a PWA (precache built by Workbox).
- Reading local data (calendar, reminders) does not require network.

### Does NOT work
- Voice STT (current implementation) requires network for transcription.
- Family graph / personality reads are local — no network needed there.

### Gap
- No graceful offline message when STT fails.
- No "queue and retry" semantics for save while offline.

---

## 4. DATA PERSISTENCE

### Today
- `localStorage` is the primary store for reminders.
- Calendar appointments persist via the existing store (also
  localStorage-backed in current implementation).

### Risks
- Volatile under cache clears.
- No schema versioning that survives a major refactor.
- No cross-device sync.

### Required for production
- IndexedDB migration with schema versioning.
- A pre-save invariant: never serialize `rawTranscript` or debug fields.

---

## 5. WHAT IS SAFE TO TEST NOW

These tests can be run by an operator without risking Martita's trust:

1. **Text-pipeline regression tests** — already automated, 2407 green.
2. **Browser QA of voice flow** with operator in front of the device —
   user must NOT depend on the result for a real reminder.
3. **Confirmation-card UI review** — Hebrew correctness, button sizes,
   contrast.
4. **Reminder board UI review** — same.
5. **Family screen content review** with PIN bypass removed.

---

## 6. WHAT IS **NOT** SAFE TO TEST WITH MARTITA YET

1. Setting a real medication reminder and closing the app.
2. Relying on a "tomorrow morning" reminder to actually fire.
3. Using reminders as the only memory aid for any health-critical task.
4. Trusting that a saved appointment will surface a pre-notification.
5. Any flow whose success depends on the app being woken from
   background.

---

## 7. EXACT GAPS UNTIL "MARTITA-READY"

| Gap | Status | Required to fix |
|-----|--------|-----------------|
| Service Worker registration | NOT STARTED | New SW file + registration in main entry |
| Push subscription | NOT STARTED | VAPID keys + push server (or local-only sched) |
| Background reminder scheduler | NOT STARTED | SW periodic sync OR scheduled push |
| IndexedDB migration | NOT STARTED | New store with schema version |
| Push permission UX | NOT STARTED | Hebrew explainer + fallback |
| Cross-tab notification dedupe | NOT STARTED | notification tag per reminder id |
| Test: reminder fires when tab closed | NOT POSSIBLE WITHOUT SW | Manual QA after SW |
| Test: reminder survives phone restart | NOT POSSIBLE WITHOUT SW | Manual QA after SW |

Until these are GREEN, AbuReminder is a calendar-of-notes, not a
healthcare reminder.

---

## 8. VERDICT

- **Text pipeline:** GREEN. 250 fixtures, 0 divergences. 30 golden
  Martita assertions pass.
- **Foreground reminder UX:** YELLOW. Functional in browser; not
  exercised with a real microphone in this session.
- **Background reminder reliability:** RED. Does not exist.
- **Production readiness for Martita as a medication reminder:** **NO.**

The pipeline is honest. The product is not yet trustworthy.
