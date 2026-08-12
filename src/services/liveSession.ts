/*
 * liveSession.ts — Abu AI, Milestone 1: the ONE live-conversation path.
 * ════════════════════════════════════════════════════════════════════
 * Goal (abu-m1-brief.md): one Hebrew voice conversation that survives five
 * minutes on Leo's iPhone. No calendar, WhatsApp, call, web retrieval, or
 * action cards. This module OWNS the entire live path end-to-end:
 *
 *   - one ephemeral token minted server-side (/api/realtime-token)
 *   - one RTCPeerConnection, one data channel
 *   - one getUserMedia track (echoCancellation/noiseSuppression/autoGainControl)
 *   - one remote track, one playback path (WebAudio, held ref, playsinline)
 *   - one session.update carrying instructions, voice, turn_detection,
 *     reasoning.effort
 *
 * Created in ONE function (connect), torn down in ONE function (teardown).
 * Handlers are closures over that object. A single module-level `liveEpoch`
 * integer, compared at the top of the datachannel handler, is the ONLY
 * ownership guard — no arbiter, no registry, no leases, no dedup.
 *
 * The model hears audio directly and reasons natively (reasoning.effort). There
 * is NO separate brain, STT, TTS, or fallback in this path (fail closed).
 *
 * Model note: the SERVER (/api/realtime-token) selects the strongest available
 * Realtime model (gpt-realtime-2.1 first) and returns which one it minted. This
 * module asserts nothing about the name — it uses whatever the server chose for
 * the SDP call, so the client and mint can never drift.
 */
import { buildLiveInstructions, buildTranscriptionPrompt, assertSessionPayloadWithinLimits } from './liveInstructions'
import { LiveTools, LIVE_TOOL_SCHEMAS, durableCalendarStore, type LiveCalendarStore, type LiveCommDraft, type LiveEvent } from './liveTools'
import type { CalendarDraft } from '../screens/AbuAI/realtime/calendarDraft'
import { extractFunctionCall, safeParseArgs, type ParsedFunctionCall } from '../screens/AbuAI/realtime/realtimeFunctionBridge'
import { FlightRecorder, downloadTrace } from './liveTrace'

// ─── Configuration (M1 defaults; M2 tunes these by listening) ──────────────

/** Warm, natural GA voice. Valid Realtime voices: alloy, ash, ballad, coral,
 *  echo, sage, shimmer, verse, marin, cedar (verified against the live API). */
export const LIVE_VOICE = 'marin' as const

/** turn_detection.silence_duration_ms — deliberately RAISED above the 500ms
 *  default so an elderly speaker is not cut off mid-thought (the "walkie-talkie"
 *  feel). M2 tunes this against real Hebrew audio. */
export const LIVE_VAD_SILENCE_MS = 1200

/** turn_detection.threshold — server-VAD speech-probability gate. RAISED from the
 *  0.5 default to 0.7 to ignore brief/quiet room noise. NOTE: the threshold ALONE did
 *  NOT stop the severe truncation — see LIVE_INTERRUPT_RESPONSE for the real mechanism
 *  and fix. Tunable on device. */
export const LIVE_VAD_THRESHOLD = 0.7

/** turn_detection.interrupt_response — whether a detected speech_started TRUNCATES
 *  Abu's in-progress audio. DISABLED (false).
 *
 *  MECHANISM (device defect 2, "one word then text-only"): the audible remote audio is
 *  rendered on device and its loudspeaker output leaks into the microphone. The server
 *  VAD hears that echo of Abu's OWN voice as `speech_started`; with interrupt_response
 *  TRUE the server then TRUNCATES her response server-side after the first word (the
 *  client only observes it — line ~534 records truncation evidence, it cannot un-cut a
 *  server truncation). The text transcript still completes, so the sentence renders as
 *  text but is never heard. Raising the threshold did not fix it — a full-voice echo
 *  crosses any gate. The correct fix for THIS user is to stop the server from ever
 *  truncating her mid-sentence: Martita (80s) does not barge in over Abu, and Abu's
 *  answers are 2–4 short sentences, so losing mid-response barge-in costs almost nothing
 *  while eliminating the worst defect entirely. create_response stays TRUE, so normal
 *  turn-taking (respond when the user finishes) is unchanged. The deeper echo root — so
 *  the mic never hears her at all — is handled by routing playback through a real
 *  media-element sink (device defect 4) which lets the OS/browser echo-canceller
 *  reference her output. */
export const LIVE_INTERRUPT_RESPONSE = false

/** turn_detection.prefix_padding_ms — audio kept before detected speech so a soft
 *  onset is not clipped. Exported so it is tunable alongside the other VAD knobs. */
export const LIVE_VAD_PREFIX_PADDING_MS = 300

