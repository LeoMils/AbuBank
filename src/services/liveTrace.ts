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

export interface TraceEntry {
  seq: number
  /** ms since recorder start (monotonic; injected clock so tests are deterministic). */
  t: number
  kind: TraceKind
  text?: string
  tool?: string
  args?: unknown
  result?: unknown
}

export interface SilentTurnFlag { atSeq: number; toolsInTurn: string[]; detail: string }
export interface TruncationFlag { atSeq: number; detail: string }

export interface TraceExport {
  startedAt: number
  entries: TraceEntry[]
  silentTurns: SilentTurnFlag[]
  truncations: TruncationFlag[]
}

export class FlightRecorder {
  private readonly entries: TraceEntry[] = []
  private readonly silentTurns: SilentTurnFlag[] = []
  private readonly truncations: TruncationFlag[] = []
  private seq = 0
  private readonly startWall: number

  // Per-turn health tracking (reset at each end-of-turn).
  private speaking = false
  private toolsSinceFinal: string[] = []
  private spokeSinceFinal = false

  constructor(private readonly now: () => number) {
    this.startWall = now()
  }

  private add(kind: TraceKind, extra: Partial<TraceEntry> = {}): void {
    this.entries.push({ seq: ++this.seq, t: this.now() - this.startWall, kind, ...extra })
  }

  /** Martita spoke (from the input transcript side-channel). */
  onUserText(text: string): void { this.add('user_speech', { text }) }

  /** Abu spoke (final audio transcript for a response). Counts as speech-in-turn. */
  onAbuText(text: string): void {
    this.spokeSinceFinal = true
    this.add('abu_speech', { text })
  }

  /** Abu audio began playing — she is speaking (used for truncation detection). */
  onAudioDelta(): void { this.speaking = true; this.spokeSinceFinal = true }

  /** The mic opened (server VAD detected user speech). If this happens WHILE Abu is
   *  speaking, it is the likely truncation cause — record it as evidence (no fix). */
  onUserSpeechStart(): void {
    if (this.speaking) {
      this.truncations.push({ atSeq: this.seq, detail: 'user speech started while Abu was still speaking — VAD interrupt / self-hearing (likely truncation of Abu audio)' })
    }
  }

  /** A tool was invoked this turn. */
  onToolCall(name: string, args?: unknown): void {
    this.toolsSinceFinal.push(name)
    this.add('tool_call', { tool: name, args })
  }

  /** A tool returned (the grounded result the model will speak). */
  onToolResult(name: string, result?: unknown): void { this.add('tool_result', { tool: name, result }) }

  /** The turn ended (the live session decided end-of-turn). If a tool ran this turn
   *  but Abu never spoke, that is a SILENT TURN — a tool result with no continuation. */
  onTurnEnd(): void {
    if (this.toolsSinceFinal.length > 0 && !this.spokeSinceFinal) {
      this.silentTurns.push({
        atSeq: this.seq,
        toolsInTurn: [...this.toolsSinceFinal],
        detail: `turn ended after tool(s) [${this.toolsSinceFinal.join(', ')}] with NO spoken continuation`,
      })
    }
    this.toolsSinceFinal = []
    this.spokeSinceFinal = false
    this.speaking = false
  }

  /** A free-text note (e.g. an error). */
  note(text: string): void { this.add('note', { text }) }

  silentTurnCount(): number { return this.silentTurns.length }
  truncationCount(): number { return this.truncations.length }

  toExport(): TraceExport {
    return { startedAt: this.startWall, entries: [...this.entries], silentTurns: [...this.silentTurns], truncations: [...this.truncations] }
  }

  /** A downloadable, human-readable trace: my speech, her speech, every tool call. */
  toText(): string {
    const lines: string[] = []
    lines.push('# Abu live session trace', '')
    for (const e of this.entries) {
      const ts = `[${(e.t / 1000).toFixed(1)}s]`
      if (e.kind === 'user_speech') lines.push(`${ts} 👤 מרטיטה: ${e.text ?? ''}`)
      else if (e.kind === 'abu_speech') lines.push(`${ts} 🤖 אבו: ${e.text ?? ''}`)
      else if (e.kind === 'tool_call') lines.push(`${ts} 🔧 ${e.tool}(${JSON.stringify(e.args ?? {})})`)
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
