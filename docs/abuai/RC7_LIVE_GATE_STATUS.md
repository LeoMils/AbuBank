# RC7 LIVE GATE — STATUS: 🔴 BLOCKED_BY_KEYS

**Blocker type:** missing REAL provider credentials.
**Network:** AVAILABLE — `curl https://api.openai.com/v1/models` returns HTTP 401
(connection succeeds; auth fails because no valid key). So the live gate is blocked
by the KEY only, not the network.
**Why code cannot proceed:** no valid key is set (the pasted value "sk-..." is the docs
placeholder, 6 chars). AbuAI's open-chat/general-knowledge + online grounding also need
the `/api/abuai-chat` and `/api/abuai-online` serverless functions running — i.e. run
this against `vercel dev` or the deployment, not a bare node process.

**Env checked (none set):** OPENAI_API_KEY, VITE_OPENAI_API_KEY, GROQ_API_KEY, VITE_GROQ_API_KEY, GEMINI_API_KEY, VITE_GEMINI_API_KEY
**Scenarios staged & ready:** 10 (acceptance/scenarios/rc7-live-scenarios.json)

## Command that runs it with a REAL key (substitute your actual key)
```bash
export OPENAI_API_KEY=sk-proj-************************   # a REAL key, not "sk-..."
export RC7_ALLOW_NETWORK=1
npx vercel dev --listen 5175 &                          # serves /api/* functions
npx tsx acceptance/rc7LiveAcceptance.harness.ts
```

## What becomes green when unblocked
- Each staged conversation runs through the real path (planner → engine → LLM →
  composer → diagnostics) and is scored on the rubric in the scenario file.
- Online scenarios hit the live web_search proxy; freshness + no-hallucination asserted.
- A transcript is written to docs/abuai/RC7_TRANSCRIPTS.md and scores to RC7_GATE_REPORT.md.

_Status: BLOCKED_BY_KEYS — not skipped, not green._