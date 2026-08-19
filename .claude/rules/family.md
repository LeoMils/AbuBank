---
description: Engineering rules for the family graph + identity
globs: "knowledge/family_data.json,knowledge/family/**,src/screens/AbuAI/family*.ts,src/screens/AbuAI/relationalResolver.ts,src/screens/AbuAI/pronounResolver.ts"
alwaysApply: false
---
# Rule: Family graph (engineering)

**Applies to:** family data + AbuAI family-reasoning modules.
**Source of truth:** `knowledge/family_data.json` (read by runtime; per-person YAML is generated).

- Change family data ONLY via the `add-family-member` skill, then `npm run validate:family`.
  Never hand-edit `knowledge/family/people/*` (generated).
- **Ofir is female.** Gender/relationship errors are correctness bugs, not style — cover them
  with regression tests (`ofirGenderRegression` is the reference).
- Relationship/pronoun resolution must be deterministic and identity-consistent across turns.
- Unknown relations must be handled safely (say "I'm not sure"), never invented.
- Run `family-graph-audit` before claiming a family change is complete.