/** Input-audio transcription model for the Hebrew side-channel. Upgraded from
 *  gpt-4o-mini-transcribe to the full gpt-4o-transcribe after a device trace showed
 *  badly mis-heard Hebrew (and even wrong-language output). More accurate on Hebrew;
 *  paired with an explicit language + a family-name/phrasing bias prompt. */
export const LIVE_TRANSCRIBE_MODEL = 'gpt-4o-transcribe' as const

/** Realtime 2 reasons natively; `low` keeps latency down for chat. This replaces
 *  any separate reasoning delegate. */
export const LIVE_REASONING_EFFORT = 'low' as const

/** The first output-audio event after the model starts a response should arrive
 *  well inside this window; used only for a truthful "no audio" error state
 *  (fail closed — there is no TTS fallback in M1). */
export const LIVE_AUDIO_TIMEOUT_MS = 6000

/** SDP call target for the WebRTC offer/answer exchange. */
export const REALTIME_CALLS_URL = 'https://api.openai.com/v1/realtime/calls'

/** Mic constraints — all three cleanups ON, per the brief. */
export const LIVE_MIC_CONSTRAINTS: MediaStreamConstraints = {
  audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  video: false,
}

// ─── System prompt ──────────────────────────────────────────────────────────
// M2: the instruction CONTENT now lives in two editable knowledge files and is
// assembled at build time by liveInstructions.ts (persona first, then the
// knowledge file verbatim; labeled OpenAI-Realtime sections; feminine Hebrew;
// no phone numbers). Editing knowledge/abu-knowledge.md reaches Abu on the next
// deploy with no code change. This module only carries the assembled string into
// the session.update (see the import of buildLiveInstructions at the top).

/** The no-op tool the model calls for silence / background noise / TV / speech
 *  not addressed to Abu — the documented fix for repeated greetings and the
 *  "I'm here?" behaviour. It takes no action and produces no speech. */
export const WAIT_FOR_USER_TOOL = {
  type: 'function',
  name: 'wait_for_user',
  description:
    'Call this and stay silent when the incoming audio is silence, background noise, a TV/radio, or speech clearly not addressed to you. Takes no action.',
  parameters: { type: 'object', properties: {}, additionalProperties: false },
} as const

// ─── Pure helpers (unit-testable without WebRTC) ────────────────────────────

/** A runtime "today" line appended to the instructions so the model can resolve
 *  relative dates ("מחר"/"היום") to a real YYYY-MM-DD before any calendar tool call.
 *  Computed from the caller's clock (the device Martita is holding). */
export function todayInstruction(now: number): string {
  const d = new Date(now)
  const pad = (n: number) => String(n).padStart(2, '0')
  const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const weekday = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getDay()]
  return [
    '',
    '# Today',
    `Today is ${iso} (${weekday}). Resolve any relative date ("מחר", "היום", "יום שישי") to a real YYYY-MM-DD before calling a calendar tool — never pass a relative word.`,
  ].join('\n')
}

/** The FULL-DUPLEX session config sent ONCE over the data channel on open. The
 *  model owns the turn (create_response TRUE) and reasons natively. Pure so it
 *  can be regression-locked. `now` seeds the runtime "today" line. */
export function buildSessionUpdate(now: number = Date.now()): Record<string, unknown> {
  // Every provider-capped STRING field is guarded here against its documented maximum,
  // on the EXACT values sent over the data channel. Over ANY cap, the whole session.update
  // is rejected with string_above_max_length and voice connects then dies ~500ms later.
  // The device blocker was NOT instructions — it was transcription.prompt (1034 > 1024).
  const instructions = buildLiveInstructions() + '\n' + todayInstruction(now)
  const transcriptionPrompt = buildTranscriptionPrompt()
  assertSessionPayloadWithinLimits({ instructions, transcriptionPrompt })
  return {
    type: 'session.update',
    session: {
      type: 'realtime',
      instructions,
      reasoning: { effort: LIVE_REASONING_EFFORT },
      tools: [WAIT_FOR_USER_TOOL, ...LIVE_TOOL_SCHEMAS],
      tool_choice: 'auto',
      audio: {
        input: {
          // The transcript is a WEAK Hebrew side-channel for the UI only — nothing
          // routes, dedups, or decides on it. The model hears the audio directly.
          // Hebrew is set EXPLICITLY and a bias prompt (family names + common request
          // phrasings) steers the transcriber toward the words Martita actually uses.
          transcription: { model: LIVE_TRANSCRIBE_MODEL, language: 'he', prompt: transcriptionPrompt },
          turn_detection: {
            type: 'server_vad',
            threshold: LIVE_VAD_THRESHOLD,
            prefix_padding_ms: LIVE_VAD_PREFIX_PADDING_MS,
            silence_duration_ms: LIVE_VAD_SILENCE_MS,
            create_response: true,
            interrupt_response: LIVE_INTERRUPT_RESPONSE,
          },
        },
        output: { voice: LIVE_VOICE },
      },
    },
  }
}

