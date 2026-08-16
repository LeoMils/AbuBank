# EAR CHECK — five minutes, one build, all four audio flags ON

This is the ONLY thing left that a test cannot do. One preview build ships **all four** device-gated
audio behaviours ON at once, so you settle them in a single sitting instead of four separate rounds.

**Build:** _(the deployed preview URL from the latest run — see docs/eval/DEPLOYED_VERIFY.json → base)_
Confirm the build is the right one: open `<url>/build-flags.json` — all four must read `true`:
`LIVE_AUDIO_TUNE_V2`, `LIVE_BARGE_IN_TRUNCATE`, `LIVE_PREFETCH_WARM`, `LIVE_CLASSIFIED_MONITOR`
(plus `LIVE_PREAMBLE_TWO_RESPONSE: true`, already confirmed).

Open Abu AI (voice), talk to her normally for two minutes, and judge FOUR things:

1. **Full sentence audible** — every answer plays to the end. No "one word then silence", no cut-off
   after the first sentence.  → gates `LIVE_BARGE_IN_TRUNCATE` (+ prefetch: current answers feel instant).
2. **One clean voice** — a single voice at the greeting and throughout. No second/overlapping voice,
   no echo of herself.  → gates `LIVE_AUDIO_TUNE_V2`.
3. **She stops when you speak** — talk over her mid-sentence: she stops cleanly and the next turn does
   not collide or garble.  → gates `LIVE_BARGE_IN_TRUNCATE` (with audio-tune).
4. **Accent correct** — Spanish family names read as Spanish (Leo, Mor, Ofir, Pepe), warm and natural,
   no English vowels; no robotic or method narration ("I'm checking…").  → gates `LIVE_CLASSIFIED_MONITOR`
   (kills any method-narration/menu that slips through) + the pronunciation frame.

## What each flag does (why it was dark, why it is on now)
| Flag | Capability | Was OFF because | Now |
|---|---|---|---|
| `LIVE_AUDIO_TUNE_V2` | far-field noise reduction — one clean voice at greeting | needed the ear (no test hears echo) | ON in this build |
| `LIVE_BARGE_IN_TRUNCATE` | clean barge-in — she stops when spoken over; ships WITH audio-tune | needed the ear; must pair with audio-tune | ON in this build |
| `LIVE_PREFETCH_WARM` | sub-1s cached cinema/weather/headlines | freshness-vs-latency is an ear call | ON in this build |
| `LIVE_CLASSIFIED_MONITOR` | repairs a slipped method-narration / options-menu (0 FP on the corpus) | device warmth (does a redo feel stilted?) | ON in this build |

## After you listen
- All four good → each flag is PROMOTED to a code default (`promotionConfirmed:true` in
  `src/services/deviceGatedFlags.ts` + flip the default), so the capability never ships dark again.
- Any one bad → say which of the four (1–4 above); only that flag's default stays OFF, the rest promote.

Risk note (logged in DECISIONS D-CLASS-DARK): enabling all four together does NOT compound the
"one word then silence" echo risk — that risk lives only in the audio-tune⇄barge-in pair, which is
*designed* to ship together (echo tamed first, then the client truncates on a real barge-in).
Prefetch (caching) and classified-monitor (text repair) are not on the echo path.
