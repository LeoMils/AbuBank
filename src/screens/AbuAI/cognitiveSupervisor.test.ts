/*
 * Cognitive Supervisor (Phase 5) — proves it BLOCKS the unsafe answers.
 */
import { describe, it, expect } from 'vitest'
import { supervise, repair } from './cognitiveSupervisor'

const block = (a: string, intent: Parameters<typeof supervise>[1]['intent'], dataAvailable = true) =>
  supervise(a, { intent, dataAvailable, forVoice: true })

describe('Cognitive Supervisor blocks', () => {
  it('blocks "I can\'t check" when the tool/session has data', () => {
    expect(block('אני לא מצליחה לבדוק את זה', 'online').approved).toBe(false)
  })
  it('blocks an unnecessary "באיזה יום" on a date question', () => {
    expect(block('באיזה יום את מתכוונת?', 'date_query').approved).toBe(false)
  })
  it('blocks "באיזה יום" on a search-all question', () => {
    expect(block('באיזה יום הפגישה?', 'calendar_search').approved).toBe(false)
  })
  it('blocks broken Hebrew ("אני תבדוק")', () => {
    expect(block('אני תבדוק את היומן', 'general').approved).toBe(false)
  })
  it('blocks a raw fragment / direct tool output (URLs, "com]( cbsnews")', () => {
    expect(block('com]( cbsnews broken', 'general').approved).toBe(false)
    expect(block('תראי כאן https://x.com', 'general').approved).toBe(false)
  })
  it('blocks a repeated apology loop', () => {
    expect(block('סליחה, סליחה, לא הבנתי', 'general').approved).toBe(false)
  })
  it('blocks a robotic assistant template', () => {
    expect(block('מה תרצי לדבר עליו?', 'general').approved).toBe(false)
  })
  it('blocks a hallucinated promise-without-result', () => {
    expect(block('רגע אחד אני בודקת ואחזור', 'online').approved).toBe(false)
  })
  it('blocks an empty answer', () => {
    expect(block('', 'general').approved).toBe(false)
  })
  it('approves a clean, grounded, short answer', () => {
    expect(block('היום יום חמישי, 2 ביולי 2026.', 'date_query').approved).toBe(true)
    expect(block('מחר אין כלום. יום שקט.', 'calendar_read').approved).toBe(true)
  })
})

describe('Supervisor repair', () => {
  it('trims an over-long-for-voice answer to the first sentence', () => {
    const long = 'תשובה קצרה וברורה. ' + 'עוד ועוד טקסט '.repeat(40)
    const v = supervise(long, { intent: 'general', dataAvailable: true, forVoice: true })
    expect(v.approved).toBe(false)
    expect(repair(long, v).length).toBeLessThan(long.length)
  })
})
