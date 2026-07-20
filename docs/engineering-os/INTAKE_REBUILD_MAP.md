# INTAKE REBUILD — understanding map & sequenced plan

Living doc for the INTAKE REBUILD mandate. Readiness is defined ONLY by Leo's
free-language device round; nothing here claims "works".

## Current intake (mapped against the real 0.140.0 code, not the stale v0.8.1 docs)

Three pattern-bound gates today — this is where nearly all real failures live:

| Path | Entry | Pattern gate | Then |
|---|---|---|---|
| Chat | `AbuAI/index.tsx handleSend` → `cognitiveRuntime.runCognitiveTurn` | `classifyIntent` / `legacyDomainClassify` (regex) | reasoners: `familyReasoner`, `dateReasoner`, `calendarReadReasoner`, online… |
| Calendar | `calendarCreate.ts` | `isCreateIntent` (`CREATE_INTENT` / `CREATE_INTENT_ES` regex); `parseCreateIntent` returns null unless matched | `startCreate`/`updateCreate` slot-fill |
| Ledger | `truth/conversationIntake.ts classifyIntake` | `extractChange` (regex stack) | `familyLaws` gate → `ledgerService.writeFact` |

LLM proxy available for P1 semantic interpretation: `api/abuai-chat.ts` (thin
OpenAI passthrough, SSE + tool-calling). No client-side strict-schema interpret
step exists yet.

Deterministic engines that MUST stay the validators (never the LLM): family
graph (`familyGraph`/`familyReasoning`), date engine (`calendarCreate` parsers),
LAWS gate (`familyLaws`), ledger (`ledgerService`).

## Done — session 1 (P2 foundation)

- **`src/truth/relationMorphology.ts`** — the ONE morphology normalization seam.
  Table-driven Hebrew inflection space → canonical `RelationType`. `parseRelationQuery`
  is now the GATE inside `answerFamilyRelation`; legacy `REL` demoted to fallback.
- New graph resolvers: `childInLawOf` (חתן/כלה), `siblingInLawOf` (גיס/גיסה),
  `parentsPublic`; single `resolveByType`.
- **310 generative tests** auto-derived from the table × the live graph.
- New capability: in-law who-is; morphology-invariant resolution (every inflection
  resolves to the same person); honest emptiness preserved.
- Evidence: CODE. Full suite 11433 pass / 0 regressions. NOT device-proven.

## Done — session 2 (P2 complete: seam feeds ALL paths)

- **create/title** (`calendarCreate.parseCreateIntent`) resolves a relation-phrase
  companion to the real person ("עם בת הזוג של מור"→"פגישה עם יעל"). Replaced the old
  hardcoded 4-word partner regex.
- **search** (`personPhraseResolver.resolvePersonPhrase`) now **delegates** to
  `familyReasoning.resolveSinglePerson`; the parallel per-form resolver engine (its own
  inflection table) was **deleted** — one runtime path per capability.
- **ledger** (`conversationIntake.extractChange`/`classifyIntake`) take an injected
  `PersonResolver` (keeps `truth/` decoupled from the graph); wired at
  `cognitiveRuntime` + `FamilyRecord`. "הבת של מור גרה בחיפה" → fact for אופיר (not the
  anchor מור); poison ("אופיר היא אשתו של רפי") still reaches THE LAWS and is refused.
- Added חם/חמות; hardened `parseRelationQuery` (leading-preposition greedy capture).
- New all-paths suite (`relationSeamPaths.test.ts`) + generative morphology; FULL suite
  11474 pass / 0 regressions (one create-title test updated to the RESOLVED name).

## Done — session 3 (P1 foundation: understanding-first layer)

- **`src/screens/AbuAI/understandingIntake.ts`** — strict `StructuredIntent` schema +
  `interpretUtterance(text, transport)` (LLM half, **injected transport** → MOCK-provable) +
  `groundIntent(si)` (PURE deterministic half: person refs → the ONE seam, date/time → the
  date engine, nothing invented) + `normalizeIntent()` (malformed model JSON → safe `unknown`).
- 13 tests: coercion safety, dictation-corruption recovery (transport contract), deterministic
  grounding, ambiguity → one question, fact/confirmation passthrough. FULL suite 11488 / 0 regress.
- **HONEST LIMIT:** built + test-covered, **NOT yet wired** as the live gate in the async turn
  path. Patterns remain the fast-path cache. Real-provider call + latency = PREVIEW, unproven.

## Done — session 4 (P1 wired live)

- `runtimeFullTurn` `needsLLM` branch (the pattern MISS) now runs understanding: real transport
  `makeInterpretTransport` → `sendServerChat` → `/api/abuai-chat` (strict json_schema) →
  `groundIntent` → `groundingLine` enriches the LLM grounding with graph-resolved people +
  engine-parsed date/time. Never decides a relation / invents a person; a failed interpret never
  breaks the turn; latency reported (`onUnderstandLatency` + `[AbuAI][UNDERSTAND|LATENCY]`).
