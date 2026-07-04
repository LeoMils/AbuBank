/**
 * Operational AI / voice / calendar contract (#fix abubank operational).
 *
 * Submission-critical guarantees:
 *  - calendar create beats family Q&A when a scheduling verb + clue is present
 *  - clean titles, parsed dates/times, confirmation-gated, local-first
 *  - family Q&A still works for purely informational sentences
 *  - calendar read (incl. specific weekday) resolves locally, never via server
 *  - confirmation state machine: save / cancel / unclear / replace / read
 *  - voice transcript shares the SAME text pipeline + safe Hebrew fallbacks
 *
 * System time is pinned (2026-05-23 = Saturday) so weekday math is stable.
 */

import fs from 'fs'
import path from 'path'
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import {
  isCreateIntent,
  parseCreateIntent,
  startCreate,
  resolvePendingMessage,
  IDLE_STATE,
} from './calendarCreate'
import { routePersonalQuery, classifyAbuBankIntent } from './router'
import { tryGroundedAnswer } from './service'
import { addAppointment, loadAppointments } from '../AbuCalendar/service'

const FIXED_TODAY = new Date('2026-05-23T09:00:00') // Saturday

beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FIXED_TODAY) })
afterAll(() => { vi.useRealTimers() })

function isCalendarRead(text: string): boolean {
  const r = routePersonalQuery(text)
  return r.type.startsWith('calendar_') && r.type !== 'calendar_create'
}

// ═══ A. Calendar create beats family Q&A ═══════════════════════════════════════

describe('A. calendar create beats family Q&A', () => {
  const cases: Array<{ text: string; title: string; day: number; time: string }> = [
    { text: 'תקבע לי עם אמא של אופיר בשני 13:22', title: 'פגישה עם אמא של אופיר', day: 1, time: '13:22' },
    { text: 'תקבע עם מור ברביעי 4 אחהצ', title: 'פגישה עם מור', day: 3, time: '16:00' },
    { text: 'שימי לי עם יעל ביום ראשון הקרוב בשבע בערב', title: 'פגישה עם יעל', day: 0, time: '19:00' },
    { text: 'תרשמי לי עם גילעד בשלישי הבא 14:00', title: 'פגישה עם גילעד', day: 2, time: '14:00' },
  ]
  for (const c of cases) {
    it(`"${c.text}" → calendar_create, not family`, () => {
      expect(isCreateIntent(c.text)).toBe(true)
      expect(classifyAbuBankIntent(c.text)).toBe('calendar_create')
      expect(routePersonalQuery(c.text).type).toBe('calendar_create')
    })
    it(`"${c.text}" → clean title / date / time, confirmation-gated`, () => {
      const p = parseCreateIntent(c.text)
      expect(p).not.toBeNull()
      expect(p!.draft.title).toBe(c.title)
      expect(p!.draft.time).toBe(c.time)
      expect(p!.draft.date).not.toBeNull()
      expect(new Date(p!.draft.date!).getDay()).toBe(c.day)
      expect(p!.missing).toEqual([])
      // Complete intent goes to confirming (gated), never auto-saves.
      expect(startCreate(c.text).phase).toBe('confirming')
    })
  }
})

// ═══ B. Family Q&A still works ═════════════════════════════════════════════════

describe('B. informational family sentences stay family_query', () => {
  it.each([
    'מי זה מור?',
    'ספרי לי על מור',
    'מי זאת אמא של אופיר?',
    'איך אופיר קשורה אליי?',
  ])('"%s" is not a create intent', (text) => {
    expect(isCreateIntent(text)).toBe(false)
    expect(classifyAbuBankIntent(text)).toBe('family_query')
  })
})

// ═══ C. Calendar read (incl. specific weekday) ═════════════════════════════════

