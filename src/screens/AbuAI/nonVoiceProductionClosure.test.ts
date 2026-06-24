/**
 * NON-VOICE PRODUCTION CLOSURE
 * ════════════════════════════
 * One harness over every non-hardware blocker, on the real runtime path. No
 * microphone, no TTS hardware — pure code/local logic. Reproduces the exact
 * field failures Leo reported and proves them closed.
 *
 * Time pinned to 2026-06-24 (Wednesday).
 */
import fs from 'fs'
import path from 'path'
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { routePersonalQuery } from './router'
import { tryGroundedAnswer } from './service'
import { startCreate, parseHebrewTimeDetailed } from './calendarCreate'
import { understandMeeting } from './meetingIntelligence'
import { resolveFollowUp } from './contextResolver'
import { deriveConversationMemory, detectCalendarAction } from './conversationMemory'
import { enforceCompanion, findBannedPhrase } from './companionComposer'
import type { CompanionPlan } from './companionPlanner'
import { addAppointment } from '../AbuCalendar/service'

const FIXED = new Date('2026-06-24T09:00:00') // Wednesday
beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FIXED) })
afterAll(() => { vi.useRealTimers() })

function localDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const todayStr = () => localDate(new Date())
const dayAfterStr = () => { const d = new Date(); d.setDate(d.getDate() + 2); return localDate(d) }

let storage: Record<string, string> = {}
function installStorage() {
  storage = {}
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => storage[k] ?? null,
    setItem: (k: string, v: string) => { storage[k] = v },
    removeItem: (k: string) => { delete storage[k] },
  })
}
function seedAlexandraToday() {
  addAppointment({
    title: 'פגישה עם אלכסנדרה', date: todayStr(), time: '19:00', emoji: '☕',
    location: 'קפה גרג רעננה', subject: 'טיול לאיטליה', personName: 'אלכסנדרה',
  } as Parameters<typeof addAppointment>[0])
}

// ═══ A. Create with Mor — afternoon time is 15:00, never 03:00 ═══════════════════
describe('A. create with Mor → 15:00 (not 03:00)', () => {
  beforeEach(() => { installStorage() })
  it('"תקבעי לי פגישה עם מור מחרתיים בשלוש אחר הצהריים"', () => {
    const s = startCreate('תקבעי לי פגישה עם מור מחרתיים בשלוש אחר הצהריים')
    expect(s.draft.time).toBe('15:00')
    expect(s.draft.date).toBe(dayAfterStr())
    expect(s.draft.person).toBe('מור')
    expect(s.draft.title).toBe('פגישה עם מור')
    expect(s.draft.location == null).toBe(true)
  })
  it('the bare time string also resolves to 15:00', () => {
    expect(parseHebrewTimeDetailed('שלוש אחר הצהריים').time).toBe('15:00')
    expect(parseHebrewTimeDetailed('ב3:00 אחר הצהריים').time).toBe('15:00')
  })
})

// ═══ B. Create with Alexandra — long messy speech, asks for the missing time ═════
describe('B. create with Alexandra (rental context)', () => {
  beforeEach(() => { installStorage() })
  const B = 'שמעי לפני שהדיירים נכנסים אני צריכה לדבר עם אלכסנדרה על השכירות של הבית מחר בערב בקפה גרג ברעננה'
  it('understands person / location / subject and ASKS the time (no invention)', () => {
    const m = understandMeeting(B)
    expect(m.who).toBe('אלכסנדרה')
    expect(m.location).toBe('קפה גרג ברעננה')
    expect(m.subject).toContain('שכירות')          // rental/lease topic
    expect(m.time).toBeNull()                        // "מחר בערב" has no hour
    expect(m.needsClarification).toBe(true)
    expect(m.clarificationQuestion).toContain('שעה')
    expect(m.title).toBe('פגישה עם אלכסנדרה')        // clean, not narrative
  })
})

// ═══ C. Calendar read — every variant finds the seeded event ════════════════════
describe('C. calendar read variants — one source of truth, no false empty', () => {
  beforeEach(() => { installStorage(); seedAlexandraToday() })
  const variants = ['איזה פגישה יש לי היום', 'פגישות יש לי ביומן היום', 'מה יש לי היום']
  for (const q of variants) {
    it(`"${q}" → finds Alexandra, never "אין"`, () => {
      expect(routePersonalQuery(q).type).toMatch(/^calendar_/)
      const a = tryGroundedAnswer(q) ?? ''
      expect(a).toContain('אלכסנדרה')
      expect(a).not.toContain('אין לך')
      expect(a).not.toContain('לא יכולה לבדוק את היומן')
    })
  }
})

// ═══ D. No-location case — never invent a location ══════════════════════════════
describe('D. meeting with Mor without a location', () => {
  beforeEach(() => { installStorage() })
  it('leaves location empty', () => {
    const s = startCreate('תקבעי לי פגישה עם מור מחר בשבע בערב')
    expect(s.draft.location == null).toBe(true)
    expect(s.draft.person).toBe('מור')
    expect(s.draft.time).toBe('19:00')
  })
})

