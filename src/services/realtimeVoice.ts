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

const REALTIME_MODEL = 'gpt-realtime'
const REALTIME_CALLS_URL = 'https://api.openai.com/v1/realtime/calls'

// The ephemeral-secret endpoint (server-side minter target). Exported +
// asserted by a guard test so a future edit can't silently regress the path.
export const REALTIME_SESSION_URL = 'https://api.openai.com/v1/realtime/client_secrets'

/** Reject the docs placeholder / obvious stubs before any network call. */
export function isPlaceholderKey(k: string | undefined): boolean {
  return !k || k.length < 20 || /^(sk-\.\.\.|sk-xxx|your_|placeholder|example|<)/i.test(k)
}

export interface SessionMode { pushToTalk: boolean; listenMode: boolean; instructions: string; voice: string }

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
          transcription: { model: 'gpt-4o-mini-transcribe' },
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
}

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

  constructor(callbacks: RealtimeCallbacks, instructions: string, onFatalError?: () => void, noiseMode: 'quiet' | 'noisy' | 'listen' = 'quiet') {
    this.cb = callbacks
    this.instructions = instructions
    this.onFatalError = onFatalError ?? null
    // v23: Three modes
    this.pushToTalk = noiseMode === 'noisy'
    this._listenMode = noiseMode === 'listen'
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

      const sessionData = await tokenRes.json().catch(() => null) as { ok?: boolean; client_secret?: string; error?: string } | null
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

      // 2. Create WebRTC peer connection
      this.pc = new RTCPeerConnection()

      // v24.3: 10-second connection timeout — if data channel doesn't open, fail fast
      let connected = false
      const connectionTimeout = setTimeout(() => {
        if (!connected) {
          console.error('[Realtime] Connection timeout — data channel never opened in 10s')
          this.cb.onError('החיבור נכשל. נסי שוב.')
          this.attemptReconnect()
        }
      }, 10_000)

      // 3. Audio output — play AI voice through speaker
      this.audioEl = document.createElement('audio')
      this.audioEl.autoplay = true
      this.pc.ontrack = (event) => {
        if (this.audioEl && event.streams[0]) {
          this.audioEl.srcObject = event.streams[0]
        }
      }

      // v24.3: Monitor ICE connection — detect failures early
      this.pc.oniceconnectionstatechange = () => {
        const iceState = this.pc?.iceConnectionState
        console.log(`[Realtime] ICE state: ${iceState}`)
        if (iceState === 'failed' || iceState === 'disconnected') {
          clearTimeout(connectionTimeout)
          if (this._state !== 'idle') this.attemptReconnect()
        }
      }

      // 4. Audio input — mic → OpenAI
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      })
      this.pc.addTrack(this.stream.getTracks()[0]!, this.stream)

      // 5. Data channel for events
      this.dc = this.pc.createDataChannel('oai-events')
      this.dc.onopen = () => {
        connected = true
        clearTimeout(connectionTimeout)
        console.log('[Realtime] Data channel open')
        this.retryCount = 0

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
        }))

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

      if (!sdpRes.ok) throw new Error(`SDP exchange failed (${sdpRes.status})`)

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
    switch (event.type) {
      // VAD detected speech start → user is talking
      case 'input_audio_buffer.speech_started':
        this.setState('listening')
        break

      // VAD detected speech stop → AI will respond (unless listen mode)
      case 'input_audio_buffer.speech_stopped':
        break

      // AI auto-created a response — cancel it in listen mode
      case 'response.created':
        if (this._listenMode) {
          // v23: Listen mode — cancel AI response, just keep transcribing
          this.sendEvent({ type: 'response.cancel' })
        }
        break

      // AI started generating audio response
      case 'response.audio.delta':
        if (this._listenMode) break // suppress in listen mode
        if (this._state !== 'speaking') this.setState('speaking')
        break

      // Streaming text transcript of AI speech
      case 'response.audio_transcript.delta':
        if (this._listenMode) break // v24: silent in meeting mode
        if (event.delta) this.cb.onAssistantDelta(event.delta)
        break

      // AI speech transcript complete
      case 'response.audio_transcript.done':
        if (this._listenMode) break // v24: silent in meeting mode
        if (event.transcript) this.cb.onAssistantTranscript(event.transcript)
        break

      // User speech transcript complete
      case 'conversation.item.input_audio_transcription.completed':
        if (event.transcript) this.cb.onUserTranscript(event.transcript)
        break

      // AI finished responding → back to listening
      case 'response.done':
        this.setState('listening')
        break

      // Error
      case 'error':
        console.error('[Realtime] Server error:', event.error)
        if (event.error?.code === 'session_expired' || event.error?.code === 'invalid_session') {
          this.attemptReconnect()
        } else {
          this.cb.onError(event.error?.message || 'שגיאה בשרת')
        }
        break

      // Rate limit
      case 'rate_limits.updated':
        break

      default:
        if (!['session.created', 'session.updated',
             'response.output_item.added', 'response.output_item.done',
             'response.content_part.added', 'response.content_part.done',
             'conversation.item.created', 'response.audio.done',
             'input_audio_buffer.committed', 'input_audio_buffer.cleared',
        ].includes(event.type)) {
          console.log('[Realtime] Event:', event.type)
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
    this.sendEvent({
      type: 'response.create',
      response: {
        modalities: ['audio', 'text'],
        instructions: `Read this reply to Martita out loud in Hebrew, warmly and naturally, EXACTLY as written — do not add, remove, translate, or invent anything:\n"${text}"`,
      },
    })
  }

  /** Cancel current AI response (barge-in via tap) */
  interrupt(): void {
    this.sendEvent({ type: 'response.cancel' })
    this.setState('listening')
  }

  /** Disconnect and clean up everything */
  disconnect(): void {
    this.setState('idle')
    this.cleanup()
  }

  private cleanup(): void {
    if (this.dc) { try { this.dc.close() } catch {} this.dc = null }
    if (this.stream) { this.stream.getTracks().forEach(t => t.stop()); this.stream = null }
    if (this.pc) { try { this.pc.close() } catch {} this.pc = null }
    if (this.audioEl) { this.audioEl.pause(); this.audioEl.srcObject = null; this.audioEl = null }
  }
}
