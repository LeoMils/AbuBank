/*
 * Long-dictation state machine — ONE shared controller for message dictation,
 * replacing scattered timers. It fixes the "stops before the user finished"
 * defect: it tolerates natural pauses, restarts on an early Web-Speech `onend`
 * while the session is active, never discards partial speech, and finalizes only
 * on a long configurable silence or explicit user action ("סיימתי").
 *
 * The recognizer is INJECTED (createRecognizer) so this logic is fully unit-
 * testable in node with a fake; the browser adapter lives in the caller. The
 * TTS→STT transition is respected by the caller: it constructs the controller
 * only AFTER the spoken prompt ends, and `start()` adds a short ARMING
 * stabilization delay before it actually listens (so STT never hears the prompt).
 *
 * Transcript model (dedup-safe across restarts): a Web-Speech session's
 * `results` are cumulative FOR THAT SESSION. On each result we recompute this
 * session's final+interim; on `onend` we fold this session's final into `base`
 * and start a fresh recognizer. Total transcript = base + sessionFinal + interim.
 * A new recognizer's results are new speech, so restarts never duplicate.
 */

export type DictationState =
  | 'IDLE' | 'PROMPTING' | 'ARMING' | 'LISTENING'
  | 'PAUSED_OR_RESTARTING' | 'FINALIZING' | 'COMPOSING' | 'HANDOFF'
  | 'ERROR' | 'CANCELLED'

export interface SpeechSegment { transcript: string; isFinal: boolean }

/** Minimal recognizer contract the controller drives (browser adapter or fake). */
export interface Recognizer {
  start(): void
  abort(): void
  onresult: ((segments: SpeechSegment[]) => void) | null
  onend: (() => void) | null
  onerror: ((error: string) => void) | null
}

export interface DictationOptions {
  mode: 'short' | 'long'
  createRecognizer: () => Recognizer
  /** ms of continuous silence that ends dictation. Defaults: short 1400 / long 7000. */
  silenceMs?: number
  /** post-prompt stabilization before listening (never hear the TTS tail). */
  armDelayMs?: number
  onState?: (s: DictationState) => void
  /** live accumulated transcript (base + session final + interim). */
  onTranscript?: (fullText: string) => void
  /** called once with the final transcript on silence/user finalize. */
  onFinal?: (text: string) => void
  onError?: (msg: string) => void
}

function join(...parts: string[]): string {
  return parts.map((p) => p.trim()).filter((p) => p.length > 0).join(' ')
}

export class DictationController {
  state: DictationState = 'IDLE'
  private rec: Recognizer | null = null
  private base = ''          // finalized text folded from PRIOR recognizer sessions
  private sessionFinal = ''  // final text from the CURRENT session
  private interim = ''       // current (un-finalized) interim
  private active = false     // true between start() and finalize()/cancel()
  private silenceTimer: ReturnType<typeof setTimeout> | null = null
  private armTimer: ReturnType<typeof setTimeout> | null = null

  constructor(private opts: DictationOptions) {}

  /** base + this session's final + interim — never loses committed speech. */
  get transcript(): string { return join(this.base, this.sessionFinal, this.interim) }

  private get silenceMs(): number {
    return this.opts.silenceMs ?? (this.opts.mode === 'long' ? 7000 : 1400)
  }

  private setState(s: DictationState) {
    this.state = s
    this.opts.onState?.(s)
  }

  /** Begin a dictation session. Call AFTER any spoken prompt has finished. */
  start(): void {
    this.active = true
    this.base = ''; this.sessionFinal = ''; this.interim = ''
    this.setState('ARMING')
    if (this.armTimer) clearTimeout(this.armTimer)
    this.armTimer = setTimeout(() => this.beginListening(), this.opts.armDelayMs ?? 400)
  }

  private beginListening(): void {
    if (!this.active) return
    this.setState('LISTENING')
    this.startRecognizer()
    this.resetSilence()
  }

  private startRecognizer(): void {
    const rec = this.opts.createRecognizer()
    this.rec = rec
    rec.onresult = (segments) => this.onResult(segments)
    rec.onend = () => this.onEnd()
    rec.onerror = (err) => this.onErr(err)
    try { rec.start() } catch { this.onErr('start-failed') }
  }

  private onResult(segments: SpeechSegment[]): void {
    if (!this.active) return
    let fin = '', inter = ''
    for (const s of segments) {
      if (s.isFinal) fin = join(fin, s.transcript)
      else inter = join(inter, s.transcript)
    }
    this.sessionFinal = fin
    this.interim = inter
    this.opts.onTranscript?.(this.transcript)
    this.resetSilence() // speech happened → the message is not over
  }

  private onEnd(): void {
    this.rec = null
    if (!this.active) return
    // Early end (the engine stopped on a pause) — DO NOT finalize. Fold this
    // session's final into base and restart so the user can keep talking.
    this.base = join(this.base, this.sessionFinal, this.interim)
    this.sessionFinal = ''; this.interim = ''
    this.setState('PAUSED_OR_RESTARTING')
    this.opts.onTranscript?.(this.transcript)
    this.startRecognizer()
    this.setState('LISTENING')
    this.resetSilence()
  }

  private onErr(err: string): void {
    if (err === 'not-allowed' || err === 'service-not-allowed') {
      this.active = false
      this.teardown()
      this.setState('ERROR')
      this.opts.onError?.('צריך הרשאה למיקרופון. בדקי בהגדרות.')
      return
    }
    // Transient error (no-speech, network, aborted) — restart if still active.
    this.rec = null
    if (!this.active) return
    this.setState('PAUSED_OR_RESTARTING')
    this.startRecognizer()
    this.setState('LISTENING')
  }

  private resetSilence(): void {
    if (this.silenceTimer) clearTimeout(this.silenceTimer)
    this.silenceTimer = setTimeout(() => this.finalize(), this.silenceMs)
  }

  /** Explicit user completion ("סיימתי") — finalizes immediately. */
  finishByUser(): void { this.finalize() }

  private finalize(): void {
    if (!this.active) return
    this.active = false
    this.base = join(this.base, this.sessionFinal, this.interim)
    this.sessionFinal = ''; this.interim = ''
    this.teardown()
    this.setState('FINALIZING')
    this.opts.onFinal?.(this.base.trim())
  }

  /** Cancel: no final emitted, no stale pending transcript. */
  cancel(): void {
    this.active = false
    this.base = ''; this.sessionFinal = ''; this.interim = ''
    this.teardown()
    this.setState('CANCELLED')
  }

  /** Advance to composing/handoff (caller-driven, for state visibility). */
  toComposing(): void { this.setState('COMPOSING') }
  toHandoff(): void { this.setState('HANDOFF') }

  private teardown(): void {
    if (this.silenceTimer) { clearTimeout(this.silenceTimer); this.silenceTimer = null }
    if (this.armTimer) { clearTimeout(this.armTimer); this.armTimer = null }
    if (this.rec) { try { this.rec.abort() } catch { /* ignore */ } this.rec = null }
  }
}
