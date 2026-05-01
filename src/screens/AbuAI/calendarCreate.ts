import { parseHebrewDate } from './dateParser'
import { detectEmoji } from '../AbuCalendar/service'

// ─── State Machine ──────────────────────────────────────────────────────────

export type CreatePhase = 'idle' | 'creating' | 'confirming'

export interface CreateDraft {
  title: string | null
  date: string | null
  time: string | null
  emoji?: string
  location?: string | null
  notes?: string | null
}

export interface CalendarCreateState {
  phase: CreatePhase
  draft: CreateDraft
  missing: Array<'title' | 'date' | 'time'>
}

export const IDLE_STATE: CalendarCreateState = {
  phase: 'idle',
  draft: { title: null, date: null, time: null, emoji: '📅' },
  missing: [],
}

// ─── Intent Detection ───────────────────────────────────────────────────────

const CREATE_INTENT = /תקבע[יה]? לי|תרשמ[יה]? לי|תוסיפ[יה]? לי|תזכיר[יה]? לי|קבע[יה]? לי|רשמ[יה]? לי|אני רוצה פגישה|אני רוצה תור|יש לי תור|יש לי פגישה|תכניס[יה]? ליומן|תשימ[יה]? ביומן|צריכה לקבוע|צריך לקבוע|רוצה לקבוע/i

// Natural speech: "אני צריכה להיות אצל...", "ביום רביעי בשעה חמש..."
// These are implicit create intents — person describes a future event
const NATURAL_INTENT = /צריכ[הא]? להיות|צריכ[הא]? להגיע|צריכ[הא]? ללכת|צריכ[הא]? לנסוע|אני צריכ[הא]?\s/i

// Detects if text contains time+date context that implies a future event description
function hasTimeAndDateContext(text: string): boolean {
  const hasDate = /היום|מחר|מחרתיים|ביום\s+(ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת)|בעוד\s+שבוע/i.test(text)
  const hasTime = /בשעה|בבוקר|בערב|בצהריים|ב(שלוש|ארבע|חמש|שש|שבע|שמונה|תשע|עשר)/i.test(text)
  return hasDate && hasTime
}

export function isCreateIntent(text: string): boolean {
  const t = text.trim()
  if (CREATE_INTENT.test(t)) return true
  // Natural speech with "צריכה להיות" etc.
  if (NATURAL_INTENT.test(t)) return true
  // Implicit: has both date + time context (describing a future event)
  if (hasTimeAndDateContext(t)) return true
  return false
}

// ─── Confirmation / Cancel ──────────────────────────────────────────────────

const CONFIRM = /^(כן|נכון|בדיוק|בסדר|סבבה|יאללה|תרשמי|כן תרשמי|אוקיי|אוקי|ok|yes|כן כן|בטח|ברור)$/i
const CANCEL = /^(לא|עזבי|תשכחי|ביטול|לא צריך|בטלי|לא רוצה|חבל|תעזבי|לא לא)$/i

export function isConfirm(text: string): boolean {
  return CONFIRM.test(text.trim())
}

export function isCancel(text: string): boolean {
  return CANCEL.test(text.trim())
}

// ─── Time Parsing ───────────────────────────────────────────────────────────

const HEBREW_HOUR_WORDS: Record<string, number> = {
  'אחת': 1, 'שתיים': 2, 'שלוש': 3, 'ארבע': 4, 'חמש': 5,
  'שש': 6, 'שבע': 7, 'שמונה': 8, 'תשע': 9, 'עשר': 10,
  'אחת עשרה': 11, 'שתים עשרה': 12,
}

