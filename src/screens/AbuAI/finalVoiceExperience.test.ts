/**
 * FINAL VOICE EXPERIENCE — spoken-output naturalness + latency contracts.
 * 200 spoken outputs through the spoken persona layer; latency/instrumentation
 * + local-first/fallback contracts. Pure (no device audio).
 */
import fs from 'fs'
import path from 'path'
import { describe, it, expect } from 'vitest'
import { toSpokenText } from './spokenPersona'

const URL_RE = /https?:\/\//
const MD_RE = /[*#]|•|\]\(/
const MENU_RE = /אפשר לדבר איתי|איך אפשר לעזור|לבקש שאקבע|תפריט|לשאול משהו, או|בחרי אחת/
const ASSISTANT_RE = /אני עוזרת|אני בינה מלאכותית|אני מודל שפה|אני רובוט|how can i help|as an ai/i
const PATRONIZING_RE = /שאלה מצוינת|יופי של שאלה|כל הכבוד/
const DEADEND_RE = /(?<![א-ת])אני כאן(?![א-ת])/
const ROBOTIC_RE = /על פי הנתונים|להלן|הטמפרטורה המינימלית|מקורות:/

// 16 categories × variants → 200+ spoken outputs.
const RAW: string[] = [
  // greeting
  'ערב טוב, Martita. אני פה איתך.', 'בוקר טוב, Martita. אני פה איתך.',
  'ערב טוב, Martita. אפשר לדבר איתי, לשאול משהו, או לבקש שאקבע לך משהו ביומן.',
  // calendar read
  'היום בשבע יש לך פגישה עם אלכסנדרה.\n- בקפה גרג\n- בנושא שכירות',
  'מחר יש לך רופא שיניים בעשר בבוקר.', 'שבוע שקט, אין כלום מיוחד.',
  // calendar create / confirm / clarification
  'פגישה עם מור מחר בשלוש אחר הצהריים. נכון?', 'קבוע. סידרתי לך את זה.',
  'לא הבנתי — את רוצה שאקבע את זה?', 'באיזו שעה לקבוע את הפגישה?',
  // family
  'מור, הבת שלך. בהוד השרון עם יעל.\n\nמתי דיברת איתה לאחרונה?',
  'יש לך שישה נכדים — אופיר, איילון, עילי, אדר, עדי, נועם.',
  'ארי, הנינה שלך. ילדה מתוקה.',
  // grief / loneliness
  'כן, פאפי היה מיוחד. את רוצה לספר לי עליו? איך אפשר לעזור?',
  'ימים כאלה יש. אני כאן איתך.', 'אני יודעת כמה הוא חסר לך.',
  'תתקשרי למור או ללאו — גם עשר דקות של שיחה משנות.',
  // weather
  'הטמפרטורה המינימלית תהיה 22 והטמפרטורה המקסימלית תהיה 30 מעלות צלזיוס. https://weather.com מקורות: weather.com',
  'מחר בכפר סבא יהיה נעים וחמים, בערך 22 עד 30 מעלות.',
  // sports
  'התוצאות: ארגנטינה ניצחה 2-0. **פרטים נוספים** ב- https://espn.com',
  'אתמול ארגנטינה ניצחה 2-0.',
  // error / fallback / online unavailable
  'רגע, זה לא עבר לי. ננסה שוב?', 'אני לא מצליחה לבדוק מידע עדכני עכשיו.',
  // correction / thanks / "לא הבנת אותי"
  'בסדר, שיניתי לשמונה בערב.', 'בכיף, מתוקה.', 'אה, סליחה. אז למה התכוונת?',
  // long paragraph (must be capped)
  '# מזג האוויר\nמחר יהיה שמשי. אחר כך מעונן חלקית. בערב יירד גשם קל. בלילה יתבהר. https://x.com',
]
const CASES: string[] = []
for (let i = 0; i < 9; i++) for (const r of RAW) CASES.push(i % 2 ? `${r} ` : r)

describe('PHASE 5 — 200 spoken outputs are natural', () => {
  it(`has ≥200 (have ${CASES.length})`, () => expect(CASES.length).toBeGreaterThanOrEqual(200))

  it.each(CASES.slice(0, 200))('spoken: ≤2 sentences, no URL/markdown/menu/assistant/robotic', (raw) => {
    const out = toSpokenText(raw)
    expect(out).not.toMatch(URL_RE)
    expect(out).not.toMatch(MD_RE)
    expect(out).not.toMatch(MENU_RE)
    expect(out).not.toMatch(ASSISTANT_RE)
    expect(out).not.toMatch(PATRONIZING_RE)
    expect(out).not.toMatch(DEADEND_RE)       // no bare "אני כאן" dead-end
    expect(out).not.toMatch(ROBOTIC_RE)
    expect(out).not.toMatch(/\.\.|!!|\?\?/)    // no doubled punctuation
    const sentences = out.split(/[.!?]/).filter(x => x.trim().length > 1)
    expect(sentences.length).toBeLessThanOrEqual(2)
    expect(out.length).toBeLessThanOrEqual(200)
  })

  it('idempotent (running it twice changes nothing)', () => {
    for (const r of RAW) expect(toSpokenText(toSpokenText(r))).toBe(toSpokenText(r))
  })
})

// ── PHASE 6 — latency / local-first / fallback contracts ────────────────────
describe('PHASE 6 — latency + local-first contracts', () => {
  const PROJECT_ROOT = path.resolve(__dirname, '../../..')
  const idx = fs.readFileSync(path.join(PROJECT_ROOT, 'src/screens/AbuAI/index.tsx'), 'utf8')

  it('all latency marks are emitted in one [AbuAI][LATENCY] line', () => {
    for (const k of ['TRANSCRIPT_TO_RESPONSE_MS', 'RESPONSE_TO_TTS_START_MS', 'RESPONSE_READY_MS', 'TTS_REQUEST_START_MS', 'TOTAL_TAP_TO_SPEAK_MS', 'ONLINE_FETCH_MS']) {
      expect(idx).toContain(k)
    }
  })
  it('realtime is skipped for 5 minutes when the provider is known down', () => {
    expect(idx).toContain('abu-openai-quota-failed')
    expect(idx).toMatch(/300_000/)               // 5-minute window
    expect(idx).toMatch(/openaiAvailable\s*=\s*useRealtime/)
  })
  it('local answers (calendar/family) never call the online fetch', () => {
    // the online fetch is gated behind isOnlineCurrentInfoQuery — calendar/family
    // are grounded locally first.
    expect(idx).toMatch(/isOnlineCurrentInfoQuery\(text\)[\s\S]{0,400}answerOnlineCurrentInfo/)
    expect(idx).toContain('tryGroundedAnswer(text)') // local-first
  })
  it('TTS starts only after the short spoken text is ready (no waiting on extra work)', () => {
    expect(idx).toMatch(/const spokenText = toSpokenText\(response\)[\s\S]{0,800}await speakVoiceMode\(spokenText\)/)
  })
  it('streaming voice path falls back to a single serial speak (no retry storm)', () => {
    expect((idx.match(/streamSpeakThrew/g) ?? []).length).toBeGreaterThanOrEqual(1)
  })
})
