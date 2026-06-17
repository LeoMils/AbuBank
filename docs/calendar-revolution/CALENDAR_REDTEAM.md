# Calendar Revolution — RED TEAM Review

Branch: `feat/calendar-revolution` · Base: `6a91ac5` · Review date: 2026-05-27
Mode: REVIEW ONLY. No source/test modified. Only this file written. typecheck +
the targeted test files were run read-only (no commit, memory restored).

## Adversarial verdict (1 paragraph)

The structural refactor is clean and the automated suite is green, but the
migration to JSON-backed family events introduced a **genuine emotional-accuracy
regression that is now locked in by a passing test**: the deceased husband Papi
(פפי) carries a `birthday: "04-19"` in `family_data.json`, so `buildFamilyBirthdays()`
emits a celebratory cake event "יום הולדת פפי 🎂" on April 19, and AbuAI's
`getBirthdayFor('פפי')` now answers "יום ההולדת של פפי — 19 באפריל." The previous
hard-coded list deliberately rendered this same date with a remembrance candle
(🕯️❤️), never a cake. For an 80+ widow this is the single highest-risk defect in
the branch — it is a dignity/tone failure, not a layout nit, and the docs
(FOLLOW_UPS FU-3, QA §2) are silent on it. Separately, the whole "no-scroll
primary" product principle is **not enforced** (`PageShell scrollable`), so the
core claim of the revolution is unproven and structurally un-guaranteed. The
remaining findings are real but lower severity: a likely once-only false-positive
birthday alert re-fire from the id-slug rename, color-hash collisions, and a pile
of behavior that is honestly marked NOT PROVEN pending browser QA.

## Severity counts
- Critical: 1
- High: 3
- Medium: 5
- Low: 4
- Follow-up: 3

---

# CRITICAL

## RT-1 — Deceased husband Papi gets a celebratory 🎂 birthday event (emotional-accuracy + dignity failure)
- **Area:** Birthday/Truth Contract, emotional accuracy (rule: "Pepe's memorial requires gentle tone, never clinical"; deceased treated with weight).
- **Risk:** `loadFamilyData()` includes the deceased member (`familyLoader.ts:66-69`), and Papi's JSON entry has `"birthday": "04-19"` (confirmed in `knowledge/family_data.json` → `family.deceased.birthday`). `buildFamilyBirthdays()` filters only on `Boolean(m.birthday)` (`familyEvents.ts:38-40`), so Papi passes the filter and produces:
  - calendar event: `title: "יום הולדת פפי 🎂"`, `emoji: '🎂'`, `type: 'birthday'` (`familyEvents.ts:44-54`)
  - AbuAI answer: `getBirthdayFor('פפי')` → "יום ההולדת של פפי — 19 באפריל" (`tools.ts:184-206`; exercised by `warRoom.test.ts:77-86`).
  The **old** hard-coded list rendered the same April 19 date as a remembrance line `'יום הולדת פפי 🕯️❤️'` with a candle emoji (see `git show 6a91ac5:src/screens/AbuCalendar/service.ts`, `bday-papi` entry), explicitly signaling memory, not celebration. The new generic-cake path strips that intent.
- **Evidence:** `familyEvents.ts:38-54`; `familyEvents.test.ts:14` asserts `'פפי'` IS in the birthday list; `familyEvents.test.ts:45` asserts every birthday `emoji === '🎂'`; base file `bday-papi` candle entry; `warRoom.test.ts:82-85`.
- **Blocks release?** YES.
- **Fix (minimal):** Exclude the deceased from birthday generation OR give the deceased birthday a remembrance treatment. Lowest-risk: in `buildFamilyBirthdays()`, skip members whose `relationship` is `husband_deceased` (or, more general, who appear in `family.deceased`). Then update `familyEvents.test.ts:14` to drop `'פפי'` from the expected birthday names and the count from 13→12. The memorial (01-01) path is unaffected and correct. If product instead wants to keep an April-19 acknowledgement, it must be a non-cake "נזכרים ב…" item, not `🎂`/`type:'birthday'`. Requires human approval because it changes documented/tested behavior.

