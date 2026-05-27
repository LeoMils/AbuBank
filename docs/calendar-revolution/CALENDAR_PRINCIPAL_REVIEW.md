# CALENDAR_PRINCIPAL_REVIEW — Phase 9 (inline)

Branch: `feat/calendar-revolution` · HEAD `746798b` (code at `60a6309`) · Base `6a91ac5`.
Mode: REVIEW ONLY (inline — the spawned Phase-9 agent hung with no output; re-run inline). No production code changed. Evidence commands run exactly once (see §9).
Classification tags on every claim: **PROVEN** (automated assertion/command output) · **STATIC_ONLY** (code/grep evidence, no runtime proof) · **NOT_PROVEN** · **NEEDS_BROWSER_QA** · **BLOCKER**.

---

## 1. Executive verdict

The Calendar Revolution is **code-complete and green at the automated level** (typecheck + 2111 tests + build all pass — PROVEN, §9), with the four operator-approved scope items implemented and the Red Team's Critical dignity defect (RT-1) remediated. The work is **sound at the logic/architecture level (PROVEN/STATIC_ONLY)** but its **core senior-UX promises are visual/behavioral and remain unverified without a browser** — chiefly the "no-scroll on primary" principle (NEEDS_BROWSER_QA / FU-5), measured contrast, and bottom-sheet interaction. **No open BLOCKER** is present in the current tree. Recommendation: **ACCEPTABLE_TO_BROWSER_QA** (§11) — ready to enter manual/device QA, not yet proven shippable.

## 2. ADD / SHOW / ALERT verdict for Martita

- **ADD** — manual + voice add relocated into the day-sheet; both still route through `createAppointmentSafe` (single safe write path). Code present STATIC_ONLY (`index.tsx` sheet footer; `service.ts` createAppointmentSafe). Voice pipeline logic unchanged (handlers relocated, not rewritten) — STATIC_ONLY. Actual tap→record→confirm→persist flow in a browser — NEEDS_BROWSER_QA.
- **SHOW** — month grid on primary; per-day events in a sheet that owns its own scroll; next-thing glance summarizes the next event + today's count. Family birthdays/memorial now from `knowledge/family_data.json` (13 entries + 1 memorial) — PROVEN by `familyEvents.test.ts` in the 2111 run. Visual layout/legibility — NEEDS_BROWSER_QA.
- **ALERT** — banner converted to in-flow reflowing inset (no longer `position:fixed` over chrome) — STATIC_ONLY (`index.tsx`); reflow-without-overlap behavior — NEEDS_BROWSER_QA. Alert-dedup id continuity preserved so dismissed alerts don't re-fire (RT-3) — PROVEN by `familyEvents.test.ts` legacy-id assertions.

## 3. Senior-first UX verdict

- Day-cell height ≥64pt; ADD/mic ≥56pt; sheet close ≥48pt — STATIC_ONLY (`index.tsx`, `DayDetailSheet.tsx`). Rendered touch-target sizes — NEEDS_BROWSER_QA.
- **No-scroll on primary** — **NOT enforced**: primary still in `<PageShell scrollable>` (`index.tsx:771`). Whether it actually fits 360×740 (esp. with 2 alert insets) — **NEEDS_BROWSER_QA** (release gate FU-5). Do not treat as satisfied.
- State feedback (recording/processing/error) preserved via StatusPill + VoiceTraceCard inside the sheet — STATIC_ONLY. Back-out: sheet closes via scrim/Escape/close (guarded during recording, RT-4) — STATIC_ONLY; behavior NEEDS_BROWSER_QA.
- Shape+count event indicators reduce color-only reliance — STATIC_ONLY; perceptual distinguishability for an 80+ user — NEEDS_BROWSER_QA.

## 4. Hebrew / RTL verdict

RTL containers + LTR-forced numbers/time preserved; "Martita" kept Latin (PROVEN — `familyEvents.test.ts` asserts title/personName). Strikethrough on past Hebrew titles replaced by "עבר" pill — STATIC_ONLY (`ApptCard.tsx`). Glance text truncation with long Hebrew titles, DD/MM rendering, "עבר" pill wrap, sheet header alignment — NEEDS_BROWSER_QA. No RTL defect found statically; full RTL correctness NOT_PROVEN without rendering.

## 5. AbuAI / voice safety verdict

