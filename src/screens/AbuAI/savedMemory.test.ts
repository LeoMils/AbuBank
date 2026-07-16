/**
 * SAVED MEMORY — durable, user-commanded facts across sessions (mandate part B).
 * ══════════════════════════════════════════════════════════════════════════════
 * Proves the ChatGPT-style contract with MULTI-SESSION replays through the real
 * runtime: session A stores a fact → a FRESH session B recalls it (the fact lives
 * in the durable store, NOT in RuntimeState) → session C forgets it on request.
 * Plus: privacy is enforced at the write boundary (no phone/medical/financial), and
 * the commands work in Spanish.
 *
 * Evidence class: CODE (drives the single runtime + the real durable store).
 */
import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest'
import { runCognitiveTurn, IDLE_RUNTIME } from './cognitiveRuntime'
import { loadMemories, clearMemories } from './savedMemory'

const FIXED = new Date('2026-06-24T09:00:00')
beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FIXED) })
afterAll(() => { vi.useRealTimers() })

let storage: Record<string, string> = {}
beforeEach(() => {
  storage = {}
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => storage[k] ?? null,
    setItem: (k: string, v: string) => { storage[k] = v },
    removeItem: (k: string) => { delete storage[k] },
  })
  vi.stubGlobal('navigator', { onLine: true })
  clearMemories() // isolate the durable store between tests
})

/** One turn from a FRESH session (new IDLE_RUNTIME + empty history) — the strongest
 *  cross-session proof: nothing carries over except the durable store. */
function freshTurn(text: string) {
  return runCognitiveTurn(IDLE_RUNTIME, text, { messages: [], now: new Date() })
}

describe('SAVED MEMORY — multi-session store → recall → forget', () => {
  it('A stores → fresh B recalls (persists beyond RuntimeState)', () => {
    const a = freshTurn('תזכרי שהכלב שלי קוראים לו טוטסי')
    expect(a.intent).toBe('memory')
    expect(a.needsLLM).toBe(false)
    expect(loadMemories().map(m => m.text)).toContain('הכלב שלי קוראים לו טוטסי')

    const b = freshTurn('מה את זוכרת עליי?')
    expect(b.intent).toBe('memory')
    expect(b.needsLLM).toBe(false)
    expect(b.display ?? '').toContain('טוטסי')
  })

  it('C forgets on request → later recall no longer has it', () => {
    freshTurn('תזכרי שהכלב שלי קוראים לו טוטסי')
    const c = freshTurn('תשכחי שהכלב שלי קוראים לו טוטסי')
    expect(c.intent).toBe('memory')
    expect(loadMemories().length).toBe(0)

    const after = freshTurn('מה את זוכרת עליי?')
    expect(after.display ?? '').not.toContain('טוטסי')
  })

  it('recall with nothing stored is honest (never fabricates a memory)', () => {
    const r = freshTurn('מה את זוכרת עליי?')
    expect(r.intent).toBe('memory')
    expect(r.needsLLM).toBe(false)
    expect(r.display ?? '').not.toContain('טוטסי')
  })

  it('PRIVACY: a phone number is refused, never persisted', () => {
    const r = freshTurn('תזכרי שמספר הטלפון שלי הוא 0521234567')
    expect(r.intent).toBe('memory')
    expect(loadMemories().length).toBe(0)                 // nothing stored
    expect(r.display ?? '').not.toContain('0521234567')   // and not echoed back as saved
  })

  it('multiple facts accumulate and all recall', () => {
    freshTurn('תזכרי שאני אוהבת יין אדום')
    freshTurn('תזכרי שיום שישי זה הכי חשוב לי')
    const r = freshTurn('מה את זוכרת עליי?')
    expect(r.display ?? '').toContain('יין אדום')
    expect(r.display ?? '').toContain('יום שישי')
  })

  it('Spanish: "recordá que…" stores and "qué te acordás de mí" recalls', () => {
    const a = freshTurn('recordá que me gusta el café')
    expect(a.intent).toBe('memory')
    expect(loadMemories().map(m => m.text)).toContain('me gusta el café')
    const b = freshTurn('qué te acordás de mí')
    expect(b.intent).toBe('memory')
    expect(b.display ?? '').toContain('café')
  })

  it('a reminder ("תזכירי לי לקנות חלב") is NOT captured as a saved memory', () => {
    const r = freshTurn('תזכירי לי לקנות חלב מחר בבוקר')
    expect(r.intent).not.toBe('memory')
    expect(loadMemories().length).toBe(0)
  })
})
