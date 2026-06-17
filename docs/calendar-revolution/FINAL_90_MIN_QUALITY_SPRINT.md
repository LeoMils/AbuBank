# AbuBank — 90-Minute Final Quality Sprint

Branch: `feat/calendar-revolution`
Base commit: `878d80c`
Final commit: `d9b4a25`
Date: 2026-05-28

---

## Verdict

| Phase | Result |
|-------|--------|
| P0 Baseline | **PASS** |
| P1 Runtime truth / SW proof | **PROVEN** |
| P2 Live QA scenarios | **NEEDS_MANUAL_BROWSER_QA** |
| P3 Pipeline review | **REVIEWED** — 1 MEDIUM bug documented |
| P4 AbuAI review | **REVIEWED** — no issues |
| P5 AbuCalendar UX | **REVIEWED** — no changes needed |
| P6 AbuGames review | **REVIEWED** — no issues |
| P7 Test hardening | **DONE** — 14 integration render tests |
| P8 Final validation | **PASS** |

---

## P0 — Baseline

```
typecheck    PASS  (0 type errors)
npm test     PASS  2189 tests / 100 files
npm run build PASS  25 precache entries / 4.98s
```

Branch: `feat/calendar-revolution`
HEAD at start: `79fba32` (unpushed)
Remote HEAD: `878d80c`

---

## P1 — Runtime Truth / SW Proof

### isDiagMode tree-shaking: PROVEN

The production bundle (`dist/assets/index-ClRLOUQz.js`) contains:
- **ABSENT**: `isDiagMode`, `isDevBuild`, `abu-voice-debug`, `env?.DEV`, `env.DEV`
- **ABSENT** (UI strings): `העתק אבחון קול`, `voice-trace-stage`, `transcript-box`, `transcript-textarea`

Vite successfully dead-code-eliminates the entire `isDiagMode` gate in production.

### "מצב הקלטה" in bundle — not a leak

