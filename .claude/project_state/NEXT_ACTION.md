# NEXT_ACTION

## Highest-ROI next task (found by the ROI cycle, 2026-06-30) — Spanish calendar create
EVIDENCE (ran the pipeline): `isCreateIntent("agendá una reunión con Gabi mañana a
las tres") === false` → a Spanish-speaking Martita CANNOT schedule in her second
language; it falls through to general chat. Spanish online + emotional already work
(`domain=online` / `domain=emotional`), so calendar is the one broken Spanish surface.
WHY HIGHEST-ROI: core feature × her native second language × currently 0% working.
SCOPE (own focused cycle): Spanish create-intent (agendá/anotá/recordame/quiero una
cita…) + Spanish date words (mañana/pasado mañana/el viernes/la semana que viene) +
Spanish hour words (a las tres/y media) + es AM/PM (de la tarde/de la noche/de la
mañana) → reuse the existing meeting pipeline. Add the matching es scenarios to
`benchmarkConversations.ts` (they fail now → fix raises the score).
RISK: low-med (additive parsing in calendarCreate; no architecture change).

---

## Baseline state
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
