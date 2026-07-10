/*
 * Voice State Machine (§8) — no indefinite silent waiting
 * ═══════════════════════════════════════════════════════
 * A user-safe voice lifecycle with EXPLICIT failure states. The P0 failure was the
 * mic sitting in "listening" forever after a completed Hebrew utterance because a
 * mis-languaged STT produced no transcript. This state machine makes that state
 * illegal: a completed utterance with no usable transcript MUST resolve to an
 * explicit failure (NO_SPEECH / TRANSCRIPTION_FAILED / LANGUAGE_UNRESOLVED), each
 * with a bounded timeout and a defined recovery — never silence.
 *
 * Pure + deterministic. The UI drives it with events; it never hides an error
 * behind a timeout.
 */

export type VoiceState =
  | 'IDLE' | 'REQUESTING_PERMISSION' | 'LISTENING' | 'SPEECH_DETECTED'
  | 'TRANSCRIBING' | 'REALTIME_PROCESSING' | 'THINKING' | 'SPEAKING'
  // explicit failure states
  | 'NO_SPEECH' | 'TRANSCRIPTION_FAILED' | 'LANGUAGE_UNRESOLVED'
  | 'REALTIME_FAILED' | 'RESPONSE_FAILED' | 'AUDIO_PLAYBACK_FAILED' | 'FALLBACK_ACTIVE'

export type VoiceEvent =
  | 'enter' | 'permission_granted' | 'permission_denied' | 'speech_started'
  | 'speech_stopped' | 'transcript_ok' | 'transcript_empty' | 'transcript_failed'
  | 'language_unresolved' | 'realtime_failed' | 'thinking_done' | 'response_failed'
  | 'audio_started' | 'audio_done' | 'audio_failed' | 'fallback' | 'exit' | 'timeout'

export const FAILURE_STATES: ReadonlySet<VoiceState> = new Set<VoiceState>([
  'NO_SPEECH', 'TRANSCRIPTION_FAILED', 'LANGUAGE_UNRESOLVED', 'REALTIME_FAILED',
  'RESPONSE_FAILED', 'AUDIO_PLAYBACK_FAILED',
])

/** States that must NOT persist — each has a bounded timeout (ms) and a next move. */
export const BOUNDED_TIMEOUTS: Partial<Record<VoiceState, number>> = {
  REQUESTING_PERMISSION: 15_000,
  LISTENING: 12_000,          // no speech in 12s → NO_SPEECH (never indefinite)
  SPEECH_DETECTED: 8_000,
  TRANSCRIBING: 12_000,       // STT stuck → TRANSCRIPTION_FAILED
  REALTIME_PROCESSING: 12_000,
  THINKING: 15_000,
  SPEAKING: 30_000,
}

const TRANSITIONS: Record<VoiceState, Partial<Record<VoiceEvent, VoiceState>>> = {
  IDLE: { enter: 'REQUESTING_PERMISSION', exit: 'IDLE' },
  REQUESTING_PERMISSION: { permission_granted: 'LISTENING', permission_denied: 'IDLE', timeout: 'IDLE', exit: 'IDLE' },
  LISTENING: { speech_started: 'SPEECH_DETECTED', timeout: 'NO_SPEECH', realtime_failed: 'REALTIME_FAILED', exit: 'IDLE' },
  SPEECH_DETECTED: { speech_stopped: 'TRANSCRIBING', realtime_failed: 'REALTIME_FAILED', timeout: 'TRANSCRIBING', exit: 'IDLE' },
  TRANSCRIBING: {
    transcript_ok: 'THINKING', transcript_empty: 'NO_SPEECH', transcript_failed: 'TRANSCRIPTION_FAILED',
    language_unresolved: 'LANGUAGE_UNRESOLVED', timeout: 'TRANSCRIPTION_FAILED', exit: 'IDLE',
  },
  REALTIME_PROCESSING: {
    transcript_ok: 'THINKING', transcript_empty: 'NO_SPEECH', realtime_failed: 'REALTIME_FAILED',
    timeout: 'REALTIME_FAILED', exit: 'IDLE',
  },
  THINKING: { thinking_done: 'SPEAKING', response_failed: 'RESPONSE_FAILED', timeout: 'RESPONSE_FAILED', exit: 'IDLE' },
  SPEAKING: { audio_started: 'SPEAKING', audio_done: 'LISTENING', audio_failed: 'AUDIO_PLAYBACK_FAILED', timeout: 'AUDIO_PLAYBACK_FAILED', exit: 'IDLE' },
  // Failure states recover to LISTENING (retry) or fall back — never dead-end silent.
  NO_SPEECH: { enter: 'LISTENING', speech_started: 'SPEECH_DETECTED', exit: 'IDLE', fallback: 'FALLBACK_ACTIVE' },
  TRANSCRIPTION_FAILED: { enter: 'LISTENING', fallback: 'FALLBACK_ACTIVE', exit: 'IDLE' },
  LANGUAGE_UNRESOLVED: { enter: 'LISTENING', fallback: 'FALLBACK_ACTIVE', exit: 'IDLE' },
  REALTIME_FAILED: { fallback: 'FALLBACK_ACTIVE', exit: 'IDLE' },
  RESPONSE_FAILED: { enter: 'LISTENING', fallback: 'FALLBACK_ACTIVE', exit: 'IDLE' },
  AUDIO_PLAYBACK_FAILED: { enter: 'LISTENING', fallback: 'FALLBACK_ACTIVE', exit: 'IDLE' },
  FALLBACK_ACTIVE: { permission_granted: 'LISTENING', transcript_ok: 'THINKING', exit: 'IDLE' },
}

export interface VoiceTransition { from: VoiceState; to: VoiceState; event: VoiceEvent }

/** Apply an event. Returns the same state for an undefined edge (no illegal jumps). */
export function nextVoiceState(state: VoiceState, event: VoiceEvent): VoiceState {
  return TRANSITIONS[state]?.[event] ?? state
}

export function isFailureState(s: VoiceState): boolean { return FAILURE_STATES.has(s) }

/** The bounded timeout for a state, or null if it may rest (IDLE / failure states). */
export function timeoutFor(s: VoiceState): number | null { return BOUNDED_TIMEOUTS[s] ?? null }

/**
 * The user-facing (Hebrew) line for a failure state — plain, never technical, and
 * never silent. Bilingual-aware clarification for LANGUAGE_UNRESOLVED.
 */
export function failureLine(s: VoiceState): string | null {
  switch (s) {
    case 'NO_SPEECH': return 'לא שמעתי כלום. תדברי אליי שוב?'
    case 'TRANSCRIPTION_FAILED': return 'לא הצלחתי להבין את ההקלטה. ננסה עוד פעם?'
    case 'LANGUAGE_UNRESOLVED': return 'לא הבנתי אם זה עברית או ספרדית. באיזו שפה נמשיך?'
    case 'REALTIME_FAILED': return 'הקול החי לא זמין כרגע. עברתי למצב רגיל — דברי אליי.'
    case 'RESPONSE_FAILED': return 'לא הצלחתי לענות עכשיו. ננסה שוב?'
    case 'AUDIO_PLAYBACK_FAILED': return 'כתבתי לך את התשובה — הקול לא הצליח להתנגן כאן.'
    default: return null
  }
}

/** INVARIANT (tested): LISTENING must always have a bounded timeout AND that timeout
 *  must lead to an explicit NO_SPEECH — it can never rest silently. */
export function listeningNeverSilent(): boolean {
  return timeoutFor('LISTENING') !== null && nextVoiceState('LISTENING', 'timeout') === 'NO_SPEECH'
}