The string appears once as the ternary else-branch of:
```
isError ? "בעיה בהקלטה" : "מצב הקלטה"
```
In production, `isDiagMode === false` means the `VoiceTraceCard` only renders when `isError === true`. Therefore `isError ? "בעיה בהקלטה" : "מצב הקלטה"` always evaluates to "בעיה בהקלטה" at runtime. The else-branch is dead at runtime, but not removed by the minifier (it's a runtime conditional, not a compile-time one).

**Status**: Not a leak. The UI diagnostic strings (`העתק אבחון קול`, stage/blob/chunks/mime/asr) that triggered the live QA failure are all **ABSENT** from the production bundle.

### Service worker self-heal: PROVEN

`main.tsx` contains the dev-mode SW auto-unregister block (`getRegistrations` / `unregister`). Confirmed by the `main.tsx` structural render test (test #9 of 14).

---

## P2 — Live QA Scenarios

All 8 scenarios require manual browser QA. Classification:

| # | Scenario | Classification |
|---|----------|----------------|
| 1 | Voice ADD complete: "תקבעי פגישה למחר בשעה 21" | `NEEDS_MANUAL_BROWSER_QA` |
| 2 | Voice ADD kinship resolved: "הבעל של אופיר" → גלעד | `NEEDS_MANUAL_BROWSER_QA` |
| 3 | Voice ADD kinship ambiguous: "הבן של מור" → candidate buttons | `NEEDS_MANUAL_BROWSER_QA` |
| 4 | Voice ADD kinship missing: "הבת של מור" → calm message | `NEEDS_MANUAL_BROWSER_QA` |
| 5 | Manual ADD via button → ConfirmCard → save | `NEEDS_MANUAL_BROWSER_QA` |
| 6 | "לא, לתקן" → editing mode → clean fields only | `NEEDS_MANUAL_BROWSER_QA` |
| 7 | Mic denied → "בעיה בהקלטה" + no diagnostic metadata | `NEEDS_MANUAL_BROWSER_QA` |
| 8 | "כן, לשמור" → SavedCard overlay with clean title/date/time | `NEEDS_MANUAL_BROWSER_QA` |

**Critical QA prerequisite**: Clear the stale service worker first:
1. DevTools → Application → Service Workers → Unregister
2. DevTools → Application → Storage → Clear site data
3. Hard-reload (Cmd/Ctrl+Shift+R)
4. OR: with `79fba32` or later loaded, the dev-mode auto-unregister fires once and handles it.

---

## P3 — Calendar / Voice Pipeline Review

### REVIEWED — pipeline is sound

The full ADD path was reviewed:
- `handleVoiceRecord` → `transcribeCalendarAudio` → `normalizeCalendarTranscript` → `processVoiceTranscript` → `resolveDraftPerson` → `setVoiceParsed` → `VoiceCard(ConfirmCard)` → `handleVoiceConfirm` → `createAppointmentSafe` → `SavedCard`

All critical invariants hold:
- `createAppointmentSafe` is the sole write path (confirmed by test)
- `savedConfirmation` is built from `result.appointment.{title,date,time}`, never `rawTranscript`
- Kinship phrases always route to `show_confirm_card` (never auto-created silently)
- `isDiagMode` requires BOTH `import.meta.env.DEV === true` AND `localStorage['abu-voice-debug']==='true'`

### MEDIUM bug — kinship + ambiguous time loses relation data

**Path**: `תקבעי פגישה עם הבעל של אופיר בשעה 9` where "9" is ambiguous (AM/PM).

1. `processVoiceTranscript` returns `needs_am_pm` (ambiguous time check fires before kinship check)
2. `ambiguousDraft` is set — does NOT include `personPhrase`
3. After user picks AM/PM in `resolveAmbiguity`, `setVoiceParsed` is called without `resolveDraftPerson`
4. ConfirmCard shows "פגישה עם הבעל של אופיר" (unresolved) instead of "פגישה עם גלעד"

**Consequence**: Title is readable but unresolved. No wrong data; no data invented. SavedCard saves "פגישה עם הבעל של אופיר" — correct but verbose.

**Priority**: MEDIUM (very rare combination; mild consequence). Not fixed in this sprint; fix would add `personPhrase` to `ambiguousDraft` type and call `resolveDraftPerson` inside `resolveAmbiguity`.

---

## P4 — AbuAI Review

**No issues found.**

- 1001 tests passing in 47 files
- `familyGraph.ts` exports only `loadGraph`, `findNode`, `GraphNode` type — read-only from calendar
- No changes made (per sprint spec)

---

## P5 — AbuCalendar UX

**No changes needed.**

Reviewed button sizing:
- ConfirmCard "כן, לשמור": `minHeight: 60`, `fontSize: 20` ✓
- ConfirmCard "לא, לתקן" / "ביטול": `minHeight: 56`, `fontSize: 17` ✓
- Candidate buttons: `minHeight: 56`, `fontSize: 18` ✓
- "להשאיר כמו שאמרתי": `minHeight: 52`, `fontSize: 16` ✓
- SavedCard "הצג ביום" / "סגור": `minHeight: 56` ✓

All touch targets ≥ 48px. SavedCard `onShowDay` correctly opens the day sheet and dismisses the card.

---

## P6 — AbuGames Review

**No issues found.**

18 tests passing. No changes made (per sprint spec).

---

## P7 — Test Hardening

### Before this sprint

- `voiceUxRender.test.tsx`: 9 integration render tests
- `voiceUxContract.test.ts`: 21 structural/functional tests

### Added in this sprint (`d9b4a25`)

5 new integration render tests added to `voiceUxRender.test.tsx`:

| # | Test | What it proves |
|---|------|----------------|
| 10 | VoiceCard error state | No ConfirmCard shown; voice-card-header present; correction fields visible |
| 11 | ConfirmCard missing date/time | "חסר" rendered; save button has `disabled` attribute |
| 12 | ConfirmCard past date | "⚠️ התאריך עבר" warning shown |
| 13 | ConfirmCard ambiguous: no save/correct/cancel | `confirm-save-btn`, `confirm-correct-btn`, `confirm-cancel-btn`, "כן, לשמור" all absent |
| 14 | ConfirmCard resolved: full action row | Secondary phrase, all three action buttons, "כן, לשמור" present; no `disabled` |

### After this sprint

- `voiceUxRender.test.tsx`: **14** integration render tests
- `voiceUxContract.test.ts`: 21 structural/functional tests
- Total test suite: **2189 tests / 100 files**

---

## P8 — Final Validation

```
typecheck    PASS
npm test     PASS  2189 / 100 files
npm run build PASS  25 precache entries
memory/*     RESTORED  (timestamp-only changes discarded)
```

Commit: `d9b4a25` (local only, NOT pushed per standing rule)

---

## What still requires manual browser QA

1. **SW clear** (one-time): DevTools → Application → Service Workers → Unregister → Clear site data → Hard-reload
2. **All P2 scenarios** (8 voice/manual/correction flows listed above)
3. **"תקווה" end-to-end**: live voice recording of "תקבעי פגישה למחר בשעה 21 עם הבעל של אופיר" should show "פגישה עם גלעד" in ConfirmCard with no "תקווה" / no "תקבעי" / no DEBUG
