# Memory System Overview

## Architecture

```
CLAUDE.md (always loaded)
  ├── Product principles, UX rules, working rules
  └── Points to /memory/ for details

/memory/ (structured retrieval)
  ├── martita_profile.yaml      — identity, personality, daily life
  ├── family_graph.yaml         — family tree, canonical names
  ├── aliases_and_names.yaml    — name → alias lookup
  ├── birthdays_registry.yaml   — birthdays + memorials + reminder policy
  ├── whatsapp_patterns.yaml    — writing patterns for message generation
  └── message_examples.md       — curated style-teaching examples

/.claude/rules/ (guardrails)
  ├── senior-ux.md              — UI/UX constraints
  ├── emotional-accuracy.md     — tone and emotional intelligence
  ├── calendar-date-integrity.md — date handling rules
  └── privacy-boundaries.md     — data minimization

/.claude/skills/ (reusable workflows)
  ├── abu-messages/             — WhatsApp message generation
  ├── abu-ai-conversation/      — AbuAI response quality
  ├── abu-calendar-assistant/   — Calendar + birthday logic
  ├── abu-memory-update/        — Safe memory updates
  └── martita-tone-check/       — Tone verification checklist
```

## Principles
1. CLAUDE.md = lean. Points to retrieval, doesn't contain data.
2. YAML files = structured facts. Easy to query, update, extend.
3. Skills = reusable procedures. Consulted when working on specific modules.
4. Rules = guardrails. Prevent drift, maintain quality.
5. No duplication. One canonical source per fact.
6. Privacy-minimized. Patterns over raw data. Roles over personal details.

## Adding New Information
Use the `abu-memory-update` skill. It defines:
- Where each type of fact goes
- How to check for duplicates
- How to mark confidence levels
- What NOT to store
