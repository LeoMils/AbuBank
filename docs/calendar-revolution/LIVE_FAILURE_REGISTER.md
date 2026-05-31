# Live Failure Register — Universe-War Mode

Single source of truth for failures observed during live operator/browser QA
on `feat/calendar-revolution`. Each entry includes severity, suspected layer,
fix status, and the test or QA step that pins it.

Status legend:
- `PROVEN_BY_TEST` — automated assertion runs and passes
- `PROVEN_BY_BROWSER_QA` — verified live in browser
- `STATIC_ONLY` — source/grep evidence only, not executed
- `NEEDS_MANUAL_QA` — fix is in code; live mic verification pending
- `FOLLOW_UP` — known limitation, not in scope this run
- `BLOCKER` — open issue, must be addressed before Martita release

---

## F-1 — Static build marker confusion (`VOICE_RESET_ACTIVE_*`)

- **Severity**: Medium (operator confusion, not user-facing)
- **Symptom**: Browser showed `VOICE_RESET_ACTIVE_614F33D` while HEAD was newer.
  The marker was a hard-coded string, not derived from `APP_VERSION` or git SHA,
  so it never updated.
- **Suspected layer**: `src/screens/AbuCalendar/index.tsx` UI surface.
- **Fix**: Removed both `VOICE_RESET_ACTIVE_8987215` and
  `VOICE_RESET_ACTIVE_614F33D` strings. Replaced with a dev-only
  `data-testid="dev-version-badge"` showing
  `v{APP_VERSION.version} · {commitHint || 'local build'}`.
- **Regression guards**:
  - `voiceAddFlow.test.tsx` — asserts both old markers absent + badge present.
  - `calendarAddSurface.test.tsx` — asserts dev-version-badge mounted and contains `APP_VERSION.version`.
- **Status**: `PROVEN_BY_TEST` — 2433/2433 green.

---

## F-2 — "מחר בחצות פגישה עם אופיר" parsed without time/date

- **Severity**: High (a real product sentence Martita uses).
- **Symptom**: Speaking the sentence yielded a draft with no time and no date.
- **Suspected layer**: `localParser.ts` `extractTime`. "חצות" had no path to
  `00:00`; numeric branches misread the surrounding context.
- **Fix**: Added `MIDNIGHT_RE` and a first-branch midnight check in `extractTime`
  before any numeric/word patterns can interfere.
- **Coverage**:
  - `localParser.test.ts` — 10 חצות tests + 4 night-hint regression tests.
  - `voicePipelineGolden.test.ts` — new `"מחר בחצות פגישה עם אופיר"` hard pin
    (intent=appointment, date=tomorrow, time=00:00).
- **Status**: `PROVEN_BY_TEST`. Live mic verification: `NEEDS_MANUAL_QA`.

---

## F-3 — Missing-time reminder flow had no visible save path

- **Severity**: High (user could complete the time choice but UI offered no save).
- **Symptom**: After tapping `בעוד שעה` / `היום בערב` / `מחר בבוקר` /
  `לבחור שעה`, the save button was hidden behind `hasAmbiguousTime`.
  `לבחור שעה` also pushed `'manual'` to the parent which then called
  `Date.setHours(NaN)` and silently broke the flow.
- **Fix**:
  - `ReminderConfirmCard` now intercepts `'manual'` and flips to correcting mode
    where the time input is editable.
  - `canSave` extended with a `canSaveCorrecting` branch so save is reachable
    once `editTime` is filled.
  - Parent (`index.tsx`) `onResolveTime` returns early on `'manual'` — no NaN.
- **Coverage**:
  - `liveQaBlockers.test.tsx` BLOCKER 1 — 4 tests pinning button visibility
    and the no-throw guard.
- **Status**: `PROVEN_BY_TEST`. Live mic verification: `NEEDS_MANUAL_QA`.

---

## F-4 — Friend/person relations ("חברה של מור") were dropped silently

- **Severity**: High. Without acknowledgement the user could not tell whether
  the system understood the phrase at all.
- **Suspected layer**: `familyResolve.ts`. The KIND regex excluded
  `חבר`/`חברה`, so `extractPersonPhrase` returned `null` and no missing-relation
  card ever appeared.
- **Fix**:
  - Extended `KIND` regex with `חברה|חבר`.
  - Added a `FRIEND_KIND` set causing an immediate `{status: 'missing', phrase}`
    return — friends are never invented from the family graph.
- **Coverage**:
  - `liveQaBlockers.test.tsx` BLOCKER 2 — 6 tests covering extraction,
    missing-status, ConfirmCard rendering, ReminderConfirmCard rendering, and
    a regression guard that "הבעל של אופיר" still resolves to גלעד.
  - `voicePipelineGolden.test.ts` — new
    `"תזכירי לי להתקשר לחברה של מור בערב"` hard pin.
- **Status**: `PROVEN_BY_TEST`. Live mic verification: `NEEDS_MANUAL_QA`.

