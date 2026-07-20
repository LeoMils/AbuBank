# Standing Proof Obligations — binding law for the INTAKE REBUILD

These 15 obligations govern every remaining intake session. They are proof
obligations, not suggestions. Success metric (#15): **Leo and Martita speak
naturally without thinking about the software.** Readiness is decided only by
Leo's free-language device round.

1. Prove the SYSTEM (whole conversations), never only components.
2. Migration requires SHADOW validation — run old + new in parallel, compare every
   turn, classify divergences, root-cause, only then migrate.
3. Everything before deterministic execution is domain-independent — meaning first,
   execution second.
4. Understanding tolerates paraphrase, omission, dictation corruption, fragments,
   indirect reference, corrections, follow-ups, multilingual mixing — not only morphology.
5. The interpreter answers only "what did the user mean", NEVER "what is true" — truth
   stays exclusively in deterministic engines.
6. No production replacement without shadow metrics (agreement, disagreement,
   recovered understanding, prevented hallucinations, clarification delta, latency delta).
7. Report understanding KPIs, not test counts (semantic recovery, ambiguity, clarification,
   false-clarification, correction recovery, follow-up continuity, unresolved-intent rates).
8. Latency is a product feature — publish p50/p95/worst per stage.
9. Explicit FAIL-CLOSED handling: timeout, malformed/partial schema, unsupported op,
   provider down, contradictory interpretation, low confidence, equal-valid interpretations —
   never fabricate structured meaning.
10. Cache normalized MEANING, never raw text; equivalent utterances reuse, different never collide.
11. Every new Leo transcript auto-becomes GOLD replay + regression + mutation + variation source.
12. One continuous recovery program resuming a single state machine — not sessions.
13. Explicit RETIREMENT criteria for the old intake — never two production intakes indefinitely.
14. Before each architectural decision, try to prove yourself WRONG (duplicate mechanisms,
    hidden live paths, stale runtime, unnecessary LLM calls, simpler designs).
15. Success = Leo and Martita speak naturally without thinking about the software.

## Discharge status

| # | Status | Evidence |
|---|---|---|
| 2 · shadow validation | **DONE (family intake)** | `src/eval/intakeShadow.ts` + `intakeShadow.test.ts`: legacy-vs-seam over a 1419-item corpus. |
| 6 · shadow metrics | **DONE (family intake)** | KPI: total=1419, agree=1101, recovered=318, regressed=0, disagree=0. |
| 13 · retirement | **DONE (family intake)** | Criterion `regressed=0 && disagree=0` MET → legacy REL retired to `legacyFamilyIntake.ts` (shadow-only, not wired); live `answerFamilyRelation` is seam-only. |
| 14 · prove-yourself-wrong | **DONE (this migration)** | Verified the legacy REL's only unique shape ("ממי X גרושה") is now in the seam; the shadow proves no other unique capability. Two intakes → one. |
| 3 · meaning before execution | Holds by design | `understandingIntake`: interpret → groundIntent (engines). |
| 5 · interpreter ≠ truth | Holds by design | interpret returns personRefs/dateWords (phrases), truth only in `groundIntent`. To be covered by an explicit test. |
| 1,4,7(full),8,9,10,11,12 | **OPEN** | Next: fail-closed suite (#9), latency stage KPIs (#8), meaning-cache (#10), transcript→gold auto-pipeline (#11), broader shadow over create/ledger paths (#2 for all paths), paraphrase/multilingual tolerance (#4). |

## Retirement record — legacy family REL intake (0.150.0)

- **Old**: `legacyAnswerFamilyRelation` (per-form regex list). **New**: seam
  (`answerFamilyRelation` → `parseRelationQuery` + `resolveByType`).
- **Shadow**: 1419 corpus turns · 0 regressed · 0 disagree · 318 recovered.
- **Retired**: REL removed from the live path; kept only in `legacyFamilyIntake.ts`
  as the shadow baseline (quarantined, never re-wired). One intake per capability.
