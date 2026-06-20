# ABUAI_CALENDAR_REASONING_MODEL

**Stage 5 (REASON) for time, appointments, and reminders.** Subordinate to [[ABUAI_COGNITIVE_MODEL]].
How AbuAI *reasons* about calendar — deterministically, because time is truth, not vibes.

**Hard law:** calendar truth is computed by deterministic code, **never** by the LLM. The LLM may
phrase a confirmed fact; it may never decide a date, a time, or whether something is saved.

---

## 1. The single clock

All temporal reasoning uses **one `now`, pinned to Asia/Jerusalem.** There is exactly one definition
of "today", "tomorrow", "this week". (The current split between local-time and UTC parsers is a known
defect; the cognitive model mandates a single timezone-aware clock — implementation must converge there.)

## 2. Temporal cognition — resolving what she means by "when"

| Expression | Reasoning | Result |
|------------|-----------|--------|
| היום / מחר / מחרתיים | offset from `now` (Jerusalem) | concrete YYYY-MM-DD |
| יום שישי / ראשון | next occurrence of that weekday | concrete date |
| בעוד שבוע / שבוע הבא | +7 / start of next week | concrete date |
| אחרי החג / סוף החודש / אחרי הפגישה | anchor → offset | concrete date (must resolve, never echo the phrase) |
| בשלוש / ברבע לארבע / שמונה וחצי | hour-word + fraction parse | HH:MM (24h) |
| bare 1–6 with no period | **ambiguous** | ASK morning/afternoon (Decision Tree §3) |

A resolved date/time is **always concrete** before it is spoken or stored. AbuAI never says
"מחר" as a stored title and never reads "TOMORROW"/"FRIDAY" back as a literal.

### 2a. Anchor authorities (closes the "אחרי החג" gap)

Relative expressions resolve against **named anchor authorities**, never an ad-hoc dictionary:

- **Holiday anchor** = a **computed Hebrew-calendar engine** (Hebcal-equivalent), locale Israel,
  as the *single* authority for any חג-relative expression ("אחרי החג", "לפני פסח", "בחנוכה").
  It must be computed (not a hand-maintained, year-limited table that expires) so resolution never
  silently returns null for a future year. "אחרי החג" = the day after the resolved holiday's last day.
- **Personal-event anchor** = the calendar store (for "אחרי הפגישה", "לפני התור").
- **Weekday/relative anchor** = the single Jerusalem clock (§1).
- **Family-date anchor** = `family_data.json` (birthdays, memorial). *Data note:* the specific
  memorial date is a human decision (01-01 vs 12-26, unresolved) — the model fixes the **source**,
  not the value.

If an anchor authority cannot resolve to a concrete date, AbuAI does **not** guess or echo the
phrase — she asks ("אחרי איזה חג בדיוק?") or states she can't pin it. Resolution is deterministic
given the authority; the cognitive model's only requirement is that the authority be named and computed.

## 3. Intent cognition — what kind of calendar act

- **CREATE** — "תקבעי…", time+title present with intent. Parse date/time/title; **confirm** before commit.
- **READ** — "מה יש לי…". Resolve the **window** precisely:
  - "מה יש לי מחר?" → that day.
  - "מה יש לי היום בארבע?" → **exactly 16:00**, not the whole day.
  - "מה יש לי אחרי ארבע?" → **only events after 16:00**.
- **REMIND** — "תזכירי לי…". Reason recurrence + lead times; schedule via the platform scheduler.
- **MODIFY/DELETE** — recognized; if unsupported, say so honestly, don't fake it.

Bare "time + date" with no clear intent is **not** a create (a known false-positive). Appraisal must
distinguish "מחר בארבע" (musing/question) from "תקבעי מחר בארבע" (command).

## 4. The trust ritual — confirm + readback (why Martita can rely on it)

Saving is a **two-beat trust ritual**, never a silent write:
1. **Confirm before commit:** "אז מחר בשלוש, פגישה עם מוטי — לקבוע?" (read the resolved values, not her raw words).
2. On "כן"/"תודה"/short assent → commit → **read back from storage**: load the event; only if
   `find()` confirms it exists say "קבעתי — מחר בשלוש." If readback fails: "לא נשמרה, ננסה שוב?".

**Honesty law:** the word "קבעתי/נשמר" may be spoken **only** after a successful readback. A confirm
word ("כן", "תודה") must **never** become the appointment title; a missing title defaults to "פגישה".

## 5. Reminder cognition (medication-grade)

- A reminder is only "set" when the **platform scheduler confirms** it (native notification scheduled,
  or an honest web fallback). AbuAI never says "אזכיר לך" if nothing was actually scheduled.
- Persisted reminders are the source of truth; the schedule must be **reconciled on app start**
  (re-armed after reboot/reload). (Current `setInterval`/create-only scheduling is a known defect; the
  cognitive law requires durable, reconciled delivery or honest "open-app-only" framing.)
- **Confident-set vs honest-fallback is a runtime branch, not a model gap.** The model is complete:
  AbuAI says "אזכיר לך" **only** when the platform scheduler returns confirmation; otherwise she takes
  the honest fallback ("אני אזכיר לך כל עוד האפליקציה פתוחה — אבל בואי נוודא שלאו הפעיל את ההתראות").
  Which branch fires depends on the device at runtime; both are fully specified here.
- Recurrence ("כל בוקר בשמונה") and lead times reasoned explicitly; medication tone is calm and certain.

## 6. Conflict & duplicate cognition

- Before committing a create, check for a **conflict** at the resolved time; if found, surface it
  ("יש לך כבר משהו בארבע — לקבוע בכל זאת?") instead of silently double-booking.
- Duplicate detection reasons on **normalized** title + time window, not exact string match
  ("רופא 16:00" ≈ "תור לרופא 16:00").

## 7. Integration

- Calendar ↔ family: a person in an event → offer a family bridge (Conversation Engine §5).
- Calendar ↔ memory: completed/מissed events become episodic memory and can seed leads
  ("היה לך רופא אתמול — הכל בסדר?").
- A READ that returns empty is stated warmly ("מחר פנוי לגמרי"), never as "0 results".
