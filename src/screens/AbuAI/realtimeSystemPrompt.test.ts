import { describe, it, expect } from 'vitest'
import { buildAbuRealtimeSystemPrompt, StyleLedger } from './realtimeSystemPrompt'

describe('production Realtime system prompt (§6) — conversational intelligence', () => {
  const p = buildAbuRealtimeSystemPrompt()
  it('has the required §6 sections', () => {
    for (const s of ['זהות', 'התנהגות עיקרית', 'דפוסים רובוטיים', 'תיקון טבעי', 'אינטליגנציה בתוכן', 'סגנון קול', 'חזרתיות', 'אמת וכלים']) {
      expect(p, s).toContain(s)
    }
  })
  it('instructs natural context-first repair (not a canned retry)', () => {
    expect(p).toContain('הסיקי מההקשר')
    expect(p).toContain('הבנתי שאת רוצה')            // the preferred natural-repair example
  })
  it('names the forbidden robotic phrases to avoid by default', () => {
    for (const bad of ['לא הבנתי', 'אני פה כדי לעזור', 'תפרטי קצת יותר', 'ננסה שוב']) expect(p).toContain(bad)
  })
  it('encodes truth + relationship + routing guardrails', () => {
    expect(p).toContain('אח של מור')                 // unresolved relationship stays unresolved
    expect(p).toContain('כוונת יומן לעולם לא הופכת לשיחת טלפון')
    expect(p).toContain('ברכה אחת בלבד')             // greeting-once
    expect(p).toMatch(/אל תטעני ששלחת|רק מכינה/)     // never claims completion
  })
})

describe('StyleLedger (§6G) — style-only repetition control, not a second brain', () => {
  it('flags a recently-used style token and bounds its memory', () => {
    const l = new StyleLedger(3)
    l.note('greet:boker'); expect(l.isRepetitive('greet:boker')).toBe(true)
    l.note('apol:sorry'); l.note('open:rega'); l.note('close:here')  // evicts greet:boker (cap 3)
    expect(l.isRepetitive('greet:boker')).toBe(false)
    expect(l.snapshot().length).toBe(3)
  })
})
