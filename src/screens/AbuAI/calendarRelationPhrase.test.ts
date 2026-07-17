/**
 * CALENDAR CREATE — relation-phrase person resolved to the real person.
 * Leo device #1: "פגישה עם החתן של רפי" was saved literally; it must schedule with
 * גלעד (Rafi's son-in-law), resolved via the family engine. Driven through the real
 * runtime (runCognitiveTurn) — the path the app uses.
 */
import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest'
import { runCognitiveTurn, IDLE_RUNTIME, type RuntimeState } from './cognitiveRuntime'

const FIXED = new Date('2026-06-24T09:00:00')
beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FIXED) })
afterAll(() => { vi.useRealTimers() })
beforeEach(() => {
  const s: Record<string, string> = {}
  vi.stubGlobal('localStorage', { getItem: (k: string) => s[k] ?? null, setItem: (k: string, v: string) => { s[k] = v }, removeItem: () => {} })
  vi.stubGlobal('navigator', { onLine: true })
})

const first = (text: string) => runCognitiveTurn(IDLE_RUNTIME, text, { messages: [], now: new Date() })

describe('CREATE resolves a relation-phrase person', () => {
  it('"תקבעי פגישה עם החתן של רפי מחר בשלוש" → confirm card names גלעד, not the phrase', () => {
    const d = first('תקבעי פגישה עם החתן של רפי מחר בשלוש')
    expect(d.intent).toBe('calendar_create')
    expect(d.display ?? '').toContain('גלעד')
    expect(d.display ?? '').not.toContain('החתן של רפי')
    expect(d.state.createState.draft.person).toBe('גלעד')
  })

  it('a rambling story resolves the person AND keeps the real meeting location', () => {
    const story = 'אז תשמעי, דיברתי היום עם החתן של רפי, והוא סיפר לי שהוא טס לניו יורק בשבוע הבא, ואנחנו רוצים להיפגש מחר בשלוש אחר הצהריים בבית קפה טולדנו כדי לדבר על הטיול המשפחתי'
    const d = first(story)
    expect(d.state.createState.draft.person).toBe('גלעד')
    expect(d.display ?? '').toContain('גלעד')
    expect(d.display ?? '').toContain('טולדנו')
  })

  it('an ordinary name is unaffected', () => {
    const d = first('תקבעי פגישה עם גבי מחר בשלוש')
    expect(d.display ?? '').toContain('גבי')
    expect(d.state.createState.draft.person).toBe('גבי')
  })
})