---

# HIGH

## RT-2 — "No scroll on primary screens" is NOT enforced; the revolution's core claim is structurally unguaranteed
- **Area:** Senior UX (mandatory: no scroll on primary screens), release-readiness.
- **Risk:** `AbuCalendar` renders inside `<PageShell scrollable>` (`index.tsx:771`). `PageShell` with `scrollable` sets `overflowY:'auto'` (`src/components/PageShell/index.tsx`). So if the content exceeds 740px the primary screen silently scrolls — exactly the failure the brief forbids. Worst case is plausible: header + 2 alert insets (each `padding:14px 20px`, `index.tsx:817-847`) + alert-time selector + glance + month nav (56px buttons) + grid (6 rows × `minHeight:64` + headers + padding ≈ 430px+) can exceed the viewport. The relocation of the list/ADD into the sheet helps, but nothing in code guarantees the no-scroll invariant.
- **Evidence:** `index.tsx:771`; `PageShell/index.tsx` (`overflowY: scrollable ? 'auto'`); alert inset `index.tsx:817-847`; grid `index.tsx:993-1106`. Actual overflow at 360×740 is **NOT PROVEN — requires browser**; the *enforcement gap* is proven by code.
- **Blocks release?** YES (verify-then-fix). At minimum the no-scroll fit must be browser-verified at 360×740 with 2 active alerts; if it overflows it must be redesigned (brief: "redesign — don't add scroll").
- **Fix:** Browser-measure first. If it fits, document the measured proof and consider switching the primary `PageShell` to non-scrollable to lock the invariant. If it does not fit, reduce alert-inset height / collapse the alert-time selector.

## RT-3 — Dismissed birthday/memorial alerts will re-fire once after deploy due to id-slug rename
- **Area:** Alert dedup / birthday Truth Contract / senior trust ("don't nag her about the same thing twice").
- **Risk:** The alert dedup set persists event ids in `localStorage['abubank-alerted-ids']` (`index.tsx:137-148`). Alert ids are `${b.id}-${yr}` where `b.id` is `bday-<slug>` (`service.ts:352-356`). The slugs changed in this migration: old `bday-ilai`→new `bday-eili`, old `bday-eylon`→new `bday-ayalon` (confirmed: `familyEvents.test.ts:26-30`; old ids in base `service.ts`). Any device that already alerted+dismissed `bday-ilai-2026` / `bday-eylon-2026` will not find a match for the new `bday-eili-2026` / `bday-ayalon-2026`, so those alerts re-enter `alertedIdsRef` as fresh and **re-fire once** (sound + banner) within the alert window. Same mechanism would hit Papi's new cake-birthday alert (compounding RT-1: a *birthday* alert for the deceased).
- **Evidence:** `index.tsx:137-198` (dedup keyed on `appt.id`); `service.ts:352-356` (id = `bday-<slug>-<year>`); slug change `familyEvents.test.ts:26-30`.
- **Blocks release?** NO (one-time, self-healing per device), but it is a real senior-trust regression and compounds RT-1. Flag prominently.
- **Fix:** None strictly required if RT-1 is fixed (removes the worst case). Optional: key dedup on a stable composite (date+title) rather than the renamed slug, or accept the one-time re-fire and note it in release notes.

