# COST — the first real number (Item 2)

**Evidence class: CODE.** These are the transparent arithmetic of the cost MODEL
(`src/screens/AbuAI/aiCostModel.ts`) fed by OpenAI Realtime published per-minute
audio rates, applied to a representative 20-minute companion session. A real
*billed* figure needs a keyed Realtime session on a device (PHYSICAL_DEVICE /
PRODUCTION class) — that is Leo's to capture. The **percentage** saving is
rate-independent; the shekel figure is shown WITH its rate so it re-derives when
the price or FX moves. Every number below is pinned by a test
(`aiCostModel.test.ts` → "pins the representative 20-min headline numbers").

## Rates (single source — `RATES` in aiCostModel.ts)
| item | rate |
|---|---|
| audio input (her mic upstream) | $0.06 / min |
| audio output (Abu speaking) | $0.24 / min |
| text input / output | $0.005 / $0.02 per 1K tokens |
| FX | $1 = ₪3.7 |

## Representative 20-minute session
An 80-year-old companion call: bursts of speech, then pauses to think / read /
step away. Inputs (observable, not magic cost numbers): 20 min total, ~5 min she
speaks, ~4 min Abu speaks, 8 idle gaps, 3K/4K text tokens in/out.

## The headline — before vs after the O-LIFECYCLE idle-stop
| | mic upstream billed | cost (USD) | cost (₪) |
|---|---|---|---|
| **BEFORE** (idle mic streams the whole call) | 20.0 min | **$2.26** | **₪8.34** |
| **AFTER** (upstream stops ~12s into each idle gap; session closes at 45s idle) | 6.6 min | **$1.45** | **₪5.37** |
| **SAVING** | −13.4 min | **$0.80** | **₪2.97** |

### **Saving ≈ 35.7% per 20-minute conversation.**

**Why this cannot cost quality:** the saving is *only* eliminated idle **mic
input** minutes. Abu's audio **output** and all text are byte-for-byte identical
before and after — a test asserts `after.audioOutputUsd === before.audioOutputUsd`
and `after.textUsd === before.textUsd`. Abu never speaks less; she just stops
paying to stream silence. A session with no idle time saves nothing (no false
savings — also tested).

## What the quality bugs were costing
Every stall where Abu said she would check and went silent forced Martita to
repeat the turn (a wasted round-trip); every repeated formulation was wasted
output. Modeled at 4 stalls + 6 repeated formulations per session:

**≈ $0.24 (₪0.90) wasted per session** — on top of the idle cost. Over a month of
daily use that is ~₪27 of pure waste, and it degraded the experience while
charging for it. **Quality work pays for itself**: fixing stalls/repetition
removes both the wasted spend AND the reason Martita had to repeat herself.

## The controls (built + tested — `costMeter.ts`)
- **Running counter** — session / day / month, persisted to localStorage, with
  correct day- and month-rollover (tested).
- **Budget alert to Leo at 70%** of a configurable daily ceiling — fires **once**
  per tier (no spam), through the EXISTING `sendNotification` sink (the O5
  heartbeat email/status-page path). Martita is never shown a cost message.
- **At the ceiling: NEVER disconnect her.** `budgetDecision` degrades gracefully —
  a cheaper realtime model (`gpt-4o-mini-realtime`) + shorter (still 2–4 sentence)
  replies — and tells **Leo, never Martita**. The hard invariants `connected:true`
  and `martitaMessage:null` hold at 100% and at 10× the ceiling (tested). This is
  the deliberate fix to the older `aiSpendGuard.checkSpendAllowed`, which cut her
  off ("we have done enough today, continue tomorrow") — a live conversation must
  degrade, never disconnect.
- **Mutant:** `cost-ceiling-disconnects-instead-of-degrades` removes the ceiling
  degrade → `costMeter.test.ts` turns red (proves the guard has teeth).

## Honest status / next step
The measurement + the control LOGIC are CODE-proven. **Live wiring** — feeding
real `response.done` token/audio usage from the WebRTC session into `recordSpend`,
and swapping `realtimeModel` mid-session on degrade — touches the device-sensitive
voice path and is intentionally NOT rushed in pre-ship (see `.claude/rules/voice.md`).
Single wire-point: `realtimeVoice.ts` `response_done` handler → `recordSpend` +
`budgetDecision` + (on `shouldFireAlert`) `sendNotification`. To be verified on
device with Leo, since real audio-token accounting is PHYSICAL_DEVICE class.
