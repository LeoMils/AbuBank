---
name: update-knowledge
description: Safely add or change project knowledge (product, behavior/tone, production rules, AbuAI identity) in the single-source knowledge system. Use before encoding any rule or fact in code/docs.
---

# Update Knowledge

Project knowledge is single-source under `knowledge/`. Each domain has ONE
authority file (see `knowledge/KNOWLEDGE.md`). A fact lives in exactly one place.

## Where each fact goes (edit ONLY the authority)
- Product / brand / UX / architecture → `knowledge/product.yaml` (domain: product)
- Companion tone / forbidden phrases / examples → `knowledge/behavior.yaml` (domain: behavior)
- Gates / eval / definition-of-done / commit rules → `knowledge/production_rules.yaml` (domain: production)
- AbuAI identity / constitution → `knowledge/abuai_identity.yaml` (domain: identity)
- Personality / daily life → `knowledge/martita_personality.yaml`
- Family → use the `add-family-member` skill (JSON source)

## Workflow
1. Read `knowledge/KNOWLEDGE.md` + the target authority file.
2. Add/edit the fact in the ONE authority file. Do NOT restate it in CLAUDE.md,
   docs, code, or another knowledge file — POINT to the authority instead.
3. Keep the `knowledge_domain:` and `authority: true` markers intact (one domain per file).
4. Validate: `npm run validate:knowledge` (also runs in `prebuild`).
5. If the change affects runtime behavior, also update the enforcing code + its test
   (e.g. behavior bans → `companionComposer.ts`/`companionExperience.ts` + tests).

## Anti-duplication
- If the same fact already exists elsewhere, MOVE it to the authority and replace the
  old copy with a pointer. `validate:knowledge` fails on a domain claimed by two files.

## Done
Authority file updated; `npm run validate:knowledge` passes; no duplicate encoding remains.
