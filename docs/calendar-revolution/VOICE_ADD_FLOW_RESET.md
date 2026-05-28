# AbuBank — Voice ADD Flow Reset

Branch: `claude/enable-family-contact-data-Hhcf4`
Date: 2026-05-28

---

## Problem Statement

Manual browser QA showed the live voice ADD flow was broken: the screen simultaneously
displayed a diagnostic panel, recording state, parsed/debug metadata, editable fields,
ConfirmCard-like text, and saved event list — all at once, with scroll.

### Root Causes

1. **`isDiagMode` active in dev**: `abu-voice-debug=true` in localStorage (from prior QA
   sessions) + `import.meta.env.DEV=true` = full diagnostic overlay coexisting with VoiceCard.

2. **Auto-TTS → auto-correction loop**: `onSpokenDone` callback in VoiceCard automatically
   called `startCorrection()` after TTS finished, triggering unexpected re-recording in what
   should have been the confirmation screen.

3. **State fragmentation**: VoiceCard + VoiceTraceCard (in DayDetailSheet footer) +
   ambiguousDraft modal + SavedCard were four independent render branches, each controlled
   by different state variables. Multiple things became visible simultaneously whenever state
   was not perfectly coordinated.

---

## Solution

### New: `VoiceAddFlow.tsx`

Single-state-machine overlay. `deriveFlowState()` reduces 6+ independent state variables
to one `FlowState` enum. Exactly one panel renders at a time:

| Priority | State | Panel |
|----------|-------|-------|
| 1 | saved | "נשמר ביומן ✓" + date/time + הצג ביום / סגור |
| 2 | ampm | AM/PM disambiguation sheet |
| 3 | error | "בעיה בהקלטה" + error text + נסה שוב / הוסף ידנית / ביטול |
| 4 | confirm | ConfirmCard (full action row) |
| 4 | correcting | מה / מתי / שעה / עם מי editable fields |
| 5 | processing | "בודקת את הבקשה…" spinner |
| 6 | recording | "אני מקשיבה…" + עצור / ביטול |
| — | hidden | null (nothing renders) |

No diagnostic strings anywhere in VoiceAddFlow.tsx.

### Removed from `index.tsx`

- `VoiceCard`, `VoiceTraceCard` renders
- `startCorrection()` function and `correctingRef`
- `correctionAck`, `isCorrecting`, `rawTranscript`, `voiceStatus` state
- `voiceTrace` state (now a ref only for internal trace-building)
- `voiceTraceCopied` state
- `shouldBlockVoiceRecord` guard (VoiceAddFlow handles its own state gating)
- `shapeCreateConfirmReadback`, `shouldShowConfirmationReadback` usage
- `parseCorrection`, `applyCorrection`, `pickClarifyQuestion`, `pickUpdateAck` usage
- `CANCEL_RESPONSE`, `UNRELATED_RESPONSE` speak calls
- `speak` import
- Inline `ambiguousDraft` modal
- Inline `SavedCard`
- StatusPill + VoiceTraceCard from DayDetailSheet footer

### Added

- `sanitizeTitleForSave` applied in `handleVoiceConfirm` before `createAppointmentSafe`
- `handleVoiceCancel()` helper
- `handleVoiceManualAdd()` helper

---

## Test Changes

### Tests removed (11)

These tests verified OLD architecture that is now replaced by VoiceAddFlow:

| File | Tests removed |
|------|--------------|
| `voiceCardSlots.test.ts` | parent wires reparse handler, parent's startCorrection, voiceStatus guard |
| `voiceConfirm.test.ts` | onSpokenDone→startCorrection, correction confirm, shapeCreateConfirmReadback in INDEX |
| `voiceReadbackGuard.test.ts` | 3 INDEX integration tests for shouldShowConfirmationReadback |
| `voiceRecordGuard.test.ts` | 2 INDEX integration tests for shouldBlockVoiceRecord |
| `voiceTrace.test.ts` | VoiceTraceCard in footer test (replaced with VoiceAddFlow check) |
| `voiceUxContract.test.ts` | 2 SavedCard tests (updated to check VoiceAddFlow) |

### Tests added (9) — `voiceAddFlow.test.tsx`

| Test | What it proves |
|------|---------------|
| Confirm: no diagnostic strings | VoiceAddFlow never leaks debug UI |
| Confirm: כן לשמור / לא לתקן / ביטול / הבנתי | Action row present |
| Resolved kinship: פגישה עם גלעד + הבעל של אופיר + 21:00 | Kinship resolution and clean time |
| Saved: נשמר ביומן + clean title | Saved state renders from normalized data |
| Correcting: shows confirm-card not edit fields | State machine routes correctly |
| Missing relation: calm message | Missing kinship shows user-friendly text |
| Ambiguous relation: candidate buttons, no auto-select | Ambiguous kinship shows choice |
| createAppointmentSafe is sole write path | Safety invariant maintained |
| VoiceAddFlow source: no diagnostic strings | Source-level check |

---

## Validation

```
typecheck    PASS  (0 errors)
npm test     PASS  2187 tests / 101 files
npm run build PASS  24 precache entries
```

---

## What Still Requires Manual Browser QA

1. **SW clear** (one-time): DevTools → Application → Service Workers → Unregister → Clear site data → Hard-reload
2. Voice ADD complete: "תקבעי פגישה למחר בשעה 21" → ConfirmCard → כן לשמור → SavedCard
3. Voice ADD kinship resolved: "הבעל של אופיר" → גלעד in title
4. Voice ADD kinship ambiguous: "הבן של מור" → candidate buttons
5. Voice ADD kinship missing: "הבת של מור" → calm message
6. Manual ADD via ＋ button → ConfirmCard → save
7. "לא, לתקן" → editing fields only (no ConfirmCard coexistence)
8. Mic denied → "בעיה בהקלטה" with no diagnostic metadata visible
9. "כן, לשמור" → SavedCard overlay with clean title / date / time
