# NEXT_ACTION

There is NO open code P0. The code side is green and deployed.

Single next action → **RELEASE GATE + DEVICE TEST**:
1. (Leo) Run `docs/abuai/LEO_COMPANION_BREAKTHROUGH_RETEST.md` on the iPhone — the
   only thing that proves criterion #4 (voice E2E) and closes P0-DEVICE.
2. (Leo/account) Restore the Realtime provider key/quota in Vercel env to clear
   P0-REALTIME (optional — the pipeline fallback already ships).
3. (On approval) Merge rc5 → main + promote the Vercel deployment to the prod domain.

Fastest code command to re-prove readiness right now:
`npm run check`  → then build + preview + the two Playwright specs.
Skills: `/verify-production` then `/release-gate`.
