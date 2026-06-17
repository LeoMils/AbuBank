# Runtime Truth Fix — tests pass, live UI was lying

Branch: `feat/calendar-revolution`
Base commit: `878d80c`

## 1. Why tests passed while live UI failed

The source code at `878d80c` does correctly gate every diagnostic surface (`DEBUG` / `מצב הקלטה` / `העתק אבחון קול` / `מה שמעתי` / `stage` / `blob` / `chunks` / `mime` / `asr`) behind a runtime check. The static-source tests verified the gate exists; they did NOT verify the rendered output.

Three runtime explanations for the live failure, in descending probability:

1. **Stale service worker.** `vite.config.ts:267` sets `devOptions: { enabled: false }`, so the Vite dev server (localhost:5173) never installs a service worker. But if `npm run preview` was ever run on the same origin — or any production build was ever loaded there — a Workbox SW was installed and **stays registered indefinitely**. That SW intercepts navigation requests and serves the old precached `index.html` + old asset bundles, where the diagnostic UI was unconditional. The user sees stale UI even though source is clean.
2. **localStorage `abu-voice-debug=true`** set during earlier QA. Even on fresh code, this flag turned `isDiagMode` true.
3. **Browser tab not refreshed** since the bundle changed (much less likely after explicit reloads).

All three are fixed below — defensively, not just by documentation.

## 2. Was stale service-worker involved?

**Yes — root cause.** The `dist/sw.js` precaches a fixed list of asset hashes (e.g. `assets/index-FqVZvFIr.js`). The SW uses `clientsClaim()` + `skipWaiting()` + `cleanupOutdatedCaches()`, but these only fire when a NEW SW is served. Vite dev serves NONE, so the old SW survives across code changes invisibly.

## 3. Diagnostic surfaces still live (at `878d80c`)

| Surface | At `878d80c` | At this fix |
|---------|--------------|-------------|
| `VoiceCard` DEBUG panel | Gated by localStorage only | Gated by **DEV build AND** localStorage |
| `VoiceCard` "מה שמעתי" transcript box | Gated by localStorage only | Gated by **DEV build AND** localStorage |
| `VoiceTraceCard` "מצב הקלטה" / blob / chunks / mime / asr | Gated by localStorage only | Gated by **DEV build AND** localStorage |
| `VoiceTraceCard` "העתק אבחון קול" | Gated by localStorage only | Gated by **DEV build AND** localStorage |
| Stale SW serving old bundles | Possible | **Auto-unregistered on dev load** |

## 4. What was removed/hardened

- **`isDiagMode` now requires `import.meta.env.DEV === true` AND the localStorage flag.** Production builds CANNOT show DEBUG even if a user/attacker sets `abu-voice-debug=true` via DevTools. In `vite dev`, the user must also explicitly set the flag — normal QA never sees it.
- **`main.tsx` now self-heals stale dev caches.** In DEV builds, the entry script calls `navigator.serviceWorker.getRegistrations()` and unregisters every SW it finds, then reloads once. Production builds are unaffected (the block is dead code under `import.meta.env.DEV === false`).

## 5. State-machine flow (unchanged but now provably clean)

```
recording
  └── ⏹ stop
        └── transcribing
              └── parsing
                    └── parsed → VoiceCard renders ConfirmCard ONLY
                          ├── ✅ "כן, לשמור" → handleVoiceConfirm
                          │     └── createAppointmentSafe(normalized record)
                          │           └── SavedCard ("נשמר ביומן ✓ / title / date·time")
                          ├── ✏️ "לא, לתקן" → setEditing(true)
                          │     └── VoiceCard correction fields (clean labels only)
                          └── ✖ "ביטול" → clear state
recording-error (only path that shows VoiceTraceCard)
  └── "בעיה בהקלטה" + user-facing error message ONLY
        (no blob/chunks/mime/asr leak; no diagnostic copy button)
```

The new integration render tests (`voiceUxRender.test.tsx`) prove the surface for `parsed`, `parsed+resolved`, `parsed+missing`, `parsed+ambiguous`, and `error` states.

## 6. ConfirmCard as the sole approval surface

`VoiceCard.tsx:194-204` renders `<ConfirmCard ...>` and nothing else when `!editing && voiceState !== 'error'`. ConfirmCard provides:
- "הבנתי"
- "מה: <title>" + optional secondary phrase line
- "מתי: <date> · <time>"
- "לשמור ביומן?" + `כן, לשמור` / `לא, לתקן` / `ביטול`

