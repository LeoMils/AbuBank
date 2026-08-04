# Production Convergence — Worklog

## Session 2026-08-04 (build 0.172.0 → 0.173.0)

### Reality restored from evidence (not narrative)
- Branch `rc5/cognitive-architecture-and-acceptance`, HEAD `1c9e750` at start.
- Version contract in sync at 0.172.0 (`src/version.ts` == `api/health.ts`).
- Certified ADR-0001 present; realtime control plane / kernel / truth monitor / function bridge all exist and are tested.
- **Baseline gates (real commands):** `tsc --noEmit` exit 0; `vitest run` → 422 files, **11938 passed / 2 todo**; realtime slice **81 passed**.

### Defect found + fixed (automatable, mechanism-first)
Audited the live realtime path per mission §0 ("truth-monitor false positives in normal forward Hebrew"). Found **two real over-block defects** with **no test protecting the buggy behavior**:
1. `TM-FP-001` (High) — the `כבר…` completion group carried 2nd-person `שלחת` ("YOU sent"); an assistant question `כבר שלחת לו?` was flagged as a fabricated 1st-person completion → nonsensical self-repair.
2. `TM-FP-002` (Medium) — `דיברתי עם` lacked the `לא ` negation guard every other completion verb had; `לא דיברתי עם מור` over-blocked.

Process: **red test first** (2 failing, confirmed the defect) → minimal fix in `truthMonitor.ts` (negation guard on both; dropped 2nd-person `שלחת`) → green (23/23) → live-path suite still green → version bump 0.173.0 → contract synced → typecheck 0.

Positive fabrications still caught (`כבר שלחתי`, `דיברתי עם … והכל סודר`) — proven by retained assertions.

### Honest limits (NOT closed this session — blockers, not scope cuts)
- **PHYSICAL_ONLY:** real mic Hebrew capture, audible warmth/prosody, on-device latency feel, WhatsApp/dialer launch.
- **LIVE-PROVIDER BLOCKED:** the configuration tournament (VAD/voice/model/eagerness) and true audio-native duplex need a live OpenAI Realtime session unavailable here.
- **DEPLOYED-TELEMETRY BLOCKED:** baseline latency/failure distributions need an instrumented deployed candidate with traffic. Not fabricated.

## PHYSICAL_PROTOCOL (run on a real iPhone; 1–5 rubric, explicit pass/fail)
1. Hebrew mic capture, quiet + noisy — transcript accepted, no infinite "מקשיבה…" (pass = bounded).
2. Short + long utterances, meaningful pauses, fast speech — no premature turn end.
3. Interruption at start / middle / end + repeated interruption — obsolete audio stops, no accepted input lost.
4. Correction + frustration + complaint-about-the-system — exits action clarification immediately.
5. WhatsApp↔Call handoff + Calendar field correction — one state authority, unrelated fields preserved.
6. Fallback / reconnect mid-tool — committed draft preserved.
7. Actual WhatsApp launch + actual dialer launch (manual send/dial only).
8. Voice warmth, clarity of names/dates, pacing, latency feel, cognitive effort (perceptual 1–5).
Each physical failure → permanent automated/simulated regression where technically possible.
