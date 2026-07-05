# Semantic Intelligence Engine v2 — architecture + runtime flow

**Build:** `0.35.0-semantic-intelligence-v2`. The runtime no longer trusts the STT
transcript. A Semantic Intelligence Engine sits immediately after STT and before every
downstream engine, recovering imperfect speech and resolving intent from fused context.

## Runtime flow

```
Speech
  ↓
STT transcript (imperfect: substitutions / dropped / duplicated / mis-spaced)
  ↓
Semantic Intelligence Engine   ← recoverTranscript() : canonical utterance
  ↓                              resolveSemanticIntent() : {intent, confidence,
Conversation Engine v2                                     alternatives, reason, clarify}
  ↓
Intent → Calendar Builder v2 · Family graph · Online Engine v2 · Memory
  ↓
Response (+ Speech delivery)
```

Wired in `cognitiveRuntime.runCognitiveTurn` as **Layer 1.5** (after normalize, before
classify): `normalized = recoverTranscript(norm.normalized).text` — so Conversation
Engine v2, Calendar Builder v2, Family, and Online all see the recovered utterance.

## Components

- **Semantic Intelligence Engine** (`semanticIntelligenceEngine.ts`)
  - `recoverTranscript(text)` — a DATA-DRIVEN recovery lexicon (STT confusions + Hebrew
    morphology + conversational shortcuts + dedup), not scattered regex. Examples:
    "קלי פגישה" → "קבעי לי פגישה"; "מי זאת אופיר" → "מי זה אופיר"; "תיקבע" → "תקבע";
    "פגישה פגישה" → "פגישה". Returns the corrected text + the corrections applied.
  - `resolveSemanticIntent(text, ctx)` — a SCORED intent model with context fusion
    (pending action, known family names via the graph, calendar/live cues). Emits
    `intent` + `confidence` + `alternatives` + `reason` + `needsClarification`. Intent
    emerges from fused signals, never regex order.

- **Online Engine v2** (`onlineEngineV2.ts`) — a real engine: `classifyInformationNeed`
  distinguishes live / static / personal / calendar / family (only LIVE hits a
  provider — no hallucinated current facts); `runOnlineV2` retries once, fails over,
  caches within a 5-min TTL, and returns a clear honest reason on failure (never a bare
  "אין לי אפשרות").

## Search vs Create vs Read vs Delete (mandatory)

| Utterance | Intent |
|---|---|
| תקבע לי פגישה עם מור | create |
| יש לי פגישה עם מור | **search** (not create) |
| מתי הפגישה עם מור | search/read |
| תבטל את הפגישה עם מור | delete |

## Regression proof (no percentages — reproducibility)

- `semanticCorpus.test.ts` — STT recovery, the confidence model, and the real-runtime
  intents (create/search/read/delete/family/online) for every listed failure. Each is
  impossible to reproduce.
- `onlineEngineV2.test.ts` — classification, retry, cache, honest failure.
- Golden Corpus + production stress harness + full suite stay green with the semantic
  layer active (faithful superset).

## Data (family / calendar) — unchanged

Family knowledge is always preferred (never a question the graph can answer, never
hallucinated); Calendar Builder v2 remains the single event extractor — the Semantic
Engine feeds it a normalized utterance, never a raw transcript.
