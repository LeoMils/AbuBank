// ─── OpenAI Realtime API — WebRTC Voice Client (FULL DUPLEX) ─────────
// v47 (2026): true ChatGPT-Advanced-Voice behavior. The live session is configured
// over the data channel with `session.update` → semantic_vad (natural hands-free
// turn-taking) + interrupt_response (barge-in: the user can cut the AI off mid-
// sentence; on WebRTC the server auto-truncates the unplayed assistant audio) +
// input transcription. Same engine as ChatGPT live; native audio in/out, sub-2s.
//
// v46 (2026): the Realtime API evolved. The old /v1/realtime/sessions minter
// and gpt-4o-realtime-preview model now 404. Current, SERVER-PROVEN contract
// (api/realtime-token.ts mints ok=true against this account):
//   - ephemeral secret: POST /v1/realtime/client_secrets (body { session:{...} })
//   - model family:     gpt-realtime  (confirmed available on this account)
//   - SDP exchange:      POST /v1/realtime/calls  (was /v1/realtime?model=)
//   - no OpenAI-Beta header required any more
// The actual mint happens SERVER-SIDE; the constants below mirror the real
// contract and are asserted by a guard test so an edit can't silently regress.

import { HE_VOICE } from './voiceConfig'
import { detectUtteranceLanguage } from './languagePolicy'
import { REALTIME_MODEL, assertNoModelDrift } from './realtimeModel'
import { normalizeRealtimeEvent } from './realtimeEvents'
import { currentVoiceFlight, type VoiceStage } from './voiceFlightRecorder'

// Model comes from the ONE shared source (realtimeModel.ts) so the client secret,
// SDP call, health, and diagnostics can never drift (Defect 3).
export { REALTIME_MODEL }
const REALTIME_CALLS_URL = 'https://api.openai.com/v1/realtime/calls'

// The ephemeral-secret endpoint (server-side minter target). Exported +
// asserted by a guard test so a future edit can't silently regress the path.
export const REALTIME_SESSION_URL = 'https://api.openai.com/v1/realtime/client_secrets'

/** Reject the docs placeholder / obvious stubs before any network call. */
export function isPlaceholderKey(k: string | undefined): boolean {
  return !k || k.length < 20 || /^(sk-\.\.\.|sk-xxx|your_|placeholder|example|<)/i.test(k)
}

export interface SessionMode { pushToTalk: boolean; listenMode: boolean; instructions: string; voice: string; transcriptionLanguage?: string }

/**
 * The FULL-DUPLEX session config sent over the data channel on connect. Pure +
 * exported so it can be regression-locked: hands-free semantic VAD, barge-in
 * (interrupt_response), and input transcription — ChatGPT Advanced-Voice behavior.
 * - default (quiet):  semantic_vad, create_response+interrupt_response → true duplex
 * - noisy (PTT):      turn_detection null (manual commit)
 * - listen:           semantic_vad but create_response false (transcribe only)
 */
export function buildRealtimeSessionUpdate(m: SessionMode): Record<string, unknown> {
  return {
    type: 'session.update',
    session: {
      type: 'realtime',
      instructions: m.instructions,
      audio: {
        input: {
          // Pin the STT language (Hebrew, Martita's primary, unless caller overrides
          // for an active Spanish conversation). Auto-detect misheard short Hebrew
          // like "בוקר טוב" as Russian/Cyrillic — never leave this unset.
          transcription: { model: 'gpt-4o-mini-transcribe', language: m.transcriptionLanguage ?? 'he' },
          turn_detection: m.pushToTalk ? null : {
            type: 'semantic_vad',
            eagerness: 'auto',
            // create_response FALSE: the model does NOT answer on its own — it
            // transcribes, and AbuAI's BRAIN produces the answer (family/calendar/
            // online/memory), voiced via session.speak(). Path-unification rule:
            // voice must not bypass the brain.
            create_response: false,
            interrupt_response: true, // barge-in still cuts off a brain reply mid-voice
          },
        },
        output: { voice: m.voice },
      },
    },
  }
}

export type RealtimeState = 'idle' | 'connecting' | 'listening' | 'speaking' | 'error'

