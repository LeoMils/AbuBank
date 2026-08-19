# Abu AI — Final Execution Spec (durable mission body)

The detailed mission that cannot fit in `/goal`. The machine oracle is
`npm run qa:production-gate` (pure logic: `src/engineering-os/productionGate.ts`).
Do not merge main. Do not deploy Production. Do not change ADR-0001 without
executable contradiction evidence.

## 0. Fixed denominator — Definition of Done
**100% AUTOMATABLE PRODUCTION CANDIDATE** means ALL of:
- zero open automatable Critical/High product rows in `scorecard.json`;
- Communication, Calendar and general conversation under ADR-0001 (one control
  plane, one truth/kernel, one Realtime conversation — no second semantic brain);
- deterministic truth/action/state proven (ordering, revision, generation, dedup);
- automatable conversation / Hebrew / long-session / repair complete;
- whole-product Critical/High QA complete (property/race/fault/mutation/privacy/
  security/a11y/perf/cost/quota/persistence/PWA-update);
- tested == pushed == deployed on Preview/stable RC (cache-busted health fingerprint);
- rollback proven;
- only concretely-evidenced physical or inaccessible-external checks remain.

## 1. Product inventory reconciliation
Reconcile: routes/screens (Home, AbuAI, AbuWhatsApp, Settings, Calendar, Opening,
Offline, Error, Admin); runtime journeys; APIs (`api/*`); providers (Groq/Gemini
free client-side; OpenAI/Azure server-only); state/effect boundaries; local
(IndexedDB `durableStore`) + remote storage; PWA/service-worker lifecycle; Realtime
+ fallback; Communication + Calendar; historical failure corpus; a11y/older-adult;
privacy/security/perf/cost/reliability. Every Critical/High surface = one scorecard row.

## 2. Evidence-class ladder (weakest→strongest)
`STATIC < UNIT < INTEGRATION < PRODUCTION_ADAPTER < BROWSER < DEPLOYED_PREVIEW <
LIVE_PROVIDER < PHYSICAL_DEVICE < PRODUCTION`.
Rule: require the strongest class technically relevant to the row. A deterministic
reducer does not need a phone (INTEGRATION/PRODUCTION_ADAPTER is its ceiling). A
visible user journey does not pass on reducer tests alone (needs BROWSER/DEPLOYED).
A voice-quality claim does not pass on text fixtures (PHYSICAL_DEVICE).

## 3. Scorecard schema (derived contract)
Per row: `id, surface, severity(Critical|High|Medium|Low), classification(
automatable|physical|external), owner, oracle, minEvidenceClass, currentEvidenceClass,
tests[], evidenceArtifact, fingerprint{commit,build}, rollbackTrigger, status(PROVEN|
PARTIAL|GAP|TESTED_NOT_DEPLOYED|STALE|EXTERNAL_BLOCKER|PHYSICAL_ONLY), blockerProof?`.
`blockerProof` is REQUIRED for PHYSICAL_ONLY/EXTERNAL_BLOCKER. Green is derived, never typed.

**Inventory reconciliation:** `product-inventory.json` lists every REQUIRED Critical/High
id; the gate raises `MISSING_INVENTORY_ROW` if any is absent — deleting/omitting a row
cannot PASS. **Anti-gaming reason codes** the gate enforces: `OPEN_ROW`,
`EVIDENCE_DEFICIT`, `FALSE_GREEN`, `MISSING_TEST_FILE`, `MISSING_EVIDENCE_ARTIFACT`,
`DUPLICATE_EVIDENCE`, `STALE_ROW_BUILD`, `STALE_FINGERPRINT`, `PREFIX_ONLY_FINGERPRINT`,
`MISCLASSIFIED_PHYSICAL/EXTERNAL`, `FAKE_PHYSICAL/EXTERNAL_BLOCKER`,
`UNPROVEN_BLOCKER_HIDES_WORK`, `MISSING_ROLLBACK`, `MISSING_INVENTORY_ROW/MANIFEST`,
`DUPLICATE_ID`, `BAD_SEVERITY/CLASSIFICATION/STATUS/*_EVIDENCE`, `UNREADABLE_SCORECARD`.
Stop enforcement: `npm run abu:goal:{arm,status,disarm}` (arm as execution step 0).

