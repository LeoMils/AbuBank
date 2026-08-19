# M3 LAYER-3 PROBE — real instrument (Track C)

Two open M3 defects settled on the ACTUAL realtime model (text mode, same instructions + tools
as the device). Paced, capped; a sub-500ms empty response is a connection failure, never a score.

## A · Participant substitution — "פגישה עם אח של מור" when the meeting is with Leo
The model correctly RESOLVES the relationship phrase to the person (people_lookup → Leo), but
before the fix it sometimes wrote the raw phrase into the calendar TITLE.

- BEFORE (v0.257 instructions): 1 of 2 runs wrote "פגישה עם **אח של מור**" as the title
  (participant was correctly "לאו"). Intermittent title substitution.
- FIX: the # Tools calendar rule + the prepare_calendar_event `title` description now say: when a
  participant is given by a relationship and resolves to ONE person, use their NAME everywhere —
  BOTH participant AND title say "פגישה עם לאו", never the relationship phrase.
- AFTER (v0.258): 3 of 3 runs wrote "פגישה עם **לאו**"; 0 of 3 wrote the relationship phrase.

Instruction change measured to help (0/3 vs 1/2). Not a deterministic guarantee — re-run the probe
after any instruction edit that touches calendar titling.

## B · Accept a correction without arguing
After the user pushes back on a family answer, Abu must concede at once and not re-assert.
- 5 of 5 runs (across before+after): turn-2 reply was "כן, נכון." — conceded, 0 runs argued.
- (The corrected fact in the probe is one where Mor genuinely IS the daughter, so turn-3 restating
  "מור היא הבת שלך" is correct, not stubbornness.)

## Cost / discipline
~20 text-mode realtime turns total (8 before, 12 after), 0 transport failures. Well under the
$5 session cap. Harness: scripts/eval/m3Probe.ts (M3_RUNS controls the count).
