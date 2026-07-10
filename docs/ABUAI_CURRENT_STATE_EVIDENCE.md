# AbuAI — Current State Evidence (Phase 0, Evolution OS)

> Repository truth captured **before** any Evolution OS behavioral change.
> Method: direct foreground inspection of the working tree at commit `43eb061`,
> branch `rc5/cognitive-architecture-and-acceptance`. No user-facing behavior was
> modified while producing this document. Every row separates **CODE evidence**
> (a file exists and does X) from **RUNTIME evidence** (a command proved X) —
> per `.claude/CLAUDE.md` evidence rules.

## 0. Verified repository facts

| Fact | Claimed (historical) | Verified | Source |
|---|---|---|---|
| App version (package.json) | ~0.9.x | **30.14.0** | `package.json:4` |
| App version (visible badge) | — | **0.57.0-family-alias-resolution** | `src/version.ts:15` |
| Deployment | Vercel prod/preview | `.vercel/` + `api/*.ts` present | dir listing, `api/` |
| Model provider | direct provider calls | serverless proxies: chat/online/stt/tts/realtime-token | `api/abuai-*.ts` |
| Persistence | — | IndexedDB via `idb` + localStorage mirror | `src/services/durableStore.ts` |
| Test/eval corpus | "thousands of tests" | large `src/eval/*` + `src/screens/AbuAI/*.test.ts` (unverified count — see §5) | glob |

**Two version surfaces exist** (`package.json` 30.14.0 vs `version.ts` 0.57.0). This is
a drift risk flagged for the owner; Evolution OS bumps the visible `version.ts`.

## 1. Serving Plane (the production turn path)

**Single no-bypass entry:** `ExecutiveCognitiveController.handleTurn` →
`runFullTurn` → `finalize` (naturalize → dialogue → supervise → deliver) →
`RUNTIME_FINALIZED` stamp, asserted by `noBypassRuntimeGuard`.

- CODE: `executiveCognitiveController.ts`, `runtimeFullTurn.ts`, `runtimeFinalizer.ts`. **Green (code).**
- Every turn already yields a rich structured `FullTurnResult`: `intent, display,
  speak, source, trace(stages+stamp), meta(actualQuestion/entities/missingFields),
  onlineTrace, aiTask, supervisor verdict, sideEffect`.
- RUNTIME: not re-run in Phase 0 beyond typecheck (see §5). **Yellow (runtime).**

**Implication for Evolution OS:** the serving plane already emits everything a
Trace Envelope needs. The turn recorder `recordTurn(...)` is called once per turn
in `executiveCognitiveController.ts:46` — **this is the OBSERVE_ONLY seam.**

## 2. Existing Evidence / Observability substrate (reuse, do not rebuild)

| Component | What it is | Gap vs Evolution OS |
|---|---|---|
| `runtimeTrace.ts` | per-turn pipeline stages + `RUNTIME_FINALIZED` stamp | not a versioned envelope; not persisted/uploaded |
| `liveTurnDiagnostics.ts` (`LiveTurnRecord`) | rich per-turn record, last-20 ring buffer via `memoryEngineV2` | in-memory only; no signal classification; no durable queue; no idempotency |
| `evidencePacket.ts` | typed evidence + confidence; enforces NO-TOOL-RESULT-NO-CLAIM | not persisted as trace evidence |
| `productDiagnostics.ts` | STT→route→TTS pipeline entries, last-20 in localStorage | no redaction; no upload; no dedup |
| `durableStore.ts` | **production IndexedDB**: schema version, idempotent migration, pre-migration backup, corruption recovery, export/import | scoped to user data keys; no append-only event/evidence queue |

**Decision (Section 27 simplicity):** Evolution OS **extends** this substrate. The
durable evidence queue reuses the `KVBackend`/`IndexedDBBackend` pattern; the Trace
Envelope is **derived from** the existing `LiveTurnRecord` + `FullTurnResult`; the
NO-CLAIM contract reuses `evidencePacket`.

## 3. Capability evidence scorecard (Evolution-relevant domains)

| Capability | CODE | RUNTIME | Status | Gap |
|---|---|---|---|---|
| Deterministic turn trace | yes (`runtimeTrace`, `LiveTurnRecord`) | typecheck only | 🟡 | not versioned/durable/uploaded |
| Evidence-gated answers | yes (`evidencePacket`, supervisor) | typecheck only | 🟡 | not captured as evolution evidence |
| Durable persistence | yes (`durableStore`) | has own tests (`durableStore.test.ts`) | 🟢(code) | no evolution event store yet |
| Family/identity grounding | yes (`familyLoader`, family graph) | commit history shows fixes | 🟡 | no generalized entity-resolution failure family |
| Calendar create/read/commit | yes (`AbuCalendar/*`, `tools`) | many tests present | 🟡 | no automatic "claimed-saved-but-not-committed" signal |
| Voice/text parity | yes (`voice = text brain` commit `4899d05`) | device proof absent | 🟡 | no divergence detector |
| Signal detection (explicit/implicit/auto) | **none** | — | 🔴 | Evolution OS adds |
| Failure state machine | **none** | — | 🔴 | Evolution OS adds |
| Secure ingestion + redaction | **none** | — | 🔴 | Evolution OS adds |
| Knowledge-correction pipeline (scoped, conflict-safe) | **none** (corrections handled inline) | — | 🔴 | Evolution OS adds |
| Holdout / candidate evaluation | partial (`src/eval/*` corpora) | — | 🟡 | no baseline-vs-candidate/holdout partitions |

## 4. Hard constraints discovered (bound the design)

- **No server datastore is provisioned.** `api/*` are stateless serverless proxies.
  Server-side persistence of evidence = **STOP condition** (infra/credentials).
  → The vertical slice is **client-durable / offline-first**; the ingestion boundary
  is built as a **pure, tested, server-ready transform** that runs locally now.
- **`memory/*` is generated**; must not be hand-edited. Knowledge proposals target
  `knowledge/*` semantics but never auto-write production knowledge.
- **Do not deploy / merge to main / rotate secrets.** Honored.
- Bash tool is broken in this environment (Git Bash fatal error); PowerShell is the
  shell of record for all commands in this program.

## 5. Baseline verification (Phase 0, step 16)

- `npm run typecheck` — see WAR_ROOM / final report for the exact result of this run.
- Full `npm test` (vitest) was **not** run wholesale in Phase 0 to avoid a long,
  noisy baseline; targeted Evolution OS tests are added and run in later phases and
  their real results are reported. **This is disclosed, not hidden.**

## 6. Status legend

🟢 proven by a passing command · 🟡 code exists, runtime not (re)proven here ·
🔴 not present — Evolution OS introduces it.