- Wired into `fullTurnBridge.buildFullTurnTools` (live). Tests: transport plumbing (mock fetch) +
  live enrichment/latency/backward-compat (mock transport). FULL suite 11496 / 0 regress.
- **PREVIEW/PENDING:** real provider call + on-device latency proven only on a deploy — not yet.

## Done — session 5 (P3 garble-tolerance)

- Phonetic fold in `relationMorphology` (ק/ך/ח→כ, ט→ת, ע→א, ב→ו, finals), gated ≥3 chars +
  unambiguous → a near-homophone slip in a relation term resolves ("החטן של מור"→גלעד), never a
  wrong person. `garbleMutator.ts` (deterministic) + `garble.test.ts` (survival floor; splits
  left to STT-recovery/P1, measured not hidden). FULL suite 11512 / 0 regress.

## Done — session 6 (P4 calendar audit)

- `calendarJourney.test.ts`: full journey (create→query→edit→delete→recreate) round-trips the
  store; multiple meetings/person allowed; resolved-name titles; STANDING capability-denial probe
  (a "can't do it" on read/search/edit/delete is a hard failure). Test-only. FULL 11516 / 0 regress.

## Done — session 7 (P5 ledger width)

- `extractExplicitFact` (explicit-only) covers education/hobby/event + a generic STORY catch-all,
  gated to KNOWN family persons (via injected `isKnownFamilyPerson`); Martita's own/first-person
  stays personal-memory; medical/financial declined. Shared soft-confirm `extractChange` untouched
  (an eval regression from touching it was caught + reverted). FULL 11529 / 0 regress.
- FOLLOW-UP: FamilyRecord paste-box still uses `extractChange` (no width yet) — can adopt
  `extractExplicitFact` later.

## Done — session 8 (P6 no-fabrication)

- `noFabricationGuard.guardNoFabricatedCalendar` runs before finalize in `runtimeFullTurn`: an
  LLM/fallback answer with an appointment frame + a concrete date/clock is neutralized to an
  honest calendar deferral. Historical dates/prose pass; deterministic/online trusted. 6/6 + FULL
  11536 / 0 regress.

## Done — session 9 (P7 correction-verify + P8 toast)

- P7 `correctionVerification.shouldReverifyOnline` wired in `runtimeFullTurn`: a factual correction
  of a prior online answer re-runs the online search on that topic instead of blind-agreeing.
  correctionVerification 5/5 (incl. live re-search). P8: deduped the "אבחון הקול הועתק" chat bubble
  (BROWSER-class). FULL 11542 / 0 regress.

## Sequenced plan (remaining)

1. **Verification regime** (full corpus green ✅ each cycle · fresh PREVIEW deploy — auto on push,
   human-gated to promote · internal free-language simulation). See "Verification regime" section below. — phonetic/edit-distance mutator (ק↔כ, ה-insertions, splits,
   near-homophones) over the corpus; permanent.
3. **P1 understanding-first intake** — client interpret step against `api/abuai-chat.ts`
   with a STRICT structured-intent schema {operation, person-refs, datetime, place,
   title-from-meaning, fact-to-remember, corrections, confirmations}; patterns become
   a fast-path cache in front of it; deterministic engines validate. Measure + report
   added latency honestly (MOCK/PREVIEW evidence for the LLM half).
4. **P4 calendar state-machine audit** — create→query→edit→delete→recreate journeys;
   multiple meetings per person; capability-denial phrases = hard failures (standing probe).
5. **P5 ledger intake width** — explicit-remember covers all chapter kinds; ban
   "לא יכולה לזכור" wherever the ledger can store; soft-confirm re-offer.
6. **P6 no-fabrication pre-emission guard** — strip/correct any LLM-fabricated
   date/event/family claim before it is spoken.
7. **P7 correction-verification** — a factual correction to an online answer triggers
   re-search before agreeing.
8. **P8 toast spam** — kill the "אבחון הקול הועתק" repeat (reproduce the fire path first).

## Verification regime — status (session 10, 0.149.0)

- ✅ **Full corpus clean**: 387 files / 11546 tests / 0 regressions (every cycle).
- ✅ **Internal free-language simulation**: `src/eval/freeLanguageSimulation.test.ts` — 300+
  generated utterances (morphology × garble × members × who-is/create/correction) asserting the
  rebuild invariants (never a wrong person, never a crash, resolved-name titles, no denial). CODE class.
- ✅ **10-line Hebrew Leo test card**: `docs/engineering-os/LEO_FREE_LANGUAGE_TEST_CARD.md`.
- ⏳ **HUMAN-GATED (not done here)**: the mandate's 200-session run through the DEPLOYED app +
  on-device voice/latency is PREVIEW/PHYSICAL. Vercel Preview auto-builds on push to rc5; promotion
  is human-gated and the preview URL was not fetchable from this environment. Verify via
  `<preview-URL>/api/health` → `buildVersion: 0.149.0-verification-regime`, then run the test card.

**Leo's free-language round decides readiness — nothing else does.**
