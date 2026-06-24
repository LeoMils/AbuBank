# Non-Voice Green Closure — Brutal Gap Audit

Scope: code/logic/UX/memory/understanding only. No microphone, no TTS hardware,
no realtime voice. Each target below lists the real production weakness, why the
old tests missed it, the concrete failure mode, the fix, and the acceptance bar.
Numbers are measured against a hostile Hebrew corpus run through the actual
runtime (`understandMeeting`, `startCreate`, `tryGroundedAnswer`), not mocks.

---

## 1. Meeting Intelligence (85 → 95+)
- **Weakness:** Long narrative ("reason before logistics", filler, mid-sentence
  story) produced garbage titles and dropped people whose name starts with a
  preposition letter (לאו) or follows "את" ("לראות את מור").
- **Why tests missed it:** old tests used short synthetic phrases ("תקבע עם מור").
- **Failure mode:** title = "אז ככה … בא לי", who = null, wrong confidence.
- **Fix:** clause/discourse engine + `resolveWho` for `עם/אצל/לראות את` + narrative
  title heuristic (comma / >5 words / markers) → `פגישה עם <who>`.
- **Bar:** ≥95% exact pass on a 60-transcript hostile corpus; 0 P0 (invented
  person/time/location).

## 2. Subject Extraction (85 → 95+)
- **Weakness:** subject came back null on reason-first phrasing; `לקבוע עם מור`
  yielded subject "עם מור".
- **Why missed:** no test fed scheduling-verb-as-noise or "לפני X" topics.
- **Failure mode:** subject "עם אלכסנדרה" / null for the Italy-trip case.
- **Fix:** explicit topic marker (`על/בנושא`) first, then purpose-verb object,
  then a `לפני/אחרי <noun>` seed; scheduling verbs excluded from purpose verbs.
- **Bar:** rental/Italy/medical/visit subjects inferred; ≥95% on subject rows.

## 3. Purpose Extraction (85 → 95+)
- **Weakness:** purpose (the WHY) wasn't captured at all for "לפני שהדיירים
  נכנסים" / "כדי לסגור את השכירות".
- **Why missed:** schema had no purpose field until this milestone.
- **Failure mode:** notes held the raw reason or nothing.
- **Fix:** reason clause (`כי/כדי/בגלל`) + timing clause (`לפני/אחרי`) → clean
  purpose; notes = the synthesized purpose, never the transcript.
- **Bar:** purpose preserved as a clean one-liner for the listed reason cases.

## 4. Location Extraction (85 → 95+)
- **Weakness:** time phrases leaked into the venue ("קפה גרג ברעננה בשבע",
  "…בסביבות שבע"); and over-eager invention risk.
- **Why missed:** no test combined a venue immediately followed by a bare time.
- **Failure mode:** saved location = "קפה גרג ברעננה בשבע".
- **Fix:** boundary list now stops a venue at `בסביבות/בערך/ב+hour-word`; null
  when nothing said; an implied-only location is never silently saved.
- **Bar:** location exact when said, empty when not; 0 invented.

## 5. STT Semantic Recovery (80 → 95+)
- **Weakness:** none existed — STT slips ("שחירות"/"זכירות"/"הזכיר שכירות",
  "אחר צהריים") reached extraction verbatim.
- **Why missed:** no STT-noise layer and no tests for it.
- **Failure mode:** subject "הזכיר שכירות"; period mis-parse.
- **Fix:** new `sttSemanticRecovery.ts` — non-word phonetic neighbours corrected
  unconditionally; meaning-changing fixes gated on context; corrections logged;
  uncertain guesses lower confidence; never invents new meaning.
- **Bar:** ≥40 STT cases corrected; context-gated, with evidence.

## 6. Companion Personality (70 → 92+)
- **Weakness:** generic assistant/menu/self-state register could pass through;
  the dead-end "אני כאן." fallback.
- **Why missed:** ban list incomplete; no broad shaping corpus.
- **Failure mode:** "אני בסדר", "איך אפשר לעזור", "אין לי מידע", menu tone.
- **Fix:** expanded `BANNED_PHRASES` (menu/self-ref/patronizing), warm
  no-info rewrite, warm non-dead-end fallback.
- **Bar:** ≥80 shaping cases; no banned phrase survives; warm short human tone.

## 7. Emotional Companion (80 → 92+)
- **Weakness:** emotional turns risked a data-dump or a cold line.
- **Fix:** companion plan suppresses lookups on grief/loneliness; warm fallbacks;
  Pepe/loneliness lines stay human (covered by emotional shaping cases).
- **Bar:** emotional inputs never answered with a menu or "אין לי מידע".

## 8. Online Understanding (85 → 92+)
- **Weakness:** "איזה משחקים יש היום במונדיאל" missed the sports route.
- **Fix:** broadened HE sports pattern (מונדיאל/אליפות/plural); weather/news/
  latest covered; honest decline when route unavailable; never invent current
  facts; never a generic "אין לי מידע" when a route exists.
- **Bar:** all listed current-info phrasings route online or decline honestly.

## 9. Abu Games UX/UI (70 → 92+)
- **Weakness:** needed real visual confirmation, not only source asserts.
- **Fix:** 18 bubble games, vertical 3-col grid, English wordmark + ABU BANK,
  no Carnival / "המשחקים שלך"; Playwright screenshots at top/mid/bottom + a
  click + keyboard/accessibility check.
- **Bar:** 18 reachable on 412×870, vertical-only, premium bubble look.

## 10. Long Conversation Memory (90 → 95+)
- **Weakness:** no persisted "last calendar action"; no 30-turn proof.
- **Fix:** deterministic `conversationMemory.ts` (lastPerson/topic/action) +
  durable summary fields; 30-turn chain harness.
- **Bar:** person/topic/action/emotion preserved across 30 turns; no family
  confusion; pronoun/continuation/recall correct.
