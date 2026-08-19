/*
 * Voice Flight Recorder — on-device, mobile-readable voice-turn diagnostics
 * ═════════════════════════════════════════════════════════════════════════
 * The physical iPhone failure ("doesn't listen, no transcript, doesn't speak") is
 * NOT observable from code alone. This records the full voice turn as an ordered
 * sequence of 28 stages so the FIRST missing/failed stage is visible on the device
 * — no Safari dev tools needed. `copyVoiceReport()` backs the "העתקת אבחון קול"
 * button so Leo can paste a compact report into Claude Code.
 *
 * Privacy: NEVER stores raw audio. Transcripts are redacted (length only) unless
 * the user explicitly opts in.
 */

export const VOICE_STAGES = [
  'USER_GESTURE_RECEIVED', 'SECURE_CONTEXT', 'MICROPHONE_PERMISSION_REQUESTED',
  'MICROPHONE_PERMISSION_GRANTED', 'MEDIA_STREAM_CREATED', 'AUDIO_TRACK_LIVE',
  'REALTIME_TOKEN_RECEIVED', 'PEER_CONNECTION_CREATED', 'SDP_OFFER_CREATED',
  'SDP_ANSWER_RECEIVED', 'ICE_CONNECTED', 'DATA_CHANNEL_OPEN', 'SESSION_UPDATE_SENT',
  'SESSION_UPDATED_CONFIRMED', 'SPEECH_STARTED', 'SPEECH_STOPPED',
  'AUDIO_BUFFER_COMMITTED', 'TRANSCRIPTION_STARTED', 'TRANSCRIPTION_COMPLETED',
  'TRANSCRIPT_LANGUAGE_RESOLVED', 'ABUAI_BRAIN_STARTED', 'ABUAI_BRAIN_COMPLETED',
  'RESPONSE_CREATE_SENT', 'OUTPUT_AUDIO_EVENT_RECEIVED', 'REMOTE_AUDIO_TRACK_RECEIVED',
  'AUDIO_PLAY_REQUESTED', 'AUDIO_PLAY_STARTED', 'AUDIO_PLAY_COMPLETED',
  // Distinct, searchable operator signal: the OpenAI project has no credit. The mint
  // is free (200) so the session OPENS, but the first inference returns a session
  // error insufficient_quota/credit_balance_exhausted → this stage names the wall so a
  // ~$0 session is never mistaken for a "transport failure" again (overnight item 2).
  'REALTIME_CREDIT_EXHAUSTED',
] as const

export type VoiceStage = typeof VOICE_STAGES[number]
export type StageStatus = 'pending' | 'ok' | 'warn' | 'fail' | 'skipped'

export interface StageRecord {
  stage: VoiceStage
  index: number
  status: StageStatus
  at?: number          // epoch ms
  elapsedMs?: number   // since turn start
  errorCode?: string
  detail?: string
}

export interface VoiceContext {
  path?: 'realtime_voice' | 'pipeline_microphone' | 'unknown'
  model?: string
  appVersion?: string
  commit?: string
  ua?: string
  iosVersion?: string
  secureContext?: boolean
  micTrack?: { readyState?: string; enabled?: boolean; muted?: boolean }
  iceState?: string
  pcState?: string
  dcState?: string
  audioEl?: { paused?: boolean; muted?: boolean; volume?: number }
}

export interface FlightSnapshot {
  turnId: string
  startedAt: number
  context: VoiceContext
  stages: StageRecord[]
  firstMissing: VoiceStage | null
  firstFailure: { stage: VoiceStage; errorCode?: string } | null
  reachedSpeech: boolean
  reachedAudioPlay: boolean
}

export class VoiceFlightRecorder {
  private stages: StageRecord[]
  private ctx: VoiceContext = { path: 'unknown' }
  private startedAt: number
  private includeTranscripts = false
  private transcriptRedacted = ''
  constructor(private turnId: string, now: number) {
    this.startedAt = now
    this.stages = VOICE_STAGES.map((stage, index) => ({ stage, index, status: 'pending' as StageStatus }))
  }

  setContext(patch: Partial<VoiceContext>): void { this.ctx = { ...this.ctx, ...patch } }
  setIncludeTranscripts(v: boolean): void { this.includeTranscripts = v }

  /** Record the transcript — redacted (length only) by default. */
  noteTranscript(text: string): void {
    this.transcriptRedacted = this.includeTranscripts ? text : `[redacted len=${(text || '').length}]`
  }

  mark(stage: VoiceStage, status: StageStatus, now: number, opts?: { errorCode?: string; detail?: string }): void {
    const rec = this.stages.find(s => s.stage === stage)
    if (!rec) return
    rec.status = status
    rec.at = now
    rec.elapsedMs = now - this.startedAt
    if (opts?.errorCode) rec.errorCode = opts.errorCode
    if (opts?.detail) rec.detail = opts.detail
  }

