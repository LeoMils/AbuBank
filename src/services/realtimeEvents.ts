/*
 * Realtime event contract — normalize current + legacy names (Defect 2)
 * ═════════════════════════════════════════════════════════════════════
 * The client handled only the LEGACY event names (`response.audio.delta`, …). The
 * current OpenAI Realtime GA emits `response.output_audio.*` and
 * `response.output_audio_transcript.*`, and input transcription now includes a
 * `.failed` event. A renamed output/transcription event was silently ignored →
 * no transcript, no speaking, indefinite listening.
 *
 * This maps BOTH the current (primary) and legacy names into ONE internal event
 * type. Unknown names are surfaced (never silently dropped). Pure + tested.
 */

export type RealtimeInternalEvent =
  | 'session_created' | 'session_updated'
  | 'speech_started' | 'speech_stopped' | 'audio_committed'
  | 'user_transcript_delta' | 'user_transcript_done' | 'user_transcript_failed'
  | 'response_created' | 'response_done'
  | 'assistant_audio_delta' | 'assistant_audio_done'
  | 'assistant_transcript_delta' | 'assistant_transcript_done'
  | 'rate_limits' | 'error' | 'unknown'

/** current (GA) name → internal. */
const CURRENT: Record<string, RealtimeInternalEvent> = {
  'session.created': 'session_created',
  'session.updated': 'session_updated',
  'input_audio_buffer.speech_started': 'speech_started',
  'input_audio_buffer.speech_stopped': 'speech_stopped',
  'input_audio_buffer.committed': 'audio_committed',
  'conversation.item.input_audio_transcription.delta': 'user_transcript_delta',
  'conversation.item.input_audio_transcription.completed': 'user_transcript_done',
  'conversation.item.input_audio_transcription.failed': 'user_transcript_failed',
  'response.created': 'response_created',
  'response.done': 'response_done',
  'response.output_audio.delta': 'assistant_audio_delta',
  'response.output_audio.done': 'assistant_audio_done',
  'response.output_audio_transcript.delta': 'assistant_transcript_delta',
  'response.output_audio_transcript.done': 'assistant_transcript_done',
  'rate_limits.updated': 'rate_limits',
  'error': 'error',
}

/** legacy name → internal (kept for backward compatibility, NOT the primary path). */
const LEGACY: Record<string, RealtimeInternalEvent> = {
  'response.audio.delta': 'assistant_audio_delta',
  'response.audio.done': 'assistant_audio_done',
  'response.audio_transcript.delta': 'assistant_transcript_delta',
  'response.audio_transcript.done': 'assistant_transcript_done',
}

/** Names we knowingly ignore (no action needed) but must NOT classify as unknown. */
const BENIGN = new Set<string>([
  'response.output_item.added', 'response.output_item.done',
  'response.content_part.added', 'response.content_part.done',
  'conversation.item.created', 'input_audio_buffer.cleared',
])

export interface NormalizedEvent {
  internal: RealtimeInternalEvent
  raw: string
  isLegacy: boolean
  isBenign: boolean
}

/** Map a raw server event name to the internal contract. Unknown, non-benign names
 *  return 'unknown' so the caller can RECORD them (never silently ignore output). */
export function normalizeRealtimeEvent(rawType: string): NormalizedEvent {
  if (rawType in CURRENT) return { internal: CURRENT[rawType]!, raw: rawType, isLegacy: false, isBenign: false }
  if (rawType in LEGACY) return { internal: LEGACY[rawType]!, raw: rawType, isLegacy: true, isBenign: false }
  if (BENIGN.has(rawType)) return { internal: 'unknown', raw: rawType, isLegacy: false, isBenign: true }
  return { internal: 'unknown', raw: rawType, isLegacy: false, isBenign: false }
}

/** The internal events that carry the user's transcript text. */
export function isUserTranscriptEvent(e: RealtimeInternalEvent): boolean {
  return e === 'user_transcript_delta' || e === 'user_transcript_done'
}

/** The internal events that indicate assistant AUDIO output is flowing. */
export function isAssistantAudioEvent(e: RealtimeInternalEvent): boolean {
  return e === 'assistant_audio_delta' || e === 'assistant_audio_done'
}