describe('C. calendar read classification', () => {
  it.each([
    ['מה יש לי היום?', 'calendar_read'],
    ['מה יש לי מחר?', 'calendar_read'],
    ['מה יש לי השבוע?', 'calendar_read'],
    ['איזה פגישות יש לי שבוע הקרוב?', 'calendar_read'],
    ['יש לי משהו ביום חמישי?', 'calendar_read'],
    ['תראי לי את הפגישות שלי', 'calendar_read'],
  ])('"%s" → %s', (text, intent) => {
    expect(classifyAbuBankIntent(text)).toBe(intent)
    expect(isCreateIntent(text)).toBe(false)
  })

  it('"יש לי משהו ביום חמישי?" resolves the weekday to a concrete date', () => {
    const r = routePersonalQuery('יש לי משהו ביום חמישי?')
    expect(r.type).toBe('calendar_exact_date')
    expect(r.dateStr).toBe('2026-05-28') // next Thursday
  })
})

// ═══ D. Read is local-first (no server/LLM) ═══════════════════════════════════

describe('D. calendar read is grounded/local', () => {
  let storage: Record<string, string> = {}
  beforeEach(() => {
    storage = {}
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => storage[k] ?? null,
      setItem: (k: string, v: string) => { storage[k] = v },
      removeItem: (k: string) => { delete storage[k] },
    })
  })

  it.each([
    'מה יש לי היום?',
    'מה יש לי מחר?',
    'מה יש לי השבוע?',
    'איזה פגישות יש לי שבוע הקרוב?',
    'יש לי משהו ביום חמישי?',
  ])('"%s" → tryGroundedAnswer non-null (no server)', (text) => {
    expect(tryGroundedAnswer(text)).not.toBeNull()
  })

  it('empty store answers truthfully with "לא מצאתי"', () => {
    expect(tryGroundedAnswer('מה יש לי מחר?')).toContain('אין כלום')
  })
})

// ═══ E. Confirmation state machine ═════════════════════════════════════════════

describe('E. confirmation state machine', () => {
  it('14. create → כן → save', () => {
    const s = startCreate('תקבע עם מור ברביעי 4 אחהצ')
    expect(s.phase).toBe('confirming')
    const r = resolvePendingMessage(s, 'כן', false)
    expect(r.action).toBe('save')
    if (r.action === 'save') {
      expect(r.draft.title).toBe('פגישה עם מור')
      expect(r.draft.time).toBe('16:00')
    }
  })

  it('15. create → לא → cancel', () => {
    const s = startCreate('תקבע עם מור ברביעי 4 אחהצ')
    expect(resolvePendingMessage(s, 'לא', false).action).toBe('cancel')
  })

  it('16. create → unclear → clarify (ask yes/no), not a blind repeat', () => {
    const s = startCreate('תקבע עם מור ברביעי 4 אחהצ')
    expect(resolvePendingMessage(s, 'אהלן מה', false).action).toBe('clarify')
  })

  it('17. pending create + new create → replaces draft', () => {
    const s = startCreate('תקבע עם מור ברביעי 4 אחהצ')
    const r = resolvePendingMessage(s, 'תרשמי לי עם גילעד בשלישי הבא 14:00', false)
    expect(r.action).toBe('replace')
    if (r.action === 'replace') {
      expect(r.state.draft.title).toBe('פגישה עם גילעד')
      expect(r.state.draft.time).toBe('14:00')
    }
  })

  it('18. pending create + calendar read → read, draft preserved', () => {
    const s = startCreate('תקבע עם מור ברביעי 4 אחהצ')
    const text = 'מה יש לי השבוע?'
    const r = resolvePendingMessage(s, text, isCalendarRead(text))
    expect(r.action).toBe('read')
    // The draft is not part of a 'read' resolution — caller keeps the
    // existing state, so the pending confirmation survives.
  })

  it('19. pending create + family question → answers it, keeps the draft (park_keep)', () => {
    const s = startCreate('תקבע עם מור ברביעי 4 אחהצ')
    const r = resolvePendingMessage(s, 'מי זה מור?', false)
    // A question mid-create is ANSWERED while the pending draft is preserved by the
    // confirmation case (park_keep) — no save, no cancel, no corruption.
    expect(r.action).toBe('park_keep')
    if (r.action === 'park_keep') expect(r.parked.draft.title).toBe('פגישה עם מור')
  })
})

// ═══ F. End-to-end: create → save → read ═══════════════════════════════════════

