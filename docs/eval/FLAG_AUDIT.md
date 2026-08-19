# FLAG AUDIT — every flag: evidence, default, survives-merge, what's missing

Track 2. A flag that fails invisibly on a merge is the most dangerous thing in the system
(ONLINE_DEEP_FETCH was exactly that — a Preview-only env var that would have shipped shallow
answers to production silently). Rule: every capability's DEFAULT lives in CODE, with the
measurement that justifies it; env names are ops overrides only. This audits all 8.

| Flag | Where | Default | Survives merge? | Evidence | Missing before default-ON |
|---|---|---|---|---|---|
| ONLINE_GENERAL_SEARCH | flags.ts (code) | **ON** | YES (code default) | acceptance 87.3%/63; never-worse OFF-only=0 | nothing — shipped ON |
| ONLINE_PREFETCH_WARM / LIVE_PREFETCH_WARM | flags.ts + liveSession (env-flippable) | OFF | YES (defaults false) | warmStore.test: warm hit <1s, 0 network | on-device freshness-vs-latency off/on |
| LIVE_OUTPUT_MONITOR_REPAIR | liveSession const | OFF | YES | deterministic repair proven; detectors observe always | device: repair round-trip p50/p95 + warmth off/on |
| LIVE_CLASSIFIED_MONITOR | liveSession const | OFF | YES | classifiedCorpus 0 FP/42 clean; detectors observe always | device: repair warmth (heavy filtering = stilted) |
| LIVE_AUDIO_TUNE_V2 (far-field NR) | env VITE_ (build) | OFF | YES (defaults false) | liveAudioTrackA.test (CODE) | owner ear: no second voice, no echo (AUDIO_CHECK) |
| LIVE_BARGE_IN_TRUNCATE | env VITE_ (build) | OFF | YES (defaults false) | bargeInEvents pure-tested; default-off safety | owner ear: clean barge-in, no "one word then silence" |
| LIVE_INTERRUPT_RESPONSE | liveSession const | OFF | YES | device-proven echo fix (BRIEF_AUDIT A3) | none — OFF is the correct PERMANENT default |
| ONLINE_PROVIDER | env (config, not boolean) | 'openai' | YES (defaults) | bake-off: Tavily 100% cite vs OpenAI 61% | flip to a search provider once its key is set in prod env |

## Findings
1. **ONLINE_DEEP_FETCH fixed (was the merge blocker).** Moved from a Preview-only env var to
   `flags.ts ONLINE_GENERAL_SEARCH_DEFAULT=true` (code, survives merge). `ONLINE_DEEP_FETCH=0` is
   now an ops kill-switch only. This is the item that would have failed invisibly in production.
2. **LIVE_PREFETCH_WARM is now env-flippable** (VITE_LIVE_PREFETCH_WARM=1), default OFF, survives
   merge — so the owner can A/B it on a Preview build like the audio flags. Default stays OFF until
   the device freshness measurement: a stale cache vs a fresh live answer is a content judgment the
   warmStore unit test (which only proves the <1s warm hit) cannot make.
3. **The audio flags are build-time VITE_ vars.** They survive a merge (unset → false), but to
   ENABLE them in production the env must be set at build; the A/B previews (AUDIO_CHECK.md) bake
   them in. Once the owner's ear confirms no echo regression, promote to a code default like the
   online loop — do NOT leave a heard capability behind an env var nobody sets.
4. **Monitor repairs (output + classified) are OFF and the detectors only OBSERVE** — so a real
   distress-menu or method-narration still reaches Martita today. Enabling the repair is a device
   measurement (round-trip latency + does the redo make her stilted). Highest-value flag still OFF.

## Merge-safety verdict
No flag fails invisibly on a merge anymore: every default is a code default (or an env var that
defaults to the safe value when unset). The remaining OFF flags are OFF because their off/on
measurement is DEVICE/EAR, not because of an env hazard. That is the honest state.