/** Char + byte size of the assembled session.update payload — recorded on the trace
 *  connection line so the next device trace shows the number directly (no more
 *  discovering an over-limit field only on a phone). Pure over buildSessionUpdate. */
export function sessionPayloadSize(now: number = Date.now()): { chars: number; bytes: number } {
  const json = JSON.stringify(buildSessionUpdate(now))
  // eslint-disable-next-line no-restricted-globals
  const bytes = typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(json).length : json.length
  return { chars: json.length, bytes }
}

/** The ONE proactive greeting. Sent exactly once per conversation id (see
 *  greeting storage helpers) — never on reconnect. */
export function buildGreetingResponse(): Record<string, unknown> {
  return {
    type: 'response.create',
    response: {
      instructions:
        'Greet Martita warmly in Hebrew based on the time of day, in ONE short sentence that gently invites her to talk. Warm and human, like a close friend on the phone. Never a menu.',
    },
  }
}

const CONV_ID_KEY = 'abu-live-conversation-id'
const GREETED_KEY = 'abu-live-greeted-conversation-id'

interface StorageLike {
  getItem(k: string): string | null
  setItem(k: string, v: string): void
}

/** Start a NEW conversation: mint + persist a fresh conversation id. Called when
 *  the user explicitly starts a live session (not on a reconnect). */
export function startConversation(storage: StorageLike, rand: () => number = Math.random): string {
  const id = 'conv_' + Math.floor(rand() * 1e9).toString(36) + Math.floor(rand() * 1e9).toString(36)
  storage.setItem(CONV_ID_KEY, id)
  return id
}

/** The current conversation id (or null if none started yet). */
export function currentConversationId(storage: StorageLike): string | null {
  return storage.getItem(CONV_ID_KEY)
}

/** True only the FIRST time we open a data channel for a given conversation id.
 *  Reconnects within the same conversation return false → resume listening
 *  silently, no greeting. */
export function shouldGreet(storage: StorageLike, conversationId: string): boolean {
  return storage.getItem(GREETED_KEY) !== conversationId
}

/** Record that we greeted for this conversation id, so a reconnect stays silent. */
export function markGreeted(storage: StorageLike, conversationId: string): void {
  storage.setItem(GREETED_KEY, conversationId)
}

export type ResponsePhase = 'commentary' | 'final_answer' | null

/** Realtime 2 emits multiple phases in one turn (commentary preamble → final
 *  answer). Read the phase off a response.done wherever the provider puts it.
 *  Unknown/absent → null (treated as terminal). */
export function parseResponsePhase(event: unknown): ResponsePhase {
  const e = event as { phase?: string; response?: { phase?: string; metadata?: { phase?: string } } } | null
  const p = e?.response?.phase ?? e?.phase ?? e?.response?.metadata?.phase
  if (p === 'commentary' || p === 'final_answer') return p
  return null
}

/** A response.done ends the turn (return to listening) ONLY when it is the final
 *  answer or carries no phase. A `commentary` response.done is NOT end-of-turn —
 *  treating it as such is the documented cause of truncated audio + text-without-
 *  audio + overlapping streams. */
export function isEndOfTurn(event: unknown): boolean {
  return parseResponsePhase(event) !== 'commentary'
}

/** Plain-Hebrew reason for a connection/session failure code — exactly what Martita
 *  SEES on the screen, so a failure says WHY (server key, network, microphone, provider)
 *  instead of a useless "try again". Pure + exported so it is unit-tested and cannot drift. */
export function connectionReasonHe(code: string): string {
  switch (code) {
    case 'OPENAI_API_KEY_MISSING': return 'החיבור לשרת לא מוגדר — חסר מפתח (OPENAI_API_KEY) בשרת. צריך להגדיר אותו.'
    case 'OPENAI_API_KEY_INVALID': return 'מפתח השרת לא תקין. צריך לבדוק את ההגדרה בשרת.'
    case 'REALTIME_QUOTA': return 'חרגנו מהמכסה של השרת כרגע. ננסה מאוחר יותר.'
    case 'REALTIME_PROVIDER_FAILED': return 'השרת לא הצליח לפתוח שיחת קול כרגע. ננסה שוב.'
    case 'MIC_PERMISSION_DENIED': return 'אין הרשאה למיקרופון. צריך לאשר גישה למיקרופון בהגדרות הטלפון.'
    case 'MIC_NOT_FOUND': return 'לא נמצא מיקרופון במכשיר.'
    case 'TOKEN_NETWORK_ERROR': return 'אין חיבור לרשת כרגע. בדקי את האינטרנט וננסה שוב.'
    case 'NO_AUDIO_EVENT': return 'לא הצלחתי להשמיע קול. ננסה שוב.'
    case 'AUDIO_ROUTE_ENDED': return 'הקול נותק (אולי אוזניות/בלוטות). ננסה שוב.'
    default:
      if (code.startsWith('SDP_HTTP') || code.startsWith('ICE_') || code === 'DATACHANNEL_CLOSED') return 'החיבור נכשל. ננסה שוב.'
      if (code.startsWith('CONNECT_EXCEPTION')) return 'משהו השתבש בחיבור. ננסה שוב.'
      return 'מצב הקול לא זמין כרגע. ננסה שוב.'
  }
}