  /** The first stage still 'pending' AFTER the last stage that reached a terminal
   *  status — i.e. where the turn stalled. */
  firstMissing(): VoiceStage | null {
    const lastDone = [...this.stages].reverse().find(s => s.status === 'ok' || s.status === 'fail')
    if (!lastDone) return this.stages[0]!.status === 'pending' ? this.stages[0]!.stage : null
    const next = this.stages.find(s => s.index > lastDone.index && s.status === 'pending')
    return next ? next.stage : null
  }

  firstFailure(): { stage: VoiceStage; errorCode?: string } | null {
    const f = this.stages.find(s => s.status === 'fail')
    return f ? { stage: f.stage, ...(f.errorCode ? { errorCode: f.errorCode } : {}) } : null
  }

  snapshot(): FlightSnapshot {
    const reached = (st: VoiceStage) => this.stages.find(s => s.stage === st)?.status === 'ok'
    return {
      turnId: this.turnId,
      startedAt: this.startedAt,
      context: this.ctx,
      stages: this.stages.map(s => ({ ...s })),
      firstMissing: this.firstMissing(),
      firstFailure: this.firstFailure(),
      reachedSpeech: reached('SPEECH_STARTED'),
      reachedAudioPlay: reached('AUDIO_PLAY_STARTED'),
    }
  }

  /** Compact, paste-ready report (safe: no raw audio, transcript redacted). */
  toReport(): string {
    const s = this.snapshot()
    const icon = (st: StageStatus) => st === 'ok' ? '🟢' : st === 'warn' ? '🟡' : st === 'fail' ? '🔴' : st === 'skipped' ? '⚪' : '·'
    const lines = s.stages.map(r => `${String(r.index + 1).padStart(2)}. ${icon(r.status)} ${r.stage}${r.elapsedMs != null ? ` +${r.elapsedMs}ms` : ''}${r.errorCode ? ` [${r.errorCode}]` : ''}${r.detail ? ` — ${r.detail}` : ''}`)
    const c = s.context
    return [
      `AbuAI Voice Diagnostic — turn ${s.turnId}`,
      `path=${c.path} model=${c.model ?? '?'} v=${c.appVersion ?? '?'} commit=${c.commit ?? '?'}`,
      `secureContext=${c.secureContext} ua=${(c.ua ?? '').slice(0, 80)} ios=${c.iosVersion ?? '?'}`,
      `mic: readyState=${c.micTrack?.readyState ?? '?'} enabled=${c.micTrack?.enabled ?? '?'} muted=${c.micTrack?.muted ?? '?'}`,
      `webrtc: ice=${c.iceState ?? '?'} pc=${c.pcState ?? '?'} dc=${c.dcState ?? '?'}`,
      `audioEl: paused=${c.audioEl?.paused ?? '?'} muted=${c.audioEl?.muted ?? '?'} vol=${c.audioEl?.volume ?? '?'}`,
      `transcript: ${this.transcriptRedacted || '(none)'}`,
      `FIRST MISSING STAGE: ${s.firstMissing ?? '(complete)'}`,
      `FIRST FAILURE: ${s.firstFailure ? `${s.firstFailure.stage} [${s.firstFailure.errorCode ?? ''}]` : '(none)'}`,
      '',
      ...lines,
    ].join('\n')
  }
}

// ── Global singleton + copy hook (one active turn recorder) ──────────────────
let _current: VoiceFlightRecorder | null = null
let _last: VoiceFlightRecorder | null = null

export function startVoiceFlight(turnId: string, now: number): VoiceFlightRecorder {
  _current = new VoiceFlightRecorder(turnId, now)
  _last = _current
  return _current
}
export function currentVoiceFlight(): VoiceFlightRecorder | null { return _current }
export function endVoiceFlight(): void { _current = null }
/** The report for the current or most recent turn (for the copy button). */
export function voiceFlightReport(): string { return (_current ?? _last)?.toReport() ?? 'אין עדיין אבחון קול. נסי לדבר פעם אחת.' }

export async function copyVoiceReport(): Promise<string> {
  const report = voiceFlightReport()
  try {
    const nav = (globalThis as unknown as { navigator?: { clipboard?: { writeText(s: string): Promise<void> } } }).navigator
    if (nav?.clipboard?.writeText) await nav.clipboard.writeText(report)
  } catch { /* clipboard unavailable — caller still gets the string */ }
  return report
}

// Console hook for device debugging even without a visible button.
try {
  const g = globalThis as unknown as { __abuVoiceDiag?: () => string; __abuCopyVoiceDiag?: () => Promise<string> }
  g.__abuVoiceDiag = voiceFlightReport
  g.__abuCopyVoiceDiag = copyVoiceReport
} catch { /* non-browser */ }
