---
name: add-family-member
description: Safely add or update a family member in the AbuBank knowledge system. Use whenever family relationships, people, birthdays, or pets change.
---

# Add / Update Family Member

Family is single-source: `knowledge/family_data.json`. Everything else (memory/,
per-person YAML) is generated. NEVER hand-edit generated files.

## Workflow
1. Read `knowledge/KNOWLEDGE.md` (the manifest) and `knowledge/family_data.json`.
2. Identify the correct group (matriarch / children / children_related /
   grandchildren_mor / grandchildren_leo / grandchildren_spouses /
   great_grandchildren / pets / close_friends / deceased).
3. Edit ONLY `knowledge/family_data.json`. For a person include at minimum:
   `canonical_name`, `hebrew_name`, `relationship`; plus `aliases`, `birthday`
   (MM-DD, no year), `location`, `spouse`/`partner`/`ex_spouse`, `children`,
   `notes` as known. Unknown facts → omit or `null` (never invent — see
   `.claude/rules/calendar-date-integrity.md`).
4. Keep relationships SYMMETRIC (if A is spouse of B, B is spouse of A).
5. Regenerate + validate:
   - `npm run generate:memory`     (rebuilds memory/*)
   - `npm run generate:knowledge`  (rebuilds knowledge/family/people/*)
   - `npm run validate:family`     (relationship integrity)
   - `npm run validate:knowledge`  (per-person sync + no duplication)
6. Run the family tests: `npx vitest run` (family graph + validation tests).
7. Privacy: city-level only; no street/phone/medical/financial.

## Rules
- HUMAN_APPROVAL_REQUIRED note: `memory/*` is generated — do not edit it directly.
- Birthdays/dates: MM-DD, no year; mark confidence/source if learned from conversation.
- Pepe's memorial date lives ONLY in `family_data.json` `deceased.memorial_date`.

## Done
family_data.json updated; all four generate/validate commands pass; family tests green.
