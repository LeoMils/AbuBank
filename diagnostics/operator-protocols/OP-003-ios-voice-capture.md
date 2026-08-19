# Operator Protocol OP-003 — iOS voice capture + audible reply, on device

**Purpose:** Verify the 0.76.0 voice fix on a physical iPhone. Root cause (see
`docs/DEVICE_P0_ROOT_CAUSE.md`): on iOS the primary STT `webkitSpeechRecognition` could start and
fire no events, hanging "מקשיבה..." forever with no bound. The fix (CODE): on iOS, **skip Web Speech
and use the Whisper (MediaRecorder→Groq) path**, plus a **listening watchdog** so any stall falls
back to Whisper / an honest state instead of hanging. This is **DEVICE-GATED** — the code is landed
but whether iOS actually captures + plays audio can only be proven on the phone.

**Acceptance Board rows:** Voice (🔴) · STT (🔴) · TTS (🟡).
**Build shown in Settings/About:** `0.76.0-ios-whisper-stt-watchdog` **or later** [must be ≥ 0.76.0].

## Preconditions (record exactly)
- Device model + iOS version. App surface: **installed PWA** (home screen) AND once in Safari tab.
- Grant microphone permission when prompted (Settings → Safari → Microphone = Ask/Allow).
- Language: Hebrew, feminine address. Network: note wifi / cellular.

## Steps
1. Open AbuAI, tap the mic. → expect a clear "listening" state.
2. Say a short Hebrew sentence, e.g. "מה השעה" or "מי זאת אופיר".
   - **Expected (fix working):** within a few seconds the words appear in the text field / are
     processed, and AbuAI **speaks a reply out loud**.
   - **Expected (fix's watchdog, if capture still fails):** it must NOT hang on "מקשיבה..." forever —
     within ~7s it should either transcribe, or fall back and say/show an honest "אני לא מצליחה
     לשמוע כרגע, אפשר לכתוב לי כאן" (never an infinite silent listen).
3. Repeat once more to check consistency.
4. If it works, do one full exchange: "תקבעי פגישה עם מור מחר בשלוש" by voice → confirm → "כן".

## Response template (fill and return verbatim)
```
OP-003 result
device: <model / iOS ver>   surface: <PWA | Safari tab>   build shown: <e.g. 0.76.0-...>  [≥0.76.0]
mic permission: <allowed | denied>   network: <wifi | cellular>

step1 listening state shown?              pass/fail
step2 speech transcribed (words appear)?  pass/fail   heard: "____"
step2 AbuAI spoke a reply out loud?        pass/fail   spoken: "____"
step2 if capture failed: bounded (no forever hang) + honest fallback shown/spoken?  pass/fail  observed: "____"
step3 consistent on 2nd try?               pass/fail
step4 voice calendar create saved once?    pass/fail

time-to-first-word (approx seconds): "____"
voice notes (warmth, latency, cut-offs, any language mixup): "____"
free-text: "____"
timestamp: <ISO local>
```

## Recording rule
Record the returned result at `DEVICE_VERIFIED`, linked from the Voice / STT / TTS rows. A PASS on
step2 upgrades voice capture from CODE→DEVICE for iOS. A PASS on only the watchdog (step2 bounded +
honest fallback) proves the "no more infinite hang" defect fix even if capture still needs work.
Do NOT paraphrase into a stronger claim than the template supports.
