/*
 * GATE 6 — INJECTED-VOICE ↔ TYPED PARITY (end-to-end, deterministic).
 *
 * Bridges the two already-proven layers into one chain:
 *   injected SpeechRecognition events  →  DictationController final transcript
 *     →  runCognitiveTurn (THE SAME controller typed input uses)  →  decision.
 *
 * Proves: (a) the dictation layer reconstructs the intended utterance across
 * interim/final, an early onend+restart, and a mid-utterance correction WITHOUT
 * loss or duplication; and (b) the resulting decision is IDENTICAL to typing the
 * same words — typed/voice parity is real, not asserted.
 *
 * No network, no real recognizer — a FakeRecognizer injects events. Deterministic.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { DictationController, type Recognizer, type SpeechSegment } from '../../services/dictationController'
import { runCognitiveTurn, IDLE_RUNTIME } from './cognitiveRuntime'

const CTX = { messages: [] as Array<{ role: string; content: string }>, now: new Date('2026-07-31T10:00:00') }

/** Normalized decision — the parts that matter for routing parity. */
function decide(text: string) {
  const d = runCognitiveTurn(IDLE_RUNTIME, text, CTX)
  return { intent: d.intent, kind: d.whatsapp?.kind ?? null, target: d.whatsapp?.targetHebrew ?? null }
}

class FakeRec implements Recognizer {
  start(): void { /* no-op */ }
  abort(): void { /* no-op */ }
  onresult: ((segments: SpeechSegment[]) => void) | null = null
  onend: (() => void) | null = null
  onerror: ((error: string) => void) | null = null
  emit(segs: SpeechSegment[]): void { this.onresult?.(segs) }
  end(): void { this.onend?.() }
}

function makeCtrl(mode: 'short' | 'long' = 'long') {
  const recs: FakeRec[] = []
  let finalText: string | null = null
  const ctrl = new DictationController({
    mode,
    createRecognizer: () => { const r = new FakeRec(); recs.push(r); return r },
    onFinal: (t) => { finalText = t },
  })
  return { ctrl, recs, current: () => recs[recs.length - 1]!, getFinal: () => finalText }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('injected-voice → typed parity', () => {
  // The recipient/verb variants Leo would speak — each reconstructed by the
  // dictation layer must route exactly as the typed equivalent.
  const UTTERANCES = [
    'תתקשרי ללאו',
    'תתקשרי לליאו',
    'תשלחי ללאו הודעה שיביא מחר שניצלים בערב',
    'תשלחי לליאו הודעה שיביא שניצלים',
    'תכתבי למור שהפגישה מחר',
  ]

  it('a single injected final transcript decides identically to typing it', () => {
    for (const u of UTTERANCES) {
      const h = makeCtrl('long')
      h.ctrl.start(); vi.advanceTimersByTime(400)          // ARMING → LISTENING
      h.current().emit([{ transcript: u, isFinal: true }])
      vi.advanceTimersByTime(7000)                          // long silence → finalize
      expect(h.getFinal(), `dictation must preserve "${u}"`).toBe(u)
      expect(decide(h.getFinal()!), `voice vs typed parity for "${u}"`).toEqual(decide(u))
    }
  })

  it('interim-then-final yields the final utterance and the same decision', () => {
    const h = makeCtrl('long')
    h.ctrl.start(); vi.advanceTimersByTime(400)
    h.current().emit([{ transcript: 'תתקשרי למ', isFinal: false }])   // interim
    h.current().emit([{ transcript: 'תתקשרי למור', isFinal: true }])   // final
    vi.advanceTimersByTime(7000)
    expect(h.getFinal()).toBe('תתקשרי למור')
    expect(decide(h.getFinal()!)).toEqual(decide('תתקשרי למור'))
    expect(decide(h.getFinal()!).kind).toBe('call')
  })

  it('early onend + restart accumulates without loss or duplication, routes as WhatsApp', () => {
    const h = makeCtrl('long')
    h.ctrl.start(); vi.advanceTimersByTime(400)
    h.current().emit([{ transcript: 'תשלחי הודעה למור', isFinal: true }])
    h.current().end()                                        // early end → auto-restart
    expect(h.ctrl.state).toBe('LISTENING')
    h.current().emit([{ transcript: 'שיביא מחר שניצלים בערב', isFinal: true }])
    vi.advanceTimersByTime(7000)
    const T = h.getFinal()!
    expect(T).toContain('שניצלים')                           // second half not lost
    expect(T.match(/הודעה/g)?.length ?? 0).toBe(1)           // first half not duplicated
    const dv = decide(T)
    expect(dv.intent).toBe('whatsapp')
    expect(dv.kind).toBe('compose')
    // Parity: the same full sentence typed decides the same way.
    expect(dv).toEqual(decide('תשלחי הודעה למור שיביא מחר שניצלים בערב'))
  })

  it('a mid-utterance correction across a restart stays a WhatsApp compose', () => {
    const h = makeCtrl('long')
    h.ctrl.start(); vi.advanceTimersByTime(400)
    h.current().emit([{ transcript: 'תשלחי למור שיבוא בארבע', isFinal: true }])
    h.current().end()
    h.current().emit([{ transcript: 'סליחה בחמש', isFinal: true }])
    vi.advanceTimersByTime(7000)
    const T = h.getFinal()!
    expect(T).toContain('חמש')
    const dv = decide(T)
    expect(dv.intent).toBe('whatsapp')                       // never falls to general/Calendar
    expect(dv.kind).toBe('compose')
    expect(dv).toEqual(decide(T))                            // stable
  })
})
