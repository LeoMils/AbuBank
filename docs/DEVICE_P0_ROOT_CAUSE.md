# Device P0 Root-Cause Report — build 0.74.0 (iPhone, Hebrew, Safari PWA)

**Source of truth for this report:** a real device test on the deployed preview, confirmed on the
QA marker as `0.74.0-family-possessive-spouse`. Real device evidence **overrides** the passing CODE
suite (10,806 green tests did not predict these). Evidence classes: `CODE < MOCK < BROWSER < PREVIEW
< DEVICE < PRODUCTION`. This report does **not** overclaim: where the true fix needs the phone, it
is marked **DEVICE-GATED** with an Operator Protocol.

**Headline:** the four failures are **largely independent root causes**, not one common cause. Server
config is healthy (`/api/health`: `OPENAI_API_KEY` present; `abuaiChat`/`abuaiOnline` configured;
`web_search` functional). The client bundle is fresh (QA marker 0.74.0). So the failures are in
specific wiring, not a stale build or a dead server.

Priority to fix (severity × how provable the fix is): **P0-ONLINE (fixed now)** → **P0-VOICE
(device-gated, plan below)** → **P0-MEMORY (needs device repro to localize)** → **P0-CALENDAR (most
likely downstream of voice)**.

---

## P0-ONLINE — hallucinated current info  ·  FIXED (this cycle, 0.75.0)

- **Symptom:** World Cup fixtures that were impossible were stated as fact.
- **Reproduced (PREVIEW):** POST to the deployed `/api/abuai-online`:
  - `"current weather in Tel Aviv"` → `ok:true`, **1 source**, real data. → web_search **works**.
  - `"who is the current prime minister of Israel"` → `ok:false, ONLINE_QUERY_BLOCKED_PERSONAL`
    (**over-blocked** — Defect B).
  - `"מי ניצח במשחקי המונדיאל אתמול"` → `ok:true`, **0 sources**, a model answer. → **Defect A**.
- **First divergence:** `api/abuai-online.ts` returned `ok:true` with the model's free text whenever
  an answer string existed, attaching `sources` only when present (`sources.length > 0 ? {sources}`).
  So an answer with **zero sources** — no evidence web_search retrieved anything — was surfaced as a
  confident claim. The only guard was a *soft* prompt line ("say honestly if you found nothing"),
  which the model can and did ignore (fabricated fixtures).
- **Root cause:** ungrounded current-info returned as fact. Violates §47 release gate
  ("current-information hallucination without live retrieval") and "NO TOOL RESULT = NO CLAIM".
- **Fix (CODE, this cycle):** zero sources ⇒ **honest failure** `ONLINE_NO_RESULTS`
  ("I could not find current info — I'd rather tell you that than make something up"); the model's
  ungrounded free text is discarded, never leaked. web_search-grounded answers (≥1 source) are
  unchanged. Regression: `src/eval/onlineGroundingGate.test.ts` (grounded ⇒ ok+sources; ungrounded ⇒
  honest fail, fabricated text not leaked). Evidence: **CODE / AUTOMATED_TEST**; PREVIEW
  re-verification pending redeploy.
- **Residual (Defect B, queued):** the personal-guard over-blocks `"who is the current prime
  minister"` — the `(?!the\s+prime\s+minister)` lookahead in `PERSONAL_EN` (line 60) is defeated by
  the adjective "current". Narrow the guard so public office-holder questions are searched.

---

## P0-VOICE — mic non-functional (no capture, no playback)  ·  DEVICE-GATED (root-caused, plan below)

- **Symptom:** mic tap → "מקשיבה..." forever; speech never captured, never in the text field;
  AbuAI never speaks back. Zero audio in / out.
- **Reproduction:** requires the physical iPhone — I have no mic/speaker/device, so the exact iOS
  behavior is **not machine-observable**. This is honestly DEVICE-GATED.
- **Code audit (CODE evidence):**
  - Primary STT is the Web Speech API (`webkitSpeechRecognition`, `index.tsx:2089`). On iOS Safari
    this exists but is **notoriously unreliable in installed-PWA standalone mode** — it commonly
    fires no `onresult`/`onend`/`onerror`, or errors generically.
  - **No watchdog on the Web Speech listening path.** The restart/back-off logic hangs off `onend`;
    if `onend` never fires (a known iOS behavior), listening stays "מקשיבה" **forever** with no
    bound and no honest fallback. This is itself a **code defect** — the voice rule requires every
    fallback to be *bounded* with a *truthful* state ("a silent wait is a defect").
  - The Whisper fallback (`startWhisperFallback` → getUserMedia + MediaRecorder → Groq) uses an
    **iOS-aware mime** (`services/recording.ts` prefers `audio/mp4`), so recording format is not the
    blocker. `VITE_GROQ_API_KEY` **is** present in the preview build (client-direct STT has a key).
  - So the most likely first divergence: `webkitSpeechRecognition.start()` succeeds but yields no
    events in the iOS PWA → infinite "listening" with no watchdog to fall through to Whisper.
