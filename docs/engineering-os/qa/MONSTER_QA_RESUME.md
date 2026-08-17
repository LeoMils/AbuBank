# Monster QA — Track A/B Deterministic Resume (persist, not exit)

**Resume from EVIDENCE (git + docs/eval/*.json + this file), not recollection.** Branch
`rc5/cognitive-architecture-and-acceptance` · never merge main · never deploy production without
explicit owner authorization. Repository truth > any prompt. Machine evidence > narrative.

## CANDIDATE (locked-clean; area roll-up GO 9/9; RELEASE_LOCK.json frozen — AUTHORITATIVE)
- **CURRENT RC: `https://abu-bank-353hxn1ha-leos-projects-d3c04c09.vercel.app` · `0.291.0-earonly`** ·
  Preview. RUNTIME_SOURCE_SHA `237bef9`. (Earlier notes referencing 73o7i62wf/0.290, njy2ocyw1/0.288,
  ridxlew2v/0.289 are SUPERSEDED — read RELEASE_LOCK.json, not prose.) RECONCILIATION LESSON: a runtime
  change (synthesize.ts / api/*) invalidates the RC — re-deploy + re-run `qa:monster rc`, use the new id.
- **EXIT CONTRACT (I3) now truthful:** the 9/9 area roll-up is GO but `qa:monster rc` correctly **exits 3
  (RC_REJECTED)** because `QA_SYSTEM=INCOMPLETE_PRODUCTIZATION` (Track B pending). Legacy `pass?0:1` would
  have exited 0 — that false-success is closed. See `docs/engineering-os/qa/QA_MONSTER_OPERATOR.md`.
- Bundle secret-clean via the REPAIRED calibrated scanner (explicit target, fail-closed): 27 chunks / 0 tokens.
- HEAD `0e37e5f`; pushed. Full suite GREEN (13429). control-plane `cp_bfccc899`. Lock: RELEASE_LOCK.json.
- NORTH-STAR AUTOMATABLE_DEFECT_ESCAPES_DISCOVERED_BY_LEO = 0.

## DONE (do NOT redo — frozen/committed; reuse the mechanisms)
- **A0** reconciled (branch/HEAD/RC/build verified from git + /api/health).
- **A1** 13 red voice/STT tests RESOLVED (778db17) — classified STALE_AFTER_INTENTIONAL_CHANGE
  (Groq/Gemini client removed), updated to the NEW server-only arch, replacement DEPLOYED-PROVEN
  (rc-acceptance-replacement-paths 4/4 TTS→STT round-trip); not weakened.
- **A2** security detector REPAIRED + CALIBRATED (7534cbf): `src/engineering-os/deployedSecretScan.ts`
  (explicit target, fail-closed, chunk-graph, credential MATERIAL) + calibration test (8) +
  `scripts/scan-deployed-secrets.ts` rewritten. Proof: clean RC→CLEAN, prod alias abu-ela-rc→EXPOSED.
- **A6** hostile-retrieval guard (fe339a2): `retrievalGuard.sanitizeRetrievedText` wired into
  synthesize.ts; 13 tests. Architecture already executes nothing from retrieved content.
- **§1 Yarden CLASS fix** (7ef2c5a) — spouse-of-descendant in-laws first-class on BOTH paths;
  deployed-proven: historical corpus **AUTOMATABLE_DEFECT_ESCAPES_DISCOVERED_BY_LEO = 0**.
- **§3 dated-SEARCH** (6b77a20) — news/latest-result freshness capability (provider dates → oracle).
- **§6 QA-of-QA** (5f5750b) — 8 detector classes fire on planted defects.
- Deployed acceptance on njy2ocyw1: calendar 7/7 · whatsapp 5/5 · temporal (weather/FX FRESH_CERTIFIED)
  · replacement 4/4 · tool-sequencing CONTRACT_HELD · corpus north-star=0 · secret-clean.
- **B1** canonical orchestrator (18ea4bc): `node scripts/qa-monster.mjs <feature|rc|production> [url]`
  → `docs/eval/QA_MONSTER_REPORT.json`. Reuses all frozen scripts. `feature` = GO.

## DONE since last checkpoint
- **A2** scanner repaired+calibrated (7534cbf). **A6** injection guard (fe339a2). **A7** proxy cost caps
  (e134a15). **A8** idempotent create — full-content dedup (e134a15). **A9** RELEASE_LOCK.json (0e37e5f).
  **A10** `qa:monster rc` = GO 9/9 on 73o7i62wf (0e37e5f). **B1** orchestrator (18ea4bc).

## DONE this checkpoint (exit-contract hardening — harness-only, runtime UNCHANGED)
- **I3 mode-aware fail-closed exit contract.** Extracted the release decision into a PURE module
  `scripts/qa-monster-verdict.mjs` (imported by the orchestrator AND its test — one code path). Exit now
  derives from the release state machine, never the area roll-up: `0` success / `2` usage / `3`
  RELEASE_REJECTED (NO_GO/NOT_READY/remaining>0) / `4` INTEGRITY_FAIL (missing/malformed report, denominator
  shrink, crashed/indeterminate area, pass-by-omission). RC success requires PRODUCT=GO ∧ QA_SYSTEM=READY ∧
  remaining=0; production requires PRODUCTION-class evidence. `qa-monster.mjs` records `exit.{code,state,
  reason,machineClosableUnknown,machineClosableRemaining}` into the report.
- **B11 (partial) exit-contract self-mutation** `src/engineering-os/qaMonsterExitContract.test.ts` — 13
  planted defects (false-success, NO_GO, dirty runtime, denominator shrink, pass-by-omission, crashed area,
  unknown corpus, PREVIEW-not-PRODUCTION, bad mode) each fail for the RIGHT code. Part of the enforced suite
  (13454 green). Feature-mode orchestrator exit proven 0; frozen-RC-data proven → new exit 3.
- `npm run qa:monster <feature|rc|production> [url]` script + `QA_MONSTER_OPERATOR.md` (fresh-session).

## REMAINING MACHINE-CLOSABLE (ordered; exact next actions)
Track A:
- **A5 stochastic reliability** — pre-registered risk-based sampling for stochastic claims (golden
  session, online freshness, family resolution). Define sample plan/stopping/pass-rule BEFORE running;
  record the full distribution; a critical single failure is not averaged away. Budget from MEASURED
  wall-time/provider-calls (do NOT invent Leo's spend). Suggest N=5–10 golden runs + N per online class.
  NOTE: `generativeMarathon` (random-seed) + `relationTermMatrix` (O(n²), 90s) are the borderline tests
  — a qa:monster `unit-suite` flake cleared on re-run; a real pre-registered policy would formalize this.
- **A8-extra PWA** — certify PWA states (fresh/warm/SW update/activation/cache convergence) via
  e2e/service-worker + persistence specs against the RC (idempotency + persisted-state already proven).
Track B (productization floor; after A):
- **B2** measure per-tier cost/runtime; **B3** capability contract/admission+retirement; **B4** change-
  impact→evidence-invalidation; **B5** test-integrity (sensitivity/specificity on co-changed detectors);
  **B6** escape→detector command; **B7** human-residual expiry re-derivation; **B8** provider/model/alias
  drift + evidence TTL; **B9** emergency path + non-deferrable safety kernel; **B10** cross-surface
  critical journeys; **B11** MONSTER-SELF-QA (mutation: omitted capability / stale PASS / wrong target /
  denominator shrink / weakened detector → each must FAIL for the right reason then restore); **B12** CI
  invokes the SAME evaluator + read-only prod synthetics; **B13** finalize the report schema.

## OWNER ACTIONS (OPEN until explicitly confirmed — never mark done without proof)
- Revoke 3 old keys at provider consoles: OpenAI `fp:e39ef3b7` · Gemini `fp:69150fc4` · Groq `fp:a2f25d13`.
  Production/canonical `abu-ela-rc.vercel.app` STILL ships them (re-confirmed by the repaired scanner).
- Authorize a clean PRODUCTION deploy of the locked candidate. Then run `qa-monster production <prodUrl>`.

## HUMAN RESIDUAL (re-derive each release; must tend to shrink)
- Voice audible/perceptual quality (naturalness/latency-feel/interruption-feel) — mic/ear only.
- Voice raw-event grading needs a real device FlightRecorder trace → `qa-monster` can grade it once
  captured (the tool-sequencing oracle is device-ready).