## 4. Defect lifecycle (every defect)
reproduce → identify first divergence → **failing-first** regression → fix the
mechanism (not the phrase) → **mutation-prove** the regression → exercise the
strongest available production path → update `failure-corpus.json` → continue.

## 5. Execution critical path (authoritative order)
0. Restore reality; deploy + fingerprint the latest tested candidate.
1. Reconcile inventory; make the gate truthful.
2. Audit `AbuCalendar` before editing.
3. Migrate Calendar under ADR-0001 (failing-first).
4. Unify Calendar/Communication/general conversation.
5. Complete Hebrew / complaint / repair / repetition / long-session work.
6. Add provider/latency/VAD/voice instrumentation + experiment runners.
7. Run live-provider experiments where creds permit; else prove access blockers.
8. Whole-product Critical/High property/race/fault/mutation QA.
9. Independent hostile review; remove false greens.
10. Commit/push; deploy Preview + stable RC; fingerprint; falsify; prove rollback.
11. Run `qa:production-gate` until exit 0.

## 6. Calendar migration contract (ADR-0001)
One rich typed draft: participant/entity, unresolved relationship, title, date,
time, duration, location, notes, provenance, missing fields, revision, confirmation
state. Field-level corrections preserve unrelated fields. Relationship uncertainty
stays unresolved ("brother of Mor" never silently becomes Leo). Capability from
deterministic calendar tools; reads via grounded receipts; confirm+commit consume
the SAME revision. Calendar cannot steal Communication turns; date words inside a
message never trigger Calendar; general talk cannot mutate the draft; fallback
preserves the committed draft. No separate Calendar conversational brain.

## 7. Conversation-quality contract
Topic continuity; latest correction wins; natural replace/cancel; explicit domain
switch; complaints + meta-conversation exit action-clarification immediately;
acknowledge a real system mistake; concise adult-to-adult Hebrew; no infantilizing;
no repeated greeting; semantic-repetition detection (not phrase blacklists).

## 8. Long-session / context contract
Bounded working memory: current topic, latest correction, active action, unresolved
ambiguity, recent complaint, grounded receipts, overused patterns, bounded summary.
Summaries MUST preserve negation, correction, replacement, unresolved questions,
provenance, recency. Current typed state overrides summary prose. Prove over long
mixed sessions, not isolated turns.

## 9. Realtime/provider instrumentation contract
Privacy-safe event timestamps (audio start/end, transcript accepted, turn committed,
first model audio, function request/completion, action committed, card visible,
interruption, obsolete-playback stopped, fallback entered, reconnect completed, turn
completed). Distributions not examples. Frozen baseline before optimization. Config
tournament (model/VAD/voice/eagerness/thresholds) on ONE frozen corpus + identical
metrics; select a Pareto winner; reject naturalness that weakens truth/privacy/
correction/latency-tails/action-consistency.

## 10. Whole-product QA contract
Model-based state exploration; property tests; duplicate/reordered/delayed events;
malformed provider results; timeouts/quota; persistence/reopen/update; mobile
viewports; a11y; privacy; security; performance; long-session pressure; recovery and
recovery-failure. Every grader must reject known-bad adversarial cases.

## 11. Deployment & rollback contract
Version contract synced (version.ts == api/health.ts == version.test.ts). Preview +
stable RC only; never Production, never merge main. Prove tested==pushed==deployed
via cache-busted `/api/health`. Prove rollback (revert restores prior build). No
billable key in a client bundle.

## 12. External / physical blocker proof requirements
`EXTERNAL_BLOCKER` allowed ONLY after: concrete failed-access evidence recorded; all
instrumentation/corpus/runner/matrix/offline prep complete; every unaffected
automatable Critical/High row proven. `physical` applies only to genuine microphone,
acoustic perception, native iPhone handoff, subjective human judgment. Never
fabricate green.

## 13. Terminal verdicts (only these)
- **A. PRODUCTION CANDIDATE PROVEN** — gate exit 0 AND structured physical validation passed.
- **B. AUTOMATABLE PRODUCTION CANDIDATE PROVEN** — gate exit 0; only precisely-evidenced
  physical/external checks remain.
"next phase", "authorization needed", "large scope", "audit complete",
"recommendations", another prompt — are NOT terminal.
