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
import { MIC_GETUSERMEDIA } from './audioConstraints'
import { detectUtteranceLanguage } from './languagePolicy'
import { REALTIME_MODEL, assertNoModelDrift } from './realtimeModel'
import { normalizeRealtimeEvent } from './realtimeEvents'
import { currentVoiceFlight, type VoiceStage } from './voiceFlightRecorder'
import { REALTIME_COMM_TOOLS, REALTIME_CALENDAR_TOOLS, isCalendarToolName, type RealtimeFunctionTool } from './realtimeToolSchemas'
import { extractFunctionCall, isKnownToolCall } from '../screens/AbuAI/realtime/realtimeFunctionBridge'
import type { RealtimeCommController } from '../screens/AbuAI/realtime/realtimeCommController'
import type { CalendarDraftController } from '../screens/AbuAI/realtime/calendarDraftController'
import { acquireSession, releaseSession, nextSessionToken } from './sessionOwnershipRegistry'
import { lifecycleDecision } from './sessionLifecycle'

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

export interface SessionMode {
  pushToTalk: boolean; listenMode: boolean; instructions: string; voice: string; transcriptionLanguage?: string
  /** realtime2 SLICE only: declare communication function tools + let the model respond
   *  and decide-to-call a tool (ADR §12). Absent → the certified brain-driven config
   *  (create_response:false) is unchanged. */
  tools?: RealtimeFunctionTool[]
}

/**
 * The FULL-DUPLEX session config sent over the data channel on connect. Pure +
 * exported so it can be regression-locked: hands-free semantic VAD, barge-in
 * (interrupt_response), and input transcription — ChatGPT Advanced-Voice behavior.
 * - default (quiet):  semantic_vad, create_response false (brain drives), interrupt on
 * - noisy (PTT):      turn_detection null (manual commit)
 * - listen:           semantic_vad but create_response false (transcribe only)
 * - SLICE (tools set): semantic_vad + create_response TRUE + session.tools + tool_choice
 *                      auto → the model owns talk and MAY call a communication tool.
 */