## RT-4 — Orphaned voice session: voice trace / status / VoiceCard can be active while the sheet that hosts them is closed
- **Area:** ADD/mic/voice-trace relocation, senior state-feedback ("Martita must always know what the app is doing").
- **Risk:** The mic button, `StatusPill`, and `VoiceTraceCard` now live ONLY inside the `DayDetailSheet` footer (`index.tsx:1117-1167`). The sheet renders `null` when closed (`DayDetailSheet.tsx:33`). The recording/transcribe pipeline is async (MediaRecorder `onstop` → transcribe → parse, `index.tsx:382-671`) and there is **no guard preventing the sheet from closing mid-session** — Escape, scrim-tap, or the × button all call `onClose` unconditionally. If Martita closes the sheet while "מקשיבה…"/"מעבדת…" is running, the recorder keeps going but the StatusPill, trace card, and any resulting VoiceCard confirmation are unmounted from view (VoiceCard is rendered as a sibling at `index.tsx:1230` and would still appear, but the in-progress status/trace inside the footer vanish). Result: a state where the app is recording/processing but shows no feedback — a silent state the senior-UX rules explicitly forbid. **NOT PROVEN — requires browser** to confirm exact visibility, but the unmount path is proven by code.
- **Evidence:** mic/status/trace only in sheet footer `index.tsx:1117-1167`; sheet returns null when closed `DayDetailSheet.tsx:33`; close is unconditional `DayDetailSheet.tsx:24,40,65`; async pipeline `index.tsx:382-671`. Cleanup effect stops the recorder only on full unmount of `AbuCalendar` (`index.tsx:749-755`), not on sheet close.
- **Blocks release?** YES until browser-verified. If closing the sheet during recording loses feedback, it must either block close while recording, or auto-reopen/relocate the status.
- **Fix:** Either disable sheet-close while `isRecording || voiceState !== 'idle'`, or stop the recorder + reset trace on sheet close, or surface the StatusPill outside the sheet during active sessions.

---

# MEDIUM

## RT-5 — `CURRENT_YEAR` captured once at module load; stale across a New-Year boundary (Papi memorial 01-01 most exposed)
- **Area:** Calendar-date integrity, birthday handling.
- **Risk:** `const CURRENT_YEAR = new Date().getFullYear()` runs once at module import (`familyEvents.ts:21`). `FAMILY_BIRTHDAYS`/`FAMILY_MEMORIALS` are also built once at import (`familyEvents.ts:76-77`). If the PWA is left open across Dec 31→Jan 1 (common for an always-on senior device), the base arrays keep last year's year. The view-year slice in `loadAppointmentsWithFamily` (`service.ts:352-359`, `${yr}-${b.date.slice(5)}`) re-bases the year on each call, so the *displayed* month is usually corrected — BUT any consumer that reads `FAMILY_BIRTHDAYS`/`FAMILY_MEMORIALS` directly without re-basing (AbuAI `getBirthdayFor`/`getMemorialFor` use only month/day, so OK; `findEventsByPerson` uses `loadAppointmentsWithFamily`, OK) gets a stale-year object. The memorial on 01-01 is the most exposed date for a New-Year-boundary mismatch.
- **Evidence:** `familyEvents.ts:21,76-77`; re-base `service.ts:352-359`.
- **Blocks release?** NO (re-base mitigates the visible calendar). Behavior across the exact boundary is **NOT PROVEN — requires browser/clock test**.
- **Fix:** Compute the year inside the build functions per-call, or always route through `loadAppointmentsWithFamily(viewYear)` (already the case for the grid). Low effort.

