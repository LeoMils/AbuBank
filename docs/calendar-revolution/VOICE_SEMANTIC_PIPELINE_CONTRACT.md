# VOICE SEMANTIC PIPELINE CONTRACT
## The Single Source of Truth for Hebrew Voice → Saved Object

**Status:** Authoritative. Every voice/calendar/reminder change must
reference this contract.

---

## THE PIPELINE (ONE WAY ONLY)

```
RAW_INPUT
  ↓ (microphone / text test)
RAW_TRANSCRIPT                    ← string, as captured. NEVER reaches UI.
  ↓ cleanTranscript()
NORMALIZED_TRANSCRIPT             ← string, after self-correction collapse,
                                    filler removal, duplicate clause merge.
  ↓ route detection
ROUTE                             ← one of the legal routes below.
  ↓ per-route extractor
SEMANTIC_DRAFT                    ← typed object, contract-defined.
  ↓ format
CONFIRMATION_TEXT                 ← human-readable Hebrew, derived ONLY
                                    from SEMANTIC_DRAFT.
  ↓ user
USER_APPROVAL                     ← explicit yes/no.
  ↓ save (only if yes)
SAVED_OBJECT                      ← appointment / reminder in store.
```

**Hard invariants:**

| # | Invariant | Enforced where |
|---|-----------|----------------|
| 1 | UI never reads RAW_TRANSCRIPT. | ConfirmCard / VoiceCard contract |
| 2 | Save never persists RAW_TRANSCRIPT. | reminderStore / calendar save |
| 3 | Readback derives only from SEMANTIC_DRAFT. | reminderFormat / ConfirmCard |
| 4 | finalTitle must be clean (no debug / no סליחה / no command verbs). | dirty-title blocker tests |
| 5 | `unknown` route can never save. | save gate |
| 6 | `schedule_query` / `family_query` can never save. | save gate |
| 7 | Any required-field gap blocks save with a reason string. | save gate |
| 8 | Any ambiguity blocks save with a reason string. | save gate |
| 9 | Explicit user approval gate is the LAST step before persist. | flow state machine |
| 10 | The pipeline is pure: same input + same TODAY_ISO → same output. | determinism test |

---

## ROUTES (CLOSED SET)

| Route | Meaning | Save-capable | Examples |
|-------|---------|--------------|----------|
| `appointment_create` | User wants a new calendar event. | YES if all required fields present and unambiguous. | "תקבעי פגישה עם גלעד מחר בתשע בערב" |
| `reminder_create` | User wants a reminder. | YES if all required fields present and unambiguous. | "תזכירי לי בעוד שתי דקות לקחת כדור" |
| `calendar_query` | User asks about their schedule. | NO. | "מה יש לי היום" |
| `family_query` | User asks about a family relationship. | NO. | "מי הבעל של אופיר" |
| `correction` | User corrects the previous draft. (Used only inside an active confirmation flow.) | NO directly; mutates active draft. | "לא, בעצם בשמונה" |
| `cancel` | User aborts the current flow. | NO. | "ביטול" / "תעצרי" |
| `unknown` | Pipeline cannot route. | NO. | "שלום, מה שלומך" |

Routing must be MUTUALLY EXCLUSIVE. A single utterance returns exactly
one route. Ambiguous-route utterances must downgrade to a clarifying
question, never silent guess.

---

## SEMANTIC DRAFTS (TYPED)

### AppointmentDraft

```ts
interface AppointmentDraft {
  route: 'appointment_create'
  finalTitle: string                       // clean, derived
  date: string | null                      // YYYY-MM-DD
  time: string | null                      // HH:MM 24h
  dueAt: string | null                     // ISO datetime
  displayDateLabel: string | null          // "מחר", "ביום ראשון 31 במאי"
  displayTimeLabel: string | null          // "21:00 בערב"
  personPhrase: string | null              // raw extracted phrase
  resolvedPerson: {
    status: 'resolved' | 'ambiguous' | 'missing' | 'none'
    name: string | null
    candidates: string[]
  }
  missingFields: ('title' | 'date' | 'time')[]
  ambiguity: null | { type: 'time' | 'date' | 'person'; detail: string }
  saveAllowed: boolean
  saveBlockReason: string                  // '' if allowed
  confirmationText: string                 // "לקבוע פגישה עם גלעד מחר בתשע בערב?"
}
```

### ReminderDraft

```ts
interface ReminderDraft {
  route: 'reminder_create'
  finalTitle: string                       // clean, derived
  dueAt: string | null                     // ISO datetime
  displayDateLabel: string | null
  displayTimeLabel: string | null
  recurrence: null | {
    frequency: 'daily' | 'weekly' | 'yearly' | 'minutes'
    timeOfDay?: string                     // HH:MM
    daysOfWeek?: number[]
    intervalMinutes?: number
  }
  familyResolution: null | {
    originalPhrase: string
    status: 'resolved' | 'ambiguous' | 'missing'
    resolvedName: string | null
    candidates: string[]
  }
  missingFields: ('title' | 'date' | 'time')[]
  ambiguity: null | { type: 'time' | 'date' | 'person'; detail: string }
  saveAllowed: boolean
  saveBlockReason: string
  readbackText: string                     // "להזכיר לך בעוד שתי דקות לקחת כדור. לשמור?"
}
```

### CalendarQueryDraft

```ts
interface CalendarQueryDraft {
  route: 'calendar_query'
  scope: 'today' | 'tomorrow' | 'week' | 'specific_day'
  specificDate: string | null              // for scope='specific_day'
  saveAllowed: false
  saveBlockReason: 'query_no_save'
  readbackText: string                     // "להציג את היומן שלך לשבוע הזה?"
}
```

