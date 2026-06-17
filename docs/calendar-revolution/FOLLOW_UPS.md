# Calendar Revolution — Follow-ups (deferred work)

Items intentionally OUT OF SCOPE for the current revolution, captured so they are not lost.

## FU-1 — One-tap "add bill as reminder" from services/bills
- **Why deferred:** Phase 0 §8 found NO due-date / billing-cycle data model in the codebase. `Home/data.ts` `Service` (`{id,label,url,color,logo,bgColor}`) carries no date/amount/dueDate field; the only billing references are decorative rotating copy strings in `MSGS`/`getDailyMsg`, not structured data.
- **Prerequisite:** a new per-service due-date data model (e.g. billing cycle / next-due date per service), defined with source-of-truth discipline and no financial-detail leakage (privacy-boundaries rule forbids storing financial details).
- **Then:** a one-tap "הוסיפי כתזכורת" affordance on the service launcher that creates a calendar reminder via the existing `createAppointmentSafe` path.
- **Status:** future work — requires data model first. Not started.

## FU-2 — Yarden & Sharon birthdays missing from source of truth
Yarden and Sharon birthdays existed in the old hard-coded list (`service.ts` `FAMILY_BIRTHDAYS`: Yarden `10-12`, Sharon `09-11`) but are missing from `knowledge/family_data.json`. Need verified dates before restoring.
- **Decision (ACCEPT-2):** do NOT invent dates; do NOT keep stale hard-coded dates. Drop Yarden and Sharon from the birthday runtime output until verified dates are added to `knowledge/family_data.json` through the proper validated flow (edit JSON → `npm run generate:memory`). Calendar-date integrity outranks preserving stale hard-coded data.
- **To restore:** add `birthday` (`MM-DD`) to the respective entries in `family_data.json` (Yarden in `grandchildren_spouses[]`, Sharon in `close_friends[]`), regenerate memory, and they will flow through the source-of-truth path automatically.
- **Status:** dropped pending verified dates. Not invented.

## FU-3 — People in family_data.json with NO birthday field (missing data, NOT deleted)
As of the JSON-backed migration (Chunk 6.1), these family members exist in `knowledge/family_data.json` but carry no `birthday`, so they produce no birthday event. They are **present as people** — this is **missing birthday data, not a deletion**:
- **Yael** (`children_related[]`, partner of Mor) — no `birthday`.
- **Gilad** (`grandchildren_spouses[]`, spouse of Ofir) — no `birthday`.
- **Mirta**, **Shoshana** (`close_friends[]`) — no `birthday`.
- (Yarden, Sharon — see FU-2.)
To add a birthday event for any of them: add a verified `birthday` (`MM-DD`) to their entry in `family_data.json` and run `npm run generate:memory`. Do not invent dates.

## FU-4 — Bottom-sheet (Chunk 6.3) deferred extras
The `DayDetailSheet` ships the minimum safe accessible version: `role="dialog"`/`aria-modal`, Escape-to-close, scrim + close-button close, focus moved into the sheet on open and restored on close, slide-up motion with `prefers-reduced-motion` honored. Deferred (not overbuilt this chunk):
- **Full Tab focus-trap** (cycle focus within the panel). Today focus is moved in and restored, but Tab can still leave the panel.
- **Swipe-down-to-close** gesture (grip is present; only tap/Escape/scrim close today).
- **`DayDetailSheet.test.tsx` render test:** the repo has no `jsdom`/`@testing-library/react` and vitest runs in `node`, so a DOM-render test can't run without adding test infra (a `package.json` change → re-gate). The sheet is currently covered by typecheck + build + Phase 7 browser QA. Add the render test if/when test infra is approved.

## FU-5 — RELEASE-GATE: no-scroll primary not enforced (Red Team RT-2)
The primary calendar still renders inside `<PageShell scrollable>` (`index.tsx:771`), so the "no scroll on primary screens" product principle is **structurally unguaranteed**. It cannot be honestly proven here (no browser). **Release gate:** browser-measure the primary at 360×740 with 2 active alert insets. If it fits, document the measured proof and consider switching this `PageShell` to non-scrollable to lock the invariant; if it overflows, redesign (brief rule: "redesign — don't add scroll", e.g. shorter alert insets / collapsed alert-time selector). Do NOT claim no-scroll until measured.

## Red Team remediations applied (Phase 8)
- **RT-1 (Critical) — fixed:** the deceased husband's birthday now renders as a candle remembrance (🕯️, `type:'memory'`, gold), never a 🎂 cake — `familyEvents.ts buildFamilyBirthdays`. Kept in the array (not a separate memorial) so AbuAI `getBirthdayFor` still resolves the month name; guarded by `familyEvents.test.ts` ("RT-1" test).
- **RT-3 (High) — fixed:** legacy event-id slugs preserved (`eili→bday-ilai`, `ayalon→bday-eylon`) so already-dismissed alerts don't re-fire after deploy — `familyEvents.ts LEGACY_BDAY_ID`.
- **RT-4 (High) — fixed:** the day-sheet cannot be closed while a voice recording is active (`index.tsx` onClose guard `if (isRecording) return`), preventing an orphaned/silent processing state.
- **RT-2 (High) — carried to browser QA** as FU-5 above (cannot be proven here).

## (candidate, not yet approved) Other Phase-0 §9 abilities held back
- Unified AbuAI voice-contract adapter (`{rawTranscript, contextDate, locale} → {status, reminder?, confidence, alternatives?, failureReason?}`).
- Recurring user reminders (medication, weekly calls) — `isRecurring` field exists but is family-only today.
- Shabbat/holiday-aware scheduling nudges (holiday table already present).
These remain audit candidates only; not in the current operator-approved scope.
