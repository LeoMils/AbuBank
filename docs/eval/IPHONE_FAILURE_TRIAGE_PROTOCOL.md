# iPhone Failure Triage Protocol

For EVERY failure Leo reports from the iPhone acceptance script.

## Inputs required (from the one-click debug flow)
1. Last 20 turns (copied via Settings or the error screen).
2. Screenshot.
3. Exact spoken/typed sentence (verbatim).
4. Expected result.

## Procedure (per failure)
1. **Reproduce in code** — drive the exact sentence(s) + state through the REAL
   `ExecutiveCognitiveController` (and `parseAppointmentText` for the calendar UI path).
   If it reproduces → it is a code failure.
2. **Add a failing regression FIRST** — encode the exact input + expected + forbidden as
   a case in `goldenAcceptanceCorpus.ts` (or the relevant harness). It must FAIL first.
3. **Root-cause fix** — fix the engine/component, never the reported phrase alone.
4. **Rerun full gates** — typecheck · full tests · build · validate:family · validate:knowledge ·
   runtimePathProof · golden corpus · production stress harness · finalCodeSideCompletion.
   All must pass; the new regression now passes.
5. **Deploy a new preview** — `vercel deploy`; verify `/api/health` build version; send Leo the URL.
6. **If NOT reproducible in code** — classify honestly:
   - device/visual/voice-only (pixel, safe-area, mic, TTS) → add to the checklist, needs device;
   - data question (e.g. a family fact) → confirm with Leo, update `family_data.json` +
     `family_graph.json` + regeneration + the pinned regression together (never guess).

## Rules
- Never claim a failure is fixed without the regression passing through the real runtime.
- Never merge to main during triage.
- Only declare **DEVICE GO** when Leo's full iPhone script passes with 0 ❌.
