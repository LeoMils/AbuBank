# Live LLM Quality Gap Report

## Status: NON-CODE/CLIENT — provider key present, but AbuAI's full answer is client-pipeline (device/browser); not runnable headless here
The DETERMINISTIC companion layer (routing, tone enforcement, calendar/family/memory
correctness, failure copy) is GREEN (eval 2530@100%, judge 115@100/100). The remaining gap
is the **live model's answer prose** — its warmth/accuracy/hallucination on a real call.

- **Blocker type:** NON-CODE — AbuAI's full answer is client-pipeline (device/browser),
  not a headless-runnable server endpoint. A provider key IS present in env, but that alone gives the RAW model, not the enforced companion answer.
- **Owner:** Leo (device acceptance test = authoritative live check today) + code
  (optional post-launch Playwright headless-client harness to automate it).
- **Not marked green.** The deterministic layer + separate judge + 1000-case bank are ready;
  the live *felt* answer is judged by Leo on device, or by the future headless harness.
- **Bank ready:** docs/eval/live_scenario_bank.json (1000 scenarios).
