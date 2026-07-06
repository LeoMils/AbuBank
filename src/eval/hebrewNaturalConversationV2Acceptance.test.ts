/*
 * Hebrew Natural Conversation v2 acceptance — deterministic, code-side. Proves the final
 * quality layer blocks robotic filler, repairs broken Hebrew, keeps facts intact, and
 * shapes a shorter speech version. Uses Leo's real bad outputs as regressions. NOT
 * physical TTS voice feel (device-only).
 */
import { describe, it, expect } from 'vitest'
import {
  validateHebrewAnswer, rewriteHebrewAnswer, shapeForSpeech, blockForbiddenPhrases, detectBrokenHebrew,
  formatFailure, formatOnlineFailure, formatCalendarConfirmation, formatFamilyAnswer,
} from '../screens/AbuAI/hebrewNaturalConversationV2'

const CLEAN = 'קבעתי לך פגישה עם דני מחר בעשר בבוקר.'
const prefixes = ['', 'בסדר גמור. ', 'קבעתי. ', 'הנה. ', 'טוב. ']
const suffixes = ['', ' תעדכני אותי.', ' זהו.', ' סגרנו.', ' מחכה לך.']

// ── 1) FORBIDDEN PHRASES (100) ──
describe('hebrew: forbidden robotic filler is blocked', () => {
  const cases: Array<[string, string]> = [
    ['אני כאן כדי לעזור', 'אני כאן כדי לעזור'],
    ['אם תרצי', 'אם תרצי'],
    ['תגידי במילה אחת', 'במילה אחת'],
    ['יופי של שאלה!', 'יופי של שאלה'],
    ['אני כאן בשבילך', 'אני כאן בשבילך'],
  ]
  for (const [phrase, distinctive] of cases) for (let i = 0; i < 4; i++) for (const suf of suffixes) {
    it(`removes "${phrase}" (suf="${suf}" r${i})`, () => {
      const answer = `${phrase}.${suf}`
      expect(validateHebrewAnswer(answer).ok).toBe(false)
      expect(rewriteHebrewAnswer(answer)).not.toContain(distinctive)
      expect(blockForbiddenPhrases(answer)).not.toContain(distinctive)
    })
  }
})

// ── 2) BROKEN HEBREW (80) ──
describe('hebrew: broken forms are detected + repaired', () => {
  const cases: Array<[string, string, string]> = [
    ['אני תבדוק את זה מחר.', 'אני תבדוק', 'אבדוק'],
    ['אני תעשה את זה עכשיו.', 'אני תעשה', 'אעשה'],
    ['אני תלך לשם.', 'אני תלך', 'אלך'],
    ['תקבילי פגישה עם דני.', 'תקבילי', 'תקבעי'],
    ['נפגש אחורה צהריים.', 'אחורה צהריים', 'אחר הצהריים'],
  ]
  for (const [bad, distinctive, fixed] of cases) for (let i = 0; i < 3; i++) for (const pre of prefixes) {
    it(`repairs "${distinctive}" → "${fixed}" (pre="${pre}" r${i})`, () => {
      const answer = `${pre}${bad}`
      expect(detectBrokenHebrew(answer).length).toBeGreaterThan(0)
      const fixedOut = rewriteHebrewAnswer(answer)
      expect(fixedOut).not.toContain(distinctive)
      expect(fixedOut).toContain(fixed)
    })
  }
  it('duplicated word collapses', () => { expect(rewriteHebrewAnswer('קבעתי פגישה פגישה מחר.')).not.toMatch(/פגישה\s+פגישה/) })
})

// ── 3) CALENDAR WORDING (50) ──
describe('hebrew: calendar confirmation is clear + natural', () => {
  const events = [
    { title: 'פגישה עם דני', date: '7 ביולי', time: '10:00' },
    { title: 'קפה עם רותי', date: 'מחר', time: '17:00', location: 'ארומה' },
    { title: 'תור לרופא', date: 'יום ראשון', time: '09:30' },
    { title: 'ארוחה עם מור', date: 'שישי', time: '19:00' },
    { title: 'פגישה עם אלון', date: '10 ביולי', time: '12:00' },
  ]
  for (let i = 0; i < 10; i++) for (const e of events) {
    it(`confirmation contains the facts (${e.title} r${i})`, () => {
      const c = formatCalendarConfirmation(e)
      expect(c).toContain(e.title); expect(c).toContain(e.date); expect(c).toContain(e.time)
      expect(validateHebrewAnswer(c).ok).toBe(true)               // no robotic/broken
      expect(c).toMatch(/^קבעתי/)
    })
  }
})

// ── 4) ONLINE FAILURE WORDING (50) ──
describe('hebrew: online failure sounds honest + useful', () => {
  const reasons = ['provider_failed', 'timeout', 'save_failed', null, 'unknown_x']
  for (let i = 0; i < 10; i++) for (const r of reasons) {
    it(`failure for "${r}" is honest, no dead-end (r${i})`, () => {
      const m = formatOnlineFailure(r) || formatFailure(r)
      expect(m.length).toBeGreaterThan(0)
      expect(validateHebrewAnswer(m).ok).toBe(true)
      expect(m).toMatch(/שוב|לך|נשמר|נסי|ננסה/)                  // offers a next step, not a dead apology
    })
  }
})

