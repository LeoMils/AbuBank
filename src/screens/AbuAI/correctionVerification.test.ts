/*
 * P7 · correction-verification. A factual correction of a prior ONLINE answer
 * re-triggers the search (verify before agreeing); the mock online tool is the
 * proof it re-searched instead of just chatting. Real retrieval quality = PREVIEW.
 */
import { describe, it, expect } from 'vitest'
import { isFactualCorrection, shouldReverifyOnline } from './correctionVerification'
import { runFullTurn, type FullTurnTools } from './runtimeFullTurn'
import { IDLE_RUNTIME, type RuntimeState, type RuntimeContext } from './cognitiveRuntime'

describe('P7 · isFactualCorrection', () => {
  it('detects truth-corrections', () => {
    for (const t of ['לא נכון', 'טעית', 'את טועה', 'בעצם זה לא ככה', 'זה לא מדויק', 'זו טעות']) {
      expect(isFactualCorrection(t)).toBe(true)
    }
  })
  it('a plain "no / cancel" is NOT a factual correction', () => {
    expect(isFactualCorrection('לא')).toBe(false)
    expect(isFactualCorrection('לא תודה')).toBe(false)
  })
  it('shouldReverifyOnline only fires on an online focus + a correction', () => {
    expect(shouldReverifyOnline('לא נכון', { kind: 'online', label: 'מזג האוויר מחר' })).toEqual({ reverify: true, topic: 'מזג האוויר מחר' })
    expect(shouldReverifyOnline('לא נכון', { kind: 'calendar_event', label: 'מור' }).reverify).toBe(false)
    expect(shouldReverifyOnline('כן תודה', { kind: 'online', label: 'x' }).reverify).toBe(false)
  })
})

describe('P7 live · a correction after an online answer RE-SEARCHES (never blind-agrees)', () => {
  const ctx: RuntimeContext = { messages: [{ role: 'assistant', content: 'מחר יהיה 30 מעלות.' }], now: new Date('2026-07-20T09:00:00Z') }
  const onlineFocus: RuntimeState = { ...IDLE_RUNTIME, focus: { kind: 'online', label: 'מזג האוויר מחר בכפר סבא' } }

  it('re-runs the online tool with the focus topic', async () => {
    const queries: string[] = []
    const tools: FullTurnTools = {
      llm: async () => 'את צודקת, סליחה.', // the WRONG (blind-agree) path — must NOT be used
      online: async (q) => { queries.push(q); return { ok: true, answer: 'בדקתי שוב: מחר 28 מעלות.' } },
    }
    const r = await runFullTurn(onlineFocus, 'לא נכון, בדקי שוב', ctx, tools)
    expect(queries).toContain('מזג האוויר מחר בכפר סבא') // it re-searched
    expect(r.source).toBe('online')
    expect(r.display).not.toContain('את צודקת') // did not blind-agree
  })

  it('without an online focus, a correction does not force a search', async () => {
    const queries: string[] = []
    const tools: FullTurnTools = {
      llm: async () => 'טוב.',
      online: async (q) => { queries.push(q); return { ok: true, answer: 'x' } },
    }
    await runFullTurn(IDLE_RUNTIME, 'לא נכון', ctx, tools)
    expect(queries.length).toBe(0)
  })
})