// ═══ E. Family — deterministic graph first, no LLM guessing ═════════════════════
describe('E. family deterministic routing', () => {
  beforeEach(() => { installStorage() })
  it.each(['מי זאת מור', 'מי זאת ארי', 'מי הנכדים שלי', 'פגישה עם מור'])(
    '"%s" → grounded locally', (q) => {
      const r = routePersonalQuery(q)
      // family lookups and the create ("פגישה עם מור") both resolve locally.
      expect(r.type === 'family_lookup' || r.type === 'calendar_create').toBe(true)
      if (r.type === 'family_lookup') expect(tryGroundedAnswer(q)).not.toBeNull()
    })
  it('"עליה" after a family turn → resolves to the last person via the graph', () => {
    const hist = [
      { role: 'user', content: 'מי זאת מור' },
      { role: 'assistant', content: 'מור, הבת שלך.' },
    ]
    const r = resolveFollowUp('עליה', hist as never)
    expect(r.wasFollowUp).toBe(true)
    expect(r.resolved).toContain('מור')
    expect(routePersonalQuery(r.resolved).type).toBe('family_lookup')
  })
  it('"תמשיכי" after a family turn → continues on the person', () => {
    const hist = [
      { role: 'user', content: 'מי זאת מור' },
      { role: 'assistant', content: 'מור, הבת שלך.' },
    ]
    expect(resolveFollowUp('תמשיכי', hist as never).resolved).toContain('מור')
  })
})

// ═══ F. Personality — no generic bot language ══════════════════════════════════
describe('F. companion personality bans generic bot language', () => {
  const plan = { step7_act: 'lead' } as CompanionPlan
  const banned = ['אני בסדר', 'איך אפשר לעזור', 'רוצה לדבר על משהו אחר', 'אין לי מידע']
  for (const phrase of banned) {
    it(`"${phrase}" is removed / warmed`, () => {
      const out = enforceCompanion(`${phrase}.`, plan)
      expect(out).not.toBe(`${phrase}.`)
      expect(out.length).toBeGreaterThan(0)
    })
  }
  it('"איך אפשר לעזור" is flagged banned', () => {
    expect(findBannedPhrase('איך אפשר לעזור לך?')).not.toBeNull()
  })
  it('the dead-end fallback is warm, not a bare "אני כאן."', () => {
    expect(enforceCompanion('אשמח לעזור', plan)).not.toBe('אני כאן.')
  })
})

// ═══ G. Memory — multi-turn chain preserves person / topic / action ════════════
describe('G. conversation memory chain', () => {
  beforeEach(() => { installStorage() })
  it('preserves last person, last calendar action, and topic across turns', () => {
    const chain = [
      { role: 'user', content: 'מי זאת מור' },
      { role: 'assistant', content: 'מור, הבת שלך.' },
      { role: 'user', content: 'תקבעי לי פגישה עם מור מחר בשלוש אחר הצהריים' },
      { role: 'assistant', content: 'קבעתי פגישה עם מור מחר בשלוש.' },
    ]
    const mem = deriveConversationMemory(chain)
    expect(mem.lastPerson).toBe('מור')
    expect(mem.lastCalendarAction).toBe('create')
    expect(mem.lastTopic).toBeTruthy()
    // Pronoun continuity still resolves to Mor.
    expect(resolveFollowUp('עליה', chain as never).resolved).toContain('מור')
  })
  it('detects read vs create vs delete actions', () => {
    expect(detectCalendarAction('מה יש לי היום')).toBe('read')
    expect(detectCalendarAction('תקבעי לי פגישה עם מור מחר בשבע')).toBe('create')
    expect(detectCalendarAction('תבטלי את הפגישה עם מור')).toBe('delete')
  })
  it('the durable summary carries lastPerson + lastCalendarAction', async () => {
    const { updateSummaryFromMessages } = await import('./service')
    const chain = [
      { role: 'user', content: 'תקבעי לי פגישה עם מור מחר בשבע בערב' },
      { role: 'assistant', content: 'קבעתי פגישה עם מור.' },
    ]
    const sum = updateSummaryFromMessages(chain, null)
    expect(sum.lastPerson).toBe('מור')
    expect(sum.lastCalendarAction).toBe('create')
  })
})

// ═══ H. Abu Games — 18 games, bubble UI, vertical/mobile, brand identity ════════
describe('H. Abu Games production-clean catalog', () => {
  const SRC = fs.readFileSync(path.resolve(__dirname, '../AbuGames/index.tsx'), 'utf8')
  it('has all 18 games', () => {
    const ids = SRC.match(/id: '[a-z0-9-]+'/g) ?? []
    expect(ids.length).toBe(18)
  })
  it('every game is reachable via same-tab navigation', () => {
    expect(SRC).toContain('window.location.href = url')
    const urls = SRC.match(/url: 'https?:\/\//g) ?? []
    expect(urls.length).toBeGreaterThanOrEqual(18)
  })
  it('renders round bubbles in a vertical 3-col grid (no horizontal-scroll dependency)', () => {
    expect(SRC).toContain("borderRadius: '50%'")
    expect(SRC).toContain("gridTemplateColumns: 'repeat(3, 1fr)'")
    expect(SRC).not.toContain("overflowX: 'auto'")
  })
  it('carries Abu Games English wordmark + Abu Bank identity, no Carnival / "המשחקים שלך"', () => {
    expect(SRC).toContain('Abu Games')
    expect(SRC).toContain('ABU BANK')
    expect(SRC).not.toContain('Carnival')
    expect(SRC).not.toContain('המשחקים שלך')
  })
})
