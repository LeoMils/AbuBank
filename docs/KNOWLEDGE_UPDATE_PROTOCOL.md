# Knowledge Update Protocol (production-safe, minimal)

Single source of truth lives under `knowledge/` (see `knowledge/KNOWLEDGE.md`).
Follow this every time knowledge changes. Never hand-edit generated files.

## Add or change a FAMILY fact (person / relationship / birthday / pet)
1. Edit ONLY `knowledge/family_data.json` (the machine source). Correct group; symmetric
   relationships; MM-DD birthdays (no year); privacy = city-level only; never invent —
   unknown → omit or `null`.
2. Regenerate + validate:
   ```
   npm run generate:memory
   npm run generate:knowledge
   npm run validate:family
   npm run validate:knowledge
   ```
3. Replay: `npx vitest run` (family graph + validation) and
   `npx vitest run src/eval/evalEngine.test.ts` (family coverage).
4. Skill shortcut: `add-family-member`.

## Update a MARTITA fact (personality / daily life)
1. Edit `knowledge/martita_personality.yaml`.
2. `npm run generate:memory` (memory/* rebuilt) → `npm run validate:knowledge`.
3. Replay: `npx vitest run`.

## Update PRODUCT / BEHAVIOR / PRODUCTION / IDENTITY knowledge
1. Edit ONLY the one authority: `knowledge/product.yaml` | `behavior.yaml` |
   `production_rules.yaml` | `abuai_identity.yaml`. Keep `knowledge_domain:` +
   `authority: true`. Do NOT restate the fact elsewhere — point to the authority.
2. `npm run validate:knowledge`.
3. If it changes runtime behavior, update the enforcing code + its test too.
4. Skill shortcut: `update-knowledge`.

## How to VALIDATE (automatic + manual)
- Automatic: `prebuild` runs `generate:memory + generate:knowledge + validate:family + validate:knowledge` on every `npm run build`.
- Manual: `npm run validate:knowledge` (checks authorities exist, domain markers, no
  duplicate-domain, per-person in sync) and `npm run validate:family` (relationship integrity).

## How to REGENERATE
- `npm run generate:memory` → rebuilds `memory/*`.
- `npm run generate:knowledge` → rebuilds `knowledge/family/people/*` + `knowledge/family/INDEX.md`.

## How to REPLAY after a knowledge update
- `npx vitest run` (full suite) and `npx vitest run src/eval/evalEngine.test.ts`
  (NORTH_STAR must stay 100%, no regression vs `docs/eval/baseline.json`).

## NEVER edit manually
- `memory/*` (generated) · `knowledge/family/people/*` + `knowledge/family/INDEX.md` (generated).
- Do not add a family fact in code, docs, or a second knowledge file — one authority only.
- Do not touch `package.json` / `.env*` without human approval.