// ─── The live session ───────────────────────────────────────────────────────

export type LiveState = 'idle' | 'connecting' | 'listening' | 'speaking' | 'error'

export interface LiveCallbacks {
  onState: (s: LiveState) => void
  onUserTranscript?: (text: string) => void
  onAbuTranscript?: (text: string) => void
  /** The remote realtime audio stream, handed to the UI so it can read Abu's live
   *  output loudness for the mouth (services/outputAmplitude). Observation only —
   *  it does NOT touch the audio graph or turn machinery. */
  onRemoteStream?: (stream: MediaStream) => void
  /** The user's turn just ended (server-VAD speech_stopped): a UI 'thinking' hint
   *  for the window before Abu speaks. Observation only — changes no VAD/turn/audio. */
  onThinking?: () => void
  /** A truthful, human error line (Hebrew). Fail closed — there is no fallback. */
  onError?: (messageHe: string, code: string) => void
  // ─── Action-card signals (Part B): the overlay renders a card as the receipt ──
  /** The pending calendar draft changed (prepare/correct/cancel). */
  onCalendarDraft?: (d: CalendarDraft | null) => void
  /** An event was actually persisted — the receipt card shows the saved fields. */
  onCalendarSaved?: (e: LiveEvent) => void
  /** A WhatsApp/call preparation changed (whatsapp_draft/phone_call/cancel). */
  onCommDraft?: (d: LiveCommDraft | null) => void
}

/** Injected browser seams — real defaults in the browser, fakes in tests. */
export interface LiveDeps {
  fetch: typeof fetch
  createPeerConnection: () => RTCPeerConnection
  getUserMedia: (c: MediaStreamConstraints) => Promise<MediaStream>
  /** Returns a resumed AudioContext (or null in an environment without WebAudio). */
  createAudioContext: () => AudioContext | null
  storage: StorageLike
  now: () => number
  /** Optional: substitute the mic track (replay harness feeds recorded Hebrew WAV). */
  micTrackOverride?: () => MediaStreamTrack | null
  /** Optional: the durable calendar store the live tools read/write (real one by default;
   *  tests inject an in-memory store to prove read-after-write without a browser). */
  calendarStore?: LiveCalendarStore
}

// A minimal in-memory storage so the module never throws when constructed
// outside a browser (e.g. the node test environment injects its own deps).
function memoryStorage(): StorageLike {
  const m = new Map<string, string>()
  return { getItem: (k) => (m.has(k) ? m.get(k)! : null), setItem: (k, v) => { m.set(k, v) } }
}

function defaultDeps(): LiveDeps {
  // Every field is lazy (accessed only when invoked) EXCEPT storage — so nothing
  // touches window/navigator/RTCPeerConnection at construction time.
  return {
    fetch: (...a: Parameters<typeof fetch>) => fetch(...a),
    createPeerConnection: () => new RTCPeerConnection(),
    getUserMedia: (c) => navigator.mediaDevices.getUserMedia(c),
    createAudioContext: () => {
      if (typeof window === 'undefined') return null
      const Ctx = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
      const C = Ctx.AudioContext ?? Ctx.webkitAudioContext
      return C ? new C() : null
    },
    storage: (typeof window !== 'undefined' && window.localStorage) ? window.localStorage : memoryStorage(),
    now: () => Date.now(),
  }
}

// The SINGLE ownership guard: bumped on every connect and every teardown, so any
// handler closed over a stale value returns immediately. Nothing else guards
// ownership.
let liveEpoch = 0

export class LiveSession {
  private readonly deps: LiveDeps
  private readonly cb: LiveCallbacks
  private readonly conversationId: string
  private readonly isReconnect: boolean

