# Device-Trace Fixes — Status & Continuity Spec

Branch: `rc5/cognitive-architecture-and-acceptance`. Source: four device traces read "as one
problem" (retrieval broken, session crashes, preambles, shallow online, audio). Order agreed
with Leo: **FIX 4 → 7 → 5 → 3 → 6 → 8**. Each fix: failure-to-regression test FIRST, gates
(typecheck + full suite + build), push to RC. Evidence class is CODE/AUTOMATED-TEST unless a
device listen is noted; nothing is claimed device-proven without a physical reconnect.

## DONE (committed + pushed to RC)

| Fix | What | Version | Commit | Proof |
|-----|------|---------|--------|-------|
| 1+2 | ONE retrieval path for all 68 people; describe-the-path (never "no relation") | 0.215.0 | 52b0f77 | reachability harness 214→**215/215**; full suite green |
| 4 | `conversation_already_has_active_response` crash → non-fatal + response.create gated/deferred; barge-in answered after the active response | 0.216.0 | d8209e5 | 3 liveSession regressions |
| 7 | announce-before-checking preamble: strengthened live rule + neutralised the dead `instantAcknowledgement` seed + **build-failing guard** (`announceBeforeChecking.guard.test.ts`) | 0.217.0 | d95d312 | guard + full suite |
| 5 | tools always return: sync `dispatch` try/catch + async online 8s timeout + honest fallback + log every non-returning call (`recorder.onToolIssue`) | 0.218.0 | bea5aa1 | 2 liveTools regressions |
| 3 | life history + places retrieval path: `knowledge/life_history.json` + `history_lookup` tool + wired + harness | 0.219.0 | d2a8a1e | historyLookup.test.ts |

### Mechanism notes (so they are not re-derived)
- **FIX 1 root cause:** extended family was role-only, never in the derived kinship graph;
  Martita had no spouse edge to Papi, no parents/siblings; Papi's side fully disconnected. Fixed
  in the SOURCE OF TRUTH (`knowledge/family_data.json`) by adding the missing structural edges
  (spouse + `children` arrays), then `npm run generate:memory`. No second tier, no special-case.
- **FIX 2:** `kinship.describePathBetween` — bounded BFS (≤4 hops) rendered in Hebrew.
- **FIX 4:** `LIVE_INTERRUPT_RESPONSE=false` is deliberate (echo/truncation fix) — do NOT flip.
  The crash was the fatal error handler + self-collisions. `activeResponse`/`pendingResponseCreate`
  gate `response.create` in `LiveSession.send`; the race is recorded, not fatal.
- **FIX 7:** live-voice preambles are the REALTIME MODEL (no code seed in liveSession/liveTools).
  `instantAcknowledgement.ts` is dead (test-only). The lever for the model is the instruction.
- **FIX 3:** `martita_personality.yaml`→`life_history` block existed but no tool read it; now the
  seed of `knowledge/life_history.json`. Genuine gaps kept unknown: how Martita/Papi met; exact
  store commercial sequence; canonical spelling of the first Bat Yam address; Casa Milstein dates.

## OPEN — next actions

### FIX 6 — online is too shallow (NEXT)
Redesign the news query + follow-up flow and cinema.
- **News briefing shape:** Martita wants ≥10 headlines across Israel / world / culture /
  entertainment / society / health — **no sports, no economics** — then she picks one and asks
  for depth. Today `get_current_info` returns ~3 headlines with no category shape or follow-up.
- Where: `api/abuai-online.ts` (server grounded endpoint) + the `get_current_info` path in
  `src/services/liveTools.ts` (`handleOnline`) + instruction shape for the briefing + follow-up.
  Consider a `mode: 'briefing' | 'depth'` on the online query; briefing returns a categorised
  headline list, depth expands one. Keep `NO TOOL RESULT = NO CLAIM`. Online acceptance is
  PREVIEW/PRODUCTION class (real provider) — the local harness can prove the SHAPE, not liveness.
- **Cinema:** listings return almost nothing and no plot summaries. Either make cinema a real
  grounded capability (a provider that returns showtimes + synopses) OR have Abu say plainly it
  cannot do cinema well. Do not fake it.
- Add harness coverage for the briefing shape (≥10 items, categories present, no sports/economics)
  and the depth follow-up.

### FIX 8 — audio (needs DEVICE measurement, do not assume)
Two device symptoms: (a) only the FIRST sentence is heard; (b) a second voice speaks over her at
session start. Both unfixed. MEASURE on device before changing anything.
- Likely surfaces: `src/services/liveSession.ts` audio path (WebAudio sink + muted keep-alive
  element — double playback if both become audible → the "second voice"), the greeting
  (`buildGreetingResponse`) vs an auto VAD response at start, and truncation (first-sentence-only
  may relate to `response.done` phase handling / an early turn-end, or a server truncation from an
  echo — see the `LIVE_INTERRUPT_RESPONSE` note). The flight recorder already records truncation
  evidence + connection/payload size + recoverable races + tool issues — use a real device trace.
- This is PHYSICAL_DEVICE evidence only; code changes must be validated by a device listen.

## Useful commands
- Gates: `npm run typecheck`; `npm test`; `npm run build` (sequential, never simultaneous).
- Family data change: edit `knowledge/family_data.json` → `npm run generate:memory` →
  `npm run validate:knowledge`. Never hand-edit `memory/*`.
- Version bump (3 surfaces in sync, NO straight apostrophe in the label — health.ts parses it
  with a single-quoted literal): `src/version.ts` + `api/health.ts` + `src/version.test.ts`.
- Deployed preview health/token: `GET /api/health`, `POST /api/realtime-token`.
