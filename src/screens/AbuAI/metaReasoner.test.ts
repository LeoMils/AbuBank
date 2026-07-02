/*
 * Meta Reasoner — locks the mission's Phase-2 named inputs.
 */
import { describe, it, expect } from 'vitest'
import { metaReason } from './metaReasoner'
import { IDLE_RUNTIME } from './cognitiveRuntime'

describe('Meta Reasoner understands the actual question', () => {
  it('"מה ליאו עבור אופיר" → family, directional subject/target', () => {
    const m = metaReason('מה ליאו עבור אופיר')
    expect(m.domain).toBe('family')
    expect(m.subject).toBe('ליאו')
    expect(m.target).toBe('אופיר')
  })
  it('"מה הקשר בין רפי ללאו" → family subject רפי target לאו', () => {
    const m = metaReason('מה הקשר בין רפי ללאו')
    expect(m.domain).toBe('family')
    expect(m.subject).toBe('רפי'); expect(m.target).toBe('לאו')
  })
  it('"מי זה ירדן עבור אנאבל" → family (skips "זה")', () => {
    const m = metaReason('מי זה ירדן עבור אנאבל')
    expect(m.subject).toBe('ירדן'); expect(m.target).toBe('אנאבל')
  })
  it('"מתי יש לי פגישה עם מוטי" → calendar_search, NEVER "באיזה יום"', () => {
    const m = metaReason('מתי יש לי פגישה עם מוטי')
    expect(m.intent).toBe('calendar_search')
    expect(m.clarificationQuestion).not.toBe('באיזה יום?')
    expect(m.target).toBe('מוטי')
  })
  it('"תקבעי לי פגישה עם דני מחר בעשר" → calendar_create with entities', () => {
    const m = metaReason('תקבעי לי פגישה עם דני מחר בעשר')
    expect(m.intent).toBe('calendar_create')
    expect(m.entities['who']).toBe('דני')
  })
  it('"כן כן כן" with a pending draft → confirmation', () => {
    const pending = { ...IDLE_RUNTIME, createState: { ...IDLE_RUNTIME.createState, phase: 'confirming' as const } }
    expect(metaReason('כן כן כן', pending).domain).toBe('confirmation')
  })
  it('"תמשיכי" → continuation', () => {
    expect(metaReason('תמשיכי').domain).toBe('continuation')
  })
  it('"לא שמעתי" → audio', () => {
    expect(metaReason('לא שמעתי').domain).toBe('audio')
  })
  it('"את לא עונה למה ששאלתי" → frustration', () => {
    expect(metaReason('את לא עונה למה ששאלתי').domain).toBe('frustration')
  })
  it('"מה יש לי היום ומה מחר" → calendar', () => {
    expect(metaReason('מה יש לי היום ומה מחר').domain).toBe('calendar')
  })
})
