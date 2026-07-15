# Voice Architecture Verdict — honest engineering assessment

**Context:** Leo device-tested build 0.78.0 on iPhone + Android: no audio out at all ("I cannot
hear her"), unreliable speech capture, confused conversation. Ten cycles have not made the real-user
voice loop work. This document is an **honest verdict, not a fix** — it traces the actual code paths
on the deployed build, states the real status of each, and gives 2–3 concrete options with effort
and risk so Leo can choose the path. Evidence classes: `CODE` (source-traced), `PREVIEW` (probed on
the live deployment), `DEVICE` (only Leo can supply). Nothing here is `DEVICE`-proven by me.

**Stamp:** deployed preview `0.78.0-spanish-family-identity` · branch `rc5` · 2026-07-15. Read-only.

> **DECISION (0.79.0): Leo chose Option C.** SHIPPED: the reliable pipeline is now the DEFAULT
> (`useRealtime = isRealtimeBetaEnabled()`, default false → pipeline); Realtime is opt-in beta
> (`localStorage['abu-voice-realtime-beta'] = '1'`). The Realtime remote-`<audio>` autoplay bug (Q4)
> is fixed behind the flag (element appended to the DOM + removed on teardown) — **DEVICE-GATED**,
> verify via OP-003. So the real user now gets the pipeline path whose TTS playback is proven
> (AudioContext + gesture unlock + server audio). What still needs device proof: (a) does the default
> pipeline actually make audible sound end-to-end on Leo's phone (STT capture is the open risk — 0.76
> iOS→Whisper), and (b) does the Realtime beta now play audio when opted in. Both → OP-003.
>
> **UPDATE (0.104.0): Realtime beta audio strengthened to MUTED-THEN-UNMUTE — voice is the whole mission.**
> The 0.79.0 DOM-append alone was NOT enough: `pc.ontrack` fires AFTER the `/api/realtime-token` await, so
> its first `.play()` is OUTSIDE the tap gesture and iOS autoplay-blocks it (connected + streaming, but
> silent). Now the REAL remote-audio `<audio>` element is PRIMED inside the tap gesture (`enterVoiceMode`):
> created + `play()`ed **muted** with a silent primer + appended to the DOM; `RealtimeVoiceSession` takes it
> via the new `primedAudioEl` arg, attaches the WebRTC stream in `ontrack`, and sets `muted = false` after
> `play()` resolves — unmuting a playing, user-activated element requires no gesture. Also: date grounding
> (Hebrew day/date/time-of-day, Israel TZ) is now injected into the Realtime session instructions alongside
> family/calendar/memory. Bounded/honest failures unchanged (REALTIME_AUDIO_TIMEOUT watchdog, onAudioBlocked
> tap-to-hear, onFatalError→pipeline). Evidence: 23 green source-contract tests (CODE) + full suite green;
> **audibility is PENDING-DEVICE** (jsdom can't run WebRTC/iOS-autoplay). Device verification: **OP-004**
> (`diagnostics/operator-protocols/OP-004-realtime-beta-audible.md`), flag `abu-voice-realtime-beta=1`.

---

## Executive verdict (the surprising, honest headline)

**The deployed build does NOT primarily use the chained "STT→LLM→TTS" pipeline. Its DEFAULT voice
path is the OpenAI Realtime API over WebRTC** — the ChatGPT-Live-like streaming approach — because
`const useRealtime = true` (`src/screens/AbuAI/index.tsx:333`). The chained pipeline is only the
*fallback* when the OpenAI quota flag is set. So the question is **not** "do we need a
fundamentally different architecture" — the streaming architecture is already wired and is the
default. The problem is that **the existing Realtime WebRTC audio loop has never been proven to
work on a real device, and there is a concrete, likely bug in how it plays remote audio.**

Both the TTS engine and the Realtime token minting **work** (probed live). The most likely reason
Leo hears **nothing** is an **autoplay-blocked remote-audio element on the Realtime path** (details
in Q4). Speech capture being unreliable is a separate, compounding device-gated problem.

---

## Q1 — Does AbuAI have any AUDIO OUTPUT (TTS) at all? Trace it.

**Yes, audio output is wired, and the server side WORKS (PREVIEW-proven).** There are two distinct
output paths depending on which voice mode is active:

### Path 1 — Realtime (WebRTC), the DEFAULT (`useRealtime = true`)
`realtimeVoice.ts`: opens an `RTCPeerConnection`, mints an ephemeral token from `/api/realtime-token`,
sends the mic track, and receives the model's **native audio track** via `pc.ontrack`. That remote
track is played like this (lines 240–249):
```
this.audioEl = document.createElement('audio')   // NOT appended to the DOM
this.audioEl.autoplay = true
this.audioEl.playsInline = true
this.pc.ontrack = (event) => { this.audioEl.srcObject = event.streams[0]; this.audioEl.play() }
```
- `/api/realtime-token` on the deployed build: **`ok=true, client_secret minted, model=gpt-realtime`
  (PREVIEW-proven).** So the Realtime session CAN be established server-side.
- **The playback is the weak point** — see Q4.

### Path 2 — Pipeline TTS (fallback)
`voice.ts::speakVoiceMode`: OpenAI TTS (server `/api/abuai-tts`, `gpt-4o-mini-tts`) → `playBlobViaAudioCtx`
(Web Audio API, iOS-safe after mic use) → `playBlob` (HTMLAudio) → Gemini TTS → Web Speech synthesis.
- `/api/abuai-tts` on the deployed build: **HTTP 200, `Content-Type: audio/mpeg`, 36,096 bytes of
  real MP3 (PREVIEW-proven).** The TTS engine is NOT missing.
- Playback uses a **shared AudioContext resumed inside the tap gesture** (`unlockIOSAudio()` at
  `index.tsx:2430`), plus a visible **"tap-to-hear" recovery button** when playback is blocked
  (`index.tsx:3070`). This path is the more robust one.

**Honest status:** TTS is fully wired and the audio bytes are real. There is **no "TTS not wired"
bug.** But on the default Realtime path the remote audio is played through an element that iOS/Android
autoplay policy is very likely blocking (Q4); and the pipeline path only speaks *after a complete
voice turn*, so if speech capture fails, nothing is ever spoken.

---

## Q2 — Voice INPUT on iOS PWA: reachable and completing, or silently failing?

**Two input paths, mirroring output:**
- **Realtime (default):** `navigator.mediaDevices.getUserMedia({audio})` → `pc.addTrack` →
  streamed natively to the model over WebRTC (`realtimeVoice.ts:275,289`). No local STT; the model
  hears the raw audio. This is reachable IF the WebRTC connection establishes on device — **unproven
  on Leo's devices** (ICE/network/mic-in-PWA can all fail silently).
- **Pipeline fallback:** since 0.76.0, iOS skips the flaky `webkitSpeechRecognition` and uses Whisper
  (`getUserMedia` + `MediaRecorder` `audio/mp4` → Groq Whisper), guarded by a listening watchdog.
  `VITE_GROQ_API_KEY` is present in the build. Reachable, but **unreliable on device** — the likely
  flaky points are silence-detection (never stops, or stops too early → `blob.size < 300` restart
  loop) and mic permission in the installed PWA.

**Honest status:** **not machine-verifiable — genuinely DEVICE-GATED.** Leo's "speech capture
unreliable" is consistent with *either* the Realtime WebRTC mic track not attaching *or* the
pipeline's silence-detection misfiring. I cannot tell which without a device trace. The app has a
"Voice Flight Recorder" (`startVoiceFlight`, `index.tsx:2432`) that records per-stage timings — its
output on Leo's phone would immediately show the first failing stage.

---

## Q3 — Is real-time natural (ChatGPT-Live-like) voice ACHIEVABLE here, or does it need a different approach?

**It is achievable, and the intended architecture is ALREADY the OpenAI Realtime API — the correct
approach.** The scaffolding is real and non-trivial: `realtimeVoice.ts` (full WebRTC peer, data
channel, native audio in/out), `/api/realtime-token` (works), `gpt-realtime` model. This is the
right way to get streaming, low-latency, barge-in-capable voice; the chained pipeline can never be
ChatGPT-Live-like (it is turn-based: record-until-silence + STT roundtrip + LLM + TTS roundtrip =
multi-second latency, no listening-while-speaking — and the program §27 notes full-duplex is
structurally unreachable *without* the Realtime/GPT-Live API).

**So the honest framing is not "rewrite to a streaming pipeline" — it's "the streaming pipeline
exists but has never worked end-to-end on a real device."** The gap is **verification + a small
number of device-specific playback/connection bugs**, not architecture. The single most suspicious
bug (remote audio autoplay, Q4) is small and fixable.

**Tradeoff reality:** Realtime is the only path to the *feeling* Leo wants, but it is also the
hardest to make reliable on iOS PWA (WebRTC + autoplay + background lifecycle + 60-min session
cap + cost per minute). The chained pipeline is far more likely to *work at all* today, at the cost
of feeling like a walkie-talkie, not a conversation.

---

## Q4 — Single most likely reason Leo hears NOTHING?

**Not "TTS not wired" (the engine works, proven). The single most likely reason is
autoplay/audio-output being blocked on the DEFAULT Realtime path** — specifically:

`realtimeVoice.ts` plays the model's voice through an `<audio autoplay playsInline>` element that is
**created with `document.createElement('audio')` and never appended to the DOM**, and whose `.play()`
is called inside `pc.ontrack` — i.e. **after** the async WebRTC negotiation, **outside** the original
user tap gesture. iOS Safari (and Android Chrome) autoplay policy blocks exactly this: a
programmatically-created, not-in-DOM media element whose `play()` is not tied to a user gesture. The
Realtime session can connect and stream the model's audio while the element silently refuses to
play → **connected, listening, generating speech, but Leo hears nothing.**

Secondary/compounding candidates (all consistent with the reports):
1. The Realtime WebRTC connection itself failing to establish on device (mic-in-PWA / ICE) → falls to
   the pipeline, whose STT is unreliable → few complete turns → TTS rarely fires.
2. When it does fall to the pipeline, the pipeline's AudioContext unlock is solid, but TTS only fires
   after a completed turn — so "no audio out" is often really "no completed turn."

The pipeline path deliberately avoids this trap (shared AudioContext resumed in the gesture + a
visible tap-to-hear button). The Realtime path does not have the same guard around its `<audio>`
element. **That asymmetry is the prime suspect.**

---

## Options for Leo (pick one; I will not act without your decision)

### Option A — Fix the Realtime WebRTC audio-out + verify on device (keep the ChatGPT-Live path)
- **What:** append the Realtime `<audio>` element to the DOM; prime/unlock it inside the tap gesture
  (like `unlockIOSAudio` does for the pipeline); ensure `.play()` is gesture-tied or muted-then-unmuted;
  add the same "tap-to-hear" guard. Then run a device session with the Voice Flight Recorder to see if
  the WebRTC loop connects + plays.
- **Effort:** low–medium (the bug is small; verification needs 1–2 device iterations).
- **Risk:** medium — device-gated; if the WebRTC *connection* also fails on iOS PWA, more iteration is
  needed. Highest ceiling (the real product) if it lands.
- **Best if:** the goal is genuinely ChatGPT-Live-like voice and Leo can do a few device test loops.

### Option B — Default to the (reliable) pipeline; ship a working walkie-talkie now
- **What:** set `useRealtime = false` (or device-gate it off for iOS PWA) so the DEFAULT is the
  push-to-talk pipeline whose TTS playback is already iOS-safe (AudioContext + gesture unlock + proven
  server audio). Harden the pipeline STT (silence-detection thresholds; surface an honest state on the
  short-blob restart loop).
- **Effort:** low. **Risk:** low (uses the already-more-robust path; TTS server + AudioContext proven).
- **Tradeoff:** honest — it will feel turn-based (~2–5s per exchange, no barge-in), not live. But it is
  the path most likely to actually make sound come out of Leo's phone this week.
- **Best if:** the priority is "a voice loop that works for the real user now," accepting it is not magic.

### Option C — Hybrid: ship B as the default, keep A behind an opt-in "beta voice" flag
- **What:** make the reliable pipeline the shipping default (Option B), and gate Realtime behind an
  explicit toggle so it can be iterated + device-proven (Option A) without blocking a working product.
- **Effort:** low–medium. **Risk:** low. **Best if:** Leo wants a working product now AND the live
  experience later, without betting everything on the unproven WebRTC path.

**My recommendation (engineering, honest):** **Option C.** Ship the pipeline as the default so the
real user finally has audible, working voice (Option B is a subset), and pursue the Realtime audio-out
fix (Option A) behind a flag with device iteration — because Realtime is the only route to the
experience the program is actually targeting, and its current failure looks like a *small* autoplay
bug plus missing device verification, not a dead architecture.

---

## Evidence appendix (what was actually checked, and how)
- `useRealtime = true` → Realtime is the default path. `CODE` (`index.tsx:333,2454`).
- `/api/realtime-token` (deployed): `ok=true, client_secret present, model=gpt-realtime`. `PREVIEW`.
- `/api/abuai-tts` (deployed): HTTP 200, `audio/mpeg`, 36,096 bytes. `PREVIEW` — TTS engine works.
- Realtime remote audio via not-in-DOM `<audio autoplay>` + `.play()` in `ontrack` (async, post-gesture).
  `CODE` (`realtimeVoice.ts:240–249`). → prime autoplay suspect for "hears nothing".
- Pipeline TTS: AudioContext playback + `unlockIOSAudio()` in the tap gesture + tap-to-hear recovery.
  `CODE` (`voice.ts:159,488–506`; `index.tsx:2430,3070`).
- Pipeline STT (iOS, since 0.76.0): Whisper via `getUserMedia`+`MediaRecorder`(`audio/mp4`)→Groq, with
  a listening watchdog. `CODE`. Reliability on device = `DEVICE`-gated (unverified).
- Voice Flight Recorder exists (`startVoiceFlight`) → per-stage device trace is the fastest next
  diagnostic. `CODE`.

**No `DEVICE` evidence is claimed anywhere in this document.** The one machine-provable, high-leverage
next step regardless of option: get one Voice Flight Recorder trace from Leo's phone (voice mode →
speak once → copy the diagnostic) to pinpoint whether Realtime connects, whether the audio element
plays, and where STT stops.
