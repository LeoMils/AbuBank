/*
 * liveTrace.ts — Abu live path: FLIGHT RECORDER + turn-health detectors (pure).
 * ════════════════════════════════════════════════════════════════════════════
 * A device session must produce a downloadable trace of the whole conversation —
 * MY speech (Martita), HER speech (Abu), and every tool call with args + result —
 * plus two turn-health signals surfaced from that same stream:
 *
 *   • SILENT TURN (Part C.3): a turn ends after a tool call with NO Abu speech.
 *     A tool result must always produce a spoken continuation in the same turn;
 *     any turn that does not is logged.
 *   • POSSIBLE TRUNCATION (Part C.2 EVIDENCE, not a fix): the user's mic opens
 *     (input_audio_buffer.speech_started) WHILE Abu is still speaking — the classic
 *     VAD-interrupt / self-hearing cause of "only the first word is heard". This is
 *     recorded so a device trace can prove the mechanism; the audio/VAD path itself
 *     is NOT changed here (that needs a measured device baseline).
 *
 * This module is PURE and side-effect-free (it only appends to its own arrays). The
 * live session drives it with semantic calls — it never changes turn/VAD/audio
 * behaviour, so it is safe observability, not a control-plane change.
 */

export type TraceKind = 'user_speech' | 'abu_speech' | 'tool_call' | 'tool_result' | 'note'

/** How a calendar confirmation was arrived at, for the confirm_calendar_event entry:
 *  - 'voice'    Martita's spoken transcript preceded the confirm this turn
 *  - 'typed'    the card's Confirm button (a typed user turn) preceded it
 *  - 'inferred' the model called confirm with NO user input since Abu last spoke
 *  This makes a trace show whether the user actually confirmed or the model inferred it. */
export type ConfirmationSource = 'voice' | 'typed' | 'inferred'

export interface TraceEntry {
  seq: number
  /** ms since recorder start (monotonic; injected clock so tests are deterministic). */
  t: number
  kind: TraceKind
  text?: string
  tool?: string
  args?: unknown
  result?: unknown
  /** Present only on a confirm_calendar_event tool_call entry (see ConfirmationSource). */
  confirmationSource?: ConfirmationSource
}

/** Tools whose CONTRACT is to produce no spoken continuation. A turn that ends after
 *  only these is NOT a silent turn — wait_for_user is the deliberate "stay quiet"
 *  no-op for noise/TV/unaddressed speech. Every other tool must be followed by speech. */
const SILENT_OK_TOOLS = new Set<string>(['wait_for_user'])

/** The tool call whose provenance we tag with a ConfirmationSource. */
const CONFIRM_TOOL = 'confirm_calendar_event'

export interface SilentTurnFlag { atSeq: number; toolsInTurn: string[]; detail: string }
export interface TruncationFlag { atSeq: number; detail: string }

/** A connection lifecycle event — recorded so a session that FAILS TO CONNECT still
 *  produces a downloadable trace saying WHY (no token / network / mic / provider). */
export interface ConnectionEvent { t: number; kind: 'attempt' | 'ok' | 'failed'; code?: string; detail?: string; payloadChars?: number; payloadBytes?: number }

export interface TraceExport {
  startedAt: number
  entries: TraceEntry[]
  silentTurns: SilentTurnFlag[]
  truncations: TruncationFlag[]
  connection: ConnectionEvent[]
}

export class FlightRecorder {
  private readonly entries: TraceEntry[] = []
  private readonly silentTurns: SilentTurnFlag[] = []
  private readonly truncations: TruncationFlag[] = []
  private readonly connection: ConnectionEvent[] = []
  private readonly recoverable: Array<{ t: number; code: string }> = []
  private readonly toolIssues: Array<{ t: number; name: string; reason: 'error' | 'timeout' }> = []
  private seq = 0
  private readonly startWall: number

  // Per-turn health tracking (reset at each end-of-turn).
  private speaking = false
  private toolsSinceFinal: string[] = []
  private spokeSinceFinal = false
  /** The most recent user input since Abu last spoke — drives the confirmation
   *  source of a confirm_calendar_event call. Cleared when Abu speaks (so a confirm
   *  attributes to input that came AFTER Abu read the draft back), and at turn end. */
  private lastUserInput: ConfirmationSource | null = null

  constructor(private readonly now: () => number) {
    this.startWall = now()
  }

  private add(kind: TraceKind, extra: Partial<TraceEntry> = {}): void {
    this.entries.push({ seq: ++this.seq, t: this.now() - this.startWall, kind, ...extra })
  }

  /** Martita spoke (from the input transcript side-channel). */
  onUserText(text: string): void { this.lastUserInput = 'voice'; this.add('user_speech', { text }) }