- **AbuAI source untouched** — PROVEN: `git diff --name-only 6a91ac5..HEAD -- src/screens/AbuAI/` returns only `tools.test.ts` + `onlineWiring.test.ts` (both tests). `service.ts` still re-exports `FAMILY_BIRTHDAYS`/`FAMILY_MEMORIALS` that AbuAI `tools.ts` imports.
- AbuAI lookups intact: `getBirthdayFor('פפי')` still month-formats "19 באפריל" (Papi kept in the array) — PROVEN (`warRoom.test.ts` T6 in the 2111 run).
- **Raw transcript never displayed** to Martita — STATIC_ONLY (no new raw-transcript render introduced in `index.tsx`; VoiceTraceCard is diagnostic, normalization upstream). Full confirmation NEEDS_BROWSER_QA.
- Orphaned-voice-session guard (sheet can't close mid-recording, RT-4) — STATIC_ONLY; runtime behavior NEEDS_BROWSER_QA.

## 6. Birthday / memorial dignity + Truth Contract verdict

- **Deceased dignity (RT-1)** — deceased husband's birthday renders as a candle remembrance (🕯️, `type:'memory'`, gold), never a 🎂 cake — PROVEN (`familyEvents.test.ts` "RT-1" test). 01-01 memorial preserved — PROVEN.
- **Never invent dates** — only the 13 JSON `birthday` fields + 1 `memorial_date` are emitted; Yarden/Sharon/Yael/Gilad/Mirta/Shoshana omitted (no JSON date), documented as missing-data (FU-2/FU-3) — PROVEN (adapter tests + JSON cross-check).
- **Truth Contract** — `createAppointmentSafe` remains the single new-event write path — STATIC_ONLY; deterministic colors (no session-unstable index) — PROVEN (determinism test).

## 7. Privacy verdict

Family events map **name + date only**; no `notes`/`location`/relationship fields copied into events — PROVEN (`familyEvents.test.ts` asserts `notes`/`location` undefined). `family_data.json` contains no phone/street/medical/financial (city-level locations only) — STATIC_ONLY. No private data surfaced via the new events or the relocated trace card — STATIC_ONLY.

## 8. Technical architecture verdict

- Re-export strategy keeps AbuAI decoupled from the data-source change — PROVEN (diff + green AbuAI tests). JSON bundles via existing `loadFamilyData()` import — PROVEN (build passes).
- Bottom-sheet layering z150/151 below modals z200/220 (modals open above sheet) — STATIC_ONLY; actual stacking/scroll-lock/focus — NEEDS_BROWSER_QA.
- localStorage schema unchanged (no migration) — STATIC_ONLY. id-slug stability for alert dedup (legacy ids) — PROVEN (tests).
- Deferred (FU-4): full Tab focus-trap, swipe-close, and a DOM render test (repo has no jsdom/@testing-library; vitest = node) — STATIC_ONLY (absence confirmed).

## 9. Tests / build evidence (run once, this review)

| Command | Result | Evidence |
|---|---|---|
| `git status --short` | clean (empty) | PROVEN |
| `git log -5 --oneline` | HEAD `746798b`, code `60a6309` | PROVEN |
| `npm run typecheck` | **PASS** (exit 0, no diagnostics) | PROVEN |
| `npm test` | **PASS — 95 files / 2111 tests** | PROVEN |
| `npm run build` | **PASS** (vite + PWA, `built in 13.51s`, sw.js generated) | PROVEN |
| memory/* after build | restored; tree clean | PROVEN |

No command failed. No memory/* committed.

## 10. Remaining browser / manual QA blockers (must do before release)

All **NEEDS_BROWSER_QA** (none are code BLOCKERs, but they gate release):
1. **No-scroll fit** of the primary at 360×740 with up to 2 active alert insets (FU-5/RT-2). If it overflows → redesign, don't add scroll.
2. **Measured WCAG contrast** of the new solid tokens + gold-on-navy small text (no AAA claimed).
3. **Bottom-sheet** open/close, own-scroll containment, focus-into / focus-restore, Escape, scrim, reduced-motion, and the RT-4 close-while-recording guard — in a real browser.
4. **Alert-inset reflow** (no paint-over of header/selector).
5. **Glance** tap → month-jump + sheet-open.
6. **iOS Safari / PWA** behavior incl. service-worker freshness after the version bump (stale-cache risk) — NEEDS_BROWSER_QA on device.
7. Event-indicator **shape-vs-color** distinguishability for an 80+ user.
8. Deferred FU-4 (Tab-trap, swipe-close) — accept as follow-up or implement before GA.

## 11. Release recommendation

**ACCEPTABLE_TO_BROWSER_QA.**

Justification: every automated gate is green (typecheck, 2111 tests, build — PROVEN); the four scope items and the RT-1 dignity fix are implemented and test-guarded; AbuAI is provably untouched; privacy and Truth-Contract obligations are met at the data layer. **No open BLOCKER** exists in the tree. However, the revolution's headline senior-UX promises (no-scroll, contrast, sheet interaction, device/PWA behavior) are inherently visual/behavioral and **cannot be honestly proven in this environment** — they must pass manual/browser QA (§10) before this is declared release-ready. It is therefore ready to advance to browser QA, not to ship.

---

*End of Phase-9 Principal Review (inline). Review only — no production code changed; nothing pushed.*
