# RC7 FAILURE LEDGER

Every known non-microphone defect, with disposition. Format: ID · defect · root-cause layer · status · evidence/plan.

## FIXED & PROVEN this RC (commits c5373ec → bf4a94c → readback fix)
| ID | Defect | Layer | Evidence |
|----|--------|-------|----------|
| F-01 | ~22 answer paths bypassed the composer | runtime bypass | `companionRuntimeGuard.test.ts` (no banned literal; composer on every dynamic path) |
| F-02 | Streaming/open-chat output unguarded | composer | both streaming finalizations run `enforceCompanion` |
| F-03 | Wrong-day calendar read (UTC vs local) | calendar | `tools.ts` local dates; `warRoom` T2 |
| F-04 | Recurring create fake-saved (no readback) | calendar | readback added; partial/fail reported honestly |
| F-05 | Exact/after-time never filtered the answer (unfiltered summary) | calendar render | summary rebuilt from filtered events; `warRoom` T2b |
| F-06 | Before-time query missing | calendar | added; `warRoom` T2b |
| F-07 | Readback matched title+date, not time | calendar | now `title+date+time` (both confirm-save sites) |
| F-08 | "מי זאת X" ≡ "ספרי לי על X" (identical) | Hebrew tone | terse/rich split; `familyTone.test.ts` |
| F-09 | "X — relationshipHebrew" database dumps | Hebrew tone | warm role phrasing; pets/friends keep short descriptor |
| F-10 | Spanish "Hijos:" colon-dump + Hebrew-script names | Spanish tone | Rioplatense + Latin names; `familyTone.test.ts` |
| F-11 | Planner continuity computed but unused | memory | rewrite to grounded query; rc6 harness grounds "ספרי לי עליה" |
| F-12 | Standalone "עזבי"/"לא לזה התכוונתי" unhandled | memory | warm abort handler |
| F-13 | great-grand/aunt/uncle single-entity queries described the person | family | relational resolver extended; 3 regressions |
| F-14 | Yarden→missing עילי / Papi→lost ז"ל / Tutsi→lost כלב | family tone | partner extraction ("אשת X"), husband role, pet descriptor |

## BLOCKED — external (keys/network); executable harness ready
| ID | Defect / gate | Blocker | Unblock command | Prepared artifact |
|----|---------------|---------|-----------------|-------------------|
| B-01 | Online grounding/freshness (news/weather/movies/sports) | no network + no key | `export OPENAI_API_KEY=… RC7_ALLOW_NETWORK=1; npx tsx acceptance/rc7LiveAcceptance.harness.ts` | harness + `rc7-live-scenarios.json` (online suite) |
| B-02 | Real-model Hebrew/Spanish prose tone (open chat, general knowledge) | no provider key | same as B-01 | scenarios: general_knowledge, mixed_he_es, papi_emotional |
| B-03 | Companion feeling / long-conversation coherence (10–30 LLM turns) | no provider key | same as B-01 | scenarios: long_context (12-turn seed) |
The blocked gate writes `docs/abuai/RC7_LIVE_GATE_STATUS.md` on every run (currently `BLOCKED_BY_KEYS`).

## CODE-FIXABLE — not done this session (honest)
| ID | Defect | Why deferred | Plan / location |
|----|--------|--------------|-----------------|
| L-2 | Spanish/English relational "la hija de Mor" answers about Mor | router/service Spanish relational path is Hebrew-regex only | mirror the `service.ts:429` role resolver for `SPANISH_WHO_IS`/`la X de Y`; route to gender-aware resolver |
| L-3 | Persistence is localStorage (evictable; no cross-device) | large/risky migration; not attempted blind at session end | IndexedDB store w/ schema version + export/import; keep readback discipline; add `fake-indexeddb` reload test |
| L-4 | Bare-word time after לפני/אחרי ("אחרי ארבע" needs ב-prefix) | parser limit | extend `parseHebrewTimeDetailed` to accept bare hour-word following לפני/אחרי |

## HUMAN-ONLY decision
| ID | Item | Needs |
|----|------|-------|
| L-1 | Pepe's memorial date: `family_data.json` says 01-01; `.claude/rules` say 12-26 | Leo to confirm the correct date; the model will not invent it. Then single-source it. |
| L-5 | `birthdays_registry.yaml` Yarden contradiction (hand-maintained `memory/*`) | HUMAN_APPROVAL to edit `memory/*`; runtime unaffected (reads JSON). |

## Summary
- **14 defects fixed & proven** this RC; **3 gates BLOCKED_BY_KEYS** (harness + commands ready); **3 code-fixable deferred** (L-2/L-3/L-4 with exact plans); **2 human-only** (L-1/L-5).
- No Planner/Composer bypass remains. No fake-save. Exact-time correct. Family graph consistent at runtime.
