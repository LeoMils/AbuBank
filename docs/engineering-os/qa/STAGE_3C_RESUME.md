# Stage 3C — Resume Checkpoint

**Resume from EVIDENCE (the JSON artifacts + git), not this prose.** This file is a human-readable
index; the machine truth is the committed artifacts.

## Control-plane identity
- Frozen control plane: see `control-plane-identity.json` (`controlPlaneId`) — re-frozen after every
  release-critical component change this session.
- Deployed candidate: `0.286.0-earonly` at `https://abu-bank-f3dpms0ta-leos-projects-d3c04c09.vercel.app`
  (health MATCH, read-only verified). Working tree is AHEAD of the deployed RC (control-plane QA is not
  product runtime and is intentionally undeployed).
- Live verdict: `control-plane-live-verdict.json` — **BLOCKED** (honest; remaining obligations below).

## Closed this session (all committed, evidence: CODE unless noted)
1. **o-yield** (§1) — `yieldGate.ts`: CONTINUE_MACHINE_WORK is not a yield. 15 cases.
2. **Standing-authority firewall** (§1 correction) — `requiresNewAuthority()`/`classifyAuthority()`:
   RC/preview/ephemeral-deploy is standing; only production/main/destructive/external needs new authority.
   Records the prior deploy-stop as AUTHORITY_CLASSIFICATION_FALSE_POSITIVE.
3. **Source-completeness oracle** (§3-4) — `capabilityDiscoverySource.ts`: proved the 3-signal producer
   was incomplete (DEVICE_GATED_FLAG / ONLINE_FLAG / DEEP_LINK_ROUTE uncovered).
4. **Producer extension** (§3) — `discover-capabilities.ts` now reads 6 source classes; universe **33 → 41**;
   source-completeness now `complete:true`.
5. **o-claimstate** (§10) — `claimState.ts`: 11-state non-collapsible model; only 2 states satisfy.
6. **Static↔dynamic reconciliation** (§4-5) — `dynamicReachability.ts` (path-equivalent core) +
   read-only observation of the deployed RC (`rc-reachability-observation.json`,
   `capability-reconciliation.json`). Evidence: PREVIEW for UI+flags.

## o-capability — current honest state (see `capability-reconciliation.json`)
- Universe size 41. `canonicalProven: false`.
- **24 STATIC_AND_DYNAMIC_CONFIRMED** (18 UI surfaces rendered via chromium + 6 active feature flags).
- **1 STATIC_ONLY_WITH_VALID_EXPLANATION** (`ONLINE_PREFETCH_WARM` ships OFF by measured design).
- **16 STATE_COVERAGE_INCOMPLETE** = the tool capabilities. All 16 are **deployed-artifact-present**
  in the RC bundle (read-only fingerprint), but live-conversation FIRING was not driven. NOT dropped.

## EXACT next action (critical path)
Close the 16 tool-firing states → then o-capability can be PROVEN and the universe canonical.
1. Build a realtime tool-firing harness driving the deployed RC's cognitive controller.
   - **Read-only tools (safe, real provider calls OK under standing authority):** `get_current_info`,
     `read_calendar`, `people_lookup`, `history_lookup`, `resolve_contact`, `prepare_calendar_event`,
     `remember`, `care_concern`.
   - **Mutating/external tools (need §12 safe side-effect env — synthetic accounts/mocks, NEVER real):**
     `phone_call`, `whatsapp_draft`, `confirm_calendar_event`, `update_calendar_event`,
     `cancel_calendar_event`, `set_reminder`, `cancel_communication`, `correct_calendar_field`.
   - Reuse the SAME reconciliation core (`dynamicReachability.reconcile`) — path-equivalence.
2. Re-run `observe-rc-reachability` + `reconcile-capability-universe`; when `canonicalProven:true`,
   emit `CANONICAL_PRODUCT_CAPABILITY_MANIFEST`.
3. **§6** rerun `constitutionCoverage` against the canonical capability/risk families (FEATURE_CAPABILITY
   is a new family — confirm governed or surface CONSTITUTIONAL_COVERAGE_GAP).
4. **§7 o-denominator** — derive certified denominator (risk classification happens HERE, not before).
5. **§9** o-labcert + o-producers. **§10** o-attest / o-sw / o-privacy / o-ci. **§11** real product acceptance.

## Remaining UNIMPLEMENTED obligations (8)
`o-capability` (finish tool-firing), `o-denominator`, `o-labcert`, `o-producers`, `o-attest`, `o-sw`,
`o-privacy`, `o-ci`. Do NOT assign risk tiers (HIGH/etc.) to the 41 until o-denominator certifies them (§2/§7).
