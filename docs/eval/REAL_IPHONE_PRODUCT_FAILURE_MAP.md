# Real iPhone Product Failure Map

**Build:** `0.24.0-real-product-green` · **Date:** 2026-07-03. Honest status per category. **Environment limit (must be stated):** this repo has **no jsdom / @testing-library**, and Playwright needs a browser that cannot be driven here — so **visual/e2e UI behavior cannot be executed in this environment.** Component *logic* is tested via `react-dom/server` `renderToString`; genuine live-UI proof requires Leo's device on the preview.

## Reproduced-first + fixed this sprint (test failed before, passes after)

| # | Category | Exact failure (reproduced) | Root cause | Fix | Proof |
|---|---|---|---|---|---|
| 1 | Calendar natural-speech extraction (PRODUCT path) | EX1 title = **raw transcript**, time = **03:00**; EX2 title raw, time 04:00, venue "בית", no גלעד detail | the calendar UI voice-add used `parseAppointmentText`, a **different/weaker extractor** than the AI runtime's `understandMeetingSmart` | `parseAppointmentText` now unifies with `understandMeetingSmart` (`enhanceWithSmart`): title "פגישה עם {who}", PM-inferred time, resolved pronoun venue, summarized details | `latestIphoneProductRepro.test.ts` — failed on 6 checks, now passes |
| 3 | Smart details / important notes | garbled "להגיע בהתקשר…"; missing גלעד | time-fix regex misfire; only "can't come" pattern | time-fix requires both sides time-like; added "X אמר ש…(יגיע/יאחר)" extractor (prior commit) | `latestIphoneLiveFailureRepro.test.ts` |
| 2 | Required fields where/when | location "אצלה בבית" unresolved | pronoun venue only resolved bare "אצלה" | resolve in place preserving trailing text (prior) | repro tests |
| 10 (partial) | Live diagnostics | no way to capture real turns | none | `liveTurnDiagnostics` ring buffer + `__abuaiDumpTurns()` / `__abuaiCopyTurns()` console hooks (Copy Last 20) | `latestIphoneAcceptanceGate.test.ts` |

## Verified NOT a bug (against real data)

Family "gender" outputs (ירדן=female, ארי=female) are **correct** per `family_data.json` — no change.

## NOT closed this sprint — honest (needs browser/device, or larger UI work)

| # | Category | Why not closed |
|---|---|---|
| 4 | Save modal wrong missing fields | `ConfirmCard` logic is correct given its draft; the divergence was the extractor (fixed #1). Visual modal behavior on device = **HOLD** (no browser here). |
| 5 | Calendar read/search wrong/invented | runtime read/search are grounded + tested (acceptance suites); the specific stale-event iPhone case was not re-reproduced from a screenshot this sprint. |
| 6,7,9 | Event card render / long-text scroll / family UI | **UI/component visual** — cannot execute render+scroll assertions without jsdom/browser. Real fix + proof needs a component-test harness or device. |
| 8 | "משהו לא עבד" recovery | error strings exist in `App.tsx`/`ErrorBoundary`; a diagnostic-cause recovery flow is a UI change not done here. |
| 11 | Hebrew robotic | covered by naturalizer + supervisor (acceptance suites green); no new iPhone-specific broken phrase reproduced this sprint. |
| 12,13 | Speech stops / resume | delivery-engine chunk/resume proven code-side (prior suites); physical TTS stop is device-gated. |
| 14,15 | Repeated greetings / filler loops | dialogue guards tested green; not re-reproduced from a new transcript this sprint. |
| 300-case gate / Playwright e2e | **Not executable here** (no browser/jsdom); building 300 cases + e2e that I cannot run would be unverifiable. |

## Verdict

The **highest-impact reproduced iPhone failure — calendar create producing raw titles and wrong times in the UI save path — is fixed at the root and proven** (`parseAppointmentText` now matches `understandMeetingSmart`). But I will **not** claim "real product green": the visual/UI/e2e categories are **not executable in this environment** and require Leo's device on the preview. **CODE-SIDE (extraction/logic) GREEN for the reproduced calendar failure · UI/DEVICE HOLD.**