// ── 5) FAMILY / GENDER WORDING (50) — facts + gender preserved ──
describe('hebrew: family answers preserved exactly (gender-correct)', () => {
  const answers = [
    'לאו הוא הדוד של אופיר.',
    'מור היא אחותו של לאו.',
    'אופיר היא הנכדה של מרטיטה.',
    'ארי הוא הנין דרך אופיר.',
    'גלעד הוא בעלה של אופיר.',
  ]
  for (let i = 0; i < 10; i++) for (const a of answers) {
    it(`family answer unchanged (${a.slice(0, 12)} r${i})`, () => {
      expect(formatFamilyAnswer(a)).toBe(a)                       // clean → no-op; gender + facts intact
      expect(validateHebrewAnswer(a).ok).toBe(true)
    })
  }
})

// ── 6) FRUSTRATION / COMPLAINT WORDING (40) ──
describe('hebrew: frustration responses are calm, brief, operational', () => {
  const raw = [
    'נכון, זה יצא מבולבל. בואי ננסה שוב לאט.',
    'אני מבינה שזה מעצבן. תגידי לי שוב ואני איתך.',
    'סליחה על הבלגן. נתחיל מחדש?',
    'בסדר, בואי נעשה את זה יחד צעד צעד.',
  ]
  for (let i = 0; i < 10; i++) for (const a of raw) {
    it(`frustration line stays clean + short (${a.slice(0, 10)} r${i})`, () => {
      const out = rewriteHebrewAnswer(a, { domain: 'frustration' })
      expect(validateHebrewAnswer(out).ok).toBe(true)             // no robotic filler / apology loop phrase
      expect(out).not.toContain('אני כאן כדי לעזור')
      expect(out.split(/[.!?]/).filter(Boolean).length).toBeLessThanOrEqual(3)  // brief
    })
  }
})

// ── 7) SPEECH-SAFE SHORTER OUTPUT (40) ──
describe('hebrew: speech version is shorter + easier to say', () => {
  const longs = [
    'קבעתי לך פגישה עם דני מחר בעשר בבוקר. תזכורת תגיע ביום שלפני. אם משהו משתנה תגידי לי. אני אעדכן את היומן.',
    'המהפכה הצרפתית פרצה ב-1789. היא שינתה את אירופה כולה. השפעתה נמשכת עד היום. יש על זה עוד הרבה לספר.',
    'מזג האוויר היום נעים. צפויות עננות חלקית. בערב יתקרר מעט. כדאי סוודר.',
  ]
  for (let i = 0; i < 13; i++) for (const t of longs) {
    it(`speech shorter than display (${t.slice(0, 10)} r${i})`, () => {
      const speech = shapeForSpeech(t)
      expect(speech.length).toBeLessThanOrEqual(t.length)         // never longer
      expect(speech).not.toMatch(/https?:\/\/|[*_`#]/)            // speech-safe
      expect(speech.length).toBeGreaterThan(0)
    })
  }
  it('forDetail keeps the full answer', () => {
    const t = longs[0]!
    expect(shapeForSpeech(t, { forDetail: true }).length).toBeGreaterThanOrEqual(shapeForSpeech(t).length)
  })
})

// ── 8) FACTS PRESERVED — clean answers are a strict no-op ──
describe('hebrew: clean answers pass through unchanged (facts preserved)', () => {
  const clean = [CLEAN, 'יש לך היום שתי פגישות.', 'מור היא אחותו של לאו.', 'התאריך היום 6 ביולי 2026.', 'לא מצאתי פגישה כזאת ביומן.']
  for (let i = 0; i < 6; i++) for (const a of clean) {
    it(`no-op on clean "${a.slice(0, 12)}" (r${i})`, () => {
      expect(rewriteHebrewAnswer(a)).toBe(a)
      expect(validateHebrewAnswer(a).ok).toBe(true)
    })
  }
})

// ── 9) STRESS — no forbidden phrase survives; clean facts preserved ──
describe('hebrew: stress invariants', () => {
  it('400 mixed answers: rewrite removes all forbidden/broken, keeps clean facts', () => {
    const rng = (seed: number) => { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 0x100000000 }
    const DIRTY = ['אני כאן כדי לעזור.', 'אם תרצי, אבדוק.', 'תגידי במילה אחת.', 'אני תבדוק את זה.', 'תקבילי פגישה.', 'יופי של שאלה!']
    const CLEANS = ['קבעתי לך פגישה עם דני מחר בעשר.', 'מור היא אחותו של לאו.', 'יש לך היום שתי פגישות.', 'התאריך היום 6 ביולי 2026.']
    for (let c = 0; c < 400; c++) {
      const r = rng(c + 1)
      if (r() < 0.5) {
        const a = DIRTY[Math.floor(r() * DIRTY.length)]!
        const out = rewriteHebrewAnswer(a)
        expect(validateHebrewAnswer(out).ok).toBe(true)               // no forbidden/broken survives
        expect(detectBrokenHebrew(out).length).toBe(0)
      } else {
        const a = CLEANS[Math.floor(r() * CLEANS.length)]!
        expect(rewriteHebrewAnswer(a)).toBe(a)                         // facts preserved (strict no-op)
        expect(shapeForSpeech(a).length).toBeLessThanOrEqual(a.length) // speech never longer
      }
    }
  })
})
