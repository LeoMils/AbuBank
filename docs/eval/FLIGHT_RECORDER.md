# Flight Recorder — real conversations become permanent tests

**What it is.** Every real AbuAI turn (typed OR voice) is captured as a **redacted,
text-only** trace and stored locally; an exported transcript can be **imported and replayed**
as a standing regression, so every real-world failure becomes a permanent test.

## The pipeline (reuse, not rebuild)

| Stage | Mechanism | Notes |
| --- | --- | --- |
| Capture | `src/evolution/observer.ts` → `observeTurn` | Wired INSIDE `ExecutiveCognitiveController.handleTurn`, so **both typed and voice** are captured on the one runtime path. OBSERVE_ONLY — can never change a served answer. |
| Redact + minimize | `src/evolution/traceEnvelope.ts` → `buildEnvelope` | Strips PII/secrets, **no audio ever** (only text), dedups by idempotency key. |
| Store (local) | `src/evolution/evidenceQueue.ts` (durable IndexedDB) | Ring buffer, `maxEvents: 500`, `retentionDays: 30`. |
| **Off switch (config)** | `src/evolution/config.ts` | `VITE_EVOLUTION_KILL=1` (or `EvolutionConfig.enabled=false`) silences ALL capture instantly. Default is OBSERVE_ONLY, globally enabled. |
| **Off switch (user)** | `src/evolution/recorderSwitch.ts` → Settings toggle | A user-facing toggle (Settings → About). Persists in localStorage, read PER-TURN at `observeTurn`, so it takes effect immediately and can only make capture SAFER — never escalate. |
| **Export (runtime)** | `src/evolution/recorderExport.ts` → `exportStoredTranscript` / `envelopesToExport` / `serializeExport` | Reads the durable queue → a stable, text-only JSON transcript (the bytes the Settings export button downloads). Round-trips via `parseExport`. Runtime-safe (no controller import). `src/eval/flightRecorderImport.ts` re-exports these so the shape has ONE source. |
| **Import → replay** | `flightRecorderImport.ts` → `replayExport` | Runs every recorded turn back through the SAME app entry the marathon/scorecard use; asserts each recorded truth (`expectContains` / `expectAbsent` / `expectSide`) still holds. Returns the failing turns — it **catches divergence**, never green-washes. |

## Leo's real device transcripts are now a standing test

`importLeoRepro` converts `docs/eval/LEO_DEVICE_FAILURES_REPRO.json` into the replay shape.
Per-turn expectations are derived from the **structured truth fields** (`resolvedToGilad`,
`hasLocation`, `dateTomorrow`, `verbatimDump` …), **not** the recorded `answer` wording —
which was captured before later phrasing fixes (e.g. the Cycle-43 subject-dedup). This keeps
the recorded TRUTH permanent while phrasing is free to improve. All 3 Leo flows replay green
(`src/eval/flightRecorderImport.test.ts`).

## How to turn a new real conversation into a permanent test

1. Use the app; the Flight Recorder captures redacted envelopes locally.
2. Export the transcript (`serializeExport(envelopesToExport(envelopes))`).
3. Commit the exported JSON under `docs/eval/` and add it to the replay suite (or extend
   `importLeoRepro`-style mapping). Add `expectContains`/`expectAbsent`/`expectSide` for the
   truths that must hold. A turn that reds names a real regression to fix with a general root.

## Honest evidence class

**CODE.** The importer + replay run the real controller with mocked `llm`/`online`. The live
capture path is also CODE. A PREVIEW/PHYSICAL claim is a deployed-app / device claim and is
**not** made here.

## User controls (Settings → About) — built in 0.125.0

- **Off-switch toggle** (`data-testid="flight-recorder-toggle"`): "שמירת שיחות (למעקב איכות)".
  On = "נשמר מקומית בלבד — טקסט, בלי הקלטות קול"; Off = "כבוי — שום שיחה לא נשמרת". Persists via
  `recorderSwitch.setRecorderOff`; `observeTurn` honors it per-turn.
- **Export button** (`data-testid="flight-recorder-export"`): "ייצוא השיחות שנשמרו (קובץ)" —
  downloads `abu-flight-recorder-<version>.json` (redacted, text-only) via
  `exportStoredTranscript`.
