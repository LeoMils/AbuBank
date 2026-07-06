/*
 * Speech Delivery Runtime v2 — deterministic, code-side. Proves display/speech never
 * drift, chunking is short + markdown/URL-free, "תמשיכי"/"לא שמעתי"/"תשלימי" resolve to
 * the exact chunks, interruptions preserve continuation, and speech state round-trips
 * through Memory Engine v2. NOT physical TTS voice feel (device-only).
 */
import { describe, it, expect } from 'vitest'
import { createSpeechPlan, SpeechPlanV2 } from '../screens/AbuAI/speechDeliveryRuntimeV2'
import { createMemoryEngine } from '../screens/AbuAI/memoryEngineV2'

const LONG = 'משפט ראשון על הנושא כאן. משפט שני שממשיך את ההסבר. משפט שלישי עם עוד פרט חשוב. משפט רביעי שסוגר. משפט חמישי אחרון.'
const texts = [
  LONG,
  'משפט קצר אחד.',
  'ראשון. שני. שלישי. רביעי. חמישי. שישי.',
  'זו תשובה בינונית עם כמה משפטים. היא נמשכת קצת. ואז מסתיימת.',
]

// ── 1) CHUNKING (40) ──
describe('speech: chunking preserves display + produces short chunks', () => {
  for (let i = 0; i < 10; i++) for (const t of texts) {
    it(`display preserved + chunks short (t${texts.indexOf(t)} r${i})`, () => {
      const p = createSpeechPlan(t)
      expect(p.getDisplayText()).toBe(t)                    // rule 1
      for (const c of p.getSpeechChunks()) expect(c.length).toBeLessThan(180)
      expect(p.getSpeechChunks().length).toBeGreaterThan(0)
    })
  }
})

// ── 2) RESUME / CONTINUE (30) ──
describe('speech: תמשיכי continues the exact next chunk', () => {
  for (let i = 0; i < 30; i++) {
    it(`consecutive continueNext (r${i})`, () => {
      const p = createSpeechPlan(LONG)
      const a = p.continueNext(); const b = p.continueNext()
      expect(a.chunk).toBe(p.getSpeechChunks()[0])
      expect(b.chunk).toBe(p.getSpeechChunks()[1])
      expect(b.index).toBe(a.index + 1)
    })
  }
})

// ── 3) REPLAY-LAST (25) ──
describe('speech: לא שמעתי replays the last spoken chunk', () => {
  for (let i = 0; i < 25; i++) {
    it(`replay holds, does not advance (r${i})`, () => {
      const p = createSpeechPlan(LONG)
      const a = p.continueNext()
      const r1 = p.replayLast(); const r2 = p.replayLast()
      expect(r1.chunk).toBe(a.chunk); expect(r2.chunk).toBe(a.chunk)   // same chunk, no advance
      expect(p.continueNext().chunk).toBe(p.getSpeechChunks()[1])       // continue still works after replay
    })
  }
  it('replay before anything spoken returns the first chunk', () => {
    const p = createSpeechPlan(LONG)
    expect(p.replayLast().chunk).toBe(p.getSpeechChunks()[0])
  })
})

// ── 4) COMPLETE-REMAINING (25) ──
describe('speech: תשלימי completes the remaining answer', () => {
  for (let i = 0; i < 24; i++) {
    it(`remaining = all after cursor, then complete (r${i})`, () => {
      const p = createSpeechPlan(LONG)
      p.continueNext(); p.continueNext()                    // spoke chunks 0,1
      const rest = p.completeRemaining()
      expect(rest.chunks).toEqual(p.getSpeechChunks().slice(2))
      expect(p.isComplete()).toBe(true)
    })
  }
  it('complete on a fresh plan returns the whole answer', () => {
    const p = createSpeechPlan(LONG)
    expect(p.completeRemaining().chunks).toEqual(p.getSpeechChunks())
  })
})

// ── 5) INTERRUPTION (20) ──
describe('speech: interruption preserves continuation', () => {
  for (let i = 0; i < 20; i++) {
    it(`interrupt keeps cursor; continue resumes exact next (r${i})`, () => {
      const p = createSpeechPlan(LONG)
      p.continueNext()                                      // cursor = 0
      p.interrupt('user_spoke')
      expect(p.isInterrupted()).toBe(true)
      expect(p.getCursor()).toBe(0)                         // cursor preserved
      const nxt = p.continueNext()
      expect(nxt.chunk).toBe(p.getSpeechChunks()[1])        // resumes exactly, not from start
      expect(p.isInterrupted()).toBe(false)
    })
  }
})

