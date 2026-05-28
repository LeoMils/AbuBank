# Voice ADD UX Contract Fix

Branch: `feat/calendar-revolution`
Base commit: `8ac546f`

## 1. Root Cause

Browser QA on `8ac546f` revealed five concurrent failures:

| # | Failure | Root cause |
|---|---------|------------|
| A | "מצב הקלטה" / stage / blob / chunks / mime / asr visible to user | `VoiceTraceCard` rendered unconditionally for any non-idle trace stage (including the successful "awaiting confirm" state). All diagnostic metadata was always shown. |
| B | "מוכן לאישור שלך לפני שמירה" shown without approval buttons | Same — `VoiceTraceCard.visibleMessage` displayed the "awaiting confirm" label from `setStage('idle', 'מחכה לאישור שלך...', ...)` without any corresponding buttons. The actual ConfirmCard buttons were in the VoiceCard overlay, but VoiceTraceCard created a confusing parallel surface. |
| C | "מחר יש לך תקווה…" in success/readback | VoiceTraceCard rendered `trace.visibleMessage` from `setStage('success', successMsg)` where `successMsg` was built from the raw ASR title that contained "תקווה". |
| D | "העתק אבחון קול" always visible | `VoiceTraceCard` copy-diagnostic button was always shown. |
| E | Correction mode showed raw transcript ("מה שמעתי" textarea) | Transcript box was always in correction mode, violating privacy and clarity requirements. |
| F | DEBUG panel visible in normal Vite dev QA | Gated by `import.meta.env.DEV === true`, which is always true in `vite dev`. |

## 2. Files Changed

| File | Change |
|------|--------|
| `VoiceTraceCard.tsx` | P0: diagnostic fields + copy button behind `isDiagMode` (localStorage); show only on errors in normal mode |
| `VoiceCard.tsx` | P1: header/badge hidden in confirmation mode; P5: transcript textarea removed from correction mode; P0: DEBUG gated by `isDiagMode` |
| `index.tsx` | P2: `SavedCard` component + `savedConfirmation` state; `handleVoiceConfirm` now sets `savedConfirmation` from normalized record |
| `localParser.ts` | P3: `^תקווה\s+` added to `TITLE_LEAD_STRIPS` (ASR command-verb mishear guard) |
| `voiceUxContract.test.ts` | NEW: 21 structural P7 tests covering the full UX contract |
| `voiceCardSlots.test.ts` | Updated: debug-block test now checks `isDiagMode`/localStorage gate; date label updated "תאריך"→"מתי" |
| `voiceConfirmationP02.test.ts` | Updated: header assertion matches new contract (ConfirmCard owns "הבנתי" in confirmation mode) |

## 3. Diagnostic UI Removed / Hidden

The following are now **invisible in normal flow** and only appear when `localStorage.getItem('abu-voice-debug') === 'true'` is explicitly set:

- `stage: <value>` / `blob: <bytes>B` / `chunks: <n>` / `mime: <type>` / `asr: <model>` — all from `VoiceTraceCard`
- `"העתק אבחון קול"` copy button
- Raw transcript / "לפני תיקון" line
- `"מה שמעתי"` textarea + "נתחי שוב" button in VoiceCard
- `DEBUG` panel (previously behind `import.meta.env.DEV`, now behind `isDiagMode`)
- `"מצב הקלטה"` card for non-error stages

The following remain visible (errors only, no diagnostic metadata):
- `"בעיה בהקלטה"` card with the user-facing error message when `voiceState === 'error'`

## 4. Voice → ConfirmCard Handoff

**Before:** VoiceCard rendered its own header "הבנתי ממך ש..." above ConfirmCard, creating dual confirmation surfaces.

**After:**
- When `!editing && voiceState !== 'error'`: VoiceCard renders ONLY ConfirmCard (no own header, no badge). ConfirmCard owns the entire visible surface: "הבנתי" / מה / relation / מתי / "לשמור ביומן?" / כן לשמור / לא לתקן / ביטול.
- When `editing`: VoiceCard header shows "תיקון" + clean editable fields (מה / מתי / שעה / איפה / הערה). No transcript. No debug.
- When `voiceState === 'error'`: VoiceCard header shows the error copy.