export function parseHebrewTime(text: string): string | null {
  const t = text.trim()

  // "בשעה 15:00" / "ב-10:30" / "בשעה 9"
  const numericTime = t.match(/ב[־-]?(?:שעה\s+)?(\d{1,2})[:.:](\d{2})/)
  if (numericTime) {
    const h = parseInt(numericTime[1]!, 10)
    const m = parseInt(numericTime[2]!, 10)
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    }
  }

  // "בשעה 10" (no minutes)
  const hourOnly = t.match(/ב[־-]?שעה\s+(\d{1,2})(?!\s*[:.:]?\d)/)
  if (hourOnly) {
    const h = parseInt(hourOnly[1]!, 10)
    if (h >= 0 && h <= 23) {
      return `${String(h).padStart(2, '0')}:00`
    }
  }

  // "בצהריים" = 12:00
  if (/בצהריים/.test(t)) return '12:00'

  // "בשעה חמש" / "בשעה שלוש וחצי" — word-number after בשעה
  for (const [word, num] of Object.entries(HEBREW_HOUR_WORDS).sort((a, b) => b[0].length - a[0].length)) {
    const shaahPattern = new RegExp(`בשעה\\s+${word}(\\s+וחצי)?(\\s+ורבע)?`)
    const shaahMatch = t.match(shaahPattern)
    if (shaahMatch) {
      const half = !!shaahMatch[1]
      const quarter = !!shaahMatch[2]
      const minutes = half ? 30 : quarter ? 15 : 0
      const isMorning = /בבוקר/.test(t)
      const isEvening = /בערב/.test(t)
      let h = num
      if (isMorning) { /* keep */ }
      else if (isEvening) { if (h < 12) h += 12 }
      else { if (h >= 1 && h <= 6) h += 12 }
      return `${String(h).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
    }
  }

  // "בבוקר" without specific hour — don't guess
  // "בערב" without specific hour — don't guess

  // Hebrew word hours: "בשלוש" / "בשלוש וחצי" / "בעשר בבוקר"
  // Try compound first ("אחת עשרה"), then single
  for (const [word, num] of Object.entries(HEBREW_HOUR_WORDS).sort((a, b) => b[0].length - a[0].length)) {
    const pattern = new RegExp(`ב${word}(\\s+וחצי)?(\\s+ורבע)?`)
    const match = t.match(pattern)
    if (match) {
      const half = !!match[1]
      const quarter = !!match[2]
      const minutes = half ? 30 : quarter ? 15 : 0
      const isMorning = /בבוקר/.test(t)
      const isEvening = /בערב/.test(t)
      // Default: hours 1-6 → PM (appointments), 7-11 → AM, explicit overrides
      let h = num
      if (isMorning) {
        // keep as-is (1-12 = AM)
      } else if (isEvening) {
        if (h < 12) h += 12
      } else {
        // Default convention: 1-6 = PM for appointments
        if (h >= 1 && h <= 6) h += 12
      }
      return `${String(h).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
    }
  }

  return null
}

// ─── Date Parsing (extends dateParser.ts with relative dates) ───────────────

function localDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function todayStr(): string {
  return localDateStr(new Date())
}

function tomorrowStr(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return localDateStr(d)
}

function nextDayOfWeek(dayIndex: number): string {
  const d = new Date()
  const current = d.getDay()
  let diff = dayIndex - current
  if (diff <= 0) diff += 7
  d.setDate(d.getDate() + diff)
  return localDateStr(d)
}

export function parseCreateDate(text: string): string | null {
  const t = text.trim()

  if (/היום/.test(t)) return todayStr()
  if (/מחרתיים/.test(t)) {
    const d = new Date()
    d.setDate(d.getDate() + 2)
    return localDateStr(d)
  }
  if (/מחר/.test(t)) return tomorrowStr()

  // Day of week: "ביום ראשון", "ביום שני", etc.
  const dayNames: Record<string, number> = {
    'ראשון': 0, 'שני': 1, 'שלישי': 2, 'רביעי': 3,
    'חמישי': 4, 'שישי': 5, 'שבת': 6,
  }
  for (const [name, idx] of Object.entries(dayNames)) {
    if (t.includes(`יום ${name}`) || t.includes(`ביום ${name}`)) {
      return nextDayOfWeek(idx)
    }
  }

  // "בעוד שבוע"
  if (/בעוד שבוע/.test(t)) {
    const d = new Date()
    d.setDate(d.getDate() + 7)
    return localDateStr(d)
  }

  // Fall back to existing dateParser (handles "ב-15 באפריל", etc.)
  return parseHebrewDate(t)
}

// ─── Title Extraction ───────────────────────────────────────────────────────

// Explanation clauses to strip ("כי היא ביקשה...", "אם...")
// Hebrew has no \b word boundary — use space/start-of-string anchor
const EXPLANATION_NOISE = /\s+(?:כי|כיוון ש|בגלל ש|למרות ש)\s.*/gi
// Intent prefixes to strip (anywhere, not just start)
const NOISE_PHRASES = /(תקבעי? לי|תרשמי? לי|תוסיפי? לי|תזכירי? לי|קבעי? לי|רשמי? לי|תכניסי? ליומן|תשימי? ביומן|צריכה? לקבוע|רוצה? לקבוע|אני רוצה|יש לי)\s*/gi
// Natural speech verbs
const NATURAL_NOISE = /(אני צריכה? להיות|אני צריכה? להגיע|אני צריכה? ללכת|אני צריכה? לנסוע|אני צריכה?)\s*/gi
// Time words to strip
const TIME_NOISE = /\s*ב(שלוש|ארבע|חמש|שש|שבע|שמונה|תשע|עשר|אחת עשרה|שתים עשרה|צהריים)(\s+וחצי|\s+ורבע)?(\s+בבוקר|\s+בערב|\s+אחר הצהריים|\s+אחרי הצהריים|\s+בלילה)?\s*/gi
const DATE_NOISE = /\s*(היום|מחר|מחרתיים|ביום\s+(ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת)|בעוד שבוע)\s*/gi
const HOUR_NOISE = /\s*בשעה\s+(?:אחת עשרה|שתים עשרה|אחת|שתיים|שלוש|ארבע|חמש|שש|שבע|שמונה|תשע|עשר)(?:\s+וחצי|\s+ורבע)?\s*/gi
const HOUR_DIGIT_NOISE = /\s*ב[־-]?(?:שעה\s+)?\d{1,2}[:.:]?\d{0,2}\s*/gi
// Standalone time-of-day words (when not part of a time phrase already stripped)
const PERIOD_NOISE = /(בבוקר|בערב|בלילה|אחר הצהריים|אחרי הצהריים)/gi
// Connector word leftover
const LEADING_CONNECTOR = /^[שו]\s+/

