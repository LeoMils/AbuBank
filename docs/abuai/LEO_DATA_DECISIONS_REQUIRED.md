# Leo Data Decisions REQUIRED — factual confirmations only Leo can make

Two data items remain. They are **factual** (real-world truth only Leo knows) — **not guessed, not auto-fixed**. The runtime is already self-consistent; these are confirmations + one hand-maintained-file correction. `memory/*` and `.claude/rules/*` edits require human approval (CLAUDE.md), so they are left for Leo with exact patches below.

---

## D-1 — Pepe / Papi memorial date  · P1 · emotional-trust

**Current state (already made consistent in code):**
| Source | Value | Status |
|--------|-------|--------|
| `knowledge/family_data.json` → `family.deceased.memorial_date` | `"01-01"` (date_of_passing `"2025-01-01"`) | **source of truth (runtime)** |
| `memory/birthdays_registry.yaml` → memorials Papi | `"01-01"` | aligned |
| AbuAI `SYSTEM_PROMPT` (`service.ts`) | **no hardcoded date — defers to `get_memorial_for`** | fixed |
| `.claude/rules/*.md` | **no hardcoded date — point to `family_data.json`** | fixed |
| Deterministic tool `getMemorialFor('פפי')` | "1 בינואר 🕯️" | locked by `memorialDatePromptContract.test.ts`, `familyEvents.test.ts` |

The whole runtime now answers **01-01** consistently. The earlier `.claude/rules` value of **12-26** has been removed (it was stale guidance, not runtime data).

**The ONLY thing Leo must do:** confirm the real-world date.
- **If 01-01 is correct** → nothing to change. ✅
- **If the real date differs** (e.g. 12-26) → edit **ONLY** `knowledge/family_data.json`:
  ```jsonc
  "deceased": { ... "date_of_passing": "<YYYY-MM-DD>", "memorial_date": "<MM-DD>", ... }
  ```
  then run `npm run generate:memory && npm run validate:family`. The prompt, calendar, and tool all read from this one place, so everything follows automatically. Re-run `npx tsx acceptance/familyMatrix.harness.ts`.

**Until confirmed:** the pilot's emotional block treats Pepe gently; no clinical date is volunteered (the tool only gives the date when asked, sourced from the data).

---

## D-2 — Yarden's relationship label in the hand-maintained registry  · P1 · family-trust

**Contradiction:**
| Source | Yarden is… | Birthday |
|--------|-----------|----------|
| `knowledge/family_data.json` (lines ~137-143; line 98) | `relationship_hebrew: "כלה (אשת עילי)"`, `spouse: "עילי"` — **Eili's wife** (Eili "נשוי לירדן"). Ofir's spouse is **Gilad**. | none recorded |
| `memory/birthdays_registry.yaml` (lines ~117-122) | `relationship: "granddaughter-in-law (Ofir's wife)"` — **says Ofir's wife (WRONG)** | `date: "10-12"` (not in source of truth) |

The runtime reads `family_data.json` (correct: Yarden = Eili's wife — `validate-family-data.ts` asserts "Yarden married to Eili (not Ofir)"). The **hand-maintained `birthdays_registry.yaml`** is the only place with the wrong label; the validator does not scan it.

**Exact patch (Leo applies — `memory/*` needs human approval):**
1. In `memory/birthdays_registry.yaml`, change the Yarden entry:
   ```yaml
   - person: "Yarden"
     hebrew: "ירדן"
     date: "10-12"               # ← CONFIRM this birthday (absent from source of truth)
     relationship: "granddaughter-in-law (Eili's wife)"   # was "(Ofir's wife)"
     confidence: confirmed         # or: unknown, if the date is not certain
   ```
2. **Confirm the birthday `10-12`.** If correct, add it to `knowledge/family_data.json` Yarden entry (`"birthday": "10-12"`) so source and registry agree; if not certain, set `confidence: unknown` and remove the date.
3. After editing: `npm run generate:memory && npm run validate:family`, then `npx tsx acceptance/familyMatrix.harness.ts`.

Runtime impact is narrow (birthday reminders read the registry), but a reminder calling Yarden "Ofir's wife" is a visible family error to Martita — worth fixing before reminders are relied on.

---

## Summary for Leo
| ID | Decision | Effort | Blocks |
|----|----------|--------|--------|
| D-1 | Confirm Pepe's memorial date (data says 01-01) | 1 line if 01-01; else edit family_data.json + regenerate | emotional pilot block |
| D-2 | Fix Yarden label → "Eili's wife"; confirm 10-12 birthday | edit registry + regenerate | birthday reminders |

Neither requires any code change. Both are factual confirmations.
