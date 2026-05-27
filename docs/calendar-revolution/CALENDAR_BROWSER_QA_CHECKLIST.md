# CALENDAR_BROWSER_QA_CHECKLIST — manual / device QA before ship

Branch: `feat/calendar-revolution` · code `60a6309` · review `e821e76` (verdict ACCEPTABLE_TO_BROWSER_QA).
Purpose: the exact manual steps to convert the Principal Review's **NEEDS_BROWSER_QA** items into PROVEN (or surface a BLOCKER) before Phase 10 ship. This is a checklist only — no code change, nothing pushed.
Tags: **PROVEN** (already verified by automated tests this branch) · **NEEDS_BROWSER_QA** (must verify manually) · **BLOCKER** · **FOLLOW_UP** (deferred, FU-4/FU-5).

## Setup
- A Vite dev server appears to be running (the "Start Vite dev server bound to 0.0.0.0" background task). Open the URL it prints (typically `http://localhost:5173` or `http://<machine-ip>:5173` from a phone on the same network).
- **Viewport:** Chrome DevTools → device toolbar → set **360 × 740** (DPR 2–3). Also test one real phone if possible.
- **RTL:** the app is RTL by default; confirm UI reads right-to-left.
- **Reduced motion:** DevTools → Rendering panel → "Emulate CSS `prefers-reduced-motion: reduce`" (and/or OS setting).
- Navigate Home → "Abu יומן" tile to reach the calendar.
- For each item: PASS = expected holds; else record a finding + severity. Do not mark PROVEN without actually observing it.

---

## 1. 360×740 no-scroll primary layout  — NEEDS_BROWSER_QA (release gate FU-5/RT-2)
**Steps:** Load the calendar at 360×740. Do NOT open the sheet. Try to scroll the primary screen vertically. Then make ≥1 alert fire (set reminder lead time and have an event within the window — or temporarily seed an appointment soon) so the alert inset shows; if you can get 2 alerts, do so.
**Expected:** header + alert-interval + glance + month nav + full 6-row grid all fit with **no vertical page scroll**, both with 0 alerts and with up to 2 alert insets active.
**PASS criteria:** no scrollbar / no content below the fold; grid fully visible.
**If it overflows:** BLOCKER for the "no-scroll" principle — redesign (shorter alert inset / collapse alert-interval), do not add scroll. (Code note: primary still uses `<PageShell scrollable>` `index.tsx:771`, so overflow would silently scroll — watch for it.)

