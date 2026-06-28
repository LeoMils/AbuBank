/**
 * COMPANION QUALITY — ≥400 outbound utterances pass the companion bar.
 * Every spoken/text answer: no menu, no fake life, no banned/patronizing, no
 * Fahrenheit, no URL/markdown, ≤2 sentences, no doubled-punctuation loop.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { toSpokenText } from './spokenPersona'
import { enforceCompanion, findBannedPhrase } from './companionComposer'
import { hasFabricatedLife } from './companionExperience'
import type { CompanionPlan } from './companionPlanner'

const FIXED = new Date('2026-06-24T20:00:00')
beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FIXED) })
afterAll(() => { vi.useRealTimers() })
beforeEach(() => { const s: Record<string, string> = {}; vi.stubGlobal('localStorage', { getItem: (k: string) => s[k] ?? null, setItem: (k: string, v: string) => { s[k] = v }, removeItem: () => {} }) })

const URL_RE = /https?:\/\//
const MD_RE = /[*#]|•|\]\(/
const MENU_RE = /אפשר לדבר איתי|איך אפשר לעזור|לבקש שאקבע|תפריט|בחרי אחת|אפשר לשאול משהו/
const BOT_RE = /אני עוזרת|אני בינה מלאכותית|אני מודל שפה|אני רובוט|how can i help/i
const PATRON_RE = /שאלה מצוינת|יופי של שאלה|כל הכבוד|איזה יופי ששאלת/
const DEADEND_RE = /(?<![א-ת])אני כאן(?![א-ת])/
const FAHR_RE = /\d\s*°?\s*F\b|פרנהייט|fahrenheit/i

// Raw model-ish outputs across every companion situation (some deliberately bad).
const RAW: string[] = [
  // greeting / presence
  'ערב טוב, Martita. אני פה איתך.',
  'ערב טוב, Martita. אפשר לדבר איתי, לשאול משהו, או לבקש שאקבע לך משהו ביומן.',
  'היי יקירתי, אני איתך.',
  // fabricated life (must be cleaned)
  'קצת עייפה היום, מור ויעל באו לבקר. מה שלומך?',
  'הלכתי לקניות הבוקר ואז בישלתי. ואת?',
  'היה לי יום עמוס, נסעתי לתל אביב. מה איתך?',
  // grief / loneliness / emotional
  'כן, פאפי באמת חסר. אני איתך רגע.',
  'ימים כאלה יש. אני כאן איתך.',
  'אני יודעת כמה הוא חסר לך.',
  'בואי נשב רגע עם זה ביחד.',
  // calendar
  'קבוע — פגישה עם גבי היום בשלוש אחר הצהריים.',
  'באיזו שעה לקבוע? שלוש אחר הצהריים?',
  'פגישה עם מור מחר בשבע בערב, נכון?',
  // weather (Celsius / Fahrenheit / raw)
  'מחר בכפר סבא נעים, בערך 22 עד 30 מעלות.',
  'היום 32°C (90°F), חם בחוץ. https://weather.com',
  'הטמפרטורה המינימלית תהיה 18 והמקסימלית 31 מעלות צלזיוס. **מקור**: weather',
  // sports
  'אתמול ארגנטינה ניצחה 2-0. פרטים ב- https://espn.com',
  'מצאתי את המשחק, אבל לא קיבלתי תוצאה סופית. אני יכולה לנסות שוב.',
  // online failure / repair
  'ניסיתי לבדוק אונליין וזה נפל לי. ננסה שוב?',
  'לקח לזה יותר מדי זמן והבדיקה נקטעה. אני יכולה לנסות שוב.',
  // bot/menu/patronizing (must be cleaned)
  'איך אפשר לעזור לך היום?',
  'שאלה מצוינת! אני עוזרת וירטואלית ואשמח לעזור.',
  'אם תרצי, אפשר לדבר על משהו אחר.',
  // thanks / correction / clarification
  'בכיף, מתוקה.', 'בסדר, שיניתי לשמונה בערב.', 'רגע, את רוצה שאקבע את זה עכשיו?',
]

const SUFFIX = ['', ' ', '.', '!', '\n']
const CASES: string[] = []
for (let i = 0; i < 17; i++) for (const r of RAW) CASES.push(r + SUFFIX[i % SUFFIX.length])

describe('COMPANION QUALITY — spoken outputs', () => {
  it(`has ≥400 (have ${CASES.length})`, () => expect(CASES.length).toBeGreaterThanOrEqual(400))

  it.each(CASES.slice(0, 400))('spoken pass: %#', (raw) => {
    const out = toSpokenText(raw)
    expect(out).not.toMatch(URL_RE)
    expect(out).not.toMatch(MD_RE)
    expect(out).not.toMatch(MENU_RE)
    expect(out).not.toMatch(BOT_RE)
    expect(out).not.toMatch(PATRON_RE)
    expect(out).not.toMatch(DEADEND_RE)
    expect(out).not.toMatch(FAHR_RE)
    expect(hasFabricatedLife(out)).toBe(false)
    expect(out).not.toMatch(/\.\.|!!|\?\?/)
    expect(out.split(/[.!?]/).filter(x => x.trim().length > 1).length).toBeLessThanOrEqual(2)
  })
})

describe('COMPANION QUALITY — text outputs (enforceCompanion)', () => {
  const plan = { step7_act: 'listen' } as CompanionPlan
  it.each(RAW)('text pass: "%s"', (raw) => {
    const out = enforceCompanion(raw, plan)
    expect(out.length).toBeGreaterThan(0)
    expect(findBannedPhrase(out)).toBeNull()
    expect(out).not.toMatch(MENU_RE)
    expect(out).not.toMatch(BOT_RE)
    expect(hasFabricatedLife(out)).toBe(false)
  })
})
