// ─── OpenAI Realtime API — WebRTC Voice Client ─────────────────────
// v24.3: Reverted to gpt-4o-realtime-preview (gpt-realtime may not be available on all accounts)
// Keep coral voice (marin may be gpt-realtime exclusive)

const REALTIME_MODEL = 'gpt-4o-realtime-preview'

// The ephemeral-session endpoint. It is a BETA route — it requires the
// `OpenAI-Beta: realtime=v1` header, without which it returns 404 ("Invalid
// URL"). Exported + asserted by a guard test so a future edit can't silently
// drop the header or path.
export const REALTIME_SESSION_URL = 'https://api.openai.com/v1/realtime/sessions'
export const REALTIME_BETA_HEADER = { 'OpenAI-Beta': 'realtime=v1' }

/** Reject the docs placeholder / obvious stubs before any network call. */
export function isPlaceholderKey(k: string | undefined): boolean {
  return !k || k.length < 20 || /^(sk-\.\.\.|sk-xxx|your_|placeholder|example|<)/i.test(k)
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
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY as string | undefined
    if (isPlaceholderKey(apiKey)) {
      // Missing or placeholder ("sk-...") key — never call OpenAI (it would 401/404).
      // Fall back to the pipeline gracefully, no retries.
      this.cb.onError('מצב הקול לא מוגדר. עוברת למצב חלופי.')
      this.setState('error')
      this.onFatalError?.()
      return
    }

    this.setState('connecting')

    try {
      // 1. Get ephemeral token
      const tokenRes = await fetch(REALTIME_SESSION_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          ...REALTIME_BETA_HEADER, // required — without it the endpoint 404s
        },
        body: JSON.stringify({
          model: REALTIME_MODEL,
          voice: 'shimmer',  // v26.1: shimmer is warmer and more natural for Hebrew/Spanish than coral
          instructions: this.instructions,
          input_audio_transcription: { model: 'whisper-1' },
          // v22.6: Quiet = server VAD (auto-detect speech), Noisy = no VAD (push-to-talk)
          turn_detection: this.pushToTalk ? null : {
            type: 'server_vad',
            threshold: this.vadThreshold,
            prefix_padding_ms: 250,
            silence_duration_ms: this.vadSilenceMs,
          },
        }),
      })

      if (!tokenRes.ok) {
        const errText = await tokenRes.text().catch(() => '')
        const isQuota = tokenRes.status === 429 || /quota|billing|exceeded/.test(errText)
        // ANY token failure (404 invalid-URL, 401/403 auth, 404 no-realtime-access,
        // quota) falls back to the free pipeline ONCE — never a noisy retry loop and
        // never a raw provider error to the UI. Diagnostic logs the status only, no key.
        console.error(`[Realtime] session creation failed (${tokenRes.status}) — falling back to pipeline`)
        this.cb.onError(isQuota ? 'המכסה של OpenAI נגמרה. עוברת למצב חלופי.' : 'מצב הקול לא זמין כרגע. עוברת למצב חלופי.')
        this.setState('error')
        this.cleanup()
        this.onFatalError?.() // immediately fall back — do not retry, do not throw
        return
      }

      const sessionData = await tokenRes.json()
      const ephemeralKey = sessionData.client_secret?.value
      if (!ephemeralKey) throw new Error('No ephemeral key received')

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

        // Send greeting (skip in listen mode — passive)
        if (!this._listenMode) {
          this.sendEvent({
            type: 'response.create',
            response: {
              modalities: ['audio', 'text'],
              instructions: 'Greet Martita warmly in Hebrew based on the time of day. One short sentence only. Speak slowly, gently, like greeting a close friend. Example: "אחר הצהריים טובים, Martita!"',
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
        `https://api.openai.com/v1/realtime?model=${REALTIME_MODEL}`,
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