  /** Martita confirmed via a TYPED turn (e.g. the calendar card's Confirm button,
   *  which injects a user message). Recorded so a confirm can be attributed to a real
   *  tap rather than a model inference. */
  onUserTypedText(text: string): void { this.lastUserInput = 'typed'; this.add('user_speech', { text }) }

  /** Abu spoke (final audio transcript for a response). Counts as speech-in-turn.
   *  Clears the pending user input so a later confirm is not mis-attributed to input
   *  from BEFORE this readback. */
  onAbuText(text: string): void {
    this.spokeSinceFinal = true
    this.lastUserInput = null
    this.add('abu_speech', { text })
  }

  /** Abu audio began playing — she is speaking (used for truncation detection). */
  onAudioDelta(): void { this.speaking = true; this.spokeSinceFinal = true; this.lastUserInput = null }

  /** M1 preamble measurement (DEVICE): the ms between the first audio of a response and the
   *  function_call in that SAME response — i.e. how long Abu spoke ("רגע, אני בודקת…") before the
   *  tool call. On a real device session this fills the distribution that SETS the commit window
   *  (or proves the window cannot work and two-response is needed). 0/absent = no preamble. */
  private readonly preambleGaps: Array<{ t: number; gapMs: number }> = []
  onPreambleGap(gapMs: number): void { this.preambleGaps.push({ t: this.now() - this.startWall, gapMs }) }
  /** The measured preamble gaps (ms) this session — read from the downloaded trace / diagnostics. */
  getPreambleGaps(): number[] { return this.preambleGaps.map((g) => g.gapMs) }

  /** The mic opened (server VAD detected user speech). If this happens WHILE Abu is
   *  speaking, it is the likely truncation cause — record it as evidence (no fix). */
  onUserSpeechStart(): void {
    if (this.speaking) {
      this.truncations.push({ atSeq: this.seq, detail: 'user speech started while Abu was still speaking — VAD interrupt / self-hearing (likely truncation of Abu audio)' })
    }
  }

  /** A tool was invoked this turn. A confirm_calendar_event call is tagged with its
   *  confirmation source (voice / typed / inferred) so the trace shows whether Martita
   *  actually confirmed or the model inferred it. */
  onToolCall(name: string, args?: unknown): void {
    this.toolsSinceFinal.push(name)
    const extra: Partial<TraceEntry> = { tool: name, args }
    if (name === CONFIRM_TOOL) extra.confirmationSource = this.lastUserInput ?? 'inferred'
    this.add('tool_call', extra)
  }

  /** A tool returned (the grounded result the model will speak). */
  onToolResult(name: string, result?: unknown): void { this.add('tool_result', { tool: name, result }) }

  /** The turn ended (the live session decided end-of-turn). If a tool that REQUIRES a
   *  spoken continuation ran this turn but Abu never spoke, that is a SILENT TURN.
   *  wait_for_user is exempt — its contract is to stay quiet, so a turn ending after
   *  only wait_for_user is not silent. */
  onTurnEnd(): void {
    const needSpeech = this.toolsSinceFinal.filter((t) => !SILENT_OK_TOOLS.has(t))
    if (needSpeech.length > 0 && !this.spokeSinceFinal) {
      this.silentTurns.push({
        atSeq: this.seq,
        toolsInTurn: [...needSpeech],
        detail: `turn ended after tool(s) [${needSpeech.join(', ')}] with NO spoken continuation`,
      })
    }
    this.toolsSinceFinal = []
    this.spokeSinceFinal = false
    this.speaking = false
    this.lastUserInput = null
  }

  /** A free-text note (e.g. an error). */
  note(text: string): void { this.add('note', { text }) }

  // ─── Connection lifecycle (so a failed connect still produces a trace) ────────
  /** The session began trying to connect (mint token → WebRTC). */
  onConnectAttempt(): void {
    this.connection.push({ t: this.now() - this.startWall, kind: 'attempt' })
    this.add('note', { text: 'connection attempt' })
  }
  /** The WebRTC data channel opened — the live session is up. `payload` is the size of
   *  the session.update config we are about to send, so an over-limit field (the cause of
   *  string_above_max_length) is visible IN THE TRACE, not only discoverable on a phone. */
  onConnectOk(model?: string, payload?: { chars: number; bytes: number }): void {
    this.connection.push({
      t: this.now() - this.startWall,
      kind: 'ok',
      ...(model ? { detail: model } : {}),
      ...(payload ? { payloadChars: payload.chars, payloadBytes: payload.bytes } : {}),
    })
    const sizeText = payload ? ` · session.update ${payload.chars} תווים / ${payload.bytes} bytes` : ''
    this.add('note', { text: `connected${model ? ` (${model})` : ''}${sizeText}` })
  }
  /** A failure occurred — connection OR mid-session. `code` is the machine reason
   *  (e.g. OPENAI_API_KEY_MISSING, MIC_PERMISSION_DENIED); `reasonHe` is what Martita saw. */
  onFailure(code: string, reasonHe?: string): void {
    this.connection.push({ t: this.now() - this.startWall, kind: 'failed', code, ...(reasonHe ? { detail: reasonHe } : {}) })
    this.add('note', { text: `FAILURE [${code}]${reasonHe ? ` — ${reasonHe}` : ''}` })
  }
  /** A RECOVERABLE error — recorded for diagnostics but NOT a failure (the session survives).
   *  FIX 4: conversation_already_has_active_response / response_cancel_not_active are benign
   *  response-lifecycle races; they must never read as a session failure. */
  onRecoverableError(code: string): void {
    this.recoverable.push({ t: this.now() - this.startWall, code })
    this.add('note', { text: `recovered [${code}]` })
  }
  /** How many recoverable races were handled (test/diagnostics). */
  recoverableErrorCount(): number { return this.recoverable.length }

