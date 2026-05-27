# Automated Browser QA Probe

Branch `feat/calendar-revolution` · HEAD `181dbb1` · probe date 2026-05-27.
Scope: ran every automated check available from Claude Code. No code changed, nothing committed beyond this report, nothing pushed.

## 1. Executive verdict
**NO_BROWSER_TOOLING_STATIC_ONLY** — the repo has no browser/e2e automation (no Playwright/Cypress/Puppeteer/@testing-library/jsdom; vitest runs in `node`; no `.test.tsx`). Real browser UX therefore cannot be honestly proven here. All non-browser gates (typecheck, full test suite, build) are green. The dev server was not responding at probe time (HTTP 000) and was not restarted (no-watch-mode rule).

## 2. Commands run
| Command | Result |
|---|---|
| `git status --short` | clean (empty) |
| `git branch --show-current` | `feat/calendar-revolution` |
| `git log -5 --oneline` | HEAD `181dbb1` (ConfirmCard) · `712e9a8` (weekday) · `07606de` · `e821e76` · `746798b` |
| `npm run typecheck` | **PASS** (exit 0) |
| `npm test` | **PASS — 96 files / 2116 tests** (exit 0) |
| `npm run build` | **PASS** (vite + PWA; exit 0); `memory/*` restored, tree clean |
| browser-tooling probe | **NONE** (deps + scripts + vitest config + dirs all negative) |
| `.test.tsx` render tests | none |
| `curl localhost:5173` | HTTP 000 (dev server down; not restarted) |

## 3. Proven automatically (test/build/static-grep)
- typecheck + 2116 tests + build green; tree clean.
- **Weekday labels** = `א׳/ב׳/ג׳/ד׳/ה׳/ו׳/שבת` — `constants.ts:15` (source-exact).
- **ConfirmCard actions** `כן, לשמור` / `לא, לתקן` / `ביטול` present + save-gate (title+date+time) — `ConfirmCard.test.ts` (asserted in the 2116 run).
- **No raw transcript / no private fields in ConfirmCard** — `ConfirmCard.test.ts` asserts source has no `transcript-box`/`transcript-textarea`/`rawTranscript`/`draft.notes`/`draft.location`.
- **Papi = candle remembrance, not cake** (🕯️, `type:'memory'`) — `familyEvents.test.ts` RT-1 test.
- **Both flows route through ConfirmCard** — `ConfirmCard.test.ts` asserts VoiceCard uses it as the non-editing face and ManualModal routes through it before save.

## 4. Static-only findings (code present; not browser-proven)
- **#2 Calendar reachable:** Home tile `Screen.AbuCalendar` wiring — `Home/index.tsx:624`.
- **#4 Day tap opens sheet:** `setSheetOpen(true)` — `index.tsx:1011` (cell) + `:876` (glance).
- **#5/#6 Manual no silent save → ConfirmCard:** `handleSave`→`setConfirming(true)` (`ManualModal.tsx:44`); `doManualSave` only on confirm (`:48`, `onConfirm={doManualSave}` `:264`).
- **#8 "לא, לתקן" reveals fields:** voice `onCorrect={() => setEditing(true)}` (`VoiceCard.tsx:195`); manual `onCorrect={() => setConfirming(false)}` → form (`ManualModal.tsx:265`).
- **#9 No "מה שמעתי" by default:** VoiceCard transcript/fields are inside the `editing` branch; default renders `ConfirmCard`.
- **#10 Mic/ADD inside sheet only:** voice/manual/trace live in the `DayDetailSheet` `footer={` prop (`index.tsx:1115`), not on primary.

## 5. Needs manual / browser QA (cannot honestly prove here)
- #1 App actually loads; #3 labels render correctly RTL; #4 sheet animates/opens on tap; #5–#8 the manual→ConfirmCard→save and "לא, לתקן" edit reveal **as rendered**; #9 no transcript visible in the live UI; #10 no permanent ADD footprint visually; #11 Papi renders with candle in the day view; #12 **no-scroll at 360×740** (incl. with alert insets); plus reduced-motion, alert-inset reflow, sheet focus/scroll, PWA/iOS. All **NEEDS_MANUAL_BROWSER_QA**.

## 6. Blockers
**None found automatically.** No failing test, no build break, no static contradiction. The only hard gate is manual browser verification of §5 (a process gate, not a defect). RT-2 (no-scroll not enforced — `PageShell scrollable`) remains a browser-measured release-gate item (FU-5), not a code blocker.

## 7. ConfirmCard specific verdict
- **Voice path:** STATIC_ONLY — ConfirmCard is the default (non-error) face; confirm → `createAppointmentSafe`. Render NEEDS_BROWSER_QA.
- **Manual path:** STATIC_ONLY — form gates then routes through ConfirmCard before save (no silent save). Render NEEDS_BROWSER_QA.
- **Correction path:** STATIC_ONLY — "לא, לתקן" → editable fields (voice) / back to form (manual); no transcript panel by default. Behavior NEEDS_BROWSER_QA.
- **No raw transcript:** PROVEN by test for ConfirmCard source; live UI NEEDS_BROWSER_QA.
- **Hebrew copy:** clean, senior-first (`כן, לשמור` / `לא, לתקן` / `ביטול`; summary מה/מתי/עם מי) — STATIC_ONLY.
- **Senior usability risk:** the manual flow now has an extra step (form → confirm); calm and explicit, but confirm the two-step isn't confusing for an 80+ user — NEEDS_BROWSER_QA.

## 8. Family / AbuAI / voice boundary
AbuAI already answers most family/calendar Q&A (relationships via `familyGraph`, birthdays, memorials, week/today/tomorrow). The calendar ADD path does **not** resolve relationship descriptors ("הבת של מור") — that's an **additive enhancement** (Family Context Resolver v1), **not** a release blocker. **The Calendar release should proceed without FamilyContextResolver.**

## 9. Final next action
**CONTINUE_MANUAL_BROWSER_QA** — no automated blocker exists; the remaining unknowns are browser-only and must be verified manually (restart the dev server when ready). No code change warranted from this probe.
