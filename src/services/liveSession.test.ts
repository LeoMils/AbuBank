/*
 * liveSession.test.ts — Milestone 1 live-path evidence (CODE/MOCK class).
 *
 * These prove the module's construction, teardown, single-owner epoch guard,
 * greeting-keyed-to-conversation-id, silent reconnect, single-instance resources,
 * and correct handling of BOTH response phases — with every browser seam faked.
 * They are CODE evidence: they prove wiring/logic, NOT that Martita heard warm
 * Hebrew audio on the iPhone (PHYSICAL_DEVICE — reported separately, not claimed).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  LiveSession,
  buildSessionUpdate,
  buildGreetingResponse,
  parseResponsePhase,
  isEndOfTurn,
  shouldGreet,
  markGreeted,
  startConversation,
  currentConversationId,
  __getLiveEpoch,
  LIVE_VOICE,
  LIVE_VAD_SILENCE_MS,
  LIVE_VAD_THRESHOLD,
  LIVE_VAD_PREFIX_PADDING_MS,
  LIVE_INTERRUPT_RESPONSE,
  LIVE_TRANSCRIBE_MODEL,
  LIVE_REASONING_EFFORT,
  connectionReasonHe,
  WAIT_FOR_USER_TOOL,
  type LiveDeps,
  type LiveState,
} from './liveSession'

// ─── Fakes ──────────────────────────────────────────────────────────────────

class FakeDataChannel {
  readyState = 'open'
  sent: Array<Record<string, unknown>> = []
  onopen: (() => void) | null = null
  onmessage: ((ev: { data: string }) => void) | null = null
  onclose: (() => void) | null = null
  send(s: string) { this.sent.push(JSON.parse(s)) }
  close() { this.readyState = 'closed' }
  fireOpen() { this.onopen?.() }
  fire(event: unknown) { this.onmessage?.({ data: JSON.stringify(event) }) }
}

class FakeTrack {
  kind = 'audio'
  readyState = 'live'
  enabled = true
  onended: (() => void) | null = null
  stopped = false
  stop() { this.stopped = true }
}

class FakeStream {
  tracks: FakeTrack[]
  constructor(tracks: FakeTrack[]) { this.tracks = tracks }
  getTracks() { return this.tracks }
  getAudioTracks() { return this.tracks }
}

class FakePeerConnection {
  dc: FakeDataChannel | null = null
  addTrackCalls: Array<{ track: unknown }> = []
  closed = false
  ontrack: ((e: { streams: MediaStream[] }) => void) | null = null
  oniceconnectionstatechange: (() => void) | null = null
  iceConnectionState = 'new'
  createDataChannel(_label: string) { this.dc = new FakeDataChannel(); return this.dc as unknown as RTCDataChannel }
  addTrack(track: unknown) { this.addTrackCalls.push({ track }); return {} as RTCRtpSender }
  createOffer() { return Promise.resolve({ type: 'offer', sdp: 'offer-sdp' } as RTCSessionDescriptionInit) }
  setLocalDescription() { return Promise.resolve() }
  setRemoteDescription() { return Promise.resolve() }
  close() { this.closed = true }
}

interface Harness {
  deps: LiveDeps
  pc: FakePeerConnection
  states: LiveState[]
  errors: Array<{ msg: string; code: string }>
  userTranscripts: string[]
  abuTranscripts: string[]
  getUserMediaCalls: number
  createPCCalls: number
  session: LiveSession
}

function makeHarness(opts: {
  tokenOk?: boolean
  tokenError?: string
  isReconnect?: boolean
  conversationId?: string
  storage?: Map<string, string>
  micOverride?: FakeTrack
} = {}): Harness {
  const pc = new FakePeerConnection()
  const storageMap = opts.storage ?? new Map<string, string>()
  const storage = {
    getItem: (k: string) => (storageMap.has(k) ? storageMap.get(k)! : null),
    setItem: (k: string, v: string) => { storageMap.set(k, v) },
  }
  const h: Partial<Harness> & { getUserMediaCalls: number; createPCCalls: number } = {
    getUserMediaCalls: 0,
    createPCCalls: 0,
  }
  const states: LiveState[] = []
  const errors: Array<{ msg: string; code: string }> = []
  const userTranscripts: string[] = []
  const abuTranscripts: string[] = []

  const deps: LiveDeps = {
    fetch: vi.fn(async (url: string) => {
      if (String(url).includes('/api/realtime-token')) {
        return {
          ok: true,
          json: async () => (opts.tokenOk === false
            ? { ok: false, error: opts.tokenError ?? 'TOKEN_MINT_FAILED' }
            : { ok: true, client_secret: 'ek_fake', model: 'gpt-realtime-2.1' }),
        } as unknown as Response
      }
      // SDP calls endpoint
      return { ok: true, text: async () => 'answer-sdp' } as unknown as Response
    }) as unknown as typeof fetch,
    createPeerConnection: () => { h.createPCCalls++; return pc as unknown as RTCPeerConnection },
    getUserMedia: async () => { h.getUserMediaCalls++; return new FakeStream([new FakeTrack()]) as unknown as MediaStream },
    createAudioContext: () => null, // skip WebAudio in node; attachPlayback guards
    storage,
    now: () => 1_000_000,
    ...(opts.micOverride ? { micTrackOverride: () => opts.micOverride as unknown as MediaStreamTrack } : {}),
  }

  const conversationId = opts.conversationId ?? 'conv_test'
  const session = new LiveSession(
    {
      onState: (s) => states.push(s),
      onUserTranscript: (t) => userTranscripts.push(t),
      onAbuTranscript: (t) => abuTranscripts.push(t),
      onError: (msg, code) => errors.push({ msg, code }),
    },
    conversationId,
    opts.isReconnect ?? false,
    deps,
  )

  return {
    deps, pc, states, errors, userTranscripts, abuTranscripts,
    get getUserMediaCalls() { return h.getUserMediaCalls },
    get createPCCalls() { return h.createPCCalls },
    session,
  } as Harness
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

describe('liveSession pure helpers', () => {
  it('buildSessionUpdate carries instructions, voice, raised VAD, reasoning.effort, and the wait_for_user tool', () => {
    const u = buildSessionUpdate() as { type: string; session: Record<string, unknown> }
    const s = u.session as unknown as {
      instructions: string
      reasoning: { effort: string }
      tools: Array<{ name: string }>
      tool_choice: string
      audio: { input: { transcription: { language: string }; turn_detection: Record<string, unknown> }; output: { voice: string } }
    }
    expect(u.type).toBe('session.update')
    expect(typeof s.instructions).toBe('string')
    expect(s.instructions.length).toBeGreaterThan(0)
    expect(s.reasoning.effort).toBe(LIVE_REASONING_EFFORT)
    expect(s.tools.map((t) => t.name)).toContain('wait_for_user')
    expect(s.tool_choice).toBe('auto')
    expect(s.audio.output.voice).toBe(LIVE_VOICE)
    expect(s.audio.input.transcription.language).toBe('he')
    expect(s.audio.input.turn_detection.silence_duration_ms).toBe(LIVE_VAD_SILENCE_MS)
    expect(s.audio.input.turn_detection.create_response).toBe(true)
    expect(LIVE_VAD_SILENCE_MS).toBeGreaterThan(500) // above the default that cuts off elderly speech
  })

  it('transcription is explicit Hebrew with a family-name bias prompt; VAD uses the raised threshold', () => {
    const u = buildSessionUpdate() as { session: { audio: { input: { transcription: { model: string; language: string; prompt: string }; turn_detection: Record<string, unknown> } } } }
    const t = u.session.audio.input.transcription
    expect(t.model).toBe(LIVE_TRANSCRIBE_MODEL)
    expect(t.language).toBe('he')
    expect(typeof t.prompt).toBe('string')
    expect(t.prompt).toContain('מור')            // a family name biases the transcriber
    expect(t.prompt).toContain('תקבעי לי תור')   // a common request phrasing
    const vad = u.session.audio.input.turn_detection
    expect(vad.threshold).toBe(LIVE_VAD_THRESHOLD)
    expect(LIVE_VAD_THRESHOLD).toBeGreaterThan(0.5) // less barge-in sensitive than the 0.5 default
    expect(vad.prefix_padding_ms).toBe(LIVE_VAD_PREFIX_PADDING_MS)
    // Device defect 2: interrupt_response is DISABLED so a self-hearing echo (Abu's own
    // loudspeaker audio leaking into the mic) can never trigger a server-side truncation
    // that cuts her off after one word. Turn-taking is preserved by create_response.
    expect(vad.interrupt_response).toBe(false)
    expect(vad.create_response).toBe(true)          // turn-taking still fires on the user's turn end
    expect(LIVE_INTERRUPT_RESPONSE).toBe(false)
  })

  it('connectionReasonHe gives a SPECIFIC plain-Hebrew reason per failure code (not a bare retry)', () => {
    // No token / server key.
    expect(connectionReasonHe('OPENAI_API_KEY_MISSING')).toContain('OPENAI_API_KEY')
    expect(connectionReasonHe('OPENAI_API_KEY_INVALID')).toContain('לא תקין')
    // Microphone.
    expect(connectionReasonHe('MIC_PERMISSION_DENIED')).toContain('מיקרופון')
    // Network.
    expect(connectionReasonHe('TOKEN_NETWORK_ERROR')).toContain('רשת')
    // Provider.
    expect(connectionReasonHe('REALTIME_PROVIDER_FAILED')).toContain('שיחת קול')
    // Each of the four families is DISTINCT — the screen can say which one it is.
    const four = ['OPENAI_API_KEY_MISSING', 'MIC_PERMISSION_DENIED', 'TOKEN_NETWORK_ERROR', 'REALTIME_PROVIDER_FAILED']
      .map(connectionReasonHe)
    expect(new Set(four).size).toBe(4)
    // SDP/ICE collapse to a general connection failure; unknown → a safe default.
    expect(connectionReasonHe('SDP_HTTP_500')).toContain('החיבור נכשל')
    expect(connectionReasonHe('ICE_FAILED')).toContain('החיבור נכשל')
    expect(connectionReasonHe('SOMETHING_ELSE')).toContain('מצב הקול')
  })

  it('wait_for_user tool takes no parameters and is a function', () => {
    expect(WAIT_FOR_USER_TOOL.type).toBe('function')
    expect(WAIT_FOR_USER_TOOL.name).toBe('wait_for_user')
    expect(WAIT_FOR_USER_TOOL.parameters.properties).toEqual({})
  })

  it('parseResponsePhase reads the phase from either location; unknown → null', () => {
    expect(parseResponsePhase({ type: 'response.done', response: { phase: 'commentary' } })).toBe('commentary')
    expect(parseResponsePhase({ type: 'response.done', phase: 'final_answer' })).toBe('final_answer')
    expect(parseResponsePhase({ type: 'response.done', response: { metadata: { phase: 'commentary' } } })).toBe('commentary')
    expect(parseResponsePhase({ type: 'response.done' })).toBeNull()
  })

  it('isEndOfTurn is FALSE for a commentary done and TRUE for final/phaseless', () => {
    expect(isEndOfTurn({ response: { phase: 'commentary' } })).toBe(false)
    expect(isEndOfTurn({ response: { phase: 'final_answer' } })).toBe(true)
    expect(isEndOfTurn({})).toBe(true)
  })

  it('greeting storage keys off the conversation id', () => {
    const m = new Map<string, string>()
    const storage = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v) } }
    expect(shouldGreet(storage, 'conv_A')).toBe(true)
    markGreeted(storage, 'conv_A')
    expect(shouldGreet(storage, 'conv_A')).toBe(false)
    expect(shouldGreet(storage, 'conv_B')).toBe(true) // a different conversation greets again
  })

  it('startConversation persists a fresh id readable by currentConversationId', () => {
    const m = new Map<string, string>()
    const storage = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v) } }
    let n = 0
    const id = startConversation(storage, () => [0.1, 0.2][n++] ?? 0.3)
    expect(id).toMatch(/^conv_/)
    expect(currentConversationId(storage)).toBe(id)
  })
})

// ─── Session behaviour ─────────────────────────────────────────────────────────

describe('LiveSession', () => {
  beforeEach(() => { vi.useRealTimers() })

  it('constructs idle and claims a fresh module epoch on connect', async () => {
    const before = __getLiveEpoch()
    const h = makeHarness()
    expect(h.session.state).toBe('idle')
    await h.session.connect()
    expect(h.session.claimedEpoch).toBe(before + 1)
    h.session.teardown()
  })

  it('builds exactly ONE of each resource (pc, mic getUserMedia, data channel, addTrack)', async () => {
    const h = makeHarness()
    await h.session.connect()
    expect(h.createPCCalls).toBe(1)
    expect(h.getUserMediaCalls).toBe(1)
    expect(h.pc.dc).not.toBeNull()
    expect(h.pc.addTrackCalls.length).toBe(1)
    h.session.teardown()
  })

  it('sends session.update on data-channel open', async () => {
    const h = makeHarness({ isReconnect: true }) // suppress greeting to isolate
    await h.session.connect()
    h.pc.dc!.fireOpen()
    const types = h.pc.dc!.sent.map((e) => e.type)
    expect(types).toContain('session.update')
  })

  it('greets ONCE keyed to the conversation id, and marks it greeted', async () => {
    const storage = new Map<string, string>()
    const h = makeHarness({ conversationId: 'conv_greet', storage })
    await h.session.connect()
    h.pc.dc!.fireOpen()
    const types = h.pc.dc!.sent.map((e) => e.type)
    expect(types).toContain('session.update')
    expect(types).toContain('response.create') // the greeting
    // A SECOND session on the same conversation id does NOT greet again.
    const h2 = makeHarness({ conversationId: 'conv_greet', storage })
    await h2.session.connect()
    h2.pc.dc!.fireOpen()
    expect(h2.pc.dc!.sent.map((e) => e.type)).not.toContain('response.create')
    h.session.teardown(); h2.session.teardown()
  })

  it('reconnect creates NO response — resume listening silently', async () => {
    const storage = new Map<string, string>() // never greeted
    const h = makeHarness({ conversationId: 'conv_recon', storage, isReconnect: true })
    await h.session.connect()
    h.pc.dc!.fireOpen()
    const types = h.pc.dc!.sent.map((e) => e.type)
    expect(types).toContain('session.update')
    expect(types).not.toContain('response.create') // silent resume
    h.session.teardown()
  })

  it('routes remote audio deltas to the speaking state; a FINAL response.done returns to listening', async () => {
    const h = makeHarness({ isReconnect: true })
    await h.session.connect()
    h.pc.dc!.fireOpen()
    h.pc.dc!.fire({ type: 'response.output_audio.delta', delta: 'x' })
    expect(h.session.state).toBe('speaking')
    h.pc.dc!.fire({ type: 'response.done', response: { phase: 'final_answer' } })
    expect(h.session.state).toBe('listening')
    h.session.teardown()
  })

  it('a COMMENTARY response.done does NOT end the turn (no truncation/overlap)', async () => {
    const h = makeHarness({ isReconnect: true })
    await h.session.connect()
    h.pc.dc!.fireOpen()
    h.pc.dc!.fire({ type: 'response.output_audio.delta', delta: 'x' })
    expect(h.session.state).toBe('speaking')
    h.pc.dc!.fire({ type: 'response.done', response: { phase: 'commentary' } })
    expect(h.session.state).toBe('speaking') // still mid-turn — more audio coming
    h.session.teardown()
  })

  it('input transcription is a UI side-channel only — surfaced, never used for state', async () => {
    const h = makeHarness({ isReconnect: true })
    await h.session.connect()
    h.pc.dc!.fireOpen()
    const stateCountBefore = h.states.length
    h.pc.dc!.fire({ type: 'conversation.item.input_audio_transcription.completed', transcript: 'בוקר טוב' })
    expect(h.userTranscripts).toContain('בוקר טוב')
    expect(h.states.length).toBe(stateCountBefore) // no state change from a transcript
    h.session.teardown()
  })

  it('wait_for_user acknowledges and STAYS SILENT (no response.create)', async () => {
    const h = makeHarness({ isReconnect: true })
    await h.session.connect()
    h.pc.dc!.fireOpen()
    h.pc.dc!.sent.length = 0 // drop the session.update
    h.pc.dc!.fire({ type: 'response.function_call_arguments.done', name: 'wait_for_user', call_id: 'c1' })
    const types = h.pc.dc!.sent.map((e) => e.type)
    expect(types).toContain('conversation.item.create') // the function_call_output ack
    expect(types).not.toContain('response.create') // silence — no reply
    h.session.teardown()
  })

  it('ONE model tool call = exactly ONE execution across all three completion shapes (no triple dispatch)', async () => {
    const h = makeHarness({ isReconnect: true })
    await h.session.connect()
    h.pc.dc!.fireOpen()
    h.pc.dc!.sent.length = 0 // drop the session.update
    const call = { name: 'resolve_contact', call_id: 'dup1', arguments: '{"name":"מור"}' }
    // The SAME completed call, delivered in ALL THREE official shapes (the device bug).
    h.pc.dc!.fire({ type: 'response.function_call_arguments.done', ...call })
    h.pc.dc!.fire({ type: 'response.output_item.done', item: { type: 'function_call', ...call } })
    h.pc.dc!.fire({ type: 'response.done', response: { output: [{ type: 'function_call', ...call }] } })
    // Exactly ONE function_call_output for this call id → one execution (no triple confirm).
    const outputs = h.pc.dc!.sent.filter(
      (e) => e.type === 'conversation.item.create'
        && (e.item as { type?: string; call_id?: string })?.type === 'function_call_output'
        && (e.item as { call_id?: string })?.call_id === 'dup1',
    )
    expect(outputs.length).toBe(1)
    // …and the flight recorder logged exactly ONE tool_call (dispatch-boundary dedup).
    const toolCalls = h.session.getRecorder().toExport().entries.filter(
      (e) => e.kind === 'tool_call' && e.tool === 'resolve_contact',
    )
    expect(toolCalls.length).toBe(1)
    h.session.teardown()
  })

  it('a function-call response.done stays MID-TURN — grounded speech lands in the same turn, no silent turn (finding #4)', async () => {
    const h = makeHarness({ isReconnect: true })
    await h.session.connect()
    h.pc.dc!.fireOpen()
    // Model requests phone_call, delivered as a response.done that CARRIES the call.
    const call = { name: 'phone_call', call_id: 'p1', arguments: '{"recipient":"לאו"}' }
    h.pc.dc!.fire({ type: 'response.done', response: { output: [{ type: 'function_call', ...call }] } })
    // The turn has NOT ended — Abu now speaks the card description; the SPOKEN done ends it.
    h.pc.dc!.fire({ type: 'response.output_audio.delta', delta: 'x' })
    expect(h.session.state).toBe('speaking')
    h.pc.dc!.fire({ type: 'response.done', response: { phase: 'final_answer' } })
    expect(h.session.state).toBe('listening')
    // The tool result was followed by speech in the same turn → NOT a silent turn.
    expect(h.session.getRecorder().silentTurnCount()).toBe(0)
    h.session.teardown()
  })

  it('the module epoch is the SINGLE owner guard: a superseded session ignores its datachannel events', async () => {
    const a = makeHarness({ isReconnect: true })
    await a.session.connect()
    a.pc.dc!.fireOpen()
    expect(a.session.state).toBe('listening')
    // A NEW session supersedes A (bumps the module epoch).
    const b = makeHarness({ isReconnect: true })
    await b.session.connect()
    // A's stale handler must now no-op.
    a.pc.dc!.fire({ type: 'response.output_audio.delta', delta: 'x' })
    expect(a.session.state).toBe('listening') // unchanged — event rejected by epoch check
    a.session.teardown(); b.session.teardown()
  })

  it('teardown is idempotent, closes the resources, bumps the epoch, and returns to idle', async () => {
    const h = makeHarness({ isReconnect: true })
    await h.session.connect()
    h.pc.dc!.fireOpen()
    const epochAfterConnect = __getLiveEpoch()
    h.session.teardown()
    expect(h.pc.closed).toBe(true)
    expect(h.pc.dc!.readyState).toBe('closed')
    expect(__getLiveEpoch()).toBe(epochAfterConnect + 1) // invalidates stale handlers
    expect(h.session.state).toBe('idle')
    // Second teardown is a no-op (no further epoch bump).
    h.session.teardown()
    expect(__getLiveEpoch()).toBe(epochAfterConnect + 1)
  })

  it('fails CLOSED on a token mint failure — error state, no peer connection, no fallback', async () => {
    const h = makeHarness({ tokenOk: false, tokenError: 'OPENAI_API_KEY_MISSING' })
    await h.session.connect()
    expect(h.session.state).toBe('error')
    expect(h.errors[h.errors.length - 1]?.code).toBe('OPENAI_API_KEY_MISSING')
    expect(h.createPCCalls).toBe(0) // never got as far as a peer connection
  })

  it('uses the replay mic-track override instead of getUserMedia', async () => {
    const replayTrack = new FakeTrack()
    const h = makeHarness({ isReconnect: true, micOverride: replayTrack })
    await h.session.connect()
    expect(h.getUserMediaCalls).toBe(0) // mic replaced
    expect(h.pc.addTrackCalls[0]?.track).toBe(replayTrack)
    h.session.teardown()
  })
})
