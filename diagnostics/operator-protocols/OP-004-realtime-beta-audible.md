# Operator Protocol OP-004 — Realtime (WebRTC) beta voice, AUDIBLE on iPhone

**Purpose:** Verify the 0.104.0 Realtime-beta audio fix on a physical iPhone. Root cause (see
`docs/VOICE_ARCHITECTURE_VERDICT.md`): the Realtime remote-audio element first `.play()`ed inside
`pc.ontrack` — which runs AFTER the token-fetch await, i.e. OUTSIDE the tap gesture — so iOS Safari
autoplay-blocked it (session connected + streaming, but Martita heard nothing). The fix (CODE):
**muted-then-unmute** — the real `<audio>` element is PRIMED inside the tap gesture (created +
`play()`ed muted), reused by the session, then UNMUTED once the WebRTC stream plays. This is
**DEVICE-GATED** — landed in code, but audibility can only be proven on the phone.

**Acceptance Board rows:** Voice (🔴) · TTS (🟡) · Latency (🔴).
**Build shown in Settings/About:** `0.104.0-realtime-audible` **or later** [must be ≥ 0.104.0].

## Preconditions (record exactly)
- Device model + iOS version. App surface: **installed PWA** (home screen) — this is the real target.
- Grant microphone permission when prompted (Settings → Safari → Microphone = Ask/Allow).
- Media volume UP; iPhone **not on silent/ring-mute**; not connected to another Bluetooth output.
- Language: Hebrew, feminine address. Network: note wifi / cellular.

## Enable the beta flag ON THE PHONE (one-time, no console needed)
The Realtime path is opt-in. Enable it from a **link** — no JS console required:
1. In Safari on the iPhone, open the preview URL with `?voice=realtime` appended, e.g.
   `https://<preview-url>/?voice=realtime`. This persists the beta flag to localStorage.
2. Then open AbuAI as normal (or launch the installed PWA). The choice sticks even after the
   query string is gone.
3. To turn it back OFF later: open `https://<preview-url>/?voice=pipeline`.
> Under the hood this sets `localStorage['abu-voice-realtime-beta'] = '1'` via
> `syncRealtimeBetaFromUrl()`. If you install the PWA fresh, re-open the `?voice=realtime` link once
> inside the installed app (localStorage is per-origin but the standalone PWA can have its own store).

## Steps
1. Tap the mic in AbuAI. → expect a clear "listening/connecting" state, then a warm **spoken** Hebrew
   greeting **out loud** within ~2–3s (this is the Realtime greeting — proves audio-out is audible).
2. Say a short Hebrew sentence, e.g. "מה השלום" or "מי זאת אופיר".
   - **Expected:** within ~1–2s AbuAI **speaks a reply out loud**, natural and warm, and you can
     **interrupt it mid-sentence** (barge-in) by talking over it.
3. Say one Spanish line, e.g. "Contame algo lindo". → expect a **spoken** Rioplatense reply out loud.
4. If audio ever fails to play, it must be **honest, not silent**: either a "tap to hear" button
   appears / it auto-falls back to the pipeline voice within ~5s (never an endless silent wait).

## Response template (fill and return verbatim)
```
OP-004 result
device: <model / iOS ver>   surface: <installed PWA | Safari tab>   build shown: <e.g. 0.104.0-...>  [≥0.104.0]
beta flag enabled: <yes | no | could-not-find-toggle>
mic permission: <allowed | denied>   volume up + not silent: <yes|no>   network: <wifi | cellular>

step1 spoken greeting heard OUT LOUD?          pass/fail   heard: "____"
step1 time to first spoken word (approx sec):  "____"
step2 reply spoken out loud?                    pass/fail   spoken: "____"
step2 barge-in (interrupt mid-sentence) works?  pass/fail
step3 Spanish reply spoken out loud?            pass/fail   spoken: "____"
step4 on any audio failure: honest (tap-to-hear or pipeline fallback), never silent?  pass/fail  observed: "____"

overall: did Martita HEAR AbuAI speak on the Realtime beta?  YES / NO
voice notes (warmth, latency, robotic?, cut-offs, language mixup): "____"
free-text: "____"
timestamp: <ISO local>
```

## Recording rule
Record the returned result at `DEVICE_VERIFIED`, linked from the Voice / TTS / Latency rows. A PASS on
step1+step2 (spoken greeting + spoken reply heard) upgrades Realtime voice-out from CODE→DEVICE and is
the first proof the muted-then-unmute fix works on iOS. Latency numbers (time-to-first-word) feed the
Latency row. Do NOT paraphrase into a stronger claim than the template supports; a receipt of a text
reply is NOT audio proof.