export function extractTitle(text: string): string | null {
  let t = text.trim()
  // 1. Strip explanation clauses first
  t = t.replace(EXPLANATION_NOISE, '')
  // 2. Strip intent phrases and natural speech verbs
  t = t.replace(NOISE_PHRASES, ' ')
  t = t.replace(NATURAL_NOISE, ' ')
  // 3. Strip time/date
  t = t.replace(HOUR_NOISE, ' ')
  t = t.replace(TIME_NOISE, ' ')
  t = t.replace(DATE_NOISE, ' ')
  t = t.replace(HOUR_DIGIT_NOISE, ' ')
  t = t.replace(PERIOD_NOISE, ' ')
  // 4. Clean up
  t = t.replace(/\s+/g, ' ').trim()
  t = t.replace(LEADING_CONNECTOR, '')
  t = t.replace(/[.!?,;]+$/, '').trim()
  return t.length >= 2 ? t : null
}

// ─── Full Intent Parse ──────────────────────────────────────────────────────

export interface ParsedCreateIntent {
  draft: CreateDraft
  missing: Array<'title' | 'date' | 'time'>
}

export function parseCreateIntent(text: string): ParsedCreateIntent | null {
  if (!isCreateIntent(text)) return null

  const title = extractTitle(text)
  const date = parseCreateDate(text)
  const time = parseHebrewTime(text)
  const emoji = title ? detectEmoji(title) : '📅'

  const missing: Array<'title' | 'date' | 'time'> = []
  if (!title) missing.push('title')
  if (!date) missing.push('date')
  if (!time) missing.push('time')

  return {
    draft: { title, date, time, emoji },
    missing,
  }
}

// ─── State Transitions ──────────────────────────────────────────────────────

export function startCreate(text: string): CalendarCreateState {
  const parsed = parseCreateIntent(text)
  if (!parsed) return IDLE_STATE

  if (parsed.missing.length === 0) {
    return { phase: 'confirming', draft: parsed.draft, missing: [] }
  }
  return { phase: 'creating', draft: parsed.draft, missing: parsed.missing }
}

/** Process a follow-up message while in creating/confirming phase. */
export function updateCreate(state: CalendarCreateState, text: string): CalendarCreateState {
  const t = text.trim()

  // Cancel always works
  if (isCancel(t)) return IDLE_STATE

  // If confirming, check for yes/no
  if (state.phase === 'confirming') {
    if (isConfirm(t)) return state // caller handles save
    // Not a confirm — maybe they're correcting? Try re-parse
  }

  // Try to fill missing fields from the new message
  const draft = { ...state.draft }
  const stillMissing = [...state.missing]

  // Title
  if (stillMissing.includes('title')) {
    const title = extractTitle(t) ?? t.replace(/[.!?,;]+$/, '').trim()
    if (title.length >= 2) {
      draft.title = title
      draft.emoji = detectEmoji(title)
      const idx = stillMissing.indexOf('title')
      if (idx !== -1) stillMissing.splice(idx, 1)
    }
  }

  // Date
  if (stillMissing.includes('date')) {
    const date = parseCreateDate(t)
    if (date) {
      draft.date = date
      const idx = stillMissing.indexOf('date')
      if (idx !== -1) stillMissing.splice(idx, 1)
    }
  }

  // Time
  if (stillMissing.includes('time')) {
    const time = parseHebrewTime(t)
    if (time) {
      draft.time = time
      const idx = stillMissing.indexOf('time')
      if (idx !== -1) stillMissing.splice(idx, 1)
    }
  }

  if (stillMissing.length === 0) {
    return { phase: 'confirming', draft, missing: [] }
  }
  return { phase: 'creating', draft, missing: stillMissing }
}