export function buildRealtimeSessionUpdate(m: SessionMode): Record<string, unknown> {
  const sliceTools = m.tools && m.tools.length > 0
  const session: Record<string, unknown> = {
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
          // create_response FALSE by default: the model does NOT answer on its own — it
          // transcribes, and AbuAI's BRAIN produces the answer, voiced via session.speak().
          // In the realtime2 SLICE it is TRUE so the model owns talk and can call a tool.
          create_response: !!sliceTools,
          interrupt_response: true, // barge-in still cuts off a reply mid-voice
        },
      },
      output: { voice: m.voice },
    },
  }
  if (sliceTools) {
    session.tools = m.tools
    session.tool_choice = 'auto'
  }
  return { type: 'session.update', session }
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
  // iOS AUTOPLAY: the actual remote-audio <audio> element, PRIMED (created + play()ed
  // muted) inside the user tap gesture by the caller. The remote MediaStream is
  // attached to THIS element and then unmuted — the only reliable way to make the
  // model's voice audible on iOS Safari PWA, where the element created post-await
  // (outside the gesture) is autoplay-blocked. Null = non-iOS/test path (created here).
  private primedAudioEl: HTMLAudioElement | null
  // realtime2 SLICE (ADR §12): the live communication controller (function-tool → kernel →
  // committed card → grounded speech). Null = certified brain-driven path (unchanged).
  // ONE LIVE SESSION: this instance's unique ownership token (single-owner registry).
  private readonly ownerToken = nextSessionToken()
  // ONE RESPONSE PER TURN (§B): the per-turn response lease + input-dedup key.
  private responseLeased = false
  private lastInputKey = ''
  private sliceController: RealtimeCommController | null = null
  // realtime2 SLICE (ADR §12): the live CALENDAR authority — a completed calendar
  // function-call routes to the canonical typed draft, at parity with communication.
  private calendarController: CalendarDraftController | null = null
  // Test seam: when set, sendEvent routes here instead of the data channel, so the REAL
  // handleEvent/sendEvent path is exercised without WebRTC (see injectForTest).
  private testSend: ((event: Record<string, unknown>) => void) | null = null
  // ── O-LIFECYCLE: idle session policy (src/services/sessionLifecycle.ts). The clocks
  //    drive lifecycleDecision each tick; effects are stop-upstream / ask-once / warm
  //    goodbye+close / 20-min outward nudge. NEVER closes mid-task. Clock is injectable
  //    for deterministic tests (default Date.now).
  private lifecycleClock: () => number = () => Date.now()
  private lifecycleTimer: ReturnType<typeof setInterval> | null = null
  private lastActivityMs = 0
  private sessionStartMs = 0
  private lifecycleAsked = false
  private lifecycleNudged = false
  private upstreamPaused = false
  private pendingGoodbyeClose = false

  /** Server event names we did not recognize this session — surfaced for diagnostics. */
  get unrecognizedEvents(): string[] { return [...this.unknownEvents] }

  constructor(
    callbacks: RealtimeCallbacks, instructions: string, onFatalError?: () => void,
    noiseMode: 'quiet' | 'noisy' | 'listen' = 'quiet', transcriptionLanguage: string = 'he',
    primedAudioEl: HTMLAudioElement | null = null,
    // realtime2 SLICE only: a factory that builds the communication controller bound to
    // THIS session's send. Decoupled (no SessionOrchestrator import here) + off by default.
    sliceControllerFactory?: (send: (event: Record<string, unknown>) => void) => RealtimeCommController,
    // realtime2 SLICE only: a factory that builds the CALENDAR controller bound to THIS
    // session's send (parity with communication). Off by default.
    calendarControllerFactory?: (send: (event: Record<string, unknown>) => void) => CalendarDraftController,
  ) {
    this.cb = callbacks
    this.instructions = instructions
    this.onFatalError = onFatalError ?? null
    // v23: Three modes
    this.pushToTalk = noiseMode === 'noisy'
    this._listenMode = noiseMode === 'listen'
    this.transcriptionLanguage = transcriptionLanguage
    this.primedAudioEl = primedAudioEl
    this.vadThreshold = 0.75
    this.vadSilenceMs = 900
    this.sliceController = sliceControllerFactory ? sliceControllerFactory((e) => this.sendEvent(e)) : null
    this.calendarController = calendarControllerFactory ? calendarControllerFactory((e) => this.sendEvent(e)) : null
  }

  /** True when the live communication slice (realtime2) is active on this session. */
  get isSliceMode(): boolean { return this.sliceController !== null }

  /**
   * TEST SEAM (no mic/WebRTC): capture outbound events and feed inbound server events
   * through the REAL handleEvent + sendEvent path, so the function-tool journey is proven
   * on the actual production adapter. Returns a `receive` to push raw server events.
   */
  injectForTest(
    onSend: (event: Record<string, unknown>) => void,
    clock?: () => number,
  ): {
    receive: (event: unknown) => void; tickLifecycle: () => void; startLifecycle: () => void
    isUpstreamPaused: () => boolean; setResponseActiveForTest: (active: boolean) => void
  } {
    this.testSend = onSend
    if (clock) this.lifecycleClock = clock
    return {
      receive: (event: unknown) => this.handleEvent(event),
      tickLifecycle: () => this.tickLifecycle(),
      startLifecycle: () => this.startLifecycle(),
      isUpstreamPaused: () => this.upstreamPaused,
      setResponseActiveForTest: (active: boolean) => { this.responseLeased = active },
    }
  }

  // ── O-LIFECYCLE wiring ──────────────────────────────────────────────────────
  /** Reset the idle clocks on any user activity; resume upstream if we had paused it.
   *  Conversation state (the thread) is untouched — a resume keeps it. */
  private markActivity(): void {
    this.lastActivityMs = this.lifecycleClock()
    this.lifecycleAsked = false
    if (this.upstreamPaused) this.resumeUpstream()
  }

  /** Begin driving the idle lifecycle: a bounded ~2s tick (real path only). */
  private startLifecycle(): void {
    const now = this.lifecycleClock()
    this.sessionStartMs = now
    this.lastActivityMs = now
    this.lifecycleAsked = false
    this.lifecycleNudged = false
    if (this.lifecycleTimer) return
    // Only run a real interval outside tests (tests drive tickLifecycle directly).
    if (!this.testSend && typeof setInterval === 'function') {
      this.lifecycleTimer = setInterval(() => this.tickLifecycle(), 2_000)
    }
  }

  private stopLifecycle(): void {
    if (this.lifecycleTimer) { clearInterval(this.lifecycleTimer); this.lifecycleTimer = null }
  }

  /** One idle-policy tick: compute the clocks, decide, dispatch the single effect.
   *  NEVER acts mid-task (Abu responding, or a calendar create/confirm in flight). */
  private tickLifecycle(): void {
    const now = this.lifecycleClock()
    const midTask = this.responseLeased || (this.calendarController?.hasActiveDraft() ?? false)
    const d = lifecycleDecision({
      silenceMs: now - this.lastActivityMs,
      sessionAgeMs: now - this.sessionStartMs,
      midTask,
      askedPresence: this.lifecycleAsked,
      nudgedOutward: this.lifecycleNudged,
    })
    switch (d.action) {
      case 'stop-upstream':
        this.pauseUpstream()
        break
      case 'ask-presence':
        this.lifecycleAsked = true
        this.speakLifecycleLine(d.speak!)
        break
      case 'outward-nudge':
        this.lifecycleNudged = true
        this.speakLifecycleLine(d.speak!)
        break
      case 'warm-goodbye':
        this.speakLifecycleLine(d.speak!)
        this.pendingGoodbyeClose = true // close AFTER the goodbye finishes (response_done)
        break
      case 'none':
      default:
        break
    }
  }

  /** Stop streaming the mic upstream during silence (cost) — reversible on activity. */
  private pauseUpstream(): void {
    if (this.upstreamPaused) return
    this.upstreamPaused = true
    const track = this.stream?.getAudioTracks()[0]
    if (track) track.enabled = false
  }
  private resumeUpstream(): void {
    this.upstreamPaused = false
    const track = this.stream?.getAudioTracks()[0]
    if (track) track.enabled = true
  }

  /** Have Abu SAY a specific warm line (idle prompt / goodbye / nudge). Routed through
   *  the authoritative createResponse, so it is skipped if a response is already active. */
  private speakLifecycleLine(line: string): void {
    this.sendEvent({
      type: 'response.create',
      response: { instructions: `אמרי בעברית, בחום ובקצרה, בדיוק את המשפט: "${line}"` },
    })
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
    // ONE LIVE SESSION (ADR §5): acquire the single-owner slot; a previous live
    // session (rerender/reconnect) is DRAINED first so there is never a parallel
    // peer connection / remote track / audio element.
    acquireSession(this.ownerToken, () => this.cleanup())
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
      //
      // iOS AUTOPLAY FIX (docs/VOICE_ARCHITECTURE_VERDICT.md, Q4 → muted-then-unmute):
      // this ontrack handler runs AFTER the /api/realtime-token await, i.e. OUTSIDE the
      // original tap gesture — so a freshly-created element's .play() is autoplay-blocked
      // and Martita "hears nothing". The caller therefore PRIMES the real element inside
      // the tap gesture (created + play()ed muted); we reuse THAT element, attach the
      // remote stream, and UNMUTE it (unmuting a playing, user-activated element needs no
      // gesture). If no primed element was passed (test/non-iOS), fall back to creating
      // one here (still appended to the DOM so it is not autoplay-blocked by not-in-DOM).
      this.audioEl = this.primedAudioEl ?? document.createElement('audio')
      this.audioEl.autoplay = true
      ;(this.audioEl as unknown as { playsInline: boolean }).playsInline = true
      this.audioEl.setAttribute('aria-hidden', 'true')
      this.audioEl.style.display = 'none'
      // Append only if it is not already in the DOM (a primed element was appended in the gesture).
      if (!this.audioEl.isConnected) { try { document.body.appendChild(this.audioEl) } catch { /* non-DOM env: best-effort */ } }
      this.pc.ontrack = (event) => {
        if (this.audioEl && event.streams[0]) {
          // Drop the silent primer source so the WebRTC stream takes over cleanly.
          try { this.audioEl.removeAttribute('src') } catch { /* */ }
          this.audioEl.srcObject = event.streams[0]
          this.stage('REMOTE_AUDIO_TRACK_RECEIVED', 'ok')
          this.setFlightCtx({ audioEl: { paused: this.audioEl.paused, muted: this.audioEl.muted, volume: this.audioEl.volume } })
          this.stage('AUDIO_PLAY_REQUESTED', 'ok')
          const played = this.audioEl.play()
          if (played && typeof played.then === 'function') {
            played.then(() => {
              // Unmute the now-playing, user-activated element → Martita actually HEARS it.
              if (this.audioEl) this.audioEl.muted = false
              this.stage('AUDIO_PLAY_STARTED', 'ok')
            })
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

      // 4. Audio input — mic → OpenAI (shared iOS-tuned constraints)
      this.stream = await navigator.mediaDevices.getUserMedia(MIC_GETUSERMEDIA)
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
        this.startLifecycle() // O-LIFECYCLE: begin the idle-session policy clocks

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
          // realtime2 SLICE: declare communication AND calendar tools so the model can
          // REQUEST (never decide/commit) an action. Absent in the certified path.
          ...((this.sliceController || this.calendarController)
            ? { tools: [...(this.sliceController ? REALTIME_COMM_TOOLS : []), ...(this.calendarController ? REALTIME_CALENDAR_TOOLS : [])] }
            : {}),
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

  // ONE RESPONSE PER TURN (§B): sendEvent is the SINGLE choke point for every
  // response.create in the app (internal sites + both controllers route here). A
  // response.create is NEVER sent raw — it is centralized through createResponse,
  // which enforces the per-turn response lease. Any other event passes straight to
  // the wire. A raw response.create therefore cannot bypass the authorization.
  private sendEvent(event: Record<string, unknown>): void {
    if (event && event.type === 'response.create') { this.createResponse(event); return }
    this.rawSend(event)
  }

  private rawSend(event: Record<string, unknown>): void {
    if (this.testSend) { this.testSend(event); return }
    if (this.dc?.readyState === 'open') {
      this.dc.send(JSON.stringify(event))
    }
  }

  /** The ONE authoritative response creator. Grants at most one response per logical
   *  turn; a second attempt for the same turn is rejected (device-falsified duplicate
   *  audio). The lease releases on response_done / cancel / a new user turn. */
  private createResponse(event: Record<string, unknown>): { granted: boolean } {
    if (this.responseLeased) {
      // eslint-disable-next-line no-console
      console.log('[AbuAI][VOICE] response.create REJECTED — a response is already active for this turn')
      return { granted: false }
    }
    this.responseLeased = true
    this.rawSend(event)
    return { granted: true }
  }

  /** Begin a new logical response turn (accepted-input boundary), deduped so a
   *  duplicate transcription shape does not grant a second response. */
  private beginResponseTurn(inputKey: string): void {
    if (inputKey && inputKey === this.lastInputKey) return // duplicate shape → same turn
    this.lastInputKey = inputKey
    this.responseLeased = false
  }
  private releaseResponseLease(): void { this.responseLeased = false }

  private handleEvent(event: any): void {
    // realtime2 SLICE (ADR §12): a completed communication function call is routed to the
    // deterministic controller BEFORE the normal switch. It runs the kernel, commits the
    // card, returns a safe receipt to the model and continues it. Non-function events fall
    // through. In the certified path (no controller) this is a no-op.
    if (this.sliceController || this.calendarController) {
      const fc = extractFunctionCall(event)
      if (fc) {
        // Disjoint routing: a calendar tool goes to the Calendar authority, a
        // communication tool to the Communication authority — never crossed.
        if (this.calendarController && isCalendarToolName(fc.name)) { void this.calendarController.onFunctionCall(fc); return }
        if (this.sliceController && isKnownToolCall(fc)) { void this.sliceController.onFunctionCall(fc); return }
      }
    }
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
        this.markActivity()       // O-LIFECYCLE: user is here → reset idle clocks, resume upstream
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
          // §B turn boundary: an accepted user transcript begins ONE logical response
          // turn (deduped) → exactly one response.create may be granted for it.
          this.beginResponseTurn(String((event as { item_id?: string }).item_id ?? event.transcript))
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
        if (event.transcript) {
          // §B: the model's spoken response for this turn has ENDED → release the lease so
          // the NEXT response (e.g. a truth repair on the next turn) may be created. This
          // keeps responses SEQUENTIAL (never two overlapping/concurrent) — the device bug.
          this.releaseResponseLease()
          // realtime2 SLICE: guard the model's spoken transcript (§11 bounded monitor) —
          // a fabricated completion / unsupported denial is repaired on the next turn.
          if (this.sliceController) this.sliceController.onAssistantTranscript(event.transcript)
          this.cb.onAssistantTranscript(event.transcript)
        }
        break

      case 'response_done':
        this.releaseResponseLease() // §B: the response lifecycle ended → next turn may respond
        this.setState('listening')
        // O-LIFECYCLE: the warm goodbye has now finished speaking → close the session.
        if (this.pendingGoodbyeClose) { this.pendingGoodbyeClose = false; this.disconnect() }
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
    this.stopLifecycle() // O-LIFECYCLE: stop the idle-policy tick
    if (this.dc) { try { this.dc.close() } catch {} this.dc = null }
    if (this.stream) { this.stream.getTracks().forEach(t => t.stop()); this.stream = null }
    if (this.pc) { try { this.pc.close() } catch {} this.pc = null }
    if (this.audioEl) { this.audioEl.pause(); this.audioEl.srcObject = null; try { this.audioEl.remove() } catch { /* not in DOM */ } this.audioEl = null }
    releaseSession(this.ownerToken) // ONE LIVE SESSION: release the single-owner slot
  }
}
