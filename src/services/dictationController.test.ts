import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { DictationController, type Recognizer, type SpeechSegment, type DictationState, type DictationOptions } from './dictationController'

// A fake recognizer the test drives. Each start() is a new "session" whose
// results are cumulative for that session (mirrors Web Speech).
class FakeRecognizer implements Recognizer {
  onresult: ((s: SpeechSegment[]) => void) | null = null
  onend: (() => void) | null = null
  onerror: ((e: string) => void) | null = null
  started = false
  aborted = false
  start() { this.started = true }
  abort() { this.aborted = true }
  emit(segs: SpeechSegment[]) { this.onresult?.(segs) }
  end() { this.onend?.() }
  err(e: string) { this.onerror?.(e) }
}

function make(mode: 'short' | 'long', extra: Partial<DictationOptions> = {}) {
  const recs: FakeRecognizer[] = []
  const states: DictationState[] = []
  let finalText: string | null = null
  const ctrl = new DictationController({
    mode,
    silenceMs: mode === 'long' ? 7000 : 1400,
    armDelayMs: 400,
    createRecognizer: () => { const r = new FakeRecognizer(); recs.push(r); return r },
    onState: (s) => states.push(s),
    onFinal: (t) => { finalText = t },
    ...extra,
  })
  return { ctrl, recs, states, current: () => recs[recs.length - 1]!, getFinal: () => finalText }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('DictationController — arming & TTS→STT transition', () => {
  it('(8) does not listen until the arm delay elapses (STT never hears the prompt tail)', () => {
    const h = make('long')
    h.ctrl.start()
    expect(h.ctrl.state).toBe('ARMING')
    expect(h.recs.length).toBe(0)         // recognizer NOT started yet
    vi.advanceTimersByTime(399)
    expect(h.recs.length).toBe(0)
    vi.advanceTimersByTime(1)
    expect(h.ctrl.state).toBe('LISTENING')
    expect(h.recs.length).toBe(1)
    expect(h.current().started).toBe(true)
  })
})

describe('DictationController — long dictation tolerates pauses', () => {
  it('(5,6) a short silence does NOT end the message; long silence finalizes', () => {
    const h = make('long')
    h.ctrl.start(); vi.advanceTimersByTime(400)
    h.current().emit([{ transcript: 'שלום מה', isFinal: true }])
    vi.advanceTimersByTime(3000)                 // natural pause < 7000
    expect(h.ctrl.state).toBe('LISTENING')       // still listening
    expect(h.getFinal()).toBeNull()
    h.current().emit([{ transcript: 'שלום מה שלומך היום', isFinal: true }])
    vi.advanceTimersByTime(7000)                 // long silence → finalize
    expect(h.ctrl.state).toBe('FINALIZING')
    expect(h.getFinal()).toBe('שלום מה שלומך היום')
  })
})

describe('DictationController — early onend restart (no loss, no dup)', () => {
  it('(6,7) restarts on an early end and preserves + does not duplicate the transcript', () => {
    const h = make('long')
    h.ctrl.start(); vi.advanceTimersByTime(400)
    h.current().emit([{ transcript: 'שלום', isFinal: true }])
    h.current().end()                            // early end mid-session
    expect(h.ctrl.state).toBe('LISTENING')       // auto-restarted
    expect(h.recs.length).toBe(2)                // a fresh recognizer
    expect(h.ctrl.transcript).toBe('שלום')       // preserved across restart
    h.current().emit([{ transcript: 'מה שלומך', isFinal: true }]) // new session speech
    h.ctrl.finishByUser()
    expect(h.getFinal()).toBe('שלום מה שלומך')    // joined, not duplicated
  })

  it('interim speech is preserved when the engine ends before finalizing it', () => {
    const h = make('long')
    h.ctrl.start(); vi.advanceTimersByTime(400)
    h.current().emit([{ transcript: 'בוא נאכל', isFinal: false }]) // only interim
    h.current().end()
    expect(h.ctrl.transcript).toBe('בוא נאכל')    // interim folded into base, not lost
  })
})

describe('DictationController — explicit completion, cancel', () => {
  it('(9) "סיימתי" finalizes immediately with the accumulated transcript', () => {
    const h = make('long')
    h.ctrl.start(); vi.advanceTimersByTime(400)
    h.current().emit([{ transcript: 'תודה רבה', isFinal: true }])
    h.ctrl.finishByUser()
    expect(h.ctrl.state).toBe('FINALIZING')
    expect(h.getFinal()).toBe('תודה רבה')
  })

  it('(10) cancel emits no final and leaves no stale transcript', () => {
    const h = make('long')
    h.ctrl.start(); vi.advanceTimersByTime(400)
    h.current().emit([{ transcript: 'משהו', isFinal: true }])
    h.ctrl.cancel()
    expect(h.ctrl.state).toBe('CANCELLED')
    expect(h.getFinal()).toBeNull()
    expect(h.ctrl.transcript).toBe('')
    expect(h.current().aborted).toBe(true)
  })
})

describe('DictationController — endpointing differs by mode', () => {
  it('short mode finalizes on a shorter silence than long mode', () => {
    const shortH = make('short')
    shortH.ctrl.start(); vi.advanceTimersByTime(400)
    shortH.current().emit([{ transcript: 'מור', isFinal: true }])
    vi.advanceTimersByTime(1400)
    expect(shortH.ctrl.state).toBe('FINALIZING')
    expect(shortH.getFinal()).toBe('מור')

    const longH = make('long')
    longH.ctrl.start(); vi.advanceTimersByTime(400)
    longH.current().emit([{ transcript: 'מור', isFinal: true }])
    vi.advanceTimersByTime(1400)
    expect(longH.ctrl.state).toBe('LISTENING') // long mode still open
  })
})

describe('DictationController — permission error is terminal', () => {
  it('not-allowed → ERROR, no restart', () => {
    let errMsg = ''
    const h = make('long', { onError: (m: string) => { errMsg = m } })
    h.ctrl.start(); vi.advanceTimersByTime(400)
    h.current().err('not-allowed')
    expect(h.ctrl.state).toBe('ERROR')
    expect(h.recs.length).toBe(1) // did NOT restart
    expect(errMsg).toContain('הרשאה')
  })
})
