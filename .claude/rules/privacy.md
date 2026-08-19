---
description: Engineering rules for privacy + secret handling
globs: "memory/**,src/screens/AbuWhatsApp/**,src/screens/FamilyPhones/**,api/**,.env*,src/services/*.ts"
alwaysApply: false
---
# Rule: Privacy + secrets (engineering)

**Applies to:** memory files, contact/phone screens, API routes, env.
**Authorities:** `.claude/rules/privacy-boundaries.md` + `docs/abuai/ENV_CONTRACT.md`.

- **Never store in `memory/`:** phone numbers, medical, financial, street address. City-level
  (Kfar Saba) only. Store patterns/roles, not raw conversations.
- **Billable provider keys are server-only** (`OPENAI_API_KEY`, `VITE_AZURE_TTS_KEY`). Client
  source must never read them (enforced by `clientProviderKeyContract.test.ts`). Only free-tier
  `VITE_GROQ_API_KEY` / `VITE_GEMINI_API_KEY` may be client-side, by documented allowance.
- Never print a real secret value. `.env` / `*.local.json` / `private/` must never be staged.
- Real phone data lives in ignored/private files — never commit or edit it in foundation work.
- Run `privacy-audit` before claiming a memory/log/api change is complete.