export interface RealtimeCallbacks {
  onStateChange: (state: RealtimeState) => void
  onUserTranscript: (text: string) => void
  onAssistantTranscript: (text: string) => void
  onAssistantDelta: (delta: string) => void
  onError: (error: string) => void
  /** Server reported the user's speech could not be transcribed → the UI must show
   *  TRANSCRIPTION_FAILED, never keep listening silently. */
  onTranscriptFailed?: (code: string) => void
  /** Remote audio arrived but the browser blocked play() (iOS autoplay) → the UI
   *  must show the text + a "tap to play" recovery button. */
  onAudioBlocked?: () => void
  /** A response.create succeeded but NO output-audio event arrived within the
   *  watchdog window (REALTIME_AUDIO_TIMEOUT). The realtime audio attempt was
   *  cancelled — the caller must voice the reply via pipeline TTS, never wait
   *  silently. `code` is the classified reason for diagnostics/Evolution. */
  onAudioTimeout?: (code: string) => void
}

// After a response.create that asks for audio, the first output-audio event should
// arrive well within this window (target latency is sub-2s). If it does not, we
// classify REALTIME_AUDIO_TIMEOUT and fall back to pipeline TTS.
const AUDIO_EVENT_TIMEOUT_MS = 5000

export class RealtimeVoiceSession {
  private pc: RTCPeerConnection | null = null
  private dc: RTCDataChannel | null = null
  private audioEl: HTMLAudioElement | null = null
  private stream: MediaStream | null = null
  private cb: RealtimeCallbacks
  private instructions: string
  private _state: RealtimeState = 'idle'
  private retryCount = 0
  private maxRetries = 2
  private onFatalError: (() => void) | null
  private vadThreshold: number
  private vadSilenceMs: number
  private pushToTalk: boolean    // noisy mode = push-to-talk (no server VAD)
  private _listenMode: boolean   // v23: passive listening — transcribe but don't respond
  private transcriptionLanguage: string // STT language pinned in session.update (Hebrew default)
  private audioWatchdog: ReturnType<typeof setTimeout> | null = null // REALTIME_AUDIO_TIMEOUT guard
  private unknownEvents: string[] = [] // unrecognized server event names (Defect 2 safety)

  /** Server event names we did not recognize this session — surfaced for diagnostics. */
  get unrecognizedEvents(): string[] { return [...this.unknownEvents] }

  constructor(callbacks: RealtimeCallbacks, instructions: string, onFatalError?: () => void, noiseMode: 'quiet' | 'noisy' | 'listen' = 'quiet', transcriptionLanguage: string = 'he') {
    this.cb = callbacks
    this.instructions = instructions
    this.onFatalError = onFatalError ?? null
    // v23: Three modes
    this.pushToTalk = noiseMode === 'noisy'
    this._listenMode = noiseMode === 'listen'
    this.transcriptionLanguage = transcriptionLanguage
    this.vadThreshold = 0.75
    this.vadSilenceMs = 900
  }

  get state(): RealtimeState { return this._state }

  private setState(s: RealtimeState) {
    if (this._state === s) return
    console.log(`[Realtime] ${this._state} → ${s}`)
    this._state = s
    this.cb.onStateChange(s)
  }

  /** Mark a Voice Flight Recorder stage (safe no-op if no active flight). */
  private stage(s: VoiceStage, status: 'ok' | 'warn' | 'fail', opts?: { errorCode?: string; detail?: string }): void {
    try { currentVoiceFlight()?.mark(s, status, Date.now(), opts) } catch { /* diag must never break voice */ }
  }
  private setFlightCtx(patch: Parameters<NonNullable<ReturnType<typeof currentVoiceFlight>>['setContext']>[0]): void {
    try { currentVoiceFlight()?.setContext(patch) } catch { /* */ }
  }

  /** Arm the REALTIME_AUDIO_TIMEOUT watchdog after a response.create that asks for
   *  audio. Cleared the instant the first output-audio event arrives. */
  private startAudioWatchdog(): void {
    this.clearAudioWatchdog()
    this.audioWatchdog = setTimeout(() => this.handleAudioTimeout(), AUDIO_EVENT_TIMEOUT_MS)
  }
  private clearAudioWatchdog(): void {
    if (this.audioWatchdog) { clearTimeout(this.audioWatchdog); this.audioWatchdog = null }
  }
  /** No output-audio event arrived in time: classify it, CANCEL the realtime audio
   *  attempt, and hand off to the caller (pipeline TTS) — never wait silently. */
  private handleAudioTimeout(): void {
    this.audioWatchdog = null
    if (this._listenMode) return // passive mode never voices a reply
    const code = 'REALTIME_AUDIO_TIMEOUT'
    console.warn('[Realtime] no output-audio event within timeout → ' + code + ' (cancel + pipeline TTS)')
    this.stage('OUTPUT_AUDIO_EVENT_RECEIVED', 'fail', { errorCode: code, detail: `no audio in ${AUDIO_EVENT_TIMEOUT_MS}ms` })
    this.sendEvent({ type: 'response.cancel' }) // cancel the stalled realtime audio attempt
    if (this._state === 'speaking') this.setState('listening')
    this.cb.onAudioTimeout?.(code)
  }