- **Fix classification:** part **CODE** (bounded listening watchdog + honest "I can't hear you, type
  here" state; prefer the Whisper path over the flaky Web Speech primary on iOS), part
  **DEVICE-GATED** (whether iOS actually captures with the changed path can only be proven on the
  phone). I did **not** blind-land a voice change this session: it is unverifiable without the device
  and the mic flow lives in a 3,500-line component where an unverified change is high-risk.
- **Plan (next cycle):** (1) add a `LISTEN_TIMEOUT` watchdog to `startVoiceListening` mirroring the
  existing `REALTIME_AUDIO_TIMEOUT` pattern → never hang; surface honest state + fall to Whisper.
  (2) On iOS, skip the `webkitSpeechRecognition` primary and start with the Whisper path. (3) Emit an
  Operator Protocol (OP-003) for on-device re-test of mic capture + audible TTS.

---

## P0-MEMORY — no continuity; dishonestly implies it has memory  ·  DISHONEST-PHRASING FIXED (0.77.0); continuity needs device repro

> **Update (0.77.0):** the *dishonest phrasing* half is fixed at CODE. The SYSTEM_PROMPT now forbids
> implying a persistent/fallible memory ("שכחתי" / "לפעמים אני מפספסת") — anything not said in the
> current conversation → honest "לא יודעת / לא סיפרת לי"; what WAS said this conversation → remember
> and continue. Regression `src/screens/AbuAI/memoryHonesty.test.ts` (source-contract on the prompt).
> The *continuity* half (does the model reliably get + use the last turn on device) still needs a
> device repro — see below.


- **Symptom:** forgets the previous turn within one conversation; and *verbally implies* it has
  memory ("sometimes I miss things") instead of being honest it has none.
- **Code audit (CODE evidence):**
  - The LLM fallback **does** receive the conversation history: `buildFullTurnTools(newMessages, …)`
    (`index.tsx:600`) → `llm: () => sendMessage(messages, …)` (`fullTurnBridge.ts:19`). So context is
    wired at the tool layer — memory loss is **not** a simple "history never passed" bug.
  - The dishonest "sometimes I miss things" is **LLM-generated persona**, not a hardcoded line — the
    only hardcoded memory line is *honest* ("לא זוכרת נושא ברור שדיברנו עליו", `index.tsx:1170`). So
    the model is role-playing continuity the system doesn't deterministically guarantee.
- **Likely first divergences (to confirm on device):** (a) whether the React `messages` state
  actually accumulates across turns in the installed PWA (iOS can reset state on background/restore);
  (b) whether `sendMessage` truncates/summarizes history so far that the model loses the last turn;
  (c) the system prompt permits the model to claim memory it doesn't have.
- **Fix classification:** part **CODE** (forbid the model from claiming memory/continuity it can't
  back; guarantee the last-N turns reach the model; make working-memory continuity deterministic for
  follow-ups per CONVERSATION_GAP_MAP G3), part **DEVICE-GATED** (reproduce the exact "forgets last
  turn" on the phone to localize a↔b). **Not fixed this session** — needs device repro to avoid
  guessing. Queued P0.

---

## P0-CALENDAR — spoken/typed create ignored person/place/date, did not save  ·  MOST LIKELY downstream of P0-VOICE

- **Symptom:** a create ignored person, place, and relative date and did not save — contradicting
  the 0.68–0.73 CODE fixes.
- **Code audit (CODE evidence):** the controller **is** the sole runtime path (`index.tsx:599`,
  `COGNITIVE_RUNTIME_FULL=true`, enforced by `runtimePathProof.test.ts`); the 0.68–0.73 create paths
  are covered by 10,806 green tests and run through this exact controller.
- **Most likely first divergence:** if the create was attempted **by voice**, it is downstream of
  P0-VOICE — with STT dead, no transcript reaches the controller, so nothing is parsed or saved
  (looks like "ignored everything"). If it was **typed** and still failed, that is a distinct,
  higher-severity finding (the controller not reached, or the deployed client differs) and needs a
  typed-only device repro to confirm.
- **Fix classification:** **DEVICE-GATED** until we know voice-vs-typed. The single most useful next
  device datapoint: **type** `תקבעי פגישה עם מור מחר בשלוש` on the phone and report the reply. If it
  confirms/saves, calendar is fine and the failure was voice-driven; if not, escalate.

---

## Prioritized plan

1. **P0-ONLINE** — FIXED this cycle (0.75.0). Redeploy preview + re-probe to upgrade CODE → PREVIEW.
   Then Defect B (personal-guard over-block).
2. **P0-VOICE** — next code cycle: listening watchdog + iOS→Whisper primary; OP-003 for device proof.
   Highest product impact (blocks everything) but the capture itself is device-gated.
3. **P0-MEMORY** — needs a device repro to localize (state-reset vs history-truncation); then fix the
   dishonest persona + guarantee last-N-turns + deterministic follow-up memory.
4. **P0-CALENDAR** — one device datapoint (typed create) decides whether it is voice-downstream or a
   real separate defect.

**Operator Protocols to run on the phone (build ≥ 0.75.0):** a new OP-003 (voice capture + TTS) is
the top device task; a typed-calendar-create datapoint resolves P0-CALENDAR; a two-turn memory probe
localizes P0-MEMORY.
