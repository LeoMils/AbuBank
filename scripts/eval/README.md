# Behavioral Evaluation Harness (`npm run eval:behavior`)

Measures **model behavior**, not string presence. Our 12k unit tests assert that
strings exist in instruction files; they cannot assert the model **obeys** them.
This harness runs real turns and judges what Abu actually says.

## What it does
- **corpus.jsonl** — 60 Hebrew cases across 6 categories (online, family, calendar,
  comm, chat, cannot), each with an expected behavior + expected answer.
- **runner.ts** — sends each case through the **real live pipeline in text mode**:
  the exact `buildSessionUpdate()` instructions + tool schemas the voice path sends,
  a Chat-Completions turn loop, tool calls executed through the **same `LiveTools`
  executor**. The online tool is wired to the live **Brave** provider (Tavily key is
  dead). It captures the full response, every tool call, latency, and — the key
  signal a grep test cannot see — **any assistant text emitted before a tool result
  returned** (the announce-before-checking preamble).
- **judge.ts** — scores each response with the server-side `OPENAI_API_KEY` on six
  binary criteria: `PREAMBLE_FREE`, `NO_SOURCES`, `NO_META`, `DIRECT`, `CONCISE`,
  `CORRECT`.
- **report.ts** — overall pass %, per-criterion %, per-category %, and the 10 worst
  failures verbatim; writes `docs/eval/BEHAVIOR_EVAL_BASELINE.json`.

## Run
```
npm run eval:behavior
```
Runs via **vite-node** (Vite-aware, so the instructions' `?raw` knowledge imports
resolve). Needs `OPENAI_API_KEY` in `.env` (pipeline `gpt-4o`, judge `gpt-4o-mini`).
Env: `EVAL_CONCURRENCY` (default 2), `EVAL_PIPELINE_MODEL`, `EVAL_JUDGE_MODEL`.
It makes real API calls; it is NOT part of `npm test` / `npm run check`.

## Baseline (2026-08-14, current build)
```
OVERALL PASS (all 6):  22/60 = 36.7%
PREAMBLE_FREE 81.7% · NO_SOURCES 83.3% · NO_META 88.3% · DIRECT 65% · CONCISE 51.7% · CORRECT 76.7%
online 0% · family 20% · calendar 30% · comm 100% · chat 60% · cannot 10%
```
The blind spot, made visible — real behavioral failures the unit tests missed:
- **online 0%** — the model NAMES sources with markdown links ("[N12](url)", "[ynet](url)")
  and is verbose, despite the instruction to speak only the grounded fact and never
  name a source.
- **cannot 10% / calendar over-refusal** — the model OVER-EXPLAINS its limits and
  even REFUSES actions it is equipped for ("אני לא יכולה לקבוע תורים" while holding a
  calendar tool). NO_META + CORRECT failures.
- **CONCISE 51.7%** — systematically too long for an 80-year-old (the 2–4 sentence rule).
- **family** over-answers (dumps ex/partner/occupation/children for "who is Mor?").

## HONEST caveat (read before trusting a number)
1. **Text-mode proxy.** This drives a Chat-Completions model (`gpt-4o`) with the
   real instructions + tools — the closest faithful **text** reproduction of the
   realtime voice model. It is not the realtime model itself.
2. **The realtime announce-before-tool failure did NOT reproduce here.** Ground-truth
   preamble-before-tool was **0/23** tool-using cases in text mode. The device
   behavior ("announced 'בסדר, בואי נבדוק' before EVERY tool call") is likely
   **realtime-model-specific** and this text proxy does not exhibit it. So this
   harness does not yet cover that exact realtime behavior — a **realtime-mode**
   harness is the next step. It DID surface many other real failures above.
3. Online correctness used live Brave results (Tavily dead); numbers move with the news.
