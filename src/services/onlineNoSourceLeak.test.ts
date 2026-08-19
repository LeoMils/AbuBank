/*
 * onlineNoSourceLeak.test.ts — the model can only cite what it is given.
 * ════════════════════════════════════════════════════════════════════════════
 * Reproduced on the device AND on the gpt-realtime harness: Abu named the websites
 * she "checked" (cinema → "מאתר סינמה סיטי ומאתר Seret.co.il"; price → store names).
 * Root cause was structural + self-inflicted: get_current_info handed the model a
 * `sources` array AND told it to "mention the source". This locks the fix: the
 * function_call_output the model receives carries NO sources, NO URL, and a
 * permitted-speech line that FORBIDS naming a source.
 */
import { describe, it, expect } from 'vitest'
import { LiveTools, scrubForSpeech, type OnlineFetch, type LiveCalendarStore, type LiveEvent } from './liveTools'
import type { ParsedFunctionCall } from '../screens/AbuAI/realtime/realtimeFunctionBridge'

function memStore(): LiveCalendarStore {
  const items: LiveEvent[] = []; let n = 0
  return { list: () => items.slice(), add: (e) => { const ev = { ...e, id: `e${++n}` }; items.push(ev); return ev }, update: (id, p) => { const i = items.findIndex((x) => x.id === id); if (i < 0) return null; items[i] = { ...items[i]!, ...p }; return items[i]! } }
}
function harness(online: OnlineFetch) {
  const sent: Array<Record<string, unknown>> = []
  const tools = new LiveTools((e) => sent.push(e), memStore(), {}, online)
  tools.handleFunctionCall({ name: 'get_current_info', callId: 'q', argsJson: JSON.stringify({ query: 'מה חדש?' }) } as ParsedFunctionCall)
  const output = () => {
    const item = sent.find((e) => e.type === 'conversation.item.create')?.item as { output?: string } | undefined
    return item?.output ?? ''
  }
  return { output }
}
const tick = () => new Promise((r) => setTimeout(r, 0))

describe('get_current_info — no source/URL ever reaches the model', () => {
  it('the model payload carries NO sources array and NO URL, even when the fetch returns them', async () => {
    const h = harness(async () => ({
      ok: true,
      answer: 'היום בכפר סבא מקרינים "דרדסים" ב-13:00. לפי [סינמה סיטי](https://cinema-city.co.il) ו-Seret.co.il.',
      sources: [{ title: 'סינמה סיטי כפר סבא', url: 'https://cinema-city.co.il' }, { url: 'https://m.seret.co.il' }],
    }))
    await tick()
    const raw = h.output()
    const parsed = JSON.parse(raw) as Record<string, unknown>
    expect(parsed.status).toBe('ok')
    // No sources key at all.
    expect('sources' in parsed).toBe(false)
    // No URL anywhere in what the model receives.
    expect(raw).not.toMatch(/https?:\/\//)
    expect(raw.toLowerCase()).not.toContain('seret.co.il')
    expect(raw).not.toContain('cinema-city.co.il')
    // The permitted-speech line forbids naming a source.
    expect(JSON.stringify(parsed.allowed_to_say)).toMatch(/never name a website|source/i)
    // The fact survives (the film + time).
    expect(String(parsed.answer)).toContain('דרדסים')
  })

  it('a no-result miss stays honest and sourceless', async () => {
    const h = harness(async () => ({ ok: false, userMessage: 'לא מצאתי' }))
    await tick()
    const parsed = JSON.parse(h.output()) as Record<string, unknown>
    expect(parsed.status).toBe('no_result')
    expect('sources' in parsed).toBe(false)
  })
})

describe('scrubForSpeech', () => {
  it('keeps link text, drops the URL', () => {
    expect(scrubForSpeech('לפי [סינמה סיטי](https://cinema-city.co.il) יש סרט')).toBe('לפי סינמה סיטי יש סרט')
  })
  it('removes bare URLs and www', () => {
    expect(scrubForSpeech('המחיר כאן https://shop.example/x או www.store.co.il היום')).not.toMatch(/https?:\/\/|www\./)
  })
  it('removes a trailing "מקור:" line', () => {
    expect(scrubForSpeech('31 מעלות בתל אביב.\nמקור: אתר מזג האוויר')).toBe('31 מעלות בתל אביב.')
  })
  it('leaves a clean fact untouched', () => {
    expect(scrubForSpeech('היום 24 מעלות ושמשי בכפר סבא.')).toBe('היום 24 מעלות ושמשי בכפר סבא.')
  })
})