## 5. Saved Success State

**Before:** `handleVoiceConfirm` called `showSuccessToast(formatCreatedConfirmation(...))` which built a technical string. VoiceTraceCard also rendered the same string via `setStage('success', successMsg)`.

**After:** 
- `handleVoiceConfirm` sets `savedConfirmation: { title, date, time }` from `result.appointment` (the normalized record, never raw ASR text).
- `SavedCard` overlay renders: "נשמר ביומן ✓" / appointment title / "מחר · 21:00" / [הצג ביום] / [סגור].
- VoiceTraceCard no longer shows success messages (non-error stages are now hidden).

## 6. "תקווה" / Command Garbage Blocked

**P3 — TITLE_LEAD_STRIPS** (`localParser.ts:521`): added `/^תקווה\s+/`. When ASR mishears "תקבעי" as "תקווה" (the "פתח תקווה" place-hint bias), this strips the leading "תקווה" token before it reaches ConfirmCard, the saved appointment, or any user-facing surface.

**Belt-and-suspenders:** the ASR prompt fix from `8ac546f` (verb-prior line + anti-substitution instruction) remains. The strip is the display-layer guard.

Legitimate uses of "תקווה" (e.g., "בפתח תקווה" as a location) are NOT affected — the strip only fires when "תקווה" is the very first word in the extracted title, which can only happen via the ASR mishear.

## 7. Tests Added / Updated

### New: `voiceUxContract.test.ts` (21 tests)

- P1: ConfirmCard renders כן/לא/ביטול; VoiceCard uses ConfirmCard in non-editing state; ManualModal routes through ConfirmCard.
- P0: VoiceTraceCard gates all diagnostic strings behind `isDiagMode`; early-exit guard verified; VoiceCard gates transcript-box/DEBUG behind `isDiagMode`; ConfirmCard never contains diagnostic strings.
- P2: SavedCard exists; `savedConfirmation` set from `result.appointment.*`; close + show-day buttons present.
- P3: "תקווה" stripped from leading title position; "פתח תקווה" in location context not affected.
- P4: "הבעל של אופיר" → גלעד; "הבת של מור" → missing; "הבן של מור" → ambiguous; ConfirmCard handles all three relation states.
- P4: "21" → 21:00.
- P5: Correction mode field labels present; transcript-box only in `isDiagMode`.
- Invariant: `createAppointmentSafe` is the only exported create function.

### Updated tests

- `voiceCardSlots.test.ts`: debug-block test updated to check `isDiagMode`/`abu-voice-debug` localStorage gate; date label updated "תאריך"→"מתי".
- `voiceConfirmationP02.test.ts`: header assertion updated — ConfirmCard provides "הבנתי" in confirmation mode; VoiceCard header shows "תיקון" in editing mode.

## 8. Test / Build / Pre-commit Results

```
npm run typecheck  PASS
npm test           PASS — 2175 tests / 99 files
npm run build      PASS — 25 precache entries; 12s build
memory/* restored  — not committed
```

## 9. What Still Needs Manual Browser QA

All items from the war room report (§11) plus:

- [ ] VoiceTraceCard: confirm it is invisible after a successful voice parse (no "מצב הקלטה" card in the footer).
- [ ] VoiceCard in confirmation mode: confirm ONLY ConfirmCard UI is shown (no "הבנתי ממך ש..." header above it).
- [ ] Tap "כן, לשמור": confirm SavedCard ("נשמר ביומן ✓" / title / date·time / [הצג ביום] / [סגור]) appears.
- [ ] Tap "הצג ביום": confirm calendar view jumps to the saved event's date and sheet opens.
- [ ] Tap "לא, לתקן": confirm correction mode shows ONLY clean fields (מה / מתי / שעה / איפה / הערה), NO transcript, NO debug.
- [ ] Say "תקבעי פגישה מחר בשעה 21 עם הבעל של אופיר": confirm ConfirmCard shows "גלעד" as title, "הבעל של אופיר" as secondary line, NO "תקווה".
- [ ] Deliberately corrupt audio / deny mic: confirm only "בעיה בהקלטה" card shows (no diagnostic metadata, no "העתק אבחון קול").
- [ ] Original war-room scenarios 1–9 (live audio).
