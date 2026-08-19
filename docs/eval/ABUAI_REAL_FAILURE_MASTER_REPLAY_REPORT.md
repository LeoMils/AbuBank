# AbuAI Real Failure Master Replay Report (Phase 3)

**Build:** `0.17.0-behavioral-production-green` · **Verdict: HOLD** (flag default-off; not deployed).

`src/eval/abuaiRealFailureMasterReplay.test.ts` → **27/27 rows, 100% behavior + 100% RUNTIME_FINALIZED**, through `runFullTurn` (the live no-bypass path).

Covers all 20 mission categories: wrong day/date · today/tomorrow · calendar contradiction · search Moti (no "באיזה יום") · create דני/מתתיהו/רוזלינדה + save · repeated "כן/כן כן/כן תקבעי" · complex Ofir (who/when/where/duration/פרטים חשובים) · "מה ליאו עבור אופיר" · "הקשר בין רפי ללאו" · "ירדן עבור אנאבל" · movies Kfar Saba · bus from Ra'anana · World Cup (honest fail) · continue · memory recall ("יש לך זיכרון…") · user-says-wrong · frustration · broken Hebrew (אני תבדוק/תקבילי/אחורה צהריים) · audio (לא שמעתי / אני לא שומע) · speech interrupt/resume.

**Pass conditions met:** 0 invented events · 0 wrong relations · 0 wrong cancellations · 0 clarification loops · 0 broken-Hebrew criticals · 0 raw URLs/markdown in speech · 0 legacy bypasses · 0 "I cannot check" when the tool/system can answer.

## Failures reproduced & fixed by layer (this turn)

- **classifyIntent ⟷ knowledgeRouter drift:** "מה הסרטים בכפר סבא" routed general in the runtime (movies missing from the runtime's online detection) → added movies/local to `ONLINE_EXTRA_RE`.
- **Recall with prefix:** "יש לך זיכרון על מה דיברנו" not classified recall → `RECALL_TOPIC_RE` now routes to continuation in `classifyIntent`.
- **Hebrew naturalizer dead `\b`:** doubled-word repair never fired → Hebrew-safe lookarounds.

Wired live this turn: Hebrew Naturalizer + Dialogue loop-guard (in `runtimeFinalizer`), Contradiction Guard (calendar reads) + Confidence Guard (family) in `runFullTurn`.
