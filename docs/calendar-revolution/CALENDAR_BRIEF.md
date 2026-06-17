# CALENDAR_BRIEF — Phase 1

Branch: `feat/calendar-revolution` (base `feat/abuwhatsapp-local-family-contacts` @ 6a91ac5)
Inputs: `CALENDAR_AUDIT.md` (Phase 0), CLAUDE.md + project rules, operator ACCEPT-0 scope decision.
Status: Brief written — awaiting ACCEPT-1. No production code. Nothing pushed.

---

## 1. Mission (one sentence)

Make AbuCalendar a calm, no-scroll, senior-first surface where the three moments — **ADD**, **SHOW**, **ALERT** — never visually collide, while preserving the mature voice-create reliability already in place.

## 2. Who this is for

Martita, 80+, non-technical, Kfar Saba. Hebrew UI throughout (RTL), Rioplatense Spanish where spoken. Readability beats aesthetics; premium but calm. She must always know what the app is doing, and a newly added event must be immediately visible — never hidden behind chrome.

## 3. Problem statement (grounded in Phase 0)

The voice/create reliability layer is mature and is NOT the gap (audit §9). The open problems are layout and real-estate:

- **PP-1 — added events covered.** Primary cause is the sticky blurred footer drawing over the bottom of a height-capped (`maxHeight:200`) event list with no spacer (audit §6c, `index.tsx:1054`, `index.tsx:1089-1097`), plus a `position:fixed` alert banner overlaying the top chrome (audit §6a, `index.tsx:762`). The iOS border-radius+overflow repaint theory remains an UNPROVEN device hypothesis (audit §6d) — not assumed as a cause.
- **PP-2 — ADD affordances eat the screen.** The footer stacks StatusPill + a full always-on VoiceTraceCard + a manual-add button + a 60px mic, occupying up to ~40% of vertical height and permanently consuming the bottom band even when idle (audit §5 PP-2, `index.tsx:1099-1151`).
- **No-scroll-on-primary violated.** `PageShell scrollable` plus a nested `overflowY:auto` list create two scrolls on a primary screen, against CLAUDE.md (audit H1).
- **Touch/contrast/indicator gaps.** Day cells `minHeight:54` (< 56pt rec), sub-AAA contrast on muted labels, color-only event dots (audit H4/H6/H7).
- **Governance drift.** Family birthdays/memorials are hard-coded in `service.ts:344-372` instead of being read from `knowledge/family_data.json`, contradicting CLAUDE.md source-of-truth rule (audit §3).

## 4. In scope (operator-confirmed, ACCEPT-0)

- **(a) Bottom-sheet day-detail that owns its own scroll** — resolves PP-1 + PP-2 together by moving the event list and ADD affordances into a sheet that is layered above primary chrome and cannot be covered by it.
- **(b) No-scroll-on-primary redesign** — the primary calendar view (month grid + glance) fits without page scroll on a 360×740 viewport.
- **(c) Day cells ≥56pt + non-color-only event indicators** — meet the senior-UX target and pair every color with a shape/text cue.
- **(e) Read family birthdays from `knowledge/family_data.json`** — replace hard-coded `FAMILY_BIRTHDAYS` with the source of truth, under Truth Contract discipline and with NO private-data leakage (no phone/street/medical/financial; abstract roles only, per privacy-boundaries rule).

## 5. Out of scope now (deferred)

- **(d) One-tap "add bill as reminder" from services/bills.** No due-date data model exists today (audit §8 — `Home/data.ts` `Service` has no date/dueDate field). Recorded in `FOLLOW_UPS.md` as future work requiring a new per-service due-date data model.
- Also explicitly deferred: AbuAI unified voice-contract adapter (§7 target contract), recurring user reminders, Shabbat/holiday scheduling nudges. These remain audit candidates, not this revolution's scope.

## 6. Non-negotiable constraints

- **No production code before ACCEPT-5.** Phases 1–5 are docs/decisions only.
- **Preserve Abu AI.** The calendar consumes read-only AbuAI exports (audit §7); do not modify AbuAI sources to serve calendar changes.
- **Raw transcript never displayed to Martita.** Abu AI is the corrective layer; the un-normalized ASR string must not surface as user-facing copy.
- **Truth Contract.** `createAppointmentSafe` round-trip stays the single write path for new events (audit §3); no claim of "fixed/working" without an actual passing assertion.
- **Preserve the four bottom-bar screens.** Out of bounds unless a chunk explicitly scopes them; this revolution does not touch them.
- **Source-of-truth.** Family data reads from `knowledge/family_data.json`; `memory/*` files are auto-generated and must not be hand-edited.
- **Hebrew/RTL + 80+ usability** are mandatory acceptance dimensions, not nice-to-haves.
- **Focus:** AbuCalendar app improvement, not infrastructure.

## 7. Success criteria (what "done" must demonstrate, with evidence)

1. On 360×740, the primary calendar view requires **no page scroll**; a newly added event is **visible without being covered** by footer/banner chrome (PP-1 resolved).
2. The ADD affordances no longer permanently consume the bottom band; they live in the day-detail sheet (PP-2 resolved).
3. Day cells render **≥56pt** with **≥12pt** spacing; event types carry a **non-color** cue in addition to color.
4. Family birthdays render from `knowledge/family_data.json` with **no** hard-coded family data remaining in `service.ts`, and **no** private fields (phone/street/medical/financial) read or displayed.
5. Voice create path and the safe-create round-trip behave **exactly as before** (no regression in `createAppointmentSafe` semantics or the 8-action pipeline).
6. `npm run typecheck`, `npm test`, `npm run build` (+ `npm run lint` if present) all pass; UI behavior verified in-browser at the relevant viewport before any "done" claim.
7. Version number incremented and displayed (CLAUDE.md rule).

## 8. Open questions for the operator (Phase 1 gate)

- **Q1.** Does `knowledge/family_data.json` already contain the birthday fields needed for (e), or will Phase 4 Integration Intelligence need to map/derive them? (Will confirm the actual file shape in Phase 2/4 before any code.)
- **Q2.** For the bottom-sheet (a): preferred trigger — tap a day cell opens the sheet (replacing the inline selected-day list), with mic/manual living inside the sheet? Or keep a minimal always-visible ADD entry on the primary view?

---

*End of Phase-1 Brief. No source files other than docs deliverables were modified.*