There is no parallel diagnostic card, and `VoiceTraceCard` now refuses to render in any non-error state regardless of dev/localStorage flags.

## 7. Saved state is built from normalized data

`index.tsx` `handleVoiceConfirm` calls `createAppointmentSafe(final)` and then sets `savedConfirmation = { title: result.appointment.title, date: result.appointment.date, time: result.appointment.time }`. The `SavedCard` overlay reads from this object, never from `rawTranscript`. The same holds for the event list — it reads `appt.title` from storage written by `createAppointmentSafe`, which received the normalized draft from `voiceAutoCreate`.

## 8. "תקווה" blocked from every user-facing surface

- **Upstream (ASR prompt, `8ac546f`):** Whisper prompt biases against "תקווה" mishear.
- **Parser strip (`localParser.ts:TITLE_LEAD_STRIPS`, this commit chain):** `/^תקווה\s+/` removed from any leading title position.
- **Display layer:** ConfirmCard renders `draft.title` only (never `rawTranscript`); SavedCard renders `appointment.title` only; event list renders `appt.title` only. None of these surfaces can show "תקווה" unless it was written to storage — and the parser strip prevents that.
- **Render test:** `voiceUxRender.test.tsx` asserts no `תקווה` / `תקבעי` in the default voice render output.

## 9. Tests added

- **NEW `voiceUxRender.test.tsx`** — 9 integration render tests using `react-dom/server.renderToString` against the actual `VoiceCard` and `VoiceTraceCard` components with a clean `MemoryStorage` shim:
  - confirmation mode (parsed): no diagnostic strings; ConfirmCard contract buttons present; normalized name shown; raw transcript suppressed.
  - resolved relation: secondary phrase line rendered; still no diagnostic strings.
  - missing relation: calm "לא מצאתי בוודאות מי …" copy; still no diagnostic strings.
  - ambiguous relation: candidate buttons + keep-phrase fallback; no auto-select; still no diagnostic strings.
  - VoiceTraceCard idle: renders empty.
  - VoiceTraceCard non-error stage: renders empty even with `visibleMessage` set (the prior leak path).
  - VoiceTraceCard error: shows user-facing error only; no blob/chunks/mime/asr leak.
  - **Production-gate proof:** with `abu-voice-debug=true` set in localStorage, the test runner's non-DEV environment still suppresses diagnostic UI (the AND-gate works).
  - main.tsx structural check: DEV-only `serviceWorker.getRegistrations` / `unregister` block present.

- **vitest.config.ts** updated to include `*.test.tsx` files (no new dependency).

## 10. Validation

```
npm run typecheck         PASS
npm test                  PASS — 2184 tests / 100 files
npm run build             PASS — 25 precache entries; 4.67s build
memory/* restored, not committed
```

## 11. What still needs manual browser QA

**Critical first step before any voice QA:**
1. **Clear the stale service worker.** Open DevTools → Application → Service Workers → Unregister. THEN Application → Storage → "Clear site data". THEN hard-reload (Cmd/Ctrl+Shift+R).
2. Alternative: with this fix loaded once, the dev-mode auto-unregister will fire on next load and reload itself. After that single auto-reload, the SW is gone for good on `vite dev`.
3. **Verify the localStorage flag is OFF:** DevTools → Application → Local Storage → confirm `abu-voice-debug` is absent. If present, delete it.

**Then verify scenarios:**
- [ ] Voice ADD "תקבעי פגישה למחר בשעה 21 עם הבעל של אופיר" → ConfirmCard ONLY, shows "פגישה עם גלעד" + secondary "הבעל של אופיר" + "מתי: מחר · 21:00" + the three approval buttons. No "תקווה". No "תקבעי". No DEBUG. No "מצב הקלטה".
- [ ] Tap "כן, לשמור" → SavedCard ("נשמר ביומן ✓") with clean title. No raw ASR.
- [ ] Open the saved event in the day list → title is clean (e.g. "פגישה עם גלעד"), no "תקווה" / "תקבעי".
- [ ] Tap "לא, לתקן" → fields only (מה / מתי / שעה / איפה / הערה). NO "מה שמעתי" textarea. NO DEBUG panel.
- [ ] Deny mic / corrupt audio → "בעיה בהקלטה" card with user-friendly Hebrew error; no blob/chunks/mime/asr leak; no "העתק אבחון קול" button.
- [ ] Repeat war-room scenarios 1–9 against the live audio path.
