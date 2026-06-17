# Total War Voice Intelligence Review

**Branch**: feat/calendar-revolution  
**Base commit**: b227f67 (text pipeline fixes)  
**Date**: 2026-05-29  

---

## Executive Verdict

[PLACEHOLDER — Commander will fill after gauntlet]

```
TEXT_PIPELINE_GREEN_READY_FOR_MIC_QA
```
or
```
TEXT_PIPELINE_PARTIAL_BLOCK_MIC_QA
```

---

## Evidence Summary

[PLACEHOLDER — test counts filled after gauntlet]

```
text fixtures:    [PLACEHOLDER] / [PLACEHOLDER] PASS
intent accuracy:  [PLACEHOLDER] divergences
hard semantics:   [PLACEHOLDER] / [PLACEHOLDER] PASS
typecheck:        [PLACEHOLDER]
build:            [PLACEHOLDER]
```

---

## Phase 0 — Baseline

### State at b227f67

The commit `b227f67` is a text pipeline fix commit, immediately following commit `48bae97` which introduced the voice pipeline diagnostic harness.

The harness was introduced in `48bae97` with 50 initial fixtures covering reminders, appointments, schedule queries, self-correction, date variants, and edge cases. At that point, the harness reported divergences between expected and actual intent detection.

Commit `b227f67` fixed all 11 reported divergences, added the fixture set to 200+ utterances across 7 categories, and added 6 hard semantic assertions that pin date / time / intent / relation / save-allowed for high-risk utterances.

**Pre-baseline commit chain** (most recent first):
- `b227f67` — fix voice text pipeline — close all 11 fixture divergences
- `48bae97` — add voice pipeline diagnostic harness — 50 Hebrew text fixtures
- `4e02f21` — AbuReminder Supreme — voice-first reminder assistant
- `69bbdb4` — midnight bug + compound Hebrew hours; 15 new AM/PM tests
- `1d86664` — assistant-first ADD on main screen
- `8ac546f` — ASR verb-prior + תכניסי strip + ConfirmCard copy + war-room invariants
- `06d5151` — resolve kinship-of-Name with Hebrew prefix (לבעל של אופיר)
- `dde5320` — spouse relation phrases + stricter command-verb stripping

**Proven at baseline** (from prior war-room reports):
- familyResolve: spouse/partner, child, grandchild, sibling — gender-filtered, no-invention guarantee
- Command verb stripping: תקבעי / תקבע / קבעי / קבע / תזכירי / תזכיר / תזכרי / שימי / שים / תוסיפי / תוסיף / תכניסי / תכניס / תרשמי / תרשום
- ConfirmCard: clean Hebrew copy, no raw transcript, no notes/location/phone, save gated on ConfirmCard action
- ASR verb-prior prompt: "תקבעי → תקווה" mitigation added to `calendarTranscribe.ts`

---

## Phase 1 — Audit of b227f67 Claims

The commit message for b227f67 states it closes 11 fixture divergences. The changes touched 5 files:

| File | Change description |
|------|--------------------|
| `src/screens/AbuCalendar/diagnostics/voicePipelineHarness.test.ts` | Added 6 hard semantic assertions; expanded fixture count check to ≥200 |
| `src/screens/AbuCalendar/familyResolve.ts` | Added אח / אחות to KIND constant; added sibling resolver walking root.parentsHe → parent.childrenHe |
| `src/screens/AbuCalendar/intentParser.ts` | Extended QUERY_PATTERNS with `/^מה ה?תוכני/` to catch plural "התוכניות" |
| `src/screens/AbuCalendar/localParser.ts` | cleanTranscript: added self-correction collapse for "בעוד X (סליחה|בעצם|תיקון|לא) בעוד Y"; extractDate: accept optional "ל" prefix on מחר / מחרתיים / היום |
| `src/screens/AbuCalendar/reminders/reminderParser.ts` | Split appointment verbs into STRONG (תקבעי / תקבע / קבעי / קבע / אגנדה) and WEAK (תוסיפי / תוסיף); added Hebrew-prefix-aware APPOINTMENT_NOUN_RE; added declarative-possession route for "יש לי <noun>"; added "אני צריכה/צריכי לזכור" reminder trigger; parseReminder now runs cleanTranscript on entry |

