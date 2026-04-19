# AbuCalendar Redesign Analysis

**Date:** 2026-04-19
**Scope:** Full product-quality redesign for AbuCalendar screen
**Target user:** Martita, 80+, non-technical, Kfar Saba

---

## 1. CURRENT PROBLEM MAP

### Critical

**P1. No undo on delete — permanent data loss in one tap.**
Tapping × on an appointment immediately calls `deleteAppointment()` and `reload()`. No confirmation, no undo bar, no soft-delete. Martita accidentally deletes a doctor appointment and it's gone forever. The `updateAppointment()` function exists in service.ts but is never called — there is no edit path either.

**P2. Past and future appointments are visually near-identical.**
The 4-way time-state system (past/next-upcoming/today-upcoming/later) exists in code but produces subtle differences: past gets `opacity: 0.40` title + strikethrough + faint stripe. On a dark screen, this reads as "slightly dimmer card" — not as "this already happened." Martita cannot glance and instantly know what's done vs. what's coming.

**P3. Only 2 appointments visible per day — rest hidden behind a count.**
`selectedAppts.slice(0, 2)` hard-caps the visible list. A Friday dinner, doctor visit, and birthday on the same day shows 2 cards + "עוד 1 אירועים נוספים" with no way to see the third. For an 80+ user, hidden content doesn't exist.

### High

**P4. No "Jump to Today" button.**
If Martita navigates 3 months ahead looking at a birthday, she has no way back except tapping the month arrow 3 times. The code has no today-return button. She gets lost.

**P5. Microphone dominates the bottom 120px but is used rarely.**
The 64px mic button + status text + manual-add button + safe-area padding consumes ~120px of fixed bottom space. On a 667px iPhone SE screen, that's 18% of viewport permanently occupied by an input mechanism she uses maybe once a week.

**P6. Alert system is fragile and non-persistent.**
Alerts only fire while AbuCalendar is mounted. `alertedIdsRef` is a runtime Set — navigate away and back, events re-alert. No background notifications, no service worker, no snooze. The 60-second polling interval means alerts can fire up to 59 seconds late.

**P7. Color assignment is meaningless.**
Colors cycle via a module-level `colorIndex` that resets on page reload. The 8 colors (#FF6B9D, #4ECDC4, #FFE66D, etc.) carry zero semantic meaning — they're decorative stripes that change unpredictably. Martita cannot learn "pink = medical" because next time it might be purple.

### Medium

**P8. No appointment editing.**
`updateAppointment()` exists in service.ts but the UI never calls it. To change a time, Martita must delete and recreate. With no undo on delete (P1), this is especially risky.

**P9. Settings panel is hidden behind a 3-dot menu.**
Alert configuration (the only setting) requires: tap 3-dot → read dropdown → find select → change value → tap close. Four steps for one toggle, behind a pattern Martita has never learned to use.

**P10. Location data parsed but never shown.**
The voice parser extracts `location` from speech ("at the clinic"), stores it in the appointment, but ApptCard never renders it. Wasted intelligence.

**P11. InfoButton imported but never used.**
Line 22 imports InfoButton but the component is never placed. There's no help/legend system on the calendar screen.

**P12. Birthday countdown bar competes with the calendar grid.**
The bar is useful (shows next birthday) but sits between header and month navigator, pushing the grid down and creating visual clutter in the hierarchy.

### Low

**P13. Holiday coverage hardcoded and expires after 2027.**
Hebrew holidays are a static `Record<string, string>` — no algorithmic calculation. Will silently stop working.

**P14. `getBirthdayToday()` exported but never called.**
Dead code in service.ts.

**P15. Event dots on calendar cells are 6px — barely visible for 80+ eyes.**
Small, single-color dots with no semantic differentiation.

---

## 2. MENTAL MODEL DEFINITION

### What AbuCalendar should fundamentally be for Martita

**A single calm screen that answers: "What's happening today and what's coming up?"**

Not a scheduling tool. Not a month planner. Not a productivity app. It's a **daily companion view** — like a kitchen wall calendar she glances at every morning while drinking coffee. It shows today's events clearly, tomorrow's events if relevant, and upcoming family moments she cares about.

Voice is how she adds events. The calendar surface is how she reads them.

### What she should understand in 3 seconds

1. **Today's date** — visually obvious, not a puzzle
2. **What's happening today** — events listed with clear time and title, or a calm "free day" signal
3. **What's next** — the single most important upcoming event, with enough context to feel oriented

### What she should be able to do in 10 seconds

1. **Add an event by voice** — one tap to start, one tap to stop, confirm, done
2. **See any day's events** — tap a day in the grid, events appear immediately
3. **Delete an event** — tap delete, get a brief undo window, event disappears
4. **Get back to today** — one tap from anywhere

### What should NOT be part of her mental model

- Color coding (she won't learn a legend)
- Settings menus
- Month-level planning
- Multi-step edit flows
- Notification configuration
