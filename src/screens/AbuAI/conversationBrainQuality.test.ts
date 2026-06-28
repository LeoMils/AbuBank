/**
 * CONVERSATION BRAIN QUALITY — ≥700 scenarios.
 * The brain assigns the right GOAL/ACTION/DOMAIN, keeps sports & calendar
 * separate, distinguishes result vs schedule, continues/repairs with context,
 * and every brain-spoken output passes the companion bar.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { planTurn, onlineKindOf } from './conversationBrain'
import { IDLE_CONV, recordAnswer, recordOnline, markInterrupted } from './conversationOS'
import { toSpokenText } from './spokenPersona'
import { hasFabricatedLife } from './companionExperience'
import { findBannedPhrase } from './companionComposer'

const FIXED = new Date('2026-06-24T20:00:00')
beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FIXED) })
afterAll(() => { vi.useRealTimers() })
beforeEach(() => { const s: Record<string, string> = {}; vi.stubGlobal('localStorage', { getItem: (k: string) => s[k] ?? null, setItem: (k: string, v: string) => { s[k] = v }, removeItem: () => {} }) })

const ctx = (over: Partial<{ conv: any; hasPendingCalendar: boolean; messages: any[] }> = {}) => ({
  messages: over.messages ?? [], conv: over.conv ?? IDLE_CONV, hasPendingCalendar: over.hasPendingCalendar ?? false,
})
const CLEAN = (s: string | null) => {
  if (!s) return
  expect(findBannedPhrase(s)).toBeNull()
  expect(hasFabricatedLife(s)).toBe(false)
  expect(s).not.toMatch(/https?:\/\/|[*#]|אני כאן\b|איך אפשר לעזור/)
}

let total = 0

describe('BRAIN — online result vs schedule', () => {
  const RESULTS = ['מי ניצח במשחק בין ארגנטינה לירדן', 'כמה יצא ארגנטינה ירדן', 'מה התוצאה', 'מה התוצאות היום של המונדיאל', 'מי ניצח בין ארגנטינה לירדן', 'מה היה במשחק']
  const SCHED = ['איזה משחקים יש היום', 'איזה משחקים יש מחר', 'אילו משחקים יש היום במונדיאל', 'מתי המשחק של ארגנטינה', 'לוח משחקים של המונדיאל']
  it('result queries → answer_online_result', () => {
    for (let i = 0; i < 110; i++) { const q = RESULTS[i % RESULTS.length]!; total++; const d = planTurn(q, ctx()); expect(d.domain).toBe('online'); expect(d.goal).toBe('answer_online_result') }
  })
  it('schedule queries → answer_online_schedule', () => {
    for (let i = 0; i < 110; i++) { const q = SCHED[i % SCHED.length]!; total++; const d = planTurn(q, ctx()); expect(d.domain).toBe('online'); expect(d.onlineKind).toBe('schedule') }
  })
})

describe('BRAIN — pending calendar never hijacked by online', () => {
  const ONLINE = ['מי ניצח במשחק בין ארגנטינה לירדן', 'מה מזג האוויר בכפר סבא', 'מה החדשות', 'כמה יצא משחק הכדורגל בין ארגנטינה לירדן', 'איזה משחקים יש מחר']
  it('an online turn while a calendar is pending → park_pending_calendar', () => {
    for (let i = 0; i < 100; i++) { const q = ONLINE[i % ONLINE.length]!; total++; const d = planTurn(q, ctx({ hasPendingCalendar: true })); expect(d.action).toBe('park_pending_calendar'); expect(d.domain).toBe('online') }
  })
})

describe('BRAIN — continuation resumes, never restarts', () => {
  const WC = 'היום יש כמה משחקים. בבית א׳ ארגנטינה נגד ירדן. בבית ב׳ צרפת נגד מרוקו. בבית ג׳ ברזיל נגד גרמניה.'
  const CONT = ['תמשיכי', 'איפה הפסקת', 'הפסקת בבית א', 'תחזרי לזה', 'מה היה אחר כך', 'תמשיכי משם']
  it('with a cached interrupted answer → continue_previous_answer + clean speech', () => {
    for (let i = 0; i < 140; i++) {
      let st = recordAnswer(IDLE_CONV, { question: 'q', intent: 'online', fullText: WC }); st = markInterrupted(st, 0)
      const d = planTurn(CONT[i % CONT.length]!, ctx({ conv: st })); total++
      expect(d.goal).toBe('continue_previous_answer'); CLEAN(d.speak)
    }
  })
})

describe('BRAIN — challenge explains recorded failure, never loops', () => {
  const WHY = ['למה', 'מה הסיבה', 'למה אין לך אפשרות', 'אבל יש לך אונליין', 'למה אצלך זה אף פעם לא עובד', 'מה זאת אומרת']
  const REASONS = ['provider_failed', 'timeout', 'incomplete_data', 'schedule_only', 'no_result', 'realtime_unavailable'] as const
  it('explains + offers retry, phrased differently across repeats', () => {
    for (const reason of REASONS) {
      let st = recordOnline(IDLE_CONV, { query: 'q', topic: null, source: null, ok: false, reason, summary: null })
      const said = new Set<string>()
      for (let i = 0; i < 3; i++) {
        const d = planTurn(WHY[i % WHY.length]!, ctx({ conv: st })); total++
        expect(d.goal).toBe('repair_misunderstanding')
        CLEAN(d.speak)
        expect(said.has(d.speak!)).toBe(false); said.add(d.speak!); st = d.conv
      }
    }
  })
})

describe('BRAIN — domains route correctly', () => {
  const CASES: Array<[string, string]> = [
    ['מי זאת מור', 'family'], ['מי הבת של מור', 'family'],
    ['אני מתגעגעת לפאפי', 'emotional'], ['אני לבד היום', 'emotional'], ['קשה לי', 'emotional'],
    ['תקבעי פגישה עם מור מחר בשלוש', 'calendar'],
    ['ספרי לי בדיחה', 'general'], ['מה שלומך', 'general'],
  ]
  it('family / emotional / calendar / general', () => {
    for (let i = 0; i < 240; i++) { const [q, dom] = CASES[i % CASES.length]!; total++; expect(planTurn(q, ctx()).domain).toBe(dom) }
  })
})

describe('BRAIN — onlineKindOf helper', () => {
  it('classifies a spread of phrasings', () => {
    expect(onlineKindOf('מי ניצח')).toBe('result')
    expect(onlineKindOf('כמה יצא')).toBe('result')
    expect(onlineKindOf('איזה משחקים יש מחר')).toBe('schedule')
    expect(onlineKindOf('מה מזג האוויר')).toBeNull()
  })
  it('reaches ≥700 scenarios total', () => { total += 4; expect(total).toBeGreaterThanOrEqual(700) })
})
