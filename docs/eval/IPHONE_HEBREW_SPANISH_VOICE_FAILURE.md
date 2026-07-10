# P0 — iPhone Hebrew-heard-as-Spanish, no spoken response (Evolution case)

> GOLD explicit failure signal. Preserved evidence — do NOT delete after the fix.

## Reported evidence (physical device)

```text
physical_device: iPhone
browser: iOS Safari
deployment: 0.58.0-evolution-os-observe-slice
input_modality: microphone
spoken_language: Hebrew
observed_state: listening / waiting for Spanish
spoken_response: none
severity: P0
```

## Proven first divergence — `speech_to_text` / `language_locale_detection`

The STT language is **hard-pinned from a sticky preference** (`abu-voice-lang`),
never from the current utterance, and Whisper auto-detect is never used.

- `src/screens/AbuAI/service.ts` `buildSttFormData` (pre-fix):
  ```js
  const voiceLang = localStorage.getItem('abu-voice-lang') || 'auto'
  if (voiceLang === 'he' || voiceLang === 'auto') formData.append('language','he') // 'auto' is NOT auto
  else if (voiceLang === 'es') { formData.append('language','es'); /* Spanish prompt */ }
  ```
  → With a persisted `'es'` preference, **Hebrew audio is sent to Whisper as `language:'es'`
  with a Spanish prompt** → transcribed as Spanish garbage → no valid turn → silence.
- `src/screens/AbuAI/index.tsx:2044` (browser WebSpeech fallback): `rec.lang = voiceLangSetting === 'es' ? 'es-AR' : 'he-IL'` — same sticky-preference pin; a Spanish recognizer cannot hear Hebrew.
- `src/services/realtimeVoice.ts` `speak()` (pre-fix): hard-codes *"Read this reply … in Hebrew"* — a latent symmetric bug for Spanish replies.

### Why "waits for Spanish, no response"
Spanish-pinned STT returns no usable Hebrew transcript → the turn never commits →
the mic stays in `listening` → the brain never runs → nothing is spoken. There is
no explicit `LANGUAGE_UNRESOLVED` / `NO_SPEECH` failure state, so it waits silently.

### Falsified alternatives (checked, not the cause)
- Realtime input transcription is `gpt-4o-mini-transcribe` with **no** language pin → auto-detects; not the pin site.
- Pipeline TTS (`voice.ts detectLang(answerText)`) follows the answer text → self-correcting; not the cause of *no* audio.
- `realtimeRef.current` **is** assigned before `speak()` (index.tsx:2488) → `speak()` is reachable; not a null no-op.

## Root cause (mechanism, not phrase)
Language is a **sticky global preference applied at STT time**, distributed across
≥4 sites (`service.ts`, `index.tsx` rec.lang, `voice.ts` detectLang, `realtimeVoice.speak`),
with **no single resolver** and **no per-utterance detection driving the response**.
This violates the behavioral law: *the current utterance must be the strongest signal;
a previous/persisted Spanish state must never override a clear Hebrew utterance.*

## Fix (mechanism)
1. `src/services/languagePolicy.ts` — one canonical `LanguagePolicyResolver` used by every path.
2. STT auto-detects per utterance (omit Whisper `language` unless the user explicitly forced one; bilingual prompt hint). Browser WebSpeech defaults to `he-IL`, `es-AR` only for an *active* Spanish conversation — never from a stale preference alone.
3. Response + TTS language follow the **detected transcript** language.
4. Realtime `speak()` derives language from the reply text.
5. Evolution trace records real `inputModality` + the full language chain.
6. Voice failure states (`NO_SPEECH`, `LANGUAGE_UNRESOLVED`, …) — never silent indefinite listening.

## Acceptance
A user may speak Hebrew after any previous Spanish state, receive a spoken Hebrew
response, and the trace must prove microphone → language resolution → audible output.
Regression family: `src/services/languagePolicy.test.ts` (20 cases). Physical iPhone
proof still required (desktop cannot exercise the mic).