---

## F-5 — Mic capture had no operator visibility

- **Severity**: Medium (operator/QA workflow only; not user-facing).
- **Symptom**: Operator had no way to see raw transcript, normalized
  transcript, route, or parsed fields without DevTools paste.
- **Fix**:
  - `VoiceDebugPanel.tsx` — operator-only panel gated on
    `localStorage['abu-voice-debug']==='true'`. Shows raw / normalized / route
    / date / time / person. Hidden by default.
  - `VoiceDebugToggle` — tiny dev-only "QA" button mounted in the corner of
    the calendar screen. One tap flips the localStorage flag — no DevTools
    needed. Renders `null` in production builds (`import.meta.env.DEV === false`).
- **Coverage**:
  - `liveQaBlockers.test.tsx` BLOCKER 3 — 5 tests: hidden-by-default,
    visible-when-enabled, ignored-on-non-true-values, draft-preferred-over-trace,
    and toggle-button-shape.
- **Status**: `PROVEN_BY_TEST`. Operator usability: `NEEDS_MANUAL_QA`.

---

## F-6 — "רבע ל" (quarter-to) Hebrew time pattern was unsupported

- **Severity**: Medium. Common Hebrew phrasing for "9:45" was silently
  misinterpreted as 10:00 by the bare-word hour branch.
- **Fix**: Added two regex branches at the top of `extractTime`:
  - `רבע ל<hour-word>` → `(hour−1):45`
  - `רבע ל-<digit>` numeric form
- **Coverage**: 7 new tests in `localParser.test.ts` covering
  `רבע לעשר בערב` → 21:45, `רבע לעשר בבוקר` → 09:45,
  `רבע לשבע בערב` → 18:45, edge `רבע לאחת בלילה`, the numeric form,
  plus two regression guards for `עשר ורבע בבוקר` and `בעשר בבוקר`.
- **Status**: `PROVEN_BY_TEST`. Live mic: `NEEDS_MANUAL_QA`.

---

## F-7 — Reminder delivery when app/tab is closed

- **Severity**: High for medication reminders, but **out of scope** this run.
- **Symptom**: Reminders are checked via setInterval inside a React tree.
  When the tab is backgrounded or the browser is closed, the interval is
  paused / killed by the OS.
- **Status**: `FOLLOW_UP` (documented in `RELIABILITY_REALITY_CHECK.md`).
  Real fix requires Service Worker + Push + IndexedDB and (likely) VAPID
  + a tiny server. Out of scope here; no new dependencies allowed.
- **User-facing rule**: Do NOT claim closed-app reliability in UI copy.
  Internal docs only.

---

## F-8 — UI/UX feels "technical" rather than "premium calm"

- **Severity**: Medium-product. Cards already use Hebrew titles
  `הבנתי` (appointment) and `אני אזכור בשבילך` (reminder).
- **Decision this run**: Hold broad per-state title redesign
  (`רק חסרה לי שעה`, `לא מצאתי את האדם בוודאות`, etc.) because changing
  visible copy risks breaking existing snapshot/text assertions across
  ~108 test files, and the war-room mandate says
  "preserve existing working behavior" + "no broad redesign".
- **What is already in place**:
  - "הבנתי" header (appointment + reminder).
  - "לא מצאתי בוודאות מי …" message for missing-person.
  - "למי התכוונת?" for ambiguous-person.
  - "נשמר ביומן" saved state.
- **Status**: `FOLLOW_UP` for per-state distinct titles. Current copy is calm
  and senior-readable; structural redesign deferred.

---

## Layer × Severity map

| Layer | Open | Fixed this run | Follow-up |
|---|---|---|---|
| Voice capture | — | F-5 panel + toggle | mic-noise/Whisper params |
| Hebrew NLP / time | — | F-2 חצות, F-6 רבע ל | extra dialect coverage |
| Routing | — | (none new) | covered by 30 golden + 4 phase-4 pins |
| Family graph | — | F-4 friends | phrase corpus expansion |
| Calendar create | — | (none new) | — |
| Reminder create | — | F-3 save path | — |
| Confirmation UX | — | (copy unchanged) | F-8 distinct per-state titles |
| Senior-first UI | — | (copy unchanged) | F-8 visual hierarchy pass |
| AbuAI boundary | — | (no change) | static review only |
| Background delivery | F-7 | — | SW/Push/IndexedDB |

---

## Exit checklist for this run

- [x] All baseline tests green (2433/2433 before changes).
- [x] All new tests green.
- [x] No `--no-verify`. No deleted/weakened tests.
- [x] No `package.json` changes.
- [x] No `family_data.json` changes.
- [x] `memory/*` timestamp-only diffs restored before commit.
- [x] Branch unchanged: `feat/calendar-revolution`.
- [ ] Live mic browser QA — `NEEDS_MANUAL_QA` (operator step,
      see `MARTITA_BROWSER_QA_SCRIPT.md`).