  private pc: RTCPeerConnection | null = null
  private dc: RTCDataChannel | null = null
  private micStream: MediaStream | null = null
  private remoteStream: MediaStream | null = null
  private audioCtx: AudioContext | null = null
  private sourceNode: MediaStreamAudioSourceNode | null = null
  private gainNode: GainNode | null = null
  // Muted <audio> keep-alive: some browsers only pull a WebRTC remote track when
  // it is also consumed by a media element. We route AUDIBLE output through
  // WebAudio and keep this element muted purely to keep the track flowing.
  private keepAliveEl: HTMLAudioElement | null = null
  private epoch = 0
  private torn = false
  private audioWatchdog: ReturnType<typeof setTimeout> | null = null
  private _state: LiveState = 'idle'
  /** The ONE tool executor for this session (contacts, calendar, whatsapp/call). */
  private readonly liveTools: LiveTools
  /** Call ids already DISPATCHED. The same completed call arrives in three event
   *  shapes (function_call_arguments.done / output_item.done / response.done), each
   *  with the same call_id; this set makes the whole dispatch — recorder, wait ack,
   *  and executor — fire EXACTLY ONCE per model tool call (no triple confirm). */
  private readonly dispatchedCalls = new Set<string>()
  /** Flight recorder — OBSERVATION ONLY. Records my/her speech + every tool call,
   *  and surfaces silent-turn (C.3) + truncation-evidence (C.2) flags. It never
   *  changes turn/VAD/audio behaviour; the live session only appends to it.
   *  Assigned in the constructor AFTER deps (its clock reads this.deps.now()). */
  private readonly recorder: FlightRecorder

  /**
   * @param isReconnect true when resuming an existing conversation after a drop —
   *   suppresses the greeting (resume listening silently).
   */
  constructor(cb: LiveCallbacks, conversationId: string, isReconnect = false, deps?: Partial<LiveDeps>) {
    this.cb = cb
    this.conversationId = conversationId
    this.isReconnect = isReconnect
    this.deps = { ...defaultDeps(), ...deps }
    this.recorder = new FlightRecorder(() => this.deps.now())
    // ONE tool executor, wired to send over this session's data channel and to the
    // durable calendar store (or an injected one in tests). No conversation state.
    // The draft/receipt callbacks forward to the overlay so every action becomes a
    // visible card (Part B). This is UI notification ONLY — it does not touch the
    // audio/VAD/turn machinery.
    this.liveTools = new LiveTools(
      (event) => this.send(event),
      this.deps.calendarStore ?? durableCalendarStore(),
      {
        onCalendarDraft: (d) => this.cb.onCalendarDraft?.(d),
        onCalendarSaved: (e) => this.cb.onCalendarSaved?.(e),
        onCommDraft: (d) => this.cb.onCommDraft?.(d),
      },
    )
  }

  get state(): LiveState { return this._state }
  /** The epoch this session claimed (for tests). */
  get claimedEpoch(): number { return this.epoch }

  private setState(s: LiveState): void {
    if (this._state === s) return
    this._state = s
    this.cb.onState(s)
  }

  private fail(messageHe: string, code: string): void {
    this.recorder.onFailure(code, messageHe)   // a failed session still produces a downloadable trace
    this.setState('error')
    this.cb.onError?.(messageHe, code)
    this.teardown()
  }

