# Evolution OS — Operator Runbook

For an operator who did NOT build the system. Everything here is client-side today
(OBSERVE_ONLY, no server upload). Commands are PowerShell (the Bash tool is broken in
this environment).

## Is it on?

- `src/version.ts` shows `0.58.0-evolution-os-observe-slice`.
- Default mode is **OBSERVE_ONLY** (`src/evolution/config.ts` → `DEFAULT_EVOLUTION_CONFIG`).
  It captures evidence but **cannot change any answer**.

## Kill switches

| Scope | How | Effect |
|---|---|---|
| Global | env `VITE_EVOLUTION_KILL=1` (build/deploy time) | `resolveConfig` sets `enabled=false, mode=off` — all machinery is a no-op |
| Global (code) | `DEFAULT_EVOLUTION_CONFIG.enabled = false` | same, without env |
| Per-domain | `DEFAULT_EVOLUTION_CONFIG.domainKill = { calendar: true }` | silences one domain only |

There is no way for env to *escalate* Evolution past OBSERVE_ONLY — that is a code +
human change by design.

## Where the evidence lives

- Browser: IndexedDB database **`abu-evolution`**, store `evidence` (separate from the
  user-data DB `abu-durable` — evidence can never collide with calendar/reminders).
- Each record: redacted `AbuTraceEnvelope` + upload status + retry metadata.
- Retention: `retentionDays` (default 30). `EvidenceQueue.purgeOlderThan` deletes older
  events; dead-letters are exempt unless `force=true`.

## Health check

`report.buildHealthReport(queue, cases, signals, cfg, nowIso)` →
`report.renderHealthReport(...)` prints:
```
collection: total/pending/uploaded/deadLetter
redaction:  pii / secretsRemoved / ok
signals:    gold/silver/bronze (fail/ok)
cases:      open + by-state
warnings:   dead-letter, redaction-not-ok, uploads-delayed, observe-only
```
`safeToPromote` is **always false** in OBSERVE_ONLY — promotion is a human decision.

## Gates & commands

| Gate | Command | Expected |
|---|---|---|
| Typecheck | `npm run typecheck` | exit 0 |
| Unit/behavioral | `npx vitest run src/evolution` | 64 passing |
| Full suite | `npm test` | 1 failed→fixed; ~10,691 passing |
| Build | `npm run build` | exit 0, `dist/sw.js` generated |

## Incident: dead-letters climbing

1. `report` warns when `deadLetter > 0`.
2. Inspect `queue.deadLetters()` — each has `lastError` + `retryCount`.
3. Dead-letters are preserved under ring cap (they need a human). Fix the ingestion
   path, then re-enqueue is a manual, idempotent operation (same idempotency key →
   dedup, never duplicates).

## Incident: redaction not OK

`report.redaction.ok === false` (a stored envelope marked `raw`) → **STOP**. This must
never happen (builder always sets `redacted`). Treat as a P0; disable via kill switch
and inspect `redaction.ts`.

## Data deletion request

`EvidenceQueue.purgeOlderThan(now, 0, true)` force-removes matching evidence. Because
metrics are computed over the queue, deletion reduces counts but does not corrupt them
(no separate aggregate store to desync). Server-side deletion is deferred (no server).

## Rollback (when a candidate reaches a live stage — future)

`release.evaluateRollback(live, DEFAULT_SLO, knownGoodId)`:
- zero-tolerance invariant observed → `auto_rollback` to known-good.
- threshold breach → `recommend_rollback` (human confirms).
`ReleaseRegistry.knownGood()` always retains a predecessor to roll back to.
