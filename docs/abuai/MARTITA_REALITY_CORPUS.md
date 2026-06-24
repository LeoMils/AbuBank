# Martita Reality Corpus

## Honesty statement (read first)
I do **not** have access to a raw audio/text dump of real phrases captured from
Martita or Leo. I cannot fabricate "real collected data" and call it real. This
corpus is **representative**: every phrase is modelled on the patterns documented
in `memory/whatsapp_patterns.yaml`, `memory/message_examples.md`, and the concrete
failures Leo reported across the iPhone testing sessions (afternoon-time bug,
`שכירות` STT mangling, narrative "reason-before-logistics", missing-time, etc.).

To turn this into a *literal* reality corpus, Leo must paste 100–200 raw phrases
(or STT transcripts) from a real session into the `CORPUS` array of
`src/screens/AbuAI/finalProductionGates.test.ts`. The runtime + scoring are ready;
only the real strings are missing — and that gap is a **device/human gate**, not a
code gate.

## What was run
The corpus (≥104 phrases) runs through the **real runtime path**:
`raw text → intent classification (isOnlineCurrentInfoQuery / isCreateIntent /
routePersonalQuery) → for creates: startCreate → draft → P0 audit`.

Categories: messy calendar creates, STT-mangled rental phrases, long rambling
speech, reason-before / logistics-before, family questions, online/current
questions, emotional phrases, corrections, greetings, general chat.

## Results (measured, deterministic)
- **Intent accuracy: 103/104 = 99%** (bar: ≥95%).
- **P0 failures on creates: 0** (no invented person/date/time/location, no
  saved-while-missing-critical, no raw transcript saved as title/notes).
- The single non-P0 miss: `"מי שיחק אתמול"` (ambiguous sports phrasing with no
  sport named) classified general instead of online — deliberately NOT broadened,
  to avoid false-positive online routing on innocent past-tense questions.

## P0 definition (any one = fail)
wrong time · invented location · invented person · invented time · saved while a
critical field is missing · false "no meeting" when storage has events · raw
transcript saved as notes/title.

## How to extend with real data
1. Collect raw phrases (or STT output) from Martita.
2. Append `['<phrase>', '<expected intent>']` rows to `CORPUS`.
3. `npx vitest run src/screens/AbuAI/finalProductionGates.test.ts`.
4. Any P0 fails the suite; fix the code (never the test).
