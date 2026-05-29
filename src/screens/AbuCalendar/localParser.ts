import { detectEmoji } from './service'

export interface LocalDraft {
  title: string
  date: string | null
  time: string | null
  ambiguousTime: boolean
  location: string | null
  notes: string | null
  emoji: string
  confidence: number
  personPhrase?: string | null
}

const HEBREW_HOUR_WORDS: Record<string, number> = {
  'אחת': 1, 'אחד': 1,
  'שתיים': 2, 'שניים': 2,
  'שלוש': 3, 'שלושה': 3,
  'ארבע': 4, 'ארבעה': 4,
  'חמש': 5, 'חמישה': 5,
  'שש': 6, 'שישה': 6,
  'שבע': 7, 'שבעה': 7,
  'שמונה': 8,
  'תשע': 9, 'תשעה': 9,
  'עשר': 10, 'עשרה': 10,
  'אחת עשרה': 11, 'אחד עשר': 11,
  'שתים עשרה': 12, 'שנים עשר': 12,
}

const HEBREW_TENS_WORDS: Record<string, number> = {
  'עשרה': 10, 'עשר': 10,
  'חמש עשרה': 15, 'חמישה עשר': 15,
  'עשרים': 20,
  'שלושים': 30,
  'ארבעים': 40,
  'חמישים': 50,
}

const HEBREW_UNITS_WORDS: Record<string, number> = {
  'אחת': 1, 'אחד': 1,
  'שתיים': 2, 'שניים': 2, 'שתי': 2,
  'שלוש': 3, 'שלושה': 3,
  'ארבע': 4, 'ארבעה': 4,
  'חמש': 5, 'חמישה': 5,
  'שש': 6, 'שישה': 6,
  'שבע': 7, 'שבעה': 7,
  'שמונה': 8,
  'תשע': 9, 'תשעה': 9,
}

const KNOWN_CITIES = [
  'הרצליה', 'תל אביב', 'תל-אביב', 'ירושלים', 'חיפה', 'באר שבע', 'באר-שבע',
  'נתניה', 'אשדוד', 'אשקלון', 'רמת גן', 'רמת-גן', 'גבעתיים', 'ראשון לציון',
  'פתח תקווה', 'פתח-תקווה', 'רחובות', 'רעננה', 'הוד השרון', 'הוד-השרון',
  'כפר סבא', 'כפר-סבא', 'חולון', 'בת ים', 'בת-ים', 'נס ציונה', 'מודיעין',
  'בית שמש', 'אילת', 'טבריה', 'נצרת', 'כפר יונה',
]

