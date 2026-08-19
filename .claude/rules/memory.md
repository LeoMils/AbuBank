---
description: Engineering rules for working + persistent memory
globs: "memory/**,src/screens/AbuAI/*emory*.ts,src/screens/AbuAI/continuityThread.ts,src/screens/AbuAI/conversationMemory.ts,src/services/familyLoader.ts"
alwaysApply: false
---
# Rule: Memory (engineering)

**Applies to:** `memory/**` (generated) + AbuAI memory/continuity modules.

- **`memory/*` is 100% GENERATED** from `knowledge/*`. Never hand-edit it. Edit
  `knowledge/family_data.json` / `knowledge/*.yaml` then `npm run generate:memory`.
- Separate **working memory** (this conversation's context: last topic, pending event,
  referenced person) from **persistent memory** (facts that survive sessions). Do not conflate.
- Continuity is a capability: a follow-up ("and her?") must resolve against working memory,
  not reset. Follow-up failures are `failure-to-regression` candidates.
- Retrieval must be truthful — if a fact is unknown, say so; never fabricate a remembered detail.
- Run `memory-integrity` before claiming a memory change is complete.