  /** FIX 5: a tool did not return normally (threw, or an async tool timed out). The executor
   *  still sent an honest fallback; this records WHICH tool and WHY so a non-returning call is
   *  visible in the trace instead of a silent wait. */
  onToolIssue(name: string, reason: 'error' | 'timeout'): void {
    this.toolIssues.push({ t: this.now() - this.startWall, name, reason })
    this.add('note', { text: `tool ${name} did not return (${reason}) — honest fallback sent` })
  }
  /** How many tool calls did not return normally (test/diagnostics). */
  toolIssueCount(): number { return this.toolIssues.length }

  /** True if any failure was recorded (so the UI/exporter knows a trace is worth keeping). */
  hasFailure(): boolean { return this.connection.some((c) => c.kind === 'failed') }

  silentTurnCount(): number { return this.silentTurns.length }
  truncationCount(): number { return this.truncations.length }

  toExport(): TraceExport {
    return { startedAt: this.startWall, entries: [...this.entries], silentTurns: [...this.silentTurns], truncations: [...this.truncations], connection: [...this.connection] }
  }

  /** A downloadable, human-readable trace: my speech, her speech, every tool call. */
  toText(): string {
    const lines: string[] = []
    lines.push('# Abu live session trace', '')
    // Connection summary FIRST — so a session that failed to connect is immediately
    // legible (the reason is at the top, not buried), and a failed connect still
    // downloads a useful trace even with zero conversation turns.
    if (this.connection.length) {
      lines.push('## CONNECTION')
      for (const c of this.connection) {
        const ts = `[${(c.t / 1000).toFixed(1)}s]`
        if (c.kind === 'attempt') lines.push(`  ${ts} … מנסה להתחבר`)
        else if (c.kind === 'ok') lines.push(`  ${ts} ✓ מחוברת${c.detail ? ` (${c.detail})` : ''}${c.payloadChars !== undefined ? ` · session.update ${c.payloadChars} תווים / ${c.payloadBytes} bytes` : ''}`)
        else lines.push(`  ${ts} ✗ נכשל — code=${c.code ?? '?'}${c.detail ? ` · "${c.detail}"` : ''}`)
      }
      lines.push('')
    }
    for (const e of this.entries) {
      const ts = `[${(e.t / 1000).toFixed(1)}s]`
      if (e.kind === 'user_speech') lines.push(`${ts} 👤 מרטיטה: ${e.text ?? ''}`)
      else if (e.kind === 'abu_speech') lines.push(`${ts} 🤖 אבו: ${e.text ?? ''}`)
      else if (e.kind === 'tool_call') {
        const src = e.confirmationSource ? `  [confirmed by: ${e.confirmationSource}]` : ''
        lines.push(`${ts} 🔧 ${e.tool}(${JSON.stringify(e.args ?? {})})${src}`)
      }
      else if (e.kind === 'tool_result') lines.push(`${ts}    → ${JSON.stringify(e.result ?? {})}`)
      else lines.push(`${ts} · ${e.text ?? ''}`)
    }
    if (this.silentTurns.length) {
      lines.push('', '## ⚠️ SILENT TURNS (tool result with no spoken continuation)')
      for (const s of this.silentTurns) lines.push(`  - ${s.detail}`)
    }
    if (this.truncations.length) {
      lines.push('', '## ⚠️ POSSIBLE AUDIO TRUNCATION (evidence, not a fix)')
      for (const tr of this.truncations) lines.push(`  - ${tr.detail}`)
    }
    return lines.join('\n')
  }
}

/** Trigger a browser download of the trace text (no-op outside the DOM). */
export function downloadTrace(recorder: FlightRecorder, filename = 'abu-live-trace.txt'): void {
  try {
    if (typeof document === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) return
    const blob = new Blob([recorder.toText()], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  } catch { /* best-effort export */ }
}
