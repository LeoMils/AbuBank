# RC7 LIVE GATE — STATUS: 🔴 BLOCKED_BY_KEYS

**Blocker type:** missing provider credentials (and network).
**Why code cannot proceed:** AbuAI's open-chat/general-knowledge generation and
online grounding call OpenAI/Groq/Gemini and `/api/abuai-online` (web_search).
This sandbox has no API keys and no outbound network, so real-model prose quality,
online freshness, and long-conversation coherence cannot be executed or graded here.

**Env checked (none set):** OPENAI_API_KEY, VITE_OPENAI_API_KEY, GROQ_API_KEY, VITE_GROQ_API_KEY, GEMINI_API_KEY, VITE_GEMINI_API_KEY
**Scenarios staged & ready:** 10 (acceptance/scenarios/rc7-live-scenarios.json)

## Command that runs it the moment keys exist
```bash
export OPENAI_API_KEY=sk-...          # and/or GROQ_API_KEY / GEMINI_API_KEY
export RC7_ALLOW_NETWORK=1            # permit live online grounding
npx tsx acceptance/rc7LiveAcceptance.harness.ts
```

## What becomes green when unblocked
- Each staged conversation runs through the real path (planner → engine → LLM →
  composer → diagnostics) and is scored on the rubric in the scenario file.
- Online scenarios hit the live web_search proxy; freshness + no-hallucination asserted.
- A transcript is written to docs/abuai/RC7_TRANSCRIPTS.md and scores to RC7_GATE_REPORT.md.

_Status: BLOCKED_BY_KEYS — not skipped, not green._