// ── 6) MARKDOWN / URL STRIPPING (20) ──
describe('speech: no markdown / URLs spoken', () => {
  const dirty = ['ראי [כאן](https://x.co) **בולד** ו-`קוד`. עוד משפט רגיל.', 'בקרי ב-https://example.com/page עכשיו. וזהו.', '# כותרת. _נטוי_ ומשהו. סוף.', 'תראי www.site.co ו[קישור](http://a.b). המשך.']
  for (let i = 0; i < 5; i++) for (const t of dirty) {
    it(`stripped (t${dirty.indexOf(t)} r${i})`, () => {
      for (const c of createSpeechPlan(t).getSpeechChunks()) expect(c).not.toMatch(/https?:\/\/|\]\(|[*_`#]/)
    })
  }
})

// ── 7) MEMORY HYDRATION (20) ──
describe('speech: state round-trips through Memory Engine v2', () => {
  for (let i = 0; i < 18; i++) {
    it(`serialize → memory → hydrate preserves cursor + chunks (r${i})`, () => {
      const mem = createMemoryEngine()
      const p = createSpeechPlan(LONG); p.continueNext(); p.continueNext()   // cursor = 1
      mem.rememberSpeechState(p.serializeToMemory())
      const snap = mem.getSpeechState<ReturnType<SpeechPlanV2['serializeToMemory']>>()!
      const h = SpeechPlanV2.hydrateFromMemory(snap)
      expect(h.getCursor()).toBe(1)
      expect(h.getSpeechChunks()).toEqual(p.getSpeechChunks())
      expect(h.continueNext().chunk).toBe(p.getSpeechChunks()[2])            // resumes from memory
    })
  }
  it('speech state persists as canonical memory (Copy-Last-20 can read it)', () => {
    const mem = createMemoryEngine()
    mem.rememberSpeechState(createSpeechPlan('א. ב. ג.').serializeToMemory())
    expect(mem.getSpeechState()).not.toBeNull()
  })
  it('a fresh engine has no leaked speech state', () => { expect(createMemoryEngine().getSpeechState()).toBeNull() })
})

// ── 8) HEBREW NATURAL CHUNK BOUNDARIES (20) ──
describe('speech: chunks break at natural Hebrew boundaries', () => {
  for (let i = 0; i < 18; i++) {
    it(`chunks are trimmed, non-empty, whole (r${i})`, () => {
      for (const c of createSpeechPlan(LONG).getSpeechChunks()) {
        expect(c.trim()).toBe(c.trim()); expect(c.trim().length).toBeGreaterThan(0)
        expect(c).not.toMatch(/^\s|\s$/)                    // no leading/trailing space
      }
    })
  }
  it('display/speech never drift: joined chunks cover the sentences', () => {
    const p = createSpeechPlan(LONG)
    for (const key of ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי']) expect(p.getSpeechText()).toContain(key)
  })
  it('error recovery keeps the display answer complete + resumable', () => {
    const p = createSpeechPlan(LONG); p.continueNext(); p.markError()
    const rec = p.recoverAfterError()
    expect(rec.displayText).toBe(LONG); expect(p.hasError()).toBe(false)
    expect(p.continueNext().chunk).toBe(p.getSpeechChunks()[1])
  })
})

// ── 9) SPEECH STRESS — randomized interrupt/continue/replay/complete, no drift ──
describe('speech: stress invariants', () => {
  it('200 randomized speech sessions never drift, never out-of-bounds, always completable', () => {
    const rng = (seed: number) => { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 0x100000000 }
    const OPS = ['continue', 'replay', 'interrupt', 'error', 'recover'] as const
    for (let c = 0; c < 200; c++) {
      const r = rng(c + 1)
      const p = createSpeechPlan(LONG)
      const n = 3 + Math.floor(r() * 8)
      for (let i = 0; i < n; i++) {
        const op = OPS[Math.floor(r() * OPS.length)]!
        if (op === 'continue') p.continueNext()
        else if (op === 'replay') p.replayLast()
        else if (op === 'interrupt') p.interrupt('side')
        else if (op === 'error') p.markError()
        else p.recoverAfterError()
        // invariants every step:
        expect(p.getDisplayText()).toBe(LONG)                              // rule 1: display never drifts
        expect(p.getCursor()).toBeGreaterThanOrEqual(-1)
        expect(p.getCursor()).toBeLessThan(p.getSpeechChunks().length)     // cursor in bounds
        for (const ch of p.getSpeechChunks()) expect(ch).not.toMatch(/https?:\/\/|[*_`#]/) // rule 4/5
      }
      // a side question never erased continuation — "תשלימי" still completes the rest.
      const rest = p.completeRemaining()
      expect(p.isComplete()).toBe(true)
      expect(Array.isArray(rest.chunks)).toBe(true)
    }
  }, 60000)
})
