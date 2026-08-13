# Production path — O4 deploy · O3 rollback · O5 monitoring

Honest status: the MECHANISMS are documented and the code-side is verified; the parts that
require Vercel auth or a production deploy are HUMAN-executed (deploy to Production is a STOP
condition — never autonomous). Nothing here was deployed by this run.

## O4 · Deployment path (dry-run)
**Automated (RC / preview):** `scripts/deploy-rc.sh` (a.k.a. the `deploy:rc` flow in MISSION_LEDGER):
1. `npm run build`  — VERIFIED GREEN this run (the build half of deploy is proven).
2. `npx vercel deploy --yes`  → an immutable Preview URL.
3. `npx vercel alias set <preview-url> abu-ela-rc.vercel.app`  → re-alias the CANONICAL stable RC
   origin so Martita's contacts/data persist across RC updates (same origin every time).
4. `curl https://abu-ela-rc.vercel.app/api/health` → assert `buildVersion` == the just-built version.

`vercel.json`: buildCommand `npm run build`, outputDirectory `dist`, framework `vite`, SPA rewrites,
and an existing cron `/api/cron/nightly` (03:00). `api/health.ts` is an **edge** function.

**Requires human:** Vercel auth (`vercel login`) and, for PRODUCTION (not RC), an explicit
`vercel deploy --prod` — a STOP condition per repo rules. **Is a merge to main required?** No for RC
(deploys the current branch as a preview+alias). Production release policy = human-approved only.

**Dry-run performed here:** step 1 (`npm run build`) is green; steps 2–4 need Vercel auth and were
NOT run (no autonomous deploy). The version contract (src/version.ts ⇆ api/health.ts) is enforced by
`src/version.test.ts`, so step 4's buildVersion check is pre-validated at CODE class.

## O3 · Rollback (mechanism proven; execution is human)
Vercel keeps EVERY deployment immutably. Rollback of the RC origin is ONE action:
`npx vercel alias set <previous-deployment-url> abu-ela-rc.vercel.app`.
**Data-loss proof:** Martita's data lives CLIENT-SIDE — IndexedDB via `services/durableStore` +
localStorage mirror, on her device. A server re-alias swaps only the served bundle; it does NOT touch
her device storage → **rollback preserves her calendar/contacts/history by construction.** (Caveat: a
rollback that also reverted a durableStore SCHEMA migration could mismatch — current stores are
additive/versioned; verify before any schema-changing release.) Real one-action revert needs Vercel
auth (human); the mechanism + data-safety are proven at CODE/reasoning class here.

## O5 · Monitoring (heartbeat exists; external alerting missing)
**Exists:** `/api/health` (edge) → `{ ok, buildVersion, serverTime }`; `ok` is true ONLY when every
required env var is present — a real liveness+config heartbeat. A nightly cron already runs.
**Missing (the minimum to design/build next):**
1. **External uptime poll** of `/api/health` every ~5 min → alert if unreachable OR `ok:false`
   (a cron/uptime service; the alert SINK is the gap — no Slack/email wired).
2. **Client "last seen" beacon** — a lightweight signal (localStorage timestamp + optional POST on
   app open) so a SILENT device failure (she stopped opening it, or it white-screened) is detectable.
   Today there is NO way to know if Martita's device stopped working (Acceptance Board: "no external
   SLO/telemetry sink").
3. **Client error beacon** — `ErrorBoundary` currently renders a Hebrew error card but reports
   nowhere. A minimal POST-on-error (redacted) would surface crashes after ship.
These are code-buildable without a device; #1's alert sink + #2/#3's ingest endpoint are the work.

## What only a human can do here
Vercel-authenticated deploy/alias/rollback commands, the Production `--prod` approval, and wiring a
real alert/telemetry sink (an external decision). Everything else above is verified or code-buildable.