## RT-6 — Event list reachable ONLY by day-tap; cold-start discoverability for adding an event is weak
- **Area:** Senior usability failure modes.
- **Risk:** After the revolution the primary screen has no event list and no permanent ADD/mic. The ONLY ways to reach the list + ADD/mic are (a) tap a day cell, or (b) tap the glance (which only works when `nextEvent` exists — `index.tsx:876`). From a cold start with no upcoming events, the glance is non-interactive (`cursor:'default'`, no-op onClick) and shows "אין אירועים קרובים"; the ONLY path to add an event is to correctly infer that tapping a calendar day opens an action sheet. There is no visible "+"/mic on the primary screen and no label inviting the tap. The InfoButton guide explains it (`index.tsx:803-809`) but is behind a ⓘ. For an 80+ first-time user this is a discoverability cliff.
- **Evidence:** no primary ADD/mic (relocated to sheet footer `index.tsx:1135-1166`); glance no-op when empty `index.tsx:876` (`onClick={() => { if (nextEvent) {...} }}`, `cursor: nextEvent ? 'pointer' : 'default'`).
- **Blocks release?** NO, but it directly contradicts "one-tap access to core actions" and warrants product sign-off / browser usability check. **NOT PROVEN — requires usability observation.**
- **Fix:** Add a persistent, clearly-labeled ADD affordance to the primary screen (or make the empty-state glance tappable → opens today's sheet). Product decision.

## RT-7 — Adding an event for a different date than the open sheet's day silently navigates away under the sheet
- **Area:** ADD/manual/mic relocation, senior state feedback.
- **Risk:** Manual save and voice/auto-create both call `setSelectedDay(result.appointment.date)` to "jump to the new event" (`index.tsx:276, 535, 695`). But the `ManualModal`/voice flow can be launched from inside an open sheet for, say, May 27, while the user types a date of June 3. On save, `selectedDay` jumps to June 3 and `selectedAppts` (`index.tsx:225`) re-derives — so the still-open `DayDetailSheet` title (`formatShortHebrewDate(selectedDay)`) and its list silently change to a different day than the one the user opened. Combined with the success toast this is recoverable, but the sheet content mutating under the user is disorienting for the target user.
- **Evidence:** `setSelectedDay(result.appointment.date)` at `index.tsx:276,535,695`; sheet title/list bound to `selectedDay` `index.tsx:1114,1189-1201`.
- **Blocks release?** NO. **NOT PROVEN — requires browser** to confirm the visual.
- **Fix:** Either close the sheet on cross-date create, or keep the sheet pinned to its opened day and rely on the toast for the jump. Product/UX decision.

## RT-8 — No body/background scroll-lock while the bottom-sheet is open
- **Area:** Bottom-sheet layering/scroll.
- **Risk:** `DayDetailSheet` adds a fixed scrim (`DayDetailSheet.tsx:37-42`) and its own scroll region (`:77`), but nothing locks scrolling of the underlying `PageShell scrollable` body. With `RT-2` (primary can scroll), touch-dragging over the scrim area or rubber-banding can scroll the page behind the sheet on mobile Safari/Chrome. For a senior this manifests as "the calendar moved while I was reading the day."
- **Evidence:** no `document.body` overflow lock anywhere in `AbuCalendar`/`PageShell` (grep found none); `PageShell` scrollable `index.tsx:771`.
- **Blocks release?** NO. **NOT PROVEN — requires browser.**
- **Fix:** Lock body scroll (`overflow:hidden` on the shell) while `sheetOpen`, or make the primary shell non-scrollable (ties to RT-2).

## RT-9 — `findEventsByPerson` future-only date filter makes the AbuAI birthday test date-fragile
- **Area:** AbuAI regression.
- **Risk:** `findEventsByPerson` filters `a.date >= today` (`tools.ts:128-131`). The branch changed the test query from `'אופיר'` (Feb 15 — already past on the 2026-05-27 review date) to `'ארי'` (Nov 26 — still future) precisely so the date filter keeps a result (`tools.test.ts` diff + comment). This means the test only passes because of *when* it runs; for any "today" after Ari's birthday (late Nov) the assertion `r.events.length > 0` will fail. This is a latent flaky test baked in by the branch, and it signals that `findEventsByPerson` returns NOTHING for a person whose only event this year already passed — a real behavior gap (asking "מתי קבעתי משהו עם אופיר" in June returns empty even though Feb existed).
- **Evidence:** `tools.ts:128-131`; `tools.test.ts:108-114` diff.
- **Blocks release?** NO. Test correctness/CI fragility, not a Martita-facing blocker.
- **Fix:** Make the test deterministic (mock today, or assert on a recurring-future birthday independent of run date). Optionally reconsider the future-only filter for "events with person" queries.

---

# LOW

## RT-10 — Deterministic color hash collides 4 people onto one color (and Martita = same pink as 3 others)
- **Area:** Visual / non-color encoding.
- **Risk:** `colorFor(slug)` maps over 8 colors (`familyEvents.ts:14-31`). Reproducing the hash over the 13 slugs: `#FF6B9D` is shared by **mor, ofir, ari, Martita**; `#FFE66D` by **raphi, ayalon, papi**; `#60A5FA` by leo+adi; `#34D399` by noam+anabel. Color is therefore not a reliable identity signal. Mitigated because the grid encodes *type* by shape, not person by color (`index.tsx:1077-1102`), and birthdays are uniformly pink in the grid regardless — so collisions don't actually surface as confusion in the month view.
- **Evidence:** `familyEvents.ts:14-31`; computed collision set (script over the 8-color palette + 13 slugs).
- **Blocks release?** NO. Acceptance rationale: per design, color is not the sole or per-person indicator; shape carries type. Cosmetic only.

## RT-11 — Gold-on-dark small text and 0.45-alpha past indicators are likely marginal; no measured contrast (correctly, no AAA claimed)
- **Area:** Visual contrast claims.
- **Risk:** Several small-text tokens are gold on near-black: glance "הדבר הבא" label `TEXT_SECONDARY` 13px (`index.tsx:888`), alert sub-line `rgba(201,168,76,0.70)` 16px (`index.tsx:831`), alert-time selector 13px `rgba(201,168,76,0.55)` (`index.tsx:854`), holiday `#e8c76a` (`index.tsx:1185`), and past-event indicators at `rgba(245,240,232,0.45)` (`index.tsx:1081,1096`). The 0.45-alpha past text/dot and the 0.55-alpha selector are the most likely to fall below 4.5:1. The QA doc correctly does NOT claim AAA/measured pass — good Truth-Contract behavior.
- **Evidence:** the cited line numbers; QA §7 marks contrast NOT PROVEN.
- **Blocks release?** NO by itself, but the contrast measurement is a release gate per senior-UX rule (4.5:1 min). **NOT PROVEN — requires measurement.**
- **Fix:** Measure the listed tokens at 360×740; bump alphas on any below 4.5:1 (esp. the 0.45/0.55 ones).

## RT-12 — Glance date is rendered DD/MM via `split('-').reverse().slice(0,2).join('/')` — ambiguous and LTR-in-RTL
- **Area:** RTL/Hebrew layout, date expectations.
- **Risk:** The glance shows `${title} · ${date.split('-').reverse().slice(0,2).join('/')}` (`index.tsx:891`), e.g. `2026-06-03` → `03/06`. This is an LTR numeric token embedded in an RTL line with no `dir`/bidi isolation, and DD/MM vs MM/DD is ambiguous for a user who also reads Spanish. The full calendar elsewhere uses spelled Hebrew dates (`formatShortHebrewDate`), so this is an inconsistent, terse format on the most-glanced element.
- **Evidence:** `index.tsx:889-892`.
- **Blocks release?** NO. **Layout NOT PROVEN — requires browser** for the bidi rendering.
- **Fix:** Reuse `formatShortHebrewDate`/spelled month for the glance, or wrap the numeric date in a bidi-isolated span.

## RT-13 — Long Hebrew titles in the glance/ApptCard rely on ellipsis/flex-wrap; truncation not visually verified
- **Area:** RTL/Hebrew layout.
- **Risk:** Glance title uses `whiteSpace:'nowrap'` + ellipsis (`index.tsx:889`), so a long Hebrew title is clipped with "title · date" — the date can be pushed out of view or the title cut mid-word. In `ApptCard` the title + "עבר" pill sit in a `flexWrap:'wrap'` row (`ApptCard.tsx:66`), so a long title wraps and the "עבר" pill can drop to its own line, away from the title. Neither is broken, but neither is visually verified for realistic Hebrew lengths.
- **Evidence:** `index.tsx:889`; `ApptCard.tsx:66-78`.
- **Blocks release?** NO. **NOT PROVEN — requires browser.**

---

# FOLLOW-UP (acknowledged, must close before/at ship per gate)

## RT-14 — Bottom-sheet has no Tab focus-trap; focus can escape behind the scrim
- **Area:** Bottom-sheet focus.
- **Risk:** `DayDetailSheet` moves focus in and restores on close (`DayDetailSheet.tsx:20-31`) but Tab is not trapped (documented FU-4, `DayDetailSheet.tsx:8-9`, `FOLLOW_UPS.md:25-29`). A keyboard/switch-access user can Tab out to the (inert-looking but still focusable) primary controls behind the scrim, with `aria-modal="true"` lying about modality. Lower real-world risk for a touch-only senior, but it is an accessibility gap shipped knowingly.
- **Evidence:** `DayDetailSheet.tsx:8-9,20-31`; `FOLLOW_UPS.md:25-29`.
- **Blocks release?** NO (documented deferral). Acceptance rationale: target user is touch-only; tap/Escape/scrim close work. Close before any keyboard-nav audience.

## RT-15 — No automated render/interaction test for the sheet (no jsdom); all sheet behavior is NOT PROVEN
- **Area:** Release readiness.
- **Risk:** Per FU-4 and QA caveat, the repo has no jsdom/@testing-library, so sheet open/close, focus, Escape, scrim-click, own-scroll, reduced-motion, alert reflow, glance tap, and no-scroll fit have **zero automated coverage** and are NOT PROVEN. The entire interaction surface of the revolution rests on un-run Phase-7 manual browser QA.
- **Evidence:** `FOLLOW_UPS.md:29`; `CALENDAR_QA.md:6-11,167-178`.
- **Blocks release?** YES at the process level — a documented Phase-7 browser QA pass (no-scroll, sheet, focus, alert reflow, contrast, glance) MUST be completed and recorded before shipping to Martita. The branch itself proves none of it.

## RT-16 — PWA stale-build risk after deploy (precache); version visibility
- **Area:** Service worker / PWA.
- **Risk:** Build generates `dist/sw.js` with workbox precache (QA §1: "25 precache entries"). On an always-open senior device, a precaching SW can serve the previous calendar until all tabs close + SW activates; without skipWaiting/clientsClaim or an update prompt, Martita may run the old calendar after deploy. The version is bumped to `0.4.18-calendar-revolution` (`version.ts:15`) and shown via main.tsx console + Settings/About (`version.ts` header comment), but the console/About badge is operator-facing, not a user-visible "update available" cue.
- **Evidence:** `version.ts:13-20`; QA §1 SW/precache note. SW update strategy **NOT VERIFIED in this review** (vite/workbox config not inspected here — NOT PROVEN).
- **Blocks release?** NO, but operator must confirm the SW update strategy (skipWaiting / update toast) so the new calendar actually reaches her.
- **Fix:** Confirm/enable an update-on-reload or update-prompt strategy; verify the bumped version surfaces where the operator checks.

---

## Single most important release blocker
**RT-1** — the deceased husband Papi is shown a celebratory 🎂 "יום הולדת" event
(and AbuAI states his birthday), a dignity/emotional-accuracy failure now locked
in by `familyEvents.test.ts`. Fix the deceased-exclusion and the test before ship.

## Truth-Contract note on this report
Every "PROVEN by code" claim cites file:line. Everything depending on rendering,
real layout, contrast measurement, sheet interaction, or clock boundary is marked
**NOT PROVEN — requires browser**. No "fixed/working/passes" claims are made about
the branch. typecheck and the three targeted test files were run read-only and
passed; memory/ was not touched (no build run). No commit, no push.