### FamilyQueryDraft

```ts
interface FamilyQueryDraft {
  route: 'family_query'
  relationPhrase: string                   // "הבעל של אופיר"
  resolvedPerson: {
    status: 'resolved' | 'ambiguous' | 'missing'
    name: string | null
    candidates: string[]
  }
  saveAllowed: false
  saveBlockReason: 'family_query_no_save'
  readbackText: string                     // "גלעד הוא הבעל של אופיר."
}
```

---

## NORMALIZATION RULES

Applied by `cleanTranscript()` BEFORE any extractor sees the text.

| # | Rule | Example In | Example Out |
|---|------|------------|-------------|
| N-1 | Strip filler heads | "אממ קבעי פגישה" | "קבעי פגישה" |
| N-2 | Relative-time correction | "בעוד עשר דקות סליחה בעוד שתי דקות" | "בעוד שתי דקות" |
| N-3 | Date-word correction | "מחר לא מחרתיים פגישה" | "מחרתיים פגישה" |
| N-4 | Time-word correction | "בתשע סליחה בעשר" | "בעשר" |
| N-5 | Person correction | "עם אופיר בעצם עם גלעד" | "עם גלעד" |
| N-6 | Duplicate clause collapse | "מחר מחר בתשע" | "מחר בתשע" |
| N-7 | Trailing politeness strip | "תודה תזכירי" | "תזכירי" |
| N-8 | Title strip of command verbs | "תקבעי פגישה לרופא" → title="רופא" | "רופא" |

**Forbidden:** A normalization rule may not destroy meaning. If a rule
removes the only verb, the only noun, or the only time reference, it is
a defect.

---

## ROUTING RULES (ORDER MATTERS)

```
1. STRONG_APPOINTMENT_VERBS                    → appointment_create
2. WEAK_APPOINTMENT_VERBS + APPOINTMENT_NOUN   → appointment_create
3. REMINDER_TRIGGERS + APPOINTMENT_CONTENT     → appointment_create
4. REMINDER_TRIGGERS alone                     → reminder_create
5. CALENDAR_QUERY_PATTERNS                     → calendar_query
6. FAMILY_QUERY_PATTERNS                       → family_query
7. !^מה + יש לי + APPOINTMENT_NOUN             → appointment_create
8. Standalone APPOINTMENT_CONTENT              → appointment_create
9. MEDICATION_RE w/o APPOINTMENT_NOUN          → reminder_create
10. RECURRING_RE                                → reminder_create
11. APPOINTMENT_NOUN + APPT_CONTEXT (no מה)    → appointment_create
12. RELATIVE_TIME_START_RE                     → reminder_create
13. else                                       → unknown
```

All regexes that touch Hebrew word substrings MUST use Hebrew
word-boundary guards `(?<![֐-׿])...(?![֐-׿])` to avoid matches inside
longer Hebrew words.

---

## SAVE GATE — THE LAST LINE

A draft becomes a saved object if and only if:
1. `route` is `appointment_create` or `reminder_create`.
2. `missingFields` is empty.
3. `ambiguity` is null.
4. `resolvedPerson.status` is not `'ambiguous'` (and not `'missing'`
   when the user named a relation).
5. `finalTitle` is clean (no forbidden tokens — see below).
6. `confirmationText` was rendered to the user AND the user explicitly
   approved.

If any condition fails, the save MUST be blocked. The block reason is a
non-empty string. The reason is shown to the user only as a friendly
question, never as a code string.

### Forbidden tokens in `finalTitle` (must NEVER appear)

- The raw word `סליחה`, `בעצם`, `לא`, `תיקון` (correction artifacts).
- Command verbs: `תקבעי`, `קבעי`, `תזכירי`, `תזכרי`, `תרשמי`, `שימי`,
  `תכניסי`, `תוסיפי`.
- Debug strings: `stage=`, `asr=`, `confidence=`, `source=`.
- The complete RAW_TRANSCRIPT (or any sentence containing more than 7
  words from it — heuristic guard against sentence-blob leakage).

A dirty-title leak is a P0 bug.

---

## CONFIRMATION TEXT — DERIVED ONLY

`confirmationText` / `readbackText` is built from the typed draft. The
formatter receives nothing else. Examples:

| Route | Template |
|-------|----------|
| `appointment_create` | `לקבוע פגישה עם ${person} ${dateLabel} ${timeLabel}?` |
| `reminder_create` (relative) | `להזכיר לך ${relativeLabel} ${task}. לשמור?` |
| `reminder_create` (absolute) | `להזכיר לך ${dateLabel} ${timeLabel} ${task}. לשמור?` |
| `family_query` (resolved) | `${name} הוא ${relationPhrase}.` |
| `family_query` (missing) | `אין לי במאגר את ${relationPhrase}.` |
| `calendar_query` | `להציג את היומן ל${scopeLabel}?` |

No raw transcript. No debug. No technical terms.

---

## DETERMINISM

Same `(rawText, TODAY_ISO)` MUST produce the same draft. Any source of
randomness (Date.now in non-test paths, random IDs in titles, locale
quirks) is a defect.

---

## TEST DOCTRINE

- **Fixtures** assert intent + structural shape on hundreds of cases.
- **Golden tests** assert the full semantic draft on ~30 realistic
  Martita utterances.
- **Hard assertions** in the harness test pin specific sentences with
  exact dates, times, names.
- **Determinism test** guarantees byte-identical reruns.
- **Dirty-title blocker** asserts that no forbidden token leaks into
  finalTitle.
- A new bug cannot be considered fixed unless a new fixture / golden
  test reproduces it BEFORE the fix and stays green AFTER.
