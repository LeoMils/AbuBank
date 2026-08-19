# P0 — iPhone voice runtime repair (0.59.1) — proven defects + observability

> Follows the failed 0.59.0 physical test ("does not listen, no transcript, does not
> speak"). The multilingual language fix did not touch the live Realtime runtime.
> ROOT CAUSE OF THE LIVE FAILURE IS NOT YET PROVEN — it requires the on-device flight
> recorder. This build repairs the proven code defects and makes the next test observable.

## Proven defects (repository references)

1. **Dead canonical state machine.** `src/screens/AbuAI/index.tsx` defined its own
   `type VoiceState` (now renamed `VoiceUIPhase`) and never imported
   `services/voiceStateMachine.ts`. → Now imported and used (`nextVoiceState`,
   `failureLine`) in `enterVoiceMode` + the Realtime failure handlers.
2. **Stale Realtime event names.** `services/realtimeVoice.ts` handled only
   `response.audio.*` / `response.audio_transcript.*`. The current GA emits
   `response.output_audio.*` / `response.output_audio_transcript.*`, and input
   transcription includes `.failed`. A renamed output/transcription event was
   silently dropped → no transcript, no speaking, indefinite listening. → Replaced
   with `services/realtimeEvents.ts` normalizing CURRENT (primary) + legacy names,
   surfacing unknown names, and mapping `input_audio_transcription.failed` →
   explicit `TRANSCRIPTION_FAILED`.
3. **Model drift.** `gpt-realtime` was hard-coded in `realtimeVoice.ts`,
   `api/realtime-token.ts`, and `index.tsx` diagnostics independently. → One shared
   `services/realtimeModel.ts`; the mint returns the model and the client asserts no
   drift at the SDP boundary; `/api/health` reports it.

## First divergence — NOT yet proven (honest)

The live first divergence (mic? SDP? session.updated? transcription? audio play?) is
not observable from code. The **Voice Flight Recorder** (`services/voiceFlightRecorder.ts`,
28 stages) now records the exact first missing/failed stage on-device. The next iPhone
test will produce the evidence via the **"העתקת אבחון קול"** button (voice overlay).

## Acceptance controls added

- **Mic:** live-track check (`readyState==='live'`, mute/ended handlers); a returned
  stream is not treated as "listening".
- **Realtime:** stage evidence for token→SDP→ICE→data-channel→session.updated; a
  transcription failure is explicit, not silent.
- **Output audio:** `autoplay` + `playsInline` + awaited `play()`; on rejection →
  `AUDIO_PLAYBACK_FAILED` + a visible **"לחצי כאן כדי להפעיל קול"** recovery button.
- **Stale build:** `services/versionSync.ts` detects a client/server version mismatch;
  the flight report shows version + commit.

## Status
`CODE REPAIRED — PHYSICAL IPHONE PROOF REQUIRED`. Desktop automation cannot exercise
the mic/WebRTC/native audio path; those remain device-only.
