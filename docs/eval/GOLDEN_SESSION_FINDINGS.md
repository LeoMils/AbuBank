# Golden Session — findings (overnight run, real gpt-realtime, text instrument)

The Golden Session (`src/services/goldenSession.ts` + `scripts/golden/golden-session.mjs`) is the
first WHOLE-CONVERSATION test in the repo. It drives ONE continuous session through the full arc and
grades every turn against a contract declared in advance. Result artifact:
`docs/eval/GOLDEN_SESSION_RESULT.json`.

## First real-model run — 14/18 turns correct

PASS: greeting · small_talk · family_relation · family_correction · **message_to_contact
(whatsapp_draft fired)** · phone_call · reminder · medication_refusal (declined, no reminder set) ·
online_lookup (grounded, NO source named) · emotional · spanish_switch · spanish_back · garbled ·
cannot_do.

FAIL (4): calendar_create · calendar_confirm · calendar_readback · online_followup.

## Triage of tonight's FIVE against this run

- **#2 message ignored** — DID NOT reproduce. "תשלחי הודעה ללאו" → people_lookup + whatsapp_draft
  fired correctly. Hypothesis: tonight's "ליארון"/"ליעל" failed because those are UNKNOWN contacts the
  model could not resolve, so it did not draft. Needs a targeted unknown-contact probe (open).
- **#3 wrong language** — DID NOT reproduce here (all Hebrew/Spanish correct). Consistent with an
  intermittent / audio-path phenomenon. The Part 4 enforcement repair is now the backstop.
- **#4 asked who he was** — DID NOT reproduce. Greeting was warm, no identity question.
- **#5 online stale/source** — the MODEL path was clean (no source named, grounded). Tonight's stale
  snippet is the ONLINE ENDPOINT returning old data (deployment/data), not the model — Part 5 territory.

## New findings (no prior check caught these)

1. **CALENDAR stalls in "offer" mode (real).** "תקבעי לי תור לרופא מחר בשעה עשר" →
   *"אני לא יכולה לקבוע תור לרופא בעצמי, אבל אני יכולה לעזור לך לשמור את זה ביומן. רוצים שאכין…"* — a
   disclaimer + permission-ask instead of creating the draft. The prepare→confirm→readback sequence
   then lagged a full turn (prepare fired on the CONFIRM turn; confirm never fired; readback answered
   from working memory). For an 81-year-old this is exactly the "just do it, stop asking" friction the
   owner keeps flagging. → instruction nudge: on an appointment/tor request, create the calendar draft
   immediately and read it back for a one-word confirm; never ask permission to prepare.
2. **Online FOLLOW-UP does not re-ground (real).** "ויש גם גרסה קטנה יותר?" → no get_current_info;
   deflected ("צריך לבדוק בחנות או באתר"). Follow-ups to a lookup should re-search, not answer from
   nothing.

## After fixes — 17/18 (verified on the real model)

- **CALENDAR cluster FIXED + verified.** A concise instruction nudge ("when Martita asks to set an
  appointment… call prepare_calendar_event RIGHT AWAY — never say you cannot book it and never ask
  permission to prepare") flipped all three calendar turns green on the real model:
  calendar_create → prepare_calendar_event, calendar_confirm → confirm_calendar_event,
  calendar_readback → read_calendar. (Kept the assembled instructions UNDER the 14000-char ratchet.)
- **family_correction was a SPEC BUG, not a defect.** The model answered perfectly
  ("כן, נכון. מור היא הבת שלך. תודה שתיקנת אותי.") and called `remember` to persist the correction —
  good behavior. The contract now allows benign `remember` on a 'none' turn (allowTools). Fixed the
  contract, did not weaken it.
- **#2 message routing EXPLAINED (not a P0).** Probe (scripts/probes/unknown-contact.mjs): for
  UNKNOWN names (יערון/יעל) the model DOES call people_lookup and, on not_found, honestly declines
  ("אין לי את הפרטים של…"). It is not skipping the tool. Tonight's "generic chat" was this honest
  decline for names that are not contacts — amplified by the stale snapshot drift below.
- **TESTED≠DEPLOYED drift found + fixed (Part 5).** The instrument had been reading a hand-dumped
  SESSION_CONFIG_SNAPSHOT.json of **35,267 chars** while the CURRENT built instructions are **13,939**
  — it was testing a prompt 2.5× larger than what ships. `sessionSnapshot.gen.test.ts` now regenerates
  the snapshot from buildSessionUpdate() every build, so the real-model instrument always tests what
  deploys.

## Open (low severity, honest, NOT a dead end)

- **online_followup** — a follow-up ("ויש גם גרסה קטנה יותר?") does not reliably re-ground; the model
  either honestly says it has no detail or OFFERS to search again ("את רוצה שאחפש שוב?") rather than
  auto-searching. Two instruction attempts did not make it deterministic (model caution + variance,
  and the ratchet limits how much can be added). Left as a documented deviation — truthful and safe,
  not a P0. The golden verdict is 17/18 with this one turn deviating; NOT faked to 18/18.

## Status
- The calendar cluster and follow-up are logged; a conservative calendar-decisiveness nudge is
  attempted next and re-measured on the instrument. Unknown-contact message routing is an open probe.
- The Golden Session now runs on every build (deterministic contract) and on demand against the real
  model (this runner). Any new anomaly a reader finds becomes a new assertion here.