## 2. Bottom-sheet open / close / scroll / focus — NEEDS_BROWSER_QA
**Steps:** Tap a day cell with several events. Observe the sheet slide up. Scroll the event list inside the sheet. Close via (a) the × button, (b) tapping the scrim/backdrop, (c) the Escape key. Re-open and tab through with the keyboard.
**Expected:** sheet opens over a dimmed scrim; the **event list scrolls inside the sheet** (primary doesn't move); × / scrim / Escape all close it; on open focus moves into the sheet (close button), on close focus returns to the day cell.
**PASS criteria:** all three close paths work; scroll is contained; focus moves in and is restored.
**FOLLOW_UP (FU-4, not built):** full Tab focus-trap (focus can currently leave the panel) and swipe-down-to-close — verify behavior but treat as known-deferred, not a blocker unless focus loss is egregious.

## 3. Alert inset reflow — NEEDS_BROWSER_QA
**Steps:** Trigger an alert. Observe placement vs the header and alert-interval selector. Dismiss it ("הבנתי").
**Expected:** the alert banner sits **in-flow below the header and pushes content down** — it must NOT paint over the header, the alert-interval selector, or the month nav. Dismiss reflows cleanly.
**PASS criteria:** no overlap of chrome at any point; no layout jank that hides controls.

## 4. ADD / manual / mic / voice-trace inside sheet only — NEEDS_BROWSER_QA
**Steps:** On the primary view, confirm there is **no** mic / "＋ הוספה ידנית" / voice-trace anywhere. Open the sheet; use "＋ הוספה ידנית" to add an event; then use the mic to add by voice. Watch StatusPill + VoiceTraceCard appear during the voice session.
**Expected:** ADD affordances exist **only inside the sheet**; manual add persists via the normal save; mic records → transcribes → confirms/creates; status + trace render in-sheet during the session.
**PASS criteria:** primary has no permanent ADD footprint (PP-2); both add paths persist an event; created event appears in the day list.
**Also (RT-4):** while recording, try to close the sheet (×/scrim/Escape) → it must **refuse to close** until recording stops. PASS = cannot close mid-recording.

## 5. Event indicator clarity without color — NEEDS_BROWSER_QA
**Steps:** View a month with a birthday day, a memorial day (Jan 1 / Papi), a regular-event day, and a day with >1 event. Optionally enable a grayscale/color-blind filter (DevTools Rendering → Emulate vision deficiencies → Achromatopsia).
**Expected:** birthday = filled circle, memorial = ring (outline), regular = square; a **count digit** shows when >1. Types remain distinguishable **with color removed**.
**PASS criteria:** under grayscale, you can still tell birthday vs memorial vs regular by shape; count is legible.

## 6. Birthday / memorial rendering and dignity — partly PROVEN, render NEEDS_BROWSER_QA
**Already PROVEN (tests):** 13 birthdays + 1 memorial from `family_data.json`; Papi's 04-19 is a candle remembrance (🕯️, type memory), not a cake; Jan-1 memorial present; Yarden/Sharon/Yael omitted.
**Steps:** Open Apr 19 → confirm Papi shows with a **candle**, gentle title "יום הולדת פפי 🕯️", NOT a 🎂. Open Jan 1 → memorial "יום הזיכרון של פפי 🕯️". Spot-check a living birthday (e.g. Ofir Feb 15) shows 🎂. Confirm "Martita" renders in Latin.
**PASS criteria:** deceased dignity holds visually; living birthdays celebratory; Martita Latin. Any cake on Papi = BLOCKER.

## 7. No private notes/location leakage — PROVEN (tests) + visual confirm NEEDS_BROWSER_QA
**Already PROVEN:** family events carry no `notes`/`location` (adapter tests).
**Steps:** Open several family birthday/memorial entries in the sheet; expand cards.
**Expected:** no relationship notes ("בת של…"), no addresses, no phone — only name + date.
**PASS criteria:** zero private/relationship text on any family event.

## 8. Raw transcript never displayed — STATIC_ONLY → NEEDS_BROWSER_QA
**Steps:** Use the mic; speak a messy phrase; go through to a created/confirm card. Inspect everything Martita sees (confirm card, toast, day list, VoiceTraceCard body).
**Expected:** she sees the **normalized/corrected** result, never the raw un-normalized ASR string as user-facing copy. (VoiceTraceCard is a diagnostic surface — verify it does not present the raw transcript as her content.)
**PASS criteria:** no raw transcript shown as user-facing text. Any raw-transcript exposure = BLOCKER (privacy/trust).

## 9. Reduced motion — NEEDS_BROWSER_QA
**Steps:** Enable `prefers-reduced-motion: reduce`. Open/close the sheet; trigger an alert; observe today-cell shimmer.
**Expected:** sheet appears/disappears without slide animation, scrim without fade; no looping shimmer; **state still changes visibly** (just instant).
**PASS criteria:** no motion under reduce; nothing becomes invisible or non-functional.

## 10. iOS / Safari / PWA-sensitive behavior — NEEDS_BROWSER_QA (real device)
**Steps (real iPhone Safari if possible):** Test the sheet's rounded-corner + animated children (no clip/flash — the audit's §6d iOS repaint risk). Test the grid's `borderRadius + overflow:hidden` with the today shimmer. Add an event by voice (mic permission, recording). Install as PWA (Add to Home Screen) and re-test the calendar + voice.
**Expected:** no iOS clip/repaint flash on the rounded grid/sheet; mic works in Safari + installed PWA; layout holds.
**PASS criteria:** no visual corruption; voice add works on device + PWA. (This is the highest-uncertainty area — was explicitly NOT_PROVEN.)

## 11. Service worker / stale-build risk — NEEDS_BROWSER_QA
**Steps:** Build is workbox `generateSW` (PWA). After loading once, deploy/refresh and check the visible version. DevTools → Application → Service Workers (enable "Update on reload"); also check Settings/About shows **`0.4.18-calendar-revolution`** and the Home QA version marker updates.
**Expected:** after reload, the new build (and new calendar UI) is served — not a stale cached calendar. Version string visibly updates.
**PASS criteria:** version `0.4.18-calendar-revolution` shows; no stale pre-revolution calendar served after update. If stale persists → FOLLOW_UP: cache-busting / SW update prompt before GA.

## 12. Final release smoke (before push / PR) — NEEDS_BROWSER_QA
**Steps:** End-to-end as Martita: open calendar → read glance → tap a day → add a manual event → add a voice event → see them on the day → see a family birthday → see Papi's remembrance → trigger an alert → dismiss it → back to Home. Re-run `npm run typecheck && npm test && npm run build` once more right before pushing.
**Expected:** the golden path works with no console errors, no overlap, no scroll on primary, dignified family events, and a clean automated run.
**PASS criteria:** golden path clean + automated gates green (currently PROVEN: typecheck, 2111 tests, build).

---

## Sign-off table (fill during QA)
| # | Area | Result | Severity if fail | Notes |
|---|------|--------|------------------|-------|
| 1 | No-scroll 360×740 | ☐ | | |
| 2 | Sheet open/close/scroll/focus | ☐ | | |
| 3 | Alert inset reflow | ☐ | | |
| 4 | ADD/mic in-sheet only + RT-4 guard | ☐ | | |
| 5 | Indicator clarity (no color) | ☐ | | |
| 6 | Birthday/memorial dignity | ☐ | | |
| 7 | No private leakage | ☐ | | |
| 8 | Raw transcript hidden | ☐ | | |
| 9 | Reduced motion | ☐ | | |
| 10 | iOS/Safari/PWA | ☐ | | |
| 11 | SW / stale build | ☐ | | |
| 12 | Release smoke | ☐ | | |

**Ship rule:** Phase 10 (push/PR) only after items 1–8 + 12 PASS and any failure is either fixed (re-gated) or explicitly accepted as a FOLLOW_UP. Items 9–11 strongly recommended; 10 (device) is the highest-risk unknown.

---

*Checklist only. No production code changed; nothing pushed. Phase 10 not started.*