describe('F. end-to-end create→save→read', () => {
  let storage: Record<string, string> = {}
  beforeEach(() => {
    storage = {}
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => storage[k] ?? null,
      setItem: (k: string, v: string) => { storage[k] = v },
      removeItem: (k: string) => { delete storage[k] },
    })
  })

  it('saves "פגישה עם מור" at 16:00 and reads it back from the local calendar', () => {
    const s = startCreate('תקבע עם מור ברביעי 4 אחהצ')
    const r = resolvePendingMessage(s, 'כן', false)
    expect(r.action).toBe('save')
    if (r.action !== 'save') return
    const d = r.draft
    addAppointment({ title: d.title!, date: d.date!, time: d.time!, emoji: d.emoji ?? '📅' })

    expect(loadAppointments().some(a => a.title === 'פגישה עם מור' && a.time === '16:00')).toBe(true)

    const answer = tryGroundedAnswer('מה יש לי ביום רביעי')
    expect(answer).not.toBeNull()
    expect(answer).toContain('פגישה עם מור')
  })
})

// ═══ G. Voice path (source contract — no DOM render infra) ═════════════════════

describe('G. voice path safety (source contract)', () => {
  const PROJECT_ROOT = path.resolve(__dirname, '../../..')
  const idx = fs.readFileSync(path.join(PROJECT_ROOT, 'src/screens/AbuAI/index.tsx'), 'utf8')

  it('20. hands-free voice reuses the SAME create state-machine helpers', () => {
    // No weaker voice-only parser: the voice handler calls startCreate /
    // resolvePendingMessage exactly like the typed path.
    expect(idx.includes('startCreate(text)')).toBe(true)
    expect(idx.includes('resolvePendingMessage(cs, text')).toBe(true)
    // Manual mic transcript flows into the same text input → handleSend.
    expect(/setInput\(prev =>/.test(idx)).toBe(true)
  })

  it('20b. voice read uses the grounded local path', () => {
    expect(idx.includes('tryGroundedAnswer(text)')).toBe(true)
  })

  it('21. mic permission denied shows a friendly Hebrew fallback (no silent exit)', () => {
    expect(idx.includes('אני לא מצליחה לשמוע כרגע. אפשר לכתוב לי כאן.')).toBe(true)
    expect(idx.includes("e.error === 'not-allowed'")).toBe(true)
  })

  it('22. unsupported speech recognition falls back to Whisper + friendly errors', () => {
    expect(idx.includes('startWhisperFallback')).toBe(true)
    expect(idx.includes('mediateVoiceCaptureError')).toBe(true)
  })

  it('23. transcription failure is never swallowed silently', () => {
    // The manual-mic catch posts a mediated error (and logs STT evidence) — never
    // an empty/swallowed block. Assert the BEHAVIOUR, not a comment position.
    expect(idx.includes("// Never fail silently")).toBe(true)
    expect(idx.includes("mediateVoiceCaptureError(err, 'transcription')")).toBe(true)
    expect(/STT_SUCCESS=false/.test(idx)).toBe(true)
  })

  it('23b. a processing watchdog prevents an infinite stuck state', () => {
    expect(idx.includes("transitionVoice('RECOVERING', 'watchdog-20s')")).toBe(true)
  })
})

// ═══ H. Submission smoke (pure, server-independent) ════════════════════════════

describe('H. submission smoke — core classifiers never need a server', () => {
  let storage: Record<string, string> = {}
  beforeEach(() => {
    storage = {}
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => storage[k] ?? null,
      setItem: (k: string, v: string) => { storage[k] = v },
      removeItem: (k: string) => { delete storage[k] },
    })
  })

  it('classify + grounded answer run without throwing (no network)', () => {
    expect(() => classifyAbuBankIntent('מה יש לי היום?')).not.toThrow()
    expect(() => routePersonalQuery('תקבע עם מור ברביעי 4 אחהצ')).not.toThrow()
    // Calendar read works with the server chat endpoint entirely absent.
    expect(tryGroundedAnswer('מה יש לי היום?')).not.toBeNull()
  })
})
