# Leo Data Decisions — facts only Leo can confirm

Two data contradictions remain. **They were NOT guessed or auto-fixed** — the correct value is a fact only Leo knows. Each item below gives the exact files, the exact conflict, and the exact patch to apply *after* Leo decides. `memory/*` and `.claude/rules/*` edits require human approval (per CLAUDE.md), so they are left for Leo.

---

## D-1 — Pepe / Papi memorial date (01-01 vs 12-26)  · P1 · emotional-trust

**Conflict:**
| Source | Value | Authority |
|--------|-------|-----------|
| `knowledge/family_data.json` (lines 23-24) | `date_of_passing: "2025-01-01"`, `memorial_date: "01-01"` | **SOURCE OF TRUTH** (runtime reads this) |
| `memory/birthdays_registry.yaml` (lines 140-141) | `date_of_passing: "2025-01-01"`, `memorial_date: "01-01"` | generated/aligned with JSON |
| `.claude/rules/calendar-date-integrity.md` (line 11) | "Pepe's memorial (12-26)" | **stale outlier** |
| `.claude/rules/emotional-accuracy.md` (line 9) | "Pepe's memorial (Dec 26)" | **stale outlier** |

The **runtime** consistently uses **01-01** (the source of truth). Only the two rule docs say 12-26.

**Leo decision (pick one):**
- **(A) 01-01 is correct** → the rule docs are stale. Patch: edit the two `.claude/rules/*.md` lines to say `01-01` (1 January). No runtime/data change. *(This is the most likely resolution — runtime + both data files already agree on 01-01.)*
- **(B) 12-26 is correct** → the source of truth is wrong. This is significant: Leo must update `knowledge/family_data.json` (`date_of_passing`, `memorial_date`) **and** `memory/birthdays_registry.yaml`, then run `npm run generate:memory`, then align the rule docs.

**Do not run a Martita pilot session that could surface Pepe's memorial until D-1 is resolved** — a wrong memorial date is an emotional hard-fail.

---

## D-2 — Yarden's relationship label in the registry  · P1 · family-trust

**Conflict:**
| Source | Yarden is… | Birthday |
|--------|-----------|----------|
| `knowledge/family_data.json` (lines 137-142, and line 98) | `relationship_hebrew: "כלה (אשת עילי)"`, `spouse: "עילי"` — **Eili's wife**. (Eili "נשוי לירדן".) | none recorded |
| `memory/birthdays_registry.yaml` (lines 117-122) | `relationship: "granddaughter-in-law (Ofir's wife)"` — **says Ofir's wife** | `date: "10-12"` |

The registry says Yarden is **Ofir's** wife, but the source of truth says Yarden is **Eili's** wife — and Ofir's spouse is **Gilad** (they are the parents of Anabel & Ari). So the registry's relationship label is **wrong**. Separately, the registry has a birthday `10-12` for Yarden that does **not** appear in the source of truth, so it cannot be verified.

**Leo decision:**
1. **Relationship label** — confirm Yarden = **Eili's wife** (expected). Patch `memory/birthdays_registry.yaml` line 120 → `relationship: "granddaughter-in-law (Eili's wife)"`. *(Mechanical correction toward the source of truth, but it lives in a human-approval file, so Leo applies it.)*
2. **Birthday 10-12** — confirm whether `10-12` is Yarden's real birthday. If yes, add it to `knowledge/family_data.json` (currently missing) so source and registry agree. If unknown, mark `confidence: unknown` rather than asserting it.

Runtime impact is narrow (birthday reminders read the registry), but a reminder that calls Yarden "Ofir's wife" is a visible family error to Martita.

---

## After Leo decides
- Apply the chosen patches above.
- Run `npm run generate:memory && npm run validate:family` to re-derive and validate.
- Re-run `npx tsx acceptance/martitaCompanion.harness.ts` to confirm no family regressions.
