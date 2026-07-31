/*
 * Multi-turn communication ownership (real device regression).
 * An explicit communication command OWNS the conversation; bare follow-ups refine
 * the SAME message and never spawn a calendar draft; "לא פגישה" corrects INTO a
 * message; evening times are never turned into morning inside a message.
 * Deterministic (runCognitiveTurn), synthetic — no real contacts.
 */
import { describe, it, expect } from 'vitest'
import { runCognitiveTurn, IDLE_RUNTIME, type RuntimeState } from './cognitiveRuntime'
import { IDLE_STATE } from './calendarCreate'

const CTX = { messages: [] as Array<{ role: string; content: string }>, now: new Date('2026-07-31T10:00:00') }
const run = (state: RuntimeState, text: string) => runCognitiveTurn(state, text, CTX)

describe('communication ownership — single utterance', () => {
  it('"לא פגישה. תשלח הודעה ללאו" corrects INTO a message (not calendar)', () => {
    const d = run(IDLE_RUNTIME, 'לא פגישה. תשלח הודעה ללאו')
    expect(d.intent).toBe('whatsapp')
    expect(d.whatsapp?.kind).toBe('compose')
    expect(d.whatsapp?.targetHebrew).toBe('לאו')
  })
  it('"תשלח וואטסאפ ללאו שיביא היום בערב יין" is a message that keeps its facts', () => {
    const d = run(IDLE_RUNTIME, 'תשלח וואטסאפ ללאו שיביא היום בערב יין לארוחת ערב')
    expect(d.intent).toBe('whatsapp')
    expect(d.whatsapp?.command?.intent).toMatch(/יין/)
    expect(d.whatsapp?.command?.intent).toMatch(/בערב/)   // evening stays evening
  })
  it('an explicit command clears a stale calendar draft (mid-draft override)', () => {
    const withDraft: RuntimeState = { ...IDLE_RUNTIME, createState: { ...IDLE_STATE, phase: 'confirming' } }
    const d = run(withDraft, 'תשלח הודעה ללאו')
    expect(d.intent).toBe('whatsapp')
    expect(d.state.createState.phase).toBe('idle')        // stale draft cleared
  })
})

describe('communication ownership — multi-turn refinement', () => {
  it('bare follow-ups update the SAME message and never create a calendar draft', () => {
    let s = IDLE_RUNTIME
    const d1 = run(s, 'תכתבי למור שהפגישה מחר')
    expect(d1.intent).toBe('whatsapp')
    expect(d1.state.pendingCommunication).toBeTruthy()
    s = d1.state

    const d2 = run(s, 'בשמונה וחצי')                       // time refinement
    expect(d2.intent).toBe('whatsapp')
    expect(d2.whatsapp?.command?.intent).toMatch(/שמונה/)
    expect(d2.state.createState.phase).toBe('idle')       // no calendar draft
    s = d2.state

    const d3 = run(s, 'תעשי מצחיק')                        // style refinement
    expect(d3.intent).toBe('whatsapp')
    expect(d3.whatsapp?.command?.style).toBe('funny')
    s = d3.state

    const d4 = run(s, 'בערב')                              // time-of-day refinement
    expect(d4.intent).toBe('whatsapp')
  })

  it('a real, unrelated question after a message ends the pending communication', () => {
    const d1 = run(IDLE_RUNTIME, 'תכתבי למור שהפגישה מחר')
    const d2 = run(d1.state, 'מה השעה עכשיו')
    // Not hijacked into a message refinement.
    expect(d2.intent).not.toBe('whatsapp')
  })
})

describe('EXACT real-device conversation (the original failure)', () => {
  it('every turn owns communication; calendar never activates', () => {
    let s = IDLE_RUNTIME
    const seq = ['תשלח הודעה ללאו', 'שיבוא היום בערב', 'עם יין', 'לא פגישה', 'בשמונה וחצי']
    let last: ReturnType<typeof run> | null = null
    for (const t of seq) {
      const d = run(s, t)
      expect(d.intent, `"${t}"`).toBe('whatsapp')
      expect(d.state.createState.phase, `"${t}" must not create a calendar draft`).toBe('idle')
      s = d.state; last = d
    }
    const msg = last!.whatsapp?.command?.intent ?? ''
    expect(msg).toMatch(/יין/)          // "עם יין" kept
    expect(msg).toMatch(/בערב/)         // evening kept
    expect(msg).toMatch(/שמונה/)        // "בשמונה וחצי" part of the message
    expect(msg).not.toMatch(/פגישה/)    // "לא פגישה" did NOT inject a meeting word

    const call = run(s, 'תתקשר למור')
    expect(call.intent).toBe('whatsapp')
    expect(call.whatsapp?.kind).toBe('call')
  })
})

describe('calendar still works, evening stays evening', () => {
  it('a real "תקבעי פגישה…" stays calendar', () => {
    const d = run(IDLE_RUNTIME, 'תקבעי פגישה עם מור מחר בשלוש')
    expect(d.intent).not.toBe('whatsapp')
  })
  it('a message mentioning "שמונה וחצי בערב" keeps the time in the message (no morning)', () => {
    const d = run(IDLE_RUNTIME, 'תכתבי למור שהפגישה מחר בשמונה וחצי בערב')
    expect(d.intent).toBe('whatsapp')
    expect(d.whatsapp?.command?.intent).toMatch(/שמונה/)
    expect(d.whatsapp?.command?.intent).toMatch(/בערב/)
  })
})