  async connect(): Promise<void> {
    this.setState('connecting')

    try {
      // 1. Mint a SHORT-LIVED ephemeral session SERVER-SIDE (/api/realtime-token).
      //    The long-lived OpenAI key lives server-side only and never reaches the
      //    client bundle. Only the ephemeral client_secret (safe for the browser
      //    SDP exchange) comes back. Any failure (missing/invalid key, quota, no
      //    realtime access) falls back to the free pipeline ONCE — no retry loop,
      //    no raw provider error, no key.
      const tokenRes = await fetch('/api/realtime-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voice: HE_VOICE.realtimeVoice,  // shimmer — warmer/more natural than coral (single source: voiceConfig)
          instructions: this.instructions,
          // v22.6: Quiet = server VAD (auto-detect speech), Noisy = no VAD (push-to-talk)
          turnDetection: this.pushToTalk ? null : {
            type: 'server_vad',
            threshold: this.vadThreshold,
            prefix_padding_ms: 250,
            silence_duration_ms: this.vadSilenceMs,
          },
        }),
      })

      const sessionData = await tokenRes.json().catch(() => null) as { ok?: boolean; client_secret?: string; error?: string; model?: string } | null
      // Reject model drift between the mint and the SDP call (Defect 3) — a mismatch
      // silently breaks the session.
      if (sessionData?.model) { try { assertNoModelDrift(sessionData.model, REALTIME_MODEL) } catch (e) { console.error('[Realtime]', (e as Error).message) } }
      if (!tokenRes.ok || !sessionData?.ok || !sessionData.client_secret) {
        const code = sessionData?.error ?? String(tokenRes.status)
        const isQuota = code === 'REALTIME_QUOTA'
        const isMissing = code === 'OPENAI_API_KEY_MISSING' || code === 'OPENAI_API_KEY_INVALID'
        console.error(`[Realtime] session mint failed (${code}) — falling back to pipeline`)
        this.cb.onError(isQuota ? 'המכסה של OpenAI נגמרה. עוברת למצב חלופי.' : isMissing ? 'מצב הקול לא מוגדר. עוברת למצב חלופי.' : 'מצב הקול לא זמין כרגע. עוברת למצב חלופי.')
        this.setState('error')
        this.cleanup()
        this.onFatalError?.() // immediately fall back — do not retry, do not throw
        return
      }

      const ephemeralKey = sessionData.client_secret
      this.stage('REALTIME_TOKEN_RECEIVED', 'ok')
      this.setFlightCtx({ path: 'realtime_voice', model: REALTIME_MODEL })

      // 2. Create WebRTC peer connection
      this.pc = new RTCPeerConnection()
      this.stage('PEER_CONNECTION_CREATED', 'ok')

      // v24.3: 10-second connection timeout — if data channel doesn't open, fail fast
      let connected = false
      const connectionTimeout = setTimeout(() => {
        if (!connected) {
          console.error('[Realtime] Connection timeout — data channel never opened in 10s')
          this.cb.onError('החיבור נכשל. נסי שוב.')
          this.attemptReconnect()
        }
      }, 10_000)

      // 3. Audio output — play AI voice through speaker. iOS Safari needs BOTH
      // autoplay AND playsInline, and it may STILL reject play() outside a gesture;
      // we await/catch the play() Promise and surface an explicit recovery path
      // rather than assuming the user heard audio.
      this.audioEl = document.createElement('audio')
      this.audioEl.autoplay = true
      ;(this.audioEl as unknown as { playsInline: boolean }).playsInline = true
      this.pc.ontrack = (event) => {
        if (this.audioEl && event.streams[0]) {
          this.audioEl.srcObject = event.streams[0]
          this.stage('REMOTE_AUDIO_TRACK_RECEIVED', 'ok')
          this.setFlightCtx({ audioEl: { paused: this.audioEl.paused, muted: this.audioEl.muted, volume: this.audioEl.volume } })
          this.stage('AUDIO_PLAY_REQUESTED', 'ok')
          const played = this.audioEl.play()
          if (played && typeof played.then === 'function') {
            played.then(() => this.stage('AUDIO_PLAY_STARTED', 'ok'))
              .catch((e: unknown) => {
                // Playback blocked (iOS autoplay policy) — NOT proof the user heard audio.
                this.stage('AUDIO_PLAY_STARTED', 'fail', { errorCode: 'play_rejected', detail: String((e as Error)?.name ?? e).slice(0, 40) })
                this.cb.onAudioBlocked?.()
              })
          }
        }
      }

      // v24.3: Monitor ICE connection — detect failures early
      this.pc.oniceconnectionstatechange = () => {
        const iceState = this.pc?.iceConnectionState
        console.log(`[Realtime] ICE state: ${iceState}`)
        this.setFlightCtx({ iceState: iceState ?? '?', pcState: this.pc?.connectionState ?? '?' })
        if (iceState === 'connected' || iceState === 'completed') this.stage('ICE_CONNECTED', 'ok')
        if (iceState === 'failed' || iceState === 'disconnected') {
          this.stage('ICE_CONNECTED', 'fail', { errorCode: `ice_${iceState}` })
          clearTimeout(connectionTimeout)
          if (this._state !== 'idle') this.attemptReconnect()
        }
      }

      // 4. Audio input — mic → OpenAI
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      })
      this.stage('MEDIA_STREAM_CREATED', 'ok')
      // Mic acceptance: a returned stream is NOT proof of a live audio track.
      const micTrack = this.stream.getAudioTracks()[0]
      this.setFlightCtx({ micTrack: micTrack ? { readyState: micTrack.readyState, enabled: micTrack.enabled, muted: micTrack.muted } : { readyState: 'none' } })
      if (micTrack && micTrack.readyState === 'live') {
        this.stage('AUDIO_TRACK_LIVE', 'ok')
        micTrack.onended = () => this.stage('AUDIO_TRACK_LIVE', 'fail', { errorCode: 'track_ended' })
        micTrack.onmute = () => this.setFlightCtx({ micTrack: { readyState: micTrack.readyState, enabled: micTrack.enabled, muted: true } })
      } else {
        this.stage('AUDIO_TRACK_LIVE', 'fail', { errorCode: `track_${micTrack?.readyState ?? 'none'}` })
      }
      this.pc.addTrack(this.stream.getTracks()[0]!, this.stream)

      // 5. Data channel for events
      this.dc = this.pc.createDataChannel('oai-events')
      this.dc.onopen = () => {
        connected = true
        clearTimeout(connectionTimeout)
        console.log('[Realtime] Data channel open')
        this.retryCount = 0
        this.stage('DATA_CHANNEL_OPEN', 'ok')
        this.setFlightCtx({ dcState: this.dc?.readyState ?? '?' })

        this.setState('listening')

        // ── FULL-DUPLEX session config (ChatGPT Advanced-Voice behavior) ──────
        // Configure the live session over the data channel (the reliable path; the
        // ephemeral mint no longer carries VAD). semantic_vad = natural, hands-free
        // turn-taking; interrupt_response = true → the user can BARGE IN mid-sentence.
        // On WebRTC the server auto-truncates unplayed assistant audio on a barge-in,
        // so no client-side audio stopping is needed — this is true full duplex.
        this.sendEvent(buildRealtimeSessionUpdate({
          pushToTalk: this.pushToTalk,
          listenMode: this._listenMode,
          instructions: this.instructions,
          voice: HE_VOICE.realtimeVoice,
          transcriptionLanguage: this.transcriptionLanguage,
        }))
        this.stage('SESSION_UPDATE_SENT', 'ok')

        // Send greeting (skip in listen mode — passive)
        if (!this._listenMode) {
          this.sendEvent({
            type: 'response.create',
            response: {
              modalities: ['audio', 'text'],
              // One warm sentence that INVITES action (talk / ask / calendar) —
              // never a dead "I'm here." Warm Israeli woman, calm but alive pace.
              instructions: 'Greet Martita warmly in Hebrew based on the time of day, in ONE short sentence that gently invites her to talk, ask something, or have you put something in her calendar. Warm, human, like a close friend on the phone — calm but not slow, never robotic, never a menu. Example: "בוקר טוב, Martita. אפשר לדבר איתי, לשאול משהו, או לבקש שאקבע לך משהו ביומן."',
            },
          })
        }
      }

      this.dc.onmessage = (event) => {
        try {
          this.handleEvent(JSON.parse(event.data))
        } catch (e) {
          console.error('[Realtime] Event parse error:', e)
        }
      }

      this.dc.onclose = () => {
        console.log('[Realtime] Data channel closed')
        clearTimeout(connectionTimeout)
        if (this._state !== 'idle') {
          this.attemptReconnect()
        }
      }

      // 6. SDP exchange
      const offer = await this.pc.createOffer()
      await this.pc.setLocalDescription(offer)
      this.stage('SDP_OFFER_CREATED', 'ok')

      const sdpRes = await fetch(
        `${REALTIME_CALLS_URL}?model=${REALTIME_MODEL}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${ephemeralKey}`,
            'Content-Type': 'application/sdp',
          },
          body: offer.sdp ?? '',
        },
      )

      if (!sdpRes.ok) {
        this.stage('SDP_ANSWER_RECEIVED', 'fail', { errorCode: `sdp_http_${sdpRes.status}` })
        throw new Error(`SDP exchange failed (${sdpRes.status})`)
      }
      this.stage('SDP_ANSWER_RECEIVED', 'ok')

      const answerSdp = await sdpRes.text()
      await this.pc.setRemoteDescription({ type: 'answer', sdp: answerSdp })

      console.log('[Realtime] WebRTC connected')

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Connection failed'
      console.error('[Realtime] Connect error:', msg)
      this.cb.onError(msg)
      this.attemptReconnect()
    }
  }

  private sendEvent(event: Record<string, unknown>): void {
    if (this.dc?.readyState === 'open') {
      this.dc.send(JSON.stringify(event))
    }
  }

  private handleEvent(event: any): void {
    // Normalize CURRENT + legacy server event names into one internal contract
    // (Defect 2). A renamed output/transcription event is no longer silently dropped.
    const { internal, raw, isBenign } = normalizeRealtimeEvent(event?.type ?? '')
    switch (internal) {
      case 'session_created':
        break
      case 'session_updated':
        this.stage('SESSION_UPDATED_CONFIRMED', 'ok')
        break

      // VAD detected speech start → user is talking
      case 'speech_started':
        this.clearAudioWatchdog() // barge-in: user is speaking again, drop any pending voicing guard
        this.stage('SPEECH_STARTED', 'ok')
        this.setState('listening')
        break
      case 'speech_stopped':
        this.stage('SPEECH_STOPPED', 'ok')
        break
      case 'audio_committed':
        this.stage('AUDIO_BUFFER_COMMITTED', 'ok')
        break

      // Streaming user transcription (current API)
      case 'user_transcript_delta':
        this.stage('TRANSCRIPTION_STARTED', 'ok')
        break
      case 'user_transcript_done':
        this.stage('TRANSCRIPTION_COMPLETED', 'ok')
        if (event.transcript) {
          try { currentVoiceFlight()?.noteTranscript(event.transcript) } catch { /* */ }
          this.cb.onUserTranscript(event.transcript)
        }
        break
      // A transcription FAILURE must become explicit — never indefinite listening.
      case 'user_transcript_failed': {
        const code = String(event.error?.code ?? event.error?.type ?? 'transcription_failed').slice(0, 40)
        this.stage('TRANSCRIPTION_COMPLETED', 'fail', { errorCode: code })
        this.cb.onTranscriptFailed?.(code)
        break
      }

      case 'response_created':
        if (this._listenMode) this.sendEvent({ type: 'response.cancel' }) // listen mode: transcribe only
        break

      // AI audio output flowing (current: response.output_audio.delta; legacy mapped too)
      case 'assistant_audio_delta':
        if (this._listenMode) break
        this.clearAudioWatchdog() // output-audio arrived → the REALTIME_AUDIO_TIMEOUT guard is satisfied
        this.stage('OUTPUT_AUDIO_EVENT_RECEIVED', 'ok')
        if (this._state !== 'speaking') this.setState('speaking')
        break
      case 'assistant_audio_done':
        break
      case 'assistant_transcript_delta':
        if (this._listenMode) break
        if (event.delta) this.cb.onAssistantDelta(event.delta)
        break
      case 'assistant_transcript_done':
        if (this._listenMode) break
        if (event.transcript) this.cb.onAssistantTranscript(event.transcript)
        break

      case 'response_done':
        this.setState('listening')
        break

      case 'error':
        console.error('[Realtime] Server error:', event.error)
        if (event.error?.code === 'session_expired' || event.error?.code === 'invalid_session') {
          this.attemptReconnect()
        } else {
          this.cb.onError(event.error?.message || 'שגיאה בשרת')
        }
        break

      case 'rate_limits':
        break

      default:
        // 'unknown' — a non-benign name we don't recognize. Record it (never ignore
        // a real server event silently). Benign lifecycle chatter is skipped.
        if (!isBenign && raw) {
          console.log('[Realtime] Unknown server event:', raw)
          this.unknownEvents.push(raw)
        }
    }
  }

  /** Attempt to reconnect with backoff, or trigger fatal fallback */
  private async attemptReconnect(): Promise<void> {
    if (this.retryCount >= this.maxRetries) {
      console.log('[Realtime] Max retries reached — falling back to pipeline')
      this.setState('error')
      this.cleanup()
      this.onFatalError?.()
      return
    }
    this.retryCount++
    console.log(`[Realtime] Reconnect attempt ${this.retryCount}/${this.maxRetries}`)
    this.cleanup()
    await new Promise(r => setTimeout(r, 1000 * this.retryCount)) // backoff: 1s, 2s
    this.connect()
  }

  /** Is this session in push-to-talk mode? */
  get isPushToTalk(): boolean { return this.pushToTalk }

  /** Is this session in listen/meeting mode? */
  get isListenMode(): boolean { return this._listenMode }

  /** Listen mode: user wants to ask about what was discussed */
  askAboutMeeting(question: string): void {
    if (!this._listenMode) return
    // Temporarily disable listen mode so AI can respond
    this._listenMode = false
    this.sendEvent({
      type: 'response.create',
      response: {
        modalities: ['audio', 'text'],
        instructions: `המשתמשת שמעה שיחה/פגישה והיא שואלת על מה שנאמר. ענני על סמך מה ששמעת בשיחה. שאלתה: "${question}"`,
      },
    })
  }

  /** Push-to-talk: signal that user started speaking */
  startTalking(): void {
    if (!this.pushToTalk) return
    // Clear any buffered audio from TV noise before user speaks
    this.sendEvent({ type: 'input_audio_buffer.clear' })
    this.setState('listening')
  }

  /** Push-to-talk: signal that user stopped speaking — commit audio + trigger response */
  stopTalking(): void {
    if (!this.pushToTalk) return
    this.sendEvent({ type: 'input_audio_buffer.commit' })
    this.sendEvent({ type: 'response.create' })
  }

  /**
   * Voice the ABUAI BRAIN's answer. Since the session runs create_response:false,
   * the model never answers on its own — this is the only way it speaks a reply.
   * We hand it AbuAI's exact reply and instruct it to read it verbatim (no invention).
   */
  speak(brainReply: string): void {
    const text = (brainReply ?? '').trim()
    if (!text) return
    // P0 fix (law #5): the spoken language follows the REPLY's language, not a
    // hard-coded Hebrew — so a Spanish reply after a Hebrew turn (or vice-versa) is
    // voiced correctly. Unknown/mixed → Hebrew (Martita's primary).
    const lang = detectUtteranceLanguage(text)
    const langWord = lang === 'es' ? 'Rioplatense (Argentine) Spanish' : 'Hebrew'
    this.sendEvent({
      type: 'response.create',
      response: {
        modalities: ['audio', 'text'],
        instructions: `Read this reply to Martita out loud in ${langWord}, warmly and naturally, EXACTLY as written — do not add, remove, translate, or invent anything:\n"${text}"`,
      },
    })
    // Arm the REALTIME_AUDIO_TIMEOUT watchdog: if no output-audio event arrives, we
    // cancel this attempt and voice via pipeline TTS instead of waiting silently.
    this.startAudioWatchdog()
  }

  /** Cancel current AI response (barge-in via tap) */
  interrupt(): void {
    this.clearAudioWatchdog()
    this.sendEvent({ type: 'response.cancel' })
    this.setState('listening')
  }

  /** Disconnect and clean up everything */
  disconnect(): void {
    this.setState('idle')
    this.cleanup()
  }

  private cleanup(): void {
    this.clearAudioWatchdog()
    if (this.dc) { try { this.dc.close() } catch {} this.dc = null }
    if (this.stream) { this.stream.getTracks().forEach(t => t.stop()); this.stream = null }
    if (this.pc) { try { this.pc.close() } catch {} this.pc = null }
    if (this.audioEl) { this.audioEl.pause(); this.audioEl.srcObject = null; this.audioEl = null }
  }
}