  /** ONE function: build the whole live path. */
  async connect(): Promise<void> {
    this.epoch = ++liveEpoch
    const myEpoch = this.epoch
    this.torn = false
    this.recorder.onConnectAttempt()   // record the attempt so even a failed connect has a trace
    this.setState('connecting')

    // 1. Mint the ephemeral secret SERVER-SIDE. The long-lived key never reaches
    //    the browser. Fail closed on any problem (no fallback in M1). On failure we
    //    surface the SPECIFIC reason in plain Hebrew (server key / network / provider)
    //    — never a bare "try again".
    let clientSecret: string
    let model: string
    try {
      const res = await this.deps.fetch('/api/realtime-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voice: LIVE_VOICE }),
      })
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; client_secret?: string; model?: string; error?: string }
        | null
      if (myEpoch !== liveEpoch) return // superseded while awaiting
      if (!res.ok || !data?.ok || !data.client_secret || !data.model) {
        // The token endpoint already classified the reason (OPENAI_API_KEY_MISSING /
        // OPENAI_API_KEY_INVALID / REALTIME_QUOTA / REALTIME_PROVIDER_FAILED). Show it.
        const code = data?.error ?? (res.ok ? 'TOKEN_MINT_FAILED' : `TOKEN_HTTP_${res.status}`)
        return this.fail(connectionReasonHe(code), code)
      }
      clientSecret = data.client_secret
      model = data.model
    } catch {
      if (myEpoch !== liveEpoch) return
      return this.fail(connectionReasonHe('TOKEN_NETWORK_ERROR'), 'TOKEN_NETWORK_ERROR')
    }

    try {
      // 2. One peer connection.
      const pc = this.deps.createPeerConnection()
      this.pc = pc

      // 3. One remote playback path (WebAudio). Built inside the user gesture by
      //    the caller priming the AudioContext; we resume + hold references.
      pc.ontrack = (event) => {
        if (myEpoch !== liveEpoch) return
        const stream = event.streams[0]
        if (!stream) return
        this.remoteStream = stream
        this.attachPlayback(stream)
        this.cb.onRemoteStream?.(stream) // UI mouth-amplitude analyser (observation only)
        // Bluetooth / headphone route changes end the track — surface it, don't
        // wait silently on dead audio.
        const track = stream.getAudioTracks()[0]
        if (track) track.onended = () => { if (myEpoch === liveEpoch) this.fail(connectionReasonHe('AUDIO_ROUTE_ENDED'), 'AUDIO_ROUTE_ENDED') }
      }

      pc.oniceconnectionstatechange = () => {
        if (myEpoch !== liveEpoch) return
        const st = pc.iceConnectionState
        if (st === 'failed' || st === 'disconnected') { const code = `ICE_${st.toUpperCase()}`; this.fail(connectionReasonHe(code), code) }
      }

      // 4. One mic track (all cleanups on) — or the replay override. The replay
      //    harness owns its track's lifecycle, so we do NOT wrap it in a stream we
      //    would later stop.
      const overrideTrack = this.deps.micTrackOverride?.() ?? null
      let micTrack: MediaStreamTrack
      if (overrideTrack) {
        micTrack = overrideTrack
        this.micStream = null
        pc.addTrack(micTrack)
      } else {
        // Mic capture — classify a permission/hardware failure SPECIFICALLY so the
        // screen can say "microphone permission denied", not a generic connect error.
        let stream: MediaStream
        try {
          stream = await this.deps.getUserMedia(LIVE_MIC_CONSTRAINTS)
        } catch (micErr) {
          if (myEpoch !== liveEpoch) return
          const name = (micErr as { name?: string } | null)?.name ?? ''
          const code = (name === 'NotAllowedError' || name === 'SecurityError') ? 'MIC_PERMISSION_DENIED'
            : (name === 'NotFoundError' || name === 'OverconstrainedError') ? 'MIC_NOT_FOUND'
            : 'MIC_ERROR'
          return this.fail(connectionReasonHe(code), code)
        }
        if (myEpoch !== liveEpoch) { stream.getTracks().forEach((t) => t.stop()); return }
        this.micStream = stream
        micTrack = stream.getAudioTracks()[0]!
        pc.addTrack(micTrack, stream)
      }

      // 5. One data channel. Handlers are closures over `myEpoch` — the ONLY guard.
      const dc = pc.createDataChannel('oai-events')
      this.dc = dc
      dc.onopen = () => {
        if (myEpoch !== liveEpoch) return
        // ONE session.update carrying instructions (+ today's date), voice,
        // turn_detection, reasoning.effort, and the tool set. Build it ONCE and record its
        // size on the trace connection line, so an over-limit field (string_above_max_length)
        // shows up as a number in the trace instead of only failing on a device.
        const payload = buildSessionUpdate(this.deps.now())
        const json = JSON.stringify(payload)
        const bytes = typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(json).length : json.length
        this.recorder.onConnectOk(model, { chars: json.length, bytes })
        this.setState('listening')
        this.send(payload)
        // Greeting is keyed to the conversation id in storage — NOT session start.
        // On a reconnect we send nothing and resume listening silently.
        if (!this.isReconnect && shouldGreet(this.deps.storage, this.conversationId)) {
          markGreeted(this.deps.storage, this.conversationId)
          this.send(buildGreetingResponse())
          this.armAudioWatchdog(myEpoch)
        }
      }
      dc.onmessage = (ev) => {
        if (myEpoch !== liveEpoch) return // <-- the single ownership check
        let parsed: unknown
        try { parsed = JSON.parse(ev.data) } catch { return }
        this.handleEvent(parsed, myEpoch)
      }
      dc.onclose = () => {
        if (myEpoch !== liveEpoch) return
        // Unexpected close (not a user teardown): fail closed with a retry-able state.
        if (!this.torn) this.fail(connectionReasonHe('DATACHANNEL_CLOSED'), 'DATACHANNEL_CLOSED')
      }

      // 6. SDP exchange with the CHOSEN model (no drift — server picked it).
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      if (myEpoch !== liveEpoch) return
      const sdpRes = await this.deps.fetch(`${REALTIME_CALLS_URL}?model=${encodeURIComponent(model)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${clientSecret}`, 'Content-Type': 'application/sdp' },
        body: offer.sdp ?? '',
      })
      if (myEpoch !== liveEpoch) return
      if (!sdpRes.ok) { const code = `SDP_HTTP_${sdpRes.status}`; return this.fail(connectionReasonHe(code), code) }
      const answerSdp = await sdpRes.text()
      if (myEpoch !== liveEpoch) return
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp } as RTCSessionDescriptionInit)
    } catch (err) {
      if (myEpoch !== liveEpoch) return
      // A mic permission/hardware error can also surface here (some browsers reject in
      // pc setup) — classify it so the reason stays specific, not a generic "something went wrong".
      const name = String((err as Error)?.name ?? 'error')
      const code = (name === 'NotAllowedError' || name === 'SecurityError') ? 'MIC_PERMISSION_DENIED'
        : (name === 'NotFoundError') ? 'MIC_NOT_FOUND'
        : 'CONNECT_EXCEPTION:' + name.slice(0, 30)
      this.fail(connectionReasonHe(code), code)
    }
  }

  /** Route the remote stream through WebAudio (audible) + a muted keep-alive
   *  element (keeps the track flowing on browsers that require a media sink). */
  private attachPlayback(stream: MediaStream): void {
    // Muted keep-alive element (playsinline for iOS; never the audible path).
    try {
      const el = (typeof document !== 'undefined') ? document.createElement('audio') : null
      if (el) {
        el.muted = true
        el.autoplay = true
        ;(el as unknown as { playsInline: boolean }).playsInline = true
        el.setAttribute('aria-hidden', 'true')
        el.style.display = 'none'
        el.srcObject = stream
        if (typeof document !== 'undefined' && document.body) document.body.appendChild(el)
        void el.play?.().catch(() => { /* muted element; best effort */ })
        this.keepAliveEl = el
      }
    } catch { /* non-DOM env */ }

    // Audible path: WebAudio graph, references held so it cannot be GC'd.
    try {
      const ctx = this.audioCtx ?? this.deps.createAudioContext()
      if (!ctx) return
      this.audioCtx = ctx
      void (ctx as unknown as { resume?: () => Promise<void> }).resume?.()
      const source = ctx.createMediaStreamSource(stream)
      const gain = ctx.createGain()
      gain.gain.value = 1.0 // full volume — counters the iOS-15 low-<audio> issue
      source.connect(gain)
      gain.connect(ctx.destination)
      this.sourceNode = source
      this.gainNode = gain
    } catch { /* WebAudio unavailable — keep-alive element still plays */ }
  }

  private handleEvent(event: unknown, myEpoch: number): void {
    const type = (event as { type?: string })?.type ?? ''
    const e = event as Record<string, unknown>

    // Tool calls arrive in several official completion shapes
    // (response.function_call_arguments.done / response.output_item.done /
    // response.done). The bridge extracts a completed call from any of them; the
    // executors dedup by call id, so handling it here on every shape is safe.
    const fc = extractFunctionCall(event)
    if (fc) this.handleToolCall(fc)

    switch (type) {
      case 'input_audio_buffer.speech_started':
        this.recorder.onUserSpeechStart()  // observation only — records truncation evidence
        this.clearAudioWatchdog()
        this.setState('listening')
        break
      case 'input_audio_buffer.speech_stopped':
        // UI hint only: the user finished; show 'thinking' until Abu's audio starts.
        // No state/VAD/turn change — the model owns turn-taking.
        this.cb.onThinking?.()
        break
      case 'conversation.item.input_audio_transcription.completed':
        // Side-channel ONLY: hand the UI the Hebrew transcript. Nothing routes on it.
        if (typeof e.transcript === 'string') { this.cb.onUserTranscript?.(e.transcript); this.recorder.onUserText(e.transcript) }
        break
      case 'response.output_audio.delta':
      case 'response.audio.delta':
        this.recorder.onAudioDelta()       // observation only
        this.clearAudioWatchdog()
        this.setState('speaking')
        break
      case 'response.output_audio_transcript.done':
      case 'response.audio_transcript.done':
        if (typeof e.transcript === 'string') { this.cb.onAbuTranscript?.(e.transcript); this.recorder.onAbuText(e.transcript) }
        break
      case 'response.done':
        // Only a FINAL answer (or a phaseless done) ends the turn. A `commentary`
        // done is mid-turn — keep speaking; more audio is coming. A done that CARRIED
        // a function call (fc truthy) is ALSO mid-turn: the tool result is about to be
        // spoken (LiveTools sends the output + a response.create), so the grounded
        // speech lands in the SAME turn. Ending here would flip to listening early AND
        // make the recorder see a silent turn — the turn ends on the SPOKEN done.
        if (isEndOfTurn(event) && !fc) { this.recorder.onTurnEnd(); this.clearAudioWatchdog(); if (myEpoch === liveEpoch) this.setState('listening') }
        break
      case 'error': {
        const code = String((e.error as { code?: string })?.code ?? 'SERVER_ERROR')
        if (code !== 'response_cancel_not_active') this.fail('שגיאה בשרת הקול.', code)
        break
      }
      default:
        break
    }
  }

  /** Route a completed function call. wait_for_user is a turn-taking no-op handled
   *  here (acknowledge, stay SILENT — no response.create). Every other tool is owned
   *  by the LiveTools executor (which sends the safe output + a response.create so the
   *  model speaks the grounded result). */
  private handleToolCall(fc: ParsedFunctionCall): void {
    // ONE model tool call = ONE execution. Dispatch each call_id exactly once — before
    // the recorder and before any executor — so a duplicate completion shape can never
    // record a second call, ack twice, or (critically) commit a calendar event twice.
    if (this.dispatchedCalls.has(fc.callId)) return
    this.dispatchedCalls.add(fc.callId)
    this.recorder.onToolCall(fc.name, safeParseArgs(fc.argsJson))  // observation only
    if (fc.name === 'wait_for_user') {
      this.send({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: fc.callId, output: '{"status":"waiting"}' } })
      this.setState('listening')
      return
    }
    if (LiveTools.owns(fc.name)) this.liveTools.handleFunctionCall(fc)
  }

  /** Export the whole-session flight trace (my speech, her speech, every tool call,
   *  plus silent-turn / truncation flags) as a downloadable file. */
  exportTrace(filename?: string): void { downloadTrace(this.recorder, filename) }
  /** The flight recorder (for tests / diagnostics). */
  getRecorder(): FlightRecorder { return this.recorder }

  private armAudioWatchdog(myEpoch: number): void {
    this.clearAudioWatchdog()
    this.audioWatchdog = setTimeout(() => {
      if (myEpoch !== liveEpoch || this.torn) return
      // Fail closed: a response was created but no audio arrived — say so, don't
      // wait silently. (No TTS fallback exists in M1.)
      this.fail(connectionReasonHe('NO_AUDIO_EVENT'), 'NO_AUDIO_EVENT')
    }, LIVE_AUDIO_TIMEOUT_MS)
  }
  private clearAudioWatchdog(): void {
    if (this.audioWatchdog) { clearTimeout(this.audioWatchdog); this.audioWatchdog = null }
  }

  /** The single wire-send. A closed channel is a no-op (fail closed). */
  private send(event: Record<string, unknown>): void {
    // Observation only: record the grounded tool result as it goes out.
    if (event.type === 'conversation.item.create') {
      const item = event.item as { type?: string; output?: string } | undefined
      if (item?.type === 'function_call_output' && typeof item.output === 'string') {
        try { this.recorder.onToolResult('', JSON.parse(item.output)) } catch { /* */ }
      }
    }
    if (this.dc && this.dc.readyState === 'open') this.dc.send(JSON.stringify(event))
  }

  /** Inject a TYPED user turn (the calendar card's Confirm button sends "כן, תשמרי").
   *  This is an additive input channel — a normal user message + response.create over
   *  the same data channel. It does NOT change VAD, turn detection, or audio playback;
   *  the model handles it exactly like a spoken turn. No-op if the channel is closed. */
  sendUserText(text: string): void {
    if (!this.dc || this.dc.readyState !== 'open') return
    this.recorder.onUserTypedText(text)  // observation only — provenance for a typed confirm (card tap)
    this.send({ type: 'conversation.item.create', item: { type: 'message', role: 'user', content: [{ type: 'input_text', text }] } })
    this.send({ type: 'response.create' })
  }

  /** ONE function: tear the whole thing down. Idempotent. Bumps the epoch so any
   *  in-flight handler closed over the old value returns immediately. */
  teardown(): void {
    if (this.torn) return
    this.torn = true
    liveEpoch++ // invalidate every handler closed over this session's epoch
    this.clearAudioWatchdog()
    if (this.dc) { try { this.dc.close() } catch { /* */ } this.dc = null }
    if (this.micStream) { this.micStream.getTracks().forEach((t) => { try { t.stop() } catch { /* */ } }); this.micStream = null }
    if (this.sourceNode) { try { this.sourceNode.disconnect() } catch { /* */ } this.sourceNode = null }
    if (this.gainNode) { try { this.gainNode.disconnect() } catch { /* */ } this.gainNode = null }
    if (this.audioCtx) { try { void (this.audioCtx as unknown as { close?: () => Promise<void> }).close?.() } catch { /* */ } this.audioCtx = null }
    if (this.keepAliveEl) { try { this.keepAliveEl.pause(); this.keepAliveEl.srcObject = null; this.keepAliveEl.remove() } catch { /* */ } this.keepAliveEl = null }
    if (this.pc) { try { this.pc.close() } catch { /* */ } this.pc = null }
    this.remoteStream = null
    if (this._state !== 'error') this.setState('idle')
  }
}

/** Test-only: read the current module epoch. */
export function __getLiveEpoch(): number { return liveEpoch }