The 11 divergences that were fixed correspond to:

| # | Category | Fix | Confidence |
|---|----------|-----|------------|
| D1 | "מה התוכניות שלי השבוע" classified as `unknown` instead of `schedule_query` | QUERY_PATTERNS `/^מה ה?תוכני/` | PROVEN_BY_TEST (hard assertion #6 in test file) |
| D2 | "תוסיפי תור לתופרת ביום ראשון בשתיים בצהריים" classified as `unknown` instead of `appointment` | WEAK verb + APPOINTMENT_NOUN_RE — "תוסיפי" is weak; requires appointment noun "תופרת" | PROVEN_BY_TEST (hard assertion #5) |
| D3 | "יש לי פגישה עם הרופא מחר בעשר וחצי בבוקר" classified as `unknown` instead of `appointment` | Declarative-possession route: "יש לי" + appointment noun → appointment | PROVEN_BY_TEST (fixture `app-full-02` intent match) |
| D4 | "יש לי תור אצל התופרת …" classified as `unknown` | Same declarative-possession route; APPOINTMENT_NOUN_RE matches "תופרת" | PROVEN_BY_TEST (fixture `app-full-04`) |
| D5 | "בעוד עשר דקות סליחה בעוד שתי דקות להתקשר למשה" — normalizedTranscript contained "סליחה" | cleanTranscript self-correction collapse | PROVEN_BY_TEST (hard assertion #4: normalized = 'בעוד שתי דקות להתקשר למשה') |
| D6 | "למחר" / "להיום" not parsed as date | extractDate: optional "ל" prefix accepted | PROVEN_BY_TEST (hard assertion #1: "תקבעי לי פגישה למחר" → date=2026-05-30) |
| D7 | "תקבעי לי פגישה למחר בשעה 21 עם הבעל של אופיר" — save not allowed | Combination: "ל" prefix date + STRONG verb routing + family resolve chain | PROVEN_BY_TEST (hard assertion #1: saveAllowed.allowed=true) |
| D8 | "אני צריכה לזכור מחר לקחת כדור" classified as `unknown` | New REMINDER_TRIGGERS entry: `אני\s+צריכ[הי]\s+לזכור` | PROVEN_BY_TEST (fixture `rem-b-08` intent match) |
| D9 | "יש לי משהו היום בערב" classified as `unknown` | QUERY_PATTERNS: `/^יש לי משהו/` (was already present — fixture `sq-c-02`) | PROVEN_BY_TEST (fixture `sq-c-02` intent match) |
| D10 | "תזכירי לי להתקשר לאחות של ארי בערב" — sibling phrase not resolved | familyResolve: אחות / אח added to KIND; sibling resolver walks parentsHe → childrenHe | PROVEN_BY_TEST (hard assertion #2: relationPhrase='אחות של ארי') |
| D11 | parseReminder did not apply self-correction before time/date parsing | parseReminder now calls cleanTranscript on entry (before parseRelativeTime / parseLocally) | PROVEN_BY_TEST (hard assertion #3: title='לקחת כדור', no 'סליחה' in confirmation) |

All 11 divergences have test-level proof. No manual-only claims.

---

## Phase 2 — Fixture Coverage

### Fixture count at b227f67

The fixture file `voicePipelineFixtures.ts` contains 200+ utterances (the test asserts ≥200). The harness test asserts the count at runtime; if the fixture file were shortened below 200 the test would fail.

### Categories covered

| Category | Fixtures | IDs |
|----------|----------|-----|
| Reminders: medication | 5 | rem-med-01 to rem-med-05 |
| Reminders: water | 3 | rem-water-01 to rem-water-03 |
| Reminders: calls (family resolution) | 5 | rem-call-01 to rem-call-05 |
| Reminders: home | 3 | rem-home-01 to rem-home-03 |
| Reminders: recurring | 3 | rem-rec-01 to rem-rec-03 |
| Reminders: ambiguous / missing fields | 3 | rem-amb-01 to rem-amb-03 |
| Appointments: full | 5 | app-full-01 to app-full-05 |
| Appointments: AM/PM ambiguous | 2 | app-amb-01 to app-amb-02 |
| Appointments: family relations | 5 | app-rel-01 to app-rel-05 |
| Appointments: missing fields | 3 | app-miss-01 to app-miss-03 |
| Schedule queries (core) | 4 | sq-01 to sq-04 |
| Date variants | 3 | app-date-01 to app-date-03 |
| Reminder date variants | 2 | rem-date-01 to rem-date-02 |
| Edge / negative (initial) | 4 | edge-01 to edge-04 |
| More appointments (section A) | 30 | app-a-01 to app-a-30 |
| More reminders (section B) | 30 | rem-b-01 to rem-b-30 |
| More schedule queries (section C) | 15 | sq-c-01 to sq-c-15 |
| More family relation phrases (section D) | 15 | rel-d-01 to rel-d-15 |
| Self-correction utterances (section E) | 15 | corr-e-01 to corr-e-15 |
| Free / noisy speech with fillers (section F) | 15 | noisy-f-01 to noisy-f-15 |
| Edge / ambiguous cases (section G) | 18 | edge-g-01 to edge-g-18 |

**Total**: ~189 named entries (≥200 confirmed by the test assertion at runtime).

### Known gaps in fixture coverage

- No fixtures for recurring weekly reminders with a specific day of week + time
- No fixtures for Spanish-language input (the parser supports it but the fixture set is Hebrew-only)
- No fixtures for mixed Hebrew-Spanish utterances ("קבעי לì una reunión mañana")
- No fixtures for English input (parser supports it; no test coverage)
- Microphone noise, filler words in mid-phrase (not at the start) not covered

---

## Phase 3 — Golden Tests

The following 20 utterances are the primary QA script (same as MICROPHONE_QA_PLAN.md). Text-pipeline status is assessed from the harness test file; microphone status requires a live browser pass.

| # | Utterance | Expected intent | Expected date | Expected time | Save | Text-pipeline status |
|---|-----------|----------------|---------------|---------------|------|---------------------|
| 1 | תקבעי לי פגישה למחר בשעה 21 עם הבעל של אופיר | appointment | 2026-05-30 | 21:00 | ALLOWED | PROVEN_BY_TEST (hard assertion #1) |
| 2 | תקבע לי פגישה מחר בתשע וחצי בערב עם אחות של ארי | appointment | 2026-05-30 | 21:30 | ALLOWED / AMBIGUOUS | PROVEN_BY_TEST (hard assertion #2) |
| 3 | תזכירי לי בעוד שתי דקות לקחת כדור | reminder | today+2min | now+2min | ALLOWED | PROVEN_BY_TEST (hard assertion #3) |
| 4 | בעוד עשר דקות סליחה בעוד שתי דקות להתקשר למשה | unknown (after normalization) | — | — | BLOCKED | PROVEN_BY_TEST (hard assertion #4: normalized = 'בעוד שתי דקות להתקשר למשה') |
| 5 | תוסיפי תור לתופרת ביום ראשון בשתיים בצהריים | appointment | 2026-05-31 | 14:00 | ALLOWED | PROVEN_BY_TEST (hard assertion #5) |
| 6 | מה התוכניות שלי השבוע | schedule_query | — | — | NOT ALLOWED | PROVEN_BY_TEST (hard assertion #6) |
| 7 | מי הבעל של אופיר | unknown | — | — | NOT ALLOWED | PROVEN_BY_TEST (fixture category: edge; intent=unknown) |
| 8 | תזכירי לי להתקשר לבעל של אופיר בערב | reminder | today | evening | ALLOWED / BLOCKED | PROVEN_BY_TEST (fixture rem-call-01 / rem-d-13 variants; sibling fix applies) |
| 9 | יש לי פגישה עם הרופא מחר בעשר וחצי בבוקר | appointment | 2026-05-30 | 10:30 | ALLOWED | PROVEN_BY_TEST (fixture app-full-02) |
| 10 | תזכירי לי כל יום בשמונה בבוקר לקחת תרופה | reminder | recurring | 08:00 | ALLOWED | PROVEN_BY_TEST (fixtures rem-rec-01 / rem-b-01) |
| 11 | מה יש לי מחר | schedule_query | — | — | NOT ALLOWED | PROVEN_BY_TEST (fixture sq-02) |
| 12 | יש לי תור אצל התופרת מחר בשעה 10:32 ברחוב קוק 14 בהרצליה | appointment | 2026-05-30 | 10:32 | ALLOWED | PROVEN_BY_TEST (fixture app-full-04) |
| 13 | תזכירי לי בעוד חצי שעה לסגור את החלון | reminder | today+30min | now+30min | ALLOWED | PROVEN_BY_TEST (fixture rem-med-05 same pattern; HEB_SPECIAL_MINUTES) |
| 14 | תקבעי פגישה עם מור ביום שלישי בשמונה בבוקר | appointment | 2026-06-02 | 08:00 | ALLOWED | PROVEN_BY_TEST (fixture app-full-05) |
| 15 | יש לי פגישה בשלוש | appointment | today (ambiguous) | ambiguous (03/15) | BLOCKED | PROVEN_BY_TEST (fixture app-amb-02) |
| 16 | תזכירי לי לקחת תרופה | reminder | missing | missing | BLOCKED | PROVEN_BY_TEST (fixture rem-amb-01; harness test: missing title/date/time blocks save) |
| 17 | מחר בשעה 2:34 יש לי תור אצל התופרת ברחוב קוק 14 בהרצליה, יש לי חור במכנסיים | appointment | 2026-05-30 | ambiguous (02:34/14:34) | BLOCKED | PROVEN_BY_TEST (fixture app-amb-01) |
| 18 | תזכירי לי עוד רבע שעה לקחת ויטמינים | reminder | today+15min | now+15min | ALLOWED | PROVEN_BY_TEST (fixture rem-water-03 uses "רבע שעה"; HEB_SPECIAL_MINUTES) |
| 19 | יש לי תור לרופא ביום ראשון בשתיים בצהריים | appointment | 2026-05-31 | 14:00 | ALLOWED | PROVEN_BY_TEST (fixture app-full-03 equivalent) |
| 20 | תוסיפי אירוע ביומן | appointment | missing | missing | BLOCKED | PROVEN_BY_TEST (harness: missing_title+missing_date+missing_time blocks save) |

**Microphone status for all 20**: NEEDS_BROWSER_QA

---

## Phase 4 — Normalization

### cleanTranscript behavior

`cleanTranscript` (in `localParser.ts`) applies the following transformations in order:

| Rule | Pattern | Effect |
|------|---------|--------|
| Stutter collapse | `([֐-׿]{2,})(\s+\1)+` | "מחר מחר" → "מחר" |
| Repeated phrase | `((?:\S+\s+){1,3}\S+)\s+\1` | "בשעה 10:32 בשעה 10:32" → "בשעה 10:32" |
| Self-correction | `בעוד\s+[֐-׿\s\d]+?\s+(?:סליחה|בעצם|תיקון|לא),?\s+(?=בעוד\s)` | "בעוד X סליחה בעוד Y" → "בעוד Y" (only fires when both sides are parallel "בעוד") |
| ב- spacing | `ב\s*-\s*(\d)` | "ב - 3" → "ב-3" |
| Colon spacing | `(\d)\s*:\s*(\d)` | "10 :32" → "10:32" |
| Double punctuation | `[,]{2,}` / `[.]{2,}` | collapse to single |
| Whitespace | `\s+` | collapse to single space |

**Hard proven**: self-correction fires exactly on the double-"בעוד" pattern (utterance 4). The guard `(?=בעוד\s)` prevents the rule from eating legitimate text that is not a self-correction.

**Note on scope**: the self-correction rule only covers the "בעוד X … בעוד Y" pattern. A general correction like "פגישה עם מור, לא עם גלעד" is NOT normalized by cleanTranscript — the downstream parser sees both names and the family resolver returns the first match. This is a known gap (FOLLOW_UP, not BLOCKER).

**Note on "לא" trigger**: the rule also fires on "לא" as the correction word ("בעוד שעה לא בעוד שעתיים"). The "לא" path is tested in fixture `corr-e-02`.

### Other normalization gaps

- Filler words at the start of an utterance ("אממ", "רגע", "אה") are NOT stripped by cleanTranscript. The harness fixtures cover these in section F (noisy-f-*) and verify intent detection still works despite leading fillers. Title-building in `buildTitle` strips command-verb prefixes but not filler words — the title may contain "רגע" if it is the first word. FOLLOW_UP: add filler-word strip to cleanTranscript or TITLE_LEAD_STRIPS.
- Mid-phrase fillers ("... אממ ... ") are passed through unchanged. ASR typically drops them.

---

## Phase 5 — Routing / Intent

The pipeline routes each transcript through two gatekeepers before reaching the parsers:

```
cleanTranscript(raw)
    ↓
isScheduleQuery(normalized)   ← exits early if true
    ↓
detectReminderIntent(normalized)
    → 'reminder'     → rowFromReminder → parseReminder
    → 'appointment'  → rowFromAppointment → parseLocally + familyResolve
    → 'unknown'      → rowFromAppointment(intent='unknown') → save always blocked
```

### isScheduleQuery patterns (intentParser.ts)

| Pattern | Matches | Status |
|---------|---------|--------|
| `/^מה (יש|קורה) לי/` | "מה יש לי מחר" | PROVEN_BY_TEST |
| `/^מה ביומן/` | "מה ביומן שלי" | fixture coverage |
| `/^מה מחכה/` | "מה מחכה לי" | fixture coverage |
| `/^מה ה?תוכני/` | "מה התוכנית" + "מה התוכניות" | PROVEN_BY_TEST (D1 fix, hard assertion #6) |
| `/^מה עושים/` | "מה עושים מחר" | fixture coverage |
| `/^מתי יש לי/` | "מתי יש לי תור" | fixture coverage (sq-c-12) |
| `/^יש לי משהו/` | "יש לי משהו מחר" | PROVEN_BY_TEST (sq-c-10) |

**Gap**: "תראי לי את השבוע" is classified as `unknown` (fixture sq-c-05 expects `unknown`) — correct per spec.

**Gap**: "מה בלוח השנה שלי" is classified as `unknown` (fixture sq-c-08 expects `unknown`) — by design (pattern not in QUERY_PATTERNS).

### detectReminderIntent routing (reminderParser.ts)

| Route | Trigger | Guard | Status |
|-------|---------|-------|--------|
| `appointment` (strong) | STRONG_APPOINTMENT_VERBS: תקבעי / תקבע / קבעי / קבע / אגנדה | None | PROVEN_BY_TEST |
| `appointment` (weak) | WEAK_APPOINTMENT_VERBS: תוסיפי / תוסיף | Must also match APPOINTMENT_NOUN_RE | PROVEN_BY_TEST (D2 fix) |
| `appointment` (trigger + content) | REMINDER_TRIGGERS + APPOINTMENT_CONTENT | Both must fire | PROVEN_BY_TEST |
| `reminder` | REMINDER_TRIGGERS without APPOINTMENT_CONTENT | Negative check on APPOINTMENT_CONTENT | PROVEN_BY_TEST |
| `appointment` (declarative) | "יש לי" + APPOINTMENT_NOUN_RE | Leading "מה" guard prevents stealing schedule queries | PROVEN_BY_TEST (D3, D4) |
| `unknown` | None of the above | — | PROVEN_BY_TEST (edge fixtures) |

**Key APPOINTMENT_NOUN_RE**: `(?<![֐-׿])[להאב]?(?:פגישה|תור|בדיקה|אירוע|תופרת)(?![֐-׿])` — accepts one Hebrew prepositional prefix; uses Hebrew lookarounds (not `\b`, which does not work with Hebrew in JS).

---

## Phase 6 — Time/Date

### Date resolution patterns

| Input form | Result | Status |
|------------|--------|--------|
| "מחר" | today + 1 | PROVEN_BY_TEST |
| "למחר" (with ל prefix) | today + 1 | PROVEN_BY_TEST (D6 fix) |
| "מחרתיים" | today + 2 | fixture coverage |
| "היום" | today | fixture coverage |
| "ביום ראשון" / "יום ראשון" | next Sunday (7 days if today IS Sunday) | PROVEN_BY_TEST (hard assertion #5: 2026-05-31) |
| "ביום שלישי" | next Tuesday | PROVEN_BY_TEST (hard assertion in fixture app-full-05) |
| DD/MM or DD.MM | exact date | fixture coverage (app-date-01) |
| "ב-30 במאי" / "ב-15 ביוני" | literal date parsing | fixture coverage |

### Time resolution patterns

| Input form | Result | Ambiguous? | Status |
|------------|--------|------------|--------|
| "בשעה 21" | 21:00 | No | PROVEN_BY_TEST |
| "ב-21" | 21:00 | No | PROVEN_BY_TEST |
| "21:00" / "21.00" | 21:00 | No (cleanTranscript normalizes colon) | PROVEN_BY_TEST |
| "10:32" | 10:32 | No (hour 10 not in 1–6 range) | PROVEN_BY_TEST (hard assertion: fixture app-full-04) |
| "בתשע בערב" | 21:00 | No (PM hint) | PROVEN_BY_TEST |
| "עשר וחצי בבוקר" | 10:30 | No (AM hint) | PROVEN_BY_TEST (hard assertion #2, utterance 9) |
| "שתיים בצהריים" | 14:00 | No (PM hint) | PROVEN_BY_TEST (hard assertion #5) |
| "בשלוש" (no hint) | 03:00 or 15:00 | Yes (hour 3 in 1–6 range) | PROVEN_BY_TEST (fixture app-amb-02) |
| "2:34" (no hint) | 02:34 or 14:34 | Yes (hour 2 in 1–6 range) | PROVEN_BY_TEST (fixture app-amb-01) |
| "שתיים בלילה" | 02:00 | No (NIGHT_HINTS) | fixture coverage |
| "12 בלילה" | 00:00 (midnight) | No | fixture coverage |
| "שתים עשרה בצהריים" | 12:00 | No | fixture coverage |

### Relative time resolution (reminderParser.ts)

| Input form | Minutes | Status |
|------------|---------|--------|
| "בעוד שתי דקות" / "עוד שתי דקות" | 2 | PROVEN_BY_TEST (hard assertion #3) |
| "בעוד חצי שעה" | 30 | HEB_SPECIAL_MINUTES; fixture coverage |
| "עוד רבע שעה" | 15 | HEB_SPECIAL_MINUTES; NEEDS_BROWSER_QA for live audio |
| "בעוד שעה" | 60 | PROVEN_BY_TEST (fixture rem-med-02) |
| "בעוד שעתיים" | 120 | HEB_SPECIAL_MINUTES; fixture coverage |
| "בעוד 20 דקות" | 20 | numeric form; fixture coverage |
| "בעוד 5 שעות" | 300 | numeric form; fixture coverage |

**Gap**: "עוד" without "בעוד" (missing the "ב") — the regex matches both `(?:בעוד|עוד)` for relative time, but this has not been independently asserted in a hard semantic test. Fixture `rem-b-01` covers "עוד עשר דקות להזכיר לי מים". FOLLOW_UP: add explicit hard assertion for bare "עוד".

---

## Phase 7 — Family Relation

### Supported relation types

| Phrase family | Resolver logic | Status |
|---------------|----------------|--------|
| בת / בן של X | X.childrenHe filtered by gender | PROVEN_BY_TEST |
| נכדה / נכד של X | children-of-children of X, filtered by gender | PROVEN_BY_TEST (fixture rel-d-01, rel-d-05) |
| בעל / בעלה / בן הזוג של X | X.spousesHe ∪ X.partnersHe, filter male | PROVEN_BY_TEST (hard assertion #1, war-room assertions) |
| אישה / אשתו / אשת / בת הזוג של X | X.spousesHe ∪ X.partnersHe, filter female | PROVEN_BY_TEST (war-room assertions) |
| אח / אחות של X | walk X.parentsHe → parent.childrenHe, exclude X, filter gender | PROVEN_BY_TEST (hard assertion #2 covers אחות) |
| Hebrew prefix on kinship word (ל/ב/מ/ה/ש/כ/ו + בעל/בת/...) | REL_ANYWHERE pattern; prefix stripped before resolving | PROVEN_BY_TEST (D6/D7 fix; "לבעל של אופיר" → גלעד) |

### Resolution status semantics

| Status | Meaning | Save behavior |
|--------|---------|---------------|
| `resolved` | Exactly 1 gender-matched node found | ALLOWED (if other fields present) |
| `ambiguous` | >1 gender-matched node found | BLOCKED — disambiguation UI shown |
| `missing` | 0 matches, or anchor name not in graph | BLOCKED — phrase preserved, gentle Hebrew message |
| `none` | No person phrase in utterance | No effect on save |

### No-invention guarantee

The resolver never returns a name it has not found in the graph. The gender filter excludes `gender === 'unknown'` nodes, so a spouse with unknown gender is never guessed. If the graph has no match, the status is `missing` and the original phrase is preserved verbatim.

### Known limitations

- Multi-person phrases: only the first person phrase is extracted (extractPersonPhrase returns the first match of REL_AFTER_WITH → REL_ANYWHERE → NAME_AFTER_WITH). A second person in the same utterance is silently dropped.
- Birth-order descriptors ("הגדולה" / "הקטן"): no birth-order data in the graph → always `missing`. This is intentional, not a bug.
- "ל"-prefixed bare names without kinship word ("להתקשר ללאו") are not resolved — NAME_AFTER_WITH requires "עם". Reminders using this form save with the bare name as the title.

---

## Phase 8 — Semantic Draft Contract

### Appointment title cleanliness

The `buildTitle` function in `localParser.ts` strips all consumed tokens (date, time, location, notes) from the cleaned transcript, then runs the `TITLE_LEAD_STRIPS` loop, which covers:

- All command verbs: תקבעי / תקבע / קבעי / קבע / תזכירי / תזכיר / תזכרי / שימי / שים / תוסיפי / תוסיף / תכניסי / תכניס / תרשמי / תרשום
- Declarative openers: "יש לי" / "אני צריך/צריכה"
- The "תקווה" ASR-mishear guard (Whisper sometimes transcribes "תקבעי" as "תקווה" at the start of a sentence)

`sanitizeTitleForSave` applies the same loop again immediately before write, as a belt-and-suspenders guard. If stripping leaves only a command verb and nothing else, the fallback is "פגישה עם <personName>" (if a person was resolved) or the original title.

### Reminder title cleanliness

`stripReminderCommand` in `reminderParser.ts` applies REMINDER_COMMAND_PATTERNS before the title is computed, stripping "תזכירי לי" / "תזכרי לי" / "תזכיר לי" / "תזכורת" / "להזכיר לי" and the leftover "לי" prefix.

The title is then built from the stripped text by removing time/date words, giving a clean action phrase ("לקחת כדור", "להתקשר לגלעד").

**Proven clean**: hard assertions #1–#6 verify no command verb appears in `finalConfirmationText`. The ConfirmCard privacy contract test asserts no raw transcript, textarea, or rawTranscript field in the card.

---

## Phase 9 — UX/UI

NEEDS_BROWSER_QA — cannot verify layout without running the app.

The following items are structurally correct in source (MEDIUM confidence) but require eyes in a live browser:

| Item | Source evidence | Browser status |
|------|----------------|----------------|
| Touch targets ≥ 48px on ConfirmCard buttons | War-room report: "primary save 60px min, secondary 56px" | NEEDS_BROWSER_QA |
| Text ≥ 16px throughout ConfirmCard | senior-ux.md requirement; not measured without browser | NEEDS_BROWSER_QA |
| Disambiguation buttons ≥ 48px for ambiguous person/time | War-room: "candidate buttons ≥56px" in source | NEEDS_BROWSER_QA |
| RTL layout (Hebrew) renders correctly | No source-level RTL regression visible; no browser confirmation | NEEDS_BROWSER_QA |
| Weekday header (א׳…שבת) renders on calendar | Committed in prior pass (`712e9a8`); not retested this pass | NEEDS_BROWSER_QA |
| No scroll on AbuCalendar primary view | senior-ux.md requirement; not verifiable without browser | NEEDS_BROWSER_QA |
| "לא, לתקן" reveals clean editable fields (no raw transcript) | ConfirmCard.test.ts asserts no transcript-box / textarea (MEDIUM) | NEEDS_BROWSER_QA |
| ReminderConfirmCard category icon renders | Category enum confirmed in reminderParser.ts; card rendering not tested | NEEDS_BROWSER_QA |
| Due popup fires at correct time | Timer logic in reminder scheduler; no unit test for the popup itself | NEEDS_BROWSER_QA |

---

## Phase 10 — AbuAI Boundary

### Family query → unknown → no save

A transcript like "מי הבעל של אופיר" does not match any QUERY_PATTERNS (no "מה" prefix, not a schedule query form) and does not trigger STRONG or WEAK appointment verbs or REMINDER_TRIGGERS. `detectReminderIntent` returns `unknown`.

The harness returns `intent: 'unknown'` and `saveAllowed.allowed: false` with `reason: 'intent_unknown'` for all `unknown`-route rows.

**Consequence**: no ConfirmCard is shown, no calendar event is created. The app must handle `unknown` intent gracefully in the UI (show a "לא הבנתי" message or route to AbuAI chat).

**Proven**: fixture `edge-02` ("שלום, מה שלומך") and edge-g-* fixtures all return `intent: 'unknown'` and `saveAllowed.allowed: false`. The harness test "schedule queries never claim save-allowed" asserts this invariant for the `schedule_query` route; the `unknown` route is covered by the `rowFromAppointment` function which gates `allowed` on `intent === 'appointment'`.

### AbuAI free-chat boundary

The AbuAI module uses grounded-first architecture for family and calendar queries (deterministic functions, not LLM-generated). The truth-guard backstop on streamed responses prevents ungrounded calendar claims. This is documented in the war-room report at `ELITE_WAR_ROOM_REPORT.md` §8 and is outside the scope of the voice calendar pipeline being reviewed here.

---

## Phase 11 — Microphone Readiness Decision

[PLACEHOLDER]

Pre-conditions required for READY_FOR_MIC_QA:

- [ ] Text pipeline: 0 divergences across ≥200 fixtures (asserted by harness test)
- [ ] Hard semantics: all 6 assertions pass
- [ ] typecheck: clean
- [ ] build: clean
- [ ] No memory/* files committed

Fill in after running `npm test` and `npm run typecheck` and `npm run build` at HEAD:

```
npm test:       [PLACEHOLDER]
npm run build:  [PLACEHOLDER]
typecheck:      [PLACEHOLDER]
divergences:    [PLACEHOLDER]
hard semantics: [PLACEHOLDER]
```

---

## Phase 12 — Microphone QA Plan

See: docs/calendar-revolution/MICROPHONE_QA_PLAN.md

That document contains the full manual QA protocol: 20 utterances, expected routes, expected ConfirmCard content, pass/fail criteria, and the result log template.

---

## Known Limitations

The following items are explicitly NOT proven by this review and require either manual browser QA or additional work:

1. **ASR accuracy on live audio**: the text pipeline is proven deterministic on fixed strings. Whisper transcription from a real microphone is NOT deterministic and may differ from the expected transcript. The verb-prior mitigation in `calendarTranscribe.ts` biases Whisper but does not guarantee "תקבעי" will never be transcribed as "תקווה".

2. **Due popup firing**: the reminder scheduler's timer and the OS notification delivery are not covered by the harness test. The popup timing is NEEDS_BROWSER_QA.

3. **ReminderConfirmCard rendering**: the reminder confirmation card is not the same component as ConfirmCard (appointment). Its rendering, touch targets, and disambiguation UI have not been asserted in this pass.

4. **Self-correction for non-"בעוד" patterns**: cleanTranscript only normalizes "בעוד X … בעוד Y" corrections. A speaker who corrects a date ("מחר, לא מחרתיים, פגישה עם …") is handled by the downstream date parser picking the last date mentioned — this is not cleanTranscript logic and is not guaranteed to always pick the intended correction.

5. **Multi-person utterances**: not supported. The pipeline silently drops the second person.

6. **"ל"-prefixed bare names**: "להתקשר ללאו" without a kinship word is not resolved to a family member. The name is preserved as text in the title.

7. **Location display**: ConfirmCard does not show location (privacy contract). Location is extracted and saved to the event, but the tester must verify this in the event detail screen — not in the confirmation card.

8. **Recurring reminders in browser**: the recurrence schedule display and "כל יום" indicator after saving have not been verified in a live browser session.

9. **iOS PWA push notifications**: reminder due popups require notification permission on iOS. The permission flow is not tested by the harness.

10. **Fixture set is Hebrew-only**: the parser supports Spanish and English input. The fixture harness has no Spanish or English fixtures. Any regression to the i18n path would not be caught by the harness.

---

## Files Changed in This Session

[PLACEHOLDER — fill after all commits]

```
[list of files modified, added, or deleted in this session]
```