const PM_HINTS = /(אחר.{0,4}הצהריים|אחה"צ|בצהריים|צהריים|בערב|אחרי הצהריים)/
const NIGHT_HINTS = /(בלילה|לפנות בוקר)/
const MORNING_HINTS = /(בבוקר|לפני הצהריים)/

// ─── Spanish / English period hints (P0 — deterministic, no Groq) ──────
const PM_HINTS_ES = /(de\s+la\s+tarde|de\s+la\s+noche|por\s+la\s+tarde|por\s+la\s+noche)/i
const MORNING_HINTS_ES = /(de\s+la\s+ma[ñn]ana|por\s+la\s+ma[ñn]ana)/i
// `\b` does NOT match between a digit and a letter (digits are word chars
// too), so "4pm" would slip past `\bpm\b`. Use letter-only lookaround so
// "4pm" / "4 pm" / "4:00pm" all detect PM; "champ" / "amplifier" do not.
const PM_HINTS_EN_INLINE = /(?<![a-zA-Z])(pm|p\.m\.?)(?![a-zA-Z])|in\s+the\s+afternoon|in\s+the\s+evening|at\s+night/i
const MORNING_HINTS_EN_INLINE = /(?<![a-zA-Z])(am|a\.m\.?)(?![a-zA-Z])|in\s+the\s+morning/i

// Spanish hour words → number.
const SPANISH_HOUR_WORDS: Record<string, number> = {
  'una': 1, 'dos': 2, 'tres': 3, 'cuatro': 4, 'cinco': 5, 'seis': 6,
  'siete': 7, 'ocho': 8, 'nueve': 9, 'diez': 10, 'once': 11, 'doce': 12,
}
// English hour words → number.
const ENGLISH_HOUR_WORDS: Record<string, number> = {
  'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6,
  'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10, 'eleven': 11, 'twelve': 12,
}
// Spanish day-of-week names (lowercase, accent-tolerant).
const SPANISH_DAY_WORDS: Array<[RegExp, number]> = [
  [/\bdomingo\b/i, 0], [/\blunes\b/i, 1], [/\bmartes\b/i, 2],
  [/\bmi[eé]rcoles\b/i, 3], [/\bjueves\b/i, 4], [/\bviernes\b/i, 5],
  [/\bs[aá]bado\b/i, 6],
]
const ENGLISH_DAY_WORDS: Array<[RegExp, number]> = [
  [/\bsunday\b/i, 0], [/\bmonday\b/i, 1], [/\btuesday\b/i, 2],
  [/\bwednesday\b/i, 3], [/\bthursday\b/i, 4], [/\bfriday\b/i, 5],
  [/\bsaturday\b/i, 6],
]


// Hebrew letters are not part of \w in JS regex, so \b breaks. Use explicit Hebrew lookarounds.
const NB = '(?<![\\u0590-\\u05FF])' // not preceded by a Hebrew letter
const NA = '(?![\\u0590-\\u05FF])'  // not followed by a Hebrew letter

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function isoToday(todayISO: string): Date {
  const [y, m, d] = todayISO.split('-').map(Number) as [number, number, number]
  return new Date(y, m - 1, d)
}

function toISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

interface DateExtract { date: string | null; consumed: string[] }
function extractDate(text: string, todayISO: string): DateExtract {
  const consumed: string[] = []
  const today = isoToday(todayISO)

  // ל? allows the dative "למחר" / "להיום" prefix the speaker often uses.
  const mahMatch = text.match(new RegExp(`${NB}(ל?מחרתיים)${NA}`))
  if (mahMatch) {
    const t = new Date(today); t.setDate(t.getDate() + 2)
    consumed.push(mahMatch[1]!)
    return { date: toISO(t), consumed }
  }
  const morMatch = text.match(new RegExp(`${NB}(ל?מחר)${NA}`))
  if (morMatch) {
    const t = new Date(today); t.setDate(t.getDate() + 1)
    consumed.push(morMatch[1]!)
    return { date: toISO(t), consumed }
  }
  const todayMatch = text.match(new RegExp(`${NB}(ל?היום)${NA}`))
  if (todayMatch) {
    consumed.push(todayMatch[1]!)
    return { date: todayISO, consumed }
  }

  const dayWords: Array<[string, number]> = [
    ['ראשון', 0], ['שני', 1], ['שלישי', 2], ['רביעי', 3],
    ['חמישי', 4], ['שישי', 5], ['שבת', 6],
  ]
  for (const [name, idx] of dayWords) {
    const re = new RegExp(`(?:ביום\\s+|יום\\s+)${name}${NA}`)
    const m = text.match(re)
    if (m) {
      const cur = today.getDay()
      let diff = (idx - cur + 7) % 7
      if (diff === 0) diff = 7
      const t = new Date(today); t.setDate(t.getDate() + diff)
      consumed.push(m[0])
      return { date: toISO(t), consumed }
    }
  }

  // "30 במאי" / "15 ביוני" — Hebrew month names.
  const HEB_MONTHS_MAP: Record<string, number> = {
    'ינואר': 1, 'פברואר': 2, 'מרץ': 3, 'אפריל': 4, 'מאי': 5, 'יוני': 6,
    'יולי': 7, 'אוגוסט': 8, 'ספטמבר': 9, 'אוקטובר': 10, 'נובמבר': 11, 'דצמבר': 12,
  }
  const monthNameRe = /(?<!\d)(\d{1,2})\s+ב(ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)/
  const mnm = text.match(monthNameRe)
  if (mnm) {
    const day = parseInt(mnm[1]!, 10)
    const month = HEB_MONTHS_MAP[mnm[2]!]!
    const yr = today.getFullYear()
    const t = new Date(yr, month - 1, day)
    if (t < today) t.setFullYear(yr + 1)
    consumed.push(mnm[0])
    return { date: toISO(t), consumed }
  }

  const dmMatch = text.match(/(?<!\d)(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?(?!\d)/)
  if (dmMatch) {
    const day = parseInt(dmMatch[1]!, 10)
    const month = parseInt(dmMatch[2]!, 10)
    let year = today.getFullYear()
    if (dmMatch[3]) {
      year = parseInt(dmMatch[3], 10)
      if (year < 100) year += 2000
    }
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      const t = new Date(year, month - 1, day)
      if (!dmMatch[3] && t < today) t.setFullYear(year + 1)
      consumed.push(dmMatch[0])
      return { date: toISO(t), consumed }
    }
  }

  // ─── Spanish / English deterministic dates (P0) ─────────────────────────
  //
  // tomorrow / mañana → today + 1
  // today    / hoy    → today
  // next Sunday / el domingo / domingo que viene → next occurrence
  if (/\b(tomorrow|ma[ñn]ana)\b/i.test(text)) {
    const t = new Date(today); t.setDate(t.getDate() + 1)
    const m = text.match(/\b(tomorrow|ma[ñn]ana)\b/i)
    consumed.push(m?.[0] ?? 'tomorrow')
    return { date: toISO(t), consumed }
  }
  if (/\b(today|hoy)\b/i.test(text)) {
    const m = text.match(/\b(today|hoy)\b/i)
    consumed.push(m?.[0] ?? 'today')
    return { date: todayISO, consumed }
  }
  for (const [re, idx] of [...SPANISH_DAY_WORDS, ...ENGLISH_DAY_WORDS]) {
    const m = text.match(re)
    if (m) {
      const cur = today.getDay()
      let diff = (idx - cur + 7) % 7
      if (diff === 0) diff = 7
      const t = new Date(today); t.setDate(t.getDate() + diff)
      consumed.push(m[0])
      return { date: toISO(t), consumed }
    }
  }

  return { date: null, consumed: [] }
}

interface TimeExtract { time: string | null; ambiguous: boolean; consumed: string[] }

function applyPeriod(hour: number, text: string): { hour: number; ambiguous: boolean } {
  // PM: Hebrew "אחר הצהריים / בערב", Spanish "de la tarde / de la noche",
  // English "pm / in the afternoon / in the evening".
  if (PM_HINTS.test(text) || PM_HINTS_ES.test(text) || PM_HINTS_EN_INLINE.test(text)) {
    if (hour >= 1 && hour <= 11) return { hour: hour + 12, ambiguous: false }
    return { hour, ambiguous: false }
  }
  if (NIGHT_HINTS.test(text)) {
    // "שתים עשרה בלילה" / "12 בלילה" = midnight = 00:00, not 12:00
    return { hour: hour === 12 ? 0 : hour, ambiguous: false }
  }
  // AM: Hebrew "בבוקר", Spanish "de la mañana", English "am / in the morning".
  if (MORNING_HINTS.test(text) || MORNING_HINTS_ES.test(text) || MORNING_HINTS_EN_INLINE.test(text)) {
    return { hour: hour >= 12 ? hour - 12 : hour, ambiguous: false }
  }
  if (hour >= 1 && hour <= 6) return { hour, ambiguous: true }
  return { hour, ambiguous: false }
}

function parseHebrewMinuteWords(after: string): { minutes: number; consumed: string } | null {
  const trimmed = after.replace(/^\s+/, '')
  const fractions: Array<[RegExp, number, string]> = [
    [new RegExp(`^וחצי${NA}`), 30, 'וחצי'],
    [new RegExp(`^ורבע${NA}`), 15, 'ורבע'],
    [new RegExp(`^ועשרים וחמש(?:ה)?${NA}`), 25, 'ועשרים וחמש'],
    [new RegExp(`^ועשרים${NA}`), 20, 'ועשרים'],
    [new RegExp(`^ושלושים וחמש(?:ה)?${NA}`), 35, 'ושלושים וחמש'],
    [new RegExp(`^ושלושים${NA}`), 30, 'ושלושים'],
    [new RegExp(`^וארבעים וחמש(?:ה)?${NA}`), 45, 'וארבעים וחמש'],
    [new RegExp(`^וארבעים${NA}`), 40, 'וארבעים'],
    [new RegExp(`^וחמישים${NA}`), 50, 'וחמישים'],
    [new RegExp(`^ועשר(?:ה)?${NA}`), 10, 'ועשר'],
    [new RegExp(`^וחמש(?:ה)?${NA}`), 5, 'וחמש'],
  ]
  for (const [re, val, str] of fractions) {
    if (re.test(trimmed)) return { minutes: val, consumed: str }
  }

  const tens = Object.keys(HEBREW_TENS_WORDS).sort((a, b) => b.length - a.length)
  for (const t of tens) {
    const re = new RegExp(`^${escapeRe(t)}(?:\\s+ו([\\u0590-\\u05FF]+))?${NA}`)
    const m = trimmed.match(re)
    if (m) {
      let mins = HEBREW_TENS_WORDS[t]!
      let consumed = t
      if (m[1]) {
        const u = HEBREW_UNITS_WORDS[m[1]]
        if (typeof u === 'number') {
          mins += u
          consumed = `${t} ו${m[1]}`
        }
      }
      if (mins < 60) return { minutes: mins, consumed }
    }
  }
  return null
}

function extractTime(text: string): TimeExtract {
  // Accept "HH:MM", "HH.MM", and optional "ב-" / "בשעה" prefix.
  // ASR commonly returns 17.34 instead of 17:34.
  const numMatch = text.match(/(?:בשעה\s+|ב-)?(\d{1,2})[:.](\d{2})(?!\d)/)
  if (numMatch) {
    const h = parseInt(numMatch[1]!, 10)
    const m = parseInt(numMatch[2]!, 10)
    if (h >= 0 && h < 24 && m >= 0 && m < 60) {
      const { hour, ambiguous } = applyPeriod(h, text)
      const time = `${String(hour).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      return { time, ambiguous, consumed: [numMatch[0]] }
    }
  }

  // Space-separated minutes only when explicitly preceded by "בשעה",
  // e.g. "בשעה 17 34" — keeps random number pairs from being misread.
  const spaceMatch = text.match(/בשעה\s+(\d{1,2})\s+(\d{2})(?!\d)/)
  if (spaceMatch) {
    const h = parseInt(spaceMatch[1]!, 10)
    const m = parseInt(spaceMatch[2]!, 10)
    if (h >= 0 && h < 24 && m >= 0 && m < 60) {
      const { hour, ambiguous } = applyPeriod(h, text)
      const time = `${String(hour).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      return { time, ambiguous, consumed: [spaceMatch[0]] }
    }
  }

  // Numeric hour + Hebrew fraction: "21 וחצי" → 21:30, "ב-21 וחצי" → 21:30.
  // Must come before hourOnly so the fraction is not dropped.
  const numFracMatch = text.match(/(?:(?:בשעה\s+|ב-)(\d{1,2})|(?<!\d)(\d{1,2}))\s+(וחצי|ורבע|ועשרים|ושלושים|וחמישים|ועשר|וחמש)(?![֐-׿])/)
  if (numFracMatch) {
    const raw = numFracMatch[1] ?? numFracMatch[2]
    const h = parseInt(raw!, 10)
    const fracMap: Record<string, number> = {
      'וחצי': 30, 'ורבע': 15, 'ועשרים': 20, 'ושלושים': 30, 'וחמישים': 50, 'ועשר': 10, 'וחמש': 5,
    }
    const m = fracMap[numFracMatch[3]!] ?? 0
    if (h >= 0 && h < 24) {
      const { hour, ambiguous } = applyPeriod(h, text)
      return { time: `${String(hour).padStart(2, '0')}:${String(m).padStart(2, '0')}`, ambiguous, consumed: [numFracMatch[0]] }
    }
  }

  // Hour-only: "בשעה 3", "ב-3", "ב-15" — must NOT be a date marker like "ב-15 לחודש".
  const hourOnly = text.match(/(?:בשעה\s+(\d{1,2})|ב-(\d{1,2}))(?!\s*לחודש)(?=\s|$|[.,!?])/)
  if (hourOnly) {
    const raw = hourOnly[1] ?? hourOnly[2]
    const h = parseInt(raw!, 10)
    if (h >= 0 && h < 24) {
      const { hour, ambiguous } = applyPeriod(h, text)
      const time = `${String(hour).padStart(2, '0')}:00`
      return { time, ambiguous, consumed: [hourOnly[0]] }
    }
  }

  const hourPat = Object.keys(HEBREW_HOUR_WORDS).sort((a, b) => b.length - a.length).join('|')
  // "בשעה שבע" (שעה + bare word) OR "בשבע" (ב + word).
  // Previous regex required "ב" even after "בשעה", missing "בשעה שבע בערב".
  const wordRe = new RegExp(`(?:בשעה\\s+|ב)(${hourPat})${NA}([\\s\\u0590-\\u05FF]*)`)
  const wm = text.match(wordRe)
  if (wm) {
    const h = HEBREW_HOUR_WORDS[wm[1]!]
    if (typeof h === 'number') {
      const minResult = parseHebrewMinuteWords(wm[2] ?? '')
      const minutes = minResult?.minutes ?? 0
      const { hour, ambiguous } = applyPeriod(h, text)
      const time = `${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
      const consumedStr = minResult ? `ב${wm[1]} ${minResult.consumed}` : `ב${wm[1]}`
      return { time, ambiguous, consumed: [consumedStr] }
    }
  }

  // "השעה חמש" / "השעה <hour-word>" — accept hour word without requiring minutes.
  const labelRe = new RegExp(`השעה\\s+(${hourPat})${NA}`)
  const lm = text.match(labelRe)
  if (lm) {
    const h = HEBREW_HOUR_WORDS[lm[1]!]
    if (typeof h === 'number') {
      const { hour, ambiguous } = applyPeriod(h, text)
      const time = `${String(hour).padStart(2, '0')}:00`
      return { time, ambiguous, consumed: [lm[0]] }
    }
  }

  const hasPeriodHint = PM_HINTS.test(text) || NIGHT_HINTS.test(text) || MORNING_HINTS.test(text)
    || PM_HINTS_ES.test(text) || PM_HINTS_EN_INLINE.test(text)
    || MORNING_HINTS_ES.test(text) || MORNING_HINTS_EN_INLINE.test(text)
  const bareRe = new RegExp(`${NB}(${hourPat})${NA}([\\s\\u0590-\\u05FF]*)`)
  const bm = text.match(bareRe)
  if (bm) {
    const h = HEBREW_HOUR_WORDS[bm[1]!]
    const minResult = parseHebrewMinuteWords(bm[2] ?? '')
    if (typeof h === 'number' && (minResult || hasPeriodHint)) {
      const minutes = minResult?.minutes ?? 0
      const { hour, ambiguous } = applyPeriod(h, text)
      const time = `${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
      const consumedStr = minResult ? `${bm[1]} ${minResult.consumed}` : bm[1]!
      return { time, ambiguous, consumed: [consumedStr] }
    }
  }

  // ─── Spanish / English deterministic time (P0) ────────────────────────
  //
  //  "at 4pm" / "at 4:30pm" / "at 16:00" — explicit period wins.
  //  "a las cuatro" / "a las diez" — Spanish word-hour.
  //  "at four" / "at ten am" — English word-hour.
  //
  //  Period policy mirrors the Hebrew applyPeriod():
  //    - explicit pm / "de la tarde" / "in the afternoon" → +12 for 1–11
  //    - explicit am / "de la mañana" / "in the morning"  → −12 for 12
  //    - hours 1–6 with no period hint → ambiguous=true (UI asks AM/PM)
  //    - other hours stay as-is (no ambiguity)

  function applyPeriodI18n(hour: number, src: string): { hour: number; ambiguous: boolean } {
    if (PM_HINTS_EN_INLINE.test(src) || PM_HINTS_ES.test(src)) {
      if (hour >= 1 && hour <= 11) return { hour: hour + 12, ambiguous: false }
      return { hour, ambiguous: false }
    }
    if (MORNING_HINTS_EN_INLINE.test(src) || MORNING_HINTS_ES.test(src)) {
      return { hour: hour === 12 ? 0 : hour, ambiguous: false }
    }
    if (hour >= 1 && hour <= 6) return { hour, ambiguous: true }
    return { hour, ambiguous: false }
  }

  // "at HH:MM" (English) / "a las HH:MM" (Spanish) — explicit numeric.
  const numI18n = text.match(/\b(?:at|a\s+las)\s+(\d{1,2})\s*[:.]\s*(\d{2})(?:\s*(am|pm|p\.m\.?|a\.m\.?))?\b/i)
  if (numI18n) {
    const h = parseInt(numI18n[1]!, 10)
    const m = parseInt(numI18n[2]!, 10)
    if (h >= 0 && h < 24 && m >= 0 && m < 60) {
      const { hour, ambiguous } = applyPeriodI18n(h, numI18n[0])
      const time = `${String(hour).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      return { time, ambiguous, consumed: [numI18n[0]] }
    }
  }

  // "at 4" / "at 4pm" / "at four" / "a las 4" / "a las cuatro".
  // Numeric form.
  const numericI18n = text.match(/\b(?:at|a\s+las)\s+(\d{1,2})(?:\s*(am|pm|p\.m\.?|a\.m\.?))?\b/i)
  if (numericI18n) {
    const h = parseInt(numericI18n[1]!, 10)
    if (h >= 0 && h < 24) {
      const { hour, ambiguous } = applyPeriodI18n(h, numericI18n[0])
      const time = `${String(hour).padStart(2, '0')}:00`
      return { time, ambiguous, consumed: [numericI18n[0]] }
    }
  }

  // Spanish word-hour: "a las cuatro" / "a las diez de la mañana".
  const esHourKeys = Object.keys(SPANISH_HOUR_WORDS).join('|')
  const esWord = text.match(new RegExp(`\\ba\\s+las\\s+(${esHourKeys})(\\s+de\\s+la\\s+(?:tarde|noche|ma[ñn]ana))?\\b`, 'i'))
  if (esWord) {
    const h = SPANISH_HOUR_WORDS[esWord[1]!.toLowerCase()]
    if (typeof h === 'number') {
      const { hour, ambiguous } = applyPeriodI18n(h, esWord[0])
      const time = `${String(hour).padStart(2, '0')}:00`
      return { time, ambiguous, consumed: [esWord[0]] }
    }
  }

  // English word-hour: "at four pm" / "at ten in the morning".
  const enHourKeys = Object.keys(ENGLISH_HOUR_WORDS).join('|')
  const enWord = text.match(new RegExp(`\\bat\\s+(${enHourKeys})(\\s+(?:am|pm|p\\.m\\.?|a\\.m\\.?|in\\s+the\\s+(?:morning|afternoon|evening)))?\\b`, 'i'))
  if (enWord) {
    const h = ENGLISH_HOUR_WORDS[enWord[1]!.toLowerCase()]
    if (typeof h === 'number') {
      const { hour, ambiguous } = applyPeriodI18n(h, enWord[0])
      const time = `${String(hour).padStart(2, '0')}:00`
      return { time, ambiguous, consumed: [enWord[0]] }
    }
  }

  return { time: null, ambiguous: false, consumed: [] }
}

interface LocationExtract { location: string | null; consumed: string[] }
function extractLocation(text: string): LocationExtract {
  const consumed: string[] = []
  let street: string | null = null
  let city: string | null = null
  let floor: string | null = null

  // Street: "ברחוב X NN" / "לרחוב X NN" / "אלרחוב X NN" / "בכתובת X NN"
  // Lookahead lets us stop at "קומה N" (floor follows the street) or another preposition.
  const streetRe = new RegExp(
    `${NB}(?:ב|ל|אל)(רחוב|כתובת)\\s+([\\u0590-\\u05FF][\\u0590-\\u05FF"'\\s־-]*?)(?:\\s+(\\d{1,4}))?(?=\\s+(?:ב|ל|אל)?[\\u0590-\\u05FF]|\\s+קומה|\\s*[,.]|$)`,
  )
  const sm = text.match(streetRe)
  if (sm) {
    const name = sm[2]!.trim()
    const num = sm[3]
    street = num ? `רחוב ${name} ${num}` : `רחוב ${name}`
    consumed.push(sm[0]!)
  }

  // Floor: "קומה N"
  const floorRe = /קומה\s+(\d{1,3})/
  const fm = text.match(floorRe)
  if (fm) {
    floor = fm[1]!
    consumed.push(fm[0])
  }

  const sortedCities = [...KNOWN_CITIES].sort((a, b) => b.length - a.length)
  for (const c of sortedCities) {
    const re = new RegExp(`${NB}(?:ב|ל|אל)${escapeRe(c)}${NA}`)
    const cm = text.match(re)
    if (cm) {
      city = c
      consumed.push(cm[0])
      break
    }
  }

  const parts: string[] = []
  if (street) parts.push(street)
  if (floor) parts.push(`קומה ${floor}`)
  if (city) parts.push(city)
  if (parts.length > 0) return { location: parts.join(', '), consumed }
  return { location: null, consumed: [] }
}

interface NotesExtract { notes: string | null; consumed: string[] }
function extractNotes(text: string, alreadyConsumed: string[]): NotesExtract {
  let working = text
  for (const c of alreadyConsumed) {
    if (!c) continue
    working = working.split(c).join(' ')
  }

  for (const trig of ['בגלל', 'מכיוון ש', 'כי']) {
    const re = new RegExp(`${NB}${trig}\\s+([\\u0590-\\u05FF].*?)\\s*[.!?]?\\s*$`)
    const m = working.match(re)
    if (m && m[1]) {
      const note = m[1].trim().replace(/[.!?]+$/, '')
      if (note) return { notes: note, consumed: [m[0]] }
    }
  }

  // Relative clause "ש<pronoun> ..." — common Hebrew way to add context about a person.
  const relMatch = working.match(/(?:^|[\s,])ש(היא|הוא|הם|הן|אני|אנחנו|זה|זאת)\s+(.+?)\s*[.!?]?\s*$/)
  if (relMatch && relMatch[1] && relMatch[2]) {
    const note = `${relMatch[1]} ${relMatch[2]}`.trim()
    if (note.length >= 3) return { notes: note, consumed: [`ש${relMatch[1]} ${relMatch[2]}`] }
  }

  const positions: number[] = []
  let from = 0
  while (true) {
    const idx = working.indexOf('יש לי', from)
    if (idx === -1) break
    positions.push(idx)
    from = idx + 1
  }
  if (positions.length === 0) return { notes: null, consumed: [] }

  const last = positions[positions.length - 1]!
  const isSecondaryByCount = positions.length >= 2
  const before = working.slice(0, last).trimEnd()
  const isSecondaryByPunct = before.endsWith(',') || before.endsWith('.')
  if (!isSecondaryByCount && !isSecondaryByPunct) return { notes: null, consumed: [] }

  const tailStart = last + 'יש לי'.length
  const tail = working.slice(tailStart).trim().replace(/[.!?]+$/, '')
  if (!tail) return { notes: null, consumed: [] }

  const commaIdx = working.lastIndexOf(',', last)
  const spanStart = commaIdx >= 0 ? commaIdx : last
  const span = working.slice(spanStart).trim()
  return { notes: tail, consumed: [span] }
}

const TITLE_LEAD_STRIPS = [
  /^יש לי\s+/,
  /^אני\s+(?:צריך|צריכה)\s+/,
  /^להיות\s+/,
  /^ל?ישר\s+/,
  /^בישר\s+/,
  /^תקבעי לי\s+/, /^תקבעי\s+/, /^תקבע לי\s+/, /^תקבע\s+/, /^קבעי\s+/, /^קבע\s+/,
  /^תזכירי לי\s+/, /^תזכירי\s+/, /^תזכיר לי\s+/, /^תזכיר\s+/, /^תזכרי\s+/,
  /^שימי לי\s+/, /^שימי\s+/, /^שים לי\s+/, /^שים\s+/,
  /^תוסיפי לי\s+/, /^תוסיפי\s+/, /^תוסיף לי\s+/, /^תוסיף\s+/,
  /^תכניסי לי\s+/, /^תכניסי\s+/, /^תכניס לי\s+/, /^תכניס\s+/,
  /^תרשמי\s+/, /^תרשום\s+/,
  // ASR mishear: Whisper may transcribe the command verb "תקבעי" as "תקווה"
  // when no verb prior exists. Strip it here as a belt-and-suspenders guard.
  // Safe: legitimate place references ("פתח תקווה") never start the title.
  /^תקווה\s+/,
]

function buildTitle(text: string, allConsumed: string[]): string {
  let working = text
  const sorted = [...allConsumed].filter(Boolean).sort((a, b) => b.length - a.length)
  for (const c of sorted) working = working.split(c).join(' ')
  working = working.replace(/[,.]+/g, ' ').replace(/\s+/g, ' ').trim()
  // Strip leading filler words; loop because patterns may stack
  // ("אני צריך" → "להיות" → "ישר" → "לפגוש את …").
  let prev: string
  do {
    prev = working
    for (const re of TITLE_LEAD_STRIPS) working = working.replace(re, '')
  } while (working !== prev && working.length > 0)
  return working.trim()
}

/** Final safety check before any appointment title is persisted.
 *  Applies the same TITLE_LEAD_STRIPS loop used at parse time, then
 *  falls back to a clean "פגישה עם <personName>" if stripping left nothing.
 *  Call this immediately before createAppointmentSafe. */
const COMMAND_VERB_ONLY = /^(תקבעי לי|תקבעי|תקבע לי|תקבע|קבעי|קבע|תזכירי לי|תזכירי|תזכיר לי|תזכיר|תזכרי|שימי לי|שימי|שים לי|שים|תוסיפי לי|תוסיפי|תוסיף לי|תוסיף|תכניסי לי|תכניסי|תכניס לי|תכניס|תרשמי|תרשום|תכנון פגישה|תקווה)$/

export function sanitizeTitleForSave(title: string, personName?: string | null): string {
  let t = title.trim()
  let prev: string
  do {
    prev = t
    for (const re of TITLE_LEAD_STRIPS) t = t.replace(re, '')
    t = t.trim()
  } while (t !== prev && t.length > 0)
  if (COMMAND_VERB_ONLY.test(t)) t = ''
  if (!t && personName?.trim()) return `פגישה עם ${personName.trim()}`
  return t || title.trim()
}

export function cleanTranscript(text: string): string {
  let s = text.trim()
  // Strip stutters: repeated consecutive Hebrew word ("מחר מחר" → "מחר")
  s = s.replace(/(?<![֐-׿])([֐-׿]{2,})(?:\s+\1)+(?![֐-׿])/g, '$1')
  // Repeated phrase up to 4 words ("בשעה 10:32 בשעה 10:32" → "בשעה 10:32")
  s = s.replace(/((?:\S+\s+){1,3}\S+)\s+\1/g, '$1')
  // Self-correction: "בעוד X (סליחה|בעצם|תיקון|לא) בעוד Y" → "בעוד Y".
  // Only fires when the corrector word is followed by a parallel "בעוד"
  // phrase, so it never eats legitimate text. Non-greedy middle keeps the
  // smallest first-clause.
  s = s.replace(/בעוד\s+[֐-׿\s\d]+?\s+(?:סליחה|בעצם|תיקון|לא),?\s+(?=בעוד\s)/g, '')
  // Date-word correction: "מחר/ביום X (סליחה|לא|בעצם|תיקון) מחר/ביום Y" → "ביום Y".
  s = s.replace(/(?:מחר|מחרתיים|היום|ביום\s+[֐-׿]+)\s+(?:לא|סליחה|בעצם|תיקון),?\s+(?=(?:מחר|מחרתיים|היום|ביום\s))/g, '')
  // Time-word correction: "ב<word> [<word>] (סליחה|לא|בעצם|תיקון) ב<word>" → "ב<word>".
  // The optional second word handles "בשש בבוקר לא בשבע" → "בשבע".
  s = s.replace(/ב[֐-׿]+(?:\s+[֐-׿]+)?\s+(?:סליחה|בעצם|תיקון|לא),?\s+(?=ב[֐-׿])/g, '')
  // Person correction: "עם X (סליחה|לא|בעצם|תיקון) עם Y" → "עם Y".
  s = s.replace(/עם\s+[֐-׿']+\s+(?:לא|סליחה|בעצם|תיקון),?\s+(?=עם\s)/g, '')
  // Normalize "ב - 3" / "ב -3" → "ב-3" so the hour-only matcher catches it
  s = s.replace(/ב\s*-\s*(\d)/g, 'ב-$1')
  // Normalize "10 :32" / "10: 32" → "10:32"
  s = s.replace(/(\d)\s*:\s*(\d)/g, '$1:$2')
  // Collapse double commas / periods / whitespace
  s = s.replace(/[,]{2,}/g, ',').replace(/[.]{2,}/g, '.').replace(/\s+/g, ' ').trim()
  return s
}

export function parseLocally(text: string, todayISO: string): LocalDraft {
  const cleaned = cleanTranscript(text)
  const dateRes = extractDate(cleaned, todayISO)
  const timeRes = extractTime(cleaned)
  const locRes = extractLocation(cleaned)
  const allConsumedForNotes = [...dateRes.consumed, ...timeRes.consumed, ...locRes.consumed]
  const notesRes = extractNotes(cleaned, allConsumedForNotes)

  const consumed = [...dateRes.consumed, ...timeRes.consumed, ...locRes.consumed, ...notesRes.consumed]
  const title = buildTitle(cleaned, consumed) || cleaned

  let confidence = 0
  if (dateRes.date) confidence += 0.3
  if (timeRes.time && !timeRes.ambiguous) confidence += 0.3
  if (timeRes.time && timeRes.ambiguous) confidence += 0.2
  if (title && title.length >= 2) confidence += 0.3
  if (locRes.location) confidence += 0.05
  if (notesRes.notes) confidence += 0.05

  return {
    title,
    date: dateRes.date,
    time: timeRes.time,
    ambiguousTime: timeRes.ambiguous,
    location: locRes.location,
    notes: notesRes.notes,
    emoji: detectEmoji(`${title} ${notesRes.notes ?? ''}`),
    confidence: Math.min(confidence, 1),
  }
}
