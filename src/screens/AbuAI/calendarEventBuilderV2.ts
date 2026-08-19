/*
 * Calendar Event Builder v2 — the ONE semantic Event Builder.
 * ══════════════════════════════════════════════════════════
 * A single pipeline: text → semantic understanding → slot extraction → confidence →
 * a Normalized Event. It is the SINGLE source of truth for calendar extraction; the
 * calendar UI (parseAppointmentText) and the AI chat both call it — no more two
 * divergent parsers bridged by "enhanceWithSmart".
 *
 * Adds the semantic layer the raw parse lacked:
 *  • explicit NOTES ("…ותכתוב שנדבר על הפרויקט" → notes) — and stops the location at
 *    the notes boundary so a venue never absorbs the note clause.
 *  • activity-aware TITLE ("ארוחת ערב עם גלעד", "קפה עם אלון", "פגישה עם מור",
 *    "תור לרופא") — never the raw sentence.
 *  • attendees, category, duration, confidence, missingFields.
 */
import { understandMeetingSmart, type SmartMeeting } from './calendarIntelligence'

export interface NormalizedEvent {
  intent: 'calendar_create'
  title: string | null
  who: string | null
  attendees: string[]
  date: string | null
  time: string | null
  location: string | null
  notes: string | null
  durationMinutes: number | null
  durationLabel: string | null
  category: string
  confidence: number
  missingFields: string[]
  importantDetails: string[]
  inferredEvening: boolean
}

// "תכתוב/תכתבי/תרשמי/רשום ש…" → an explicit note. Captured up to the sentence end.
const NOTES_RE = /(?:^|[\s,.])(?:ו?תכתב[יי]?|ו?תכתוב[יי]?|ו?תרשמ[יי]?|ו?רשו?מ[יי]?|ו?כתב[יי]?|ו?כתוב[יי]?)\s+ש(.+?)(?:[.!?]|$)/u

const ACTIVITY: Array<[RegExp, string]> = [
  [/ארוחת\s+ערב|דינר/u, 'ארוחת ערב'],
  [/ארוחת\s+צהריים|צהריי/u, 'ארוחת צהריים'],
  [/ארוחת\s+בוקר|בראנץ/u, 'ארוחת בוקר'],
  [/קפה/u, 'קפה'],
  [/משקה|בירה|לשתות/u, 'משקה'],
]
const CATEGORY: Array<[RegExp, string]> = [
  [/רופא|בדיקה|תור\s+רפואי|שיניים|חיסון/u, 'medical'],
  [/ארוחת|קפה|מסעד|בר\b|לשתות/u, 'social'],
  [/טיסה|רכבת|נסיע/u, 'travel'],
  [/יומולדת|יום\s+הולדת/u, 'birthday'],
  [/עבודה|פרויקט|ישיבה/u, 'work'],
]

function extractNotes(raw: string): { notes: string | null; cleaned: string } {
  const m = raw.match(NOTES_RE)
  if (!m || !m[1]) return { notes: null, cleaned: raw }
  const notes = m[1].trim().replace(/[.!?]+$/u, '').trim()
  const cleaned = raw.replace(m[0], ' ').replace(/\s{2,}/gu, ' ').trim()
  return { notes: notes.length >= 2 ? notes : null, cleaned }
}

function titleFor(m: SmartMeeting, cleaned: string): string | null {
  if (m.who) {
    // An explicit "פגישה/להיפגש" wins. Otherwise pick a stated activity — but NEVER a
    // ב-prefixed VENUE word ("בקפה אליהו" is a place, not a coffee date).
    let act = 'פגישה'
    if (!/(?<![א-ת])(?:פגישה|פגישת|לפגוש|להיפגש|נפגש)/u.test(cleaned)) {
      for (const [re, label] of ACTIVITY) {
        if (new RegExp(`(?<!ב)(?:${re.source})`, 'u').test(cleaned)) { act = label; break }
      }
    }
    return `${act} עם ${m.who}`
  }
  if (/רופא\s+שיניים|שיניים/u.test(cleaned)) return 'תור לרופא שיניים'
  if (/רופא/u.test(cleaned)) return 'תור לרופא'
  if (/תספורת|מספרה/u.test(cleaned)) return 'תספורת'
  if (/טיסה/u.test(cleaned)) return 'טיסה'
  if (/יום\s+הולדת|יומולדת/u.test(cleaned)) return 'יום הולדת'
  return m.title
}

/** Build the single Normalized Event from any calendar utterance. */
export function buildEventV2(raw: string): NormalizedEvent {
  const { notes, cleaned } = extractNotes(raw)
  const m = understandMeetingSmart(cleaned)          // core semantic understanding (one extractor)
  const attendees = [...new Set(
    [m.who, ...((cleaned.match(/עם\s+([א-ת]{2,}(?:\s+[א-ת]{2,})?)/gu) ?? []).map(s => s.replace(/^עם\s+/u, '').trim()))]
      .filter((x): x is string => !!x),
  )]
  const missingFields: string[] = []
  if (!m.who && !m.title) missingFields.push('who')
  if (!m.date) missingFields.push('date')
  if (!m.time) missingFields.push('time')
  return {
    intent: 'calendar_create',
    title: titleFor(m, cleaned),
    who: m.who,
    attendees,
    date: m.date,
    time: m.time,
    location: m.location,
    // explicit "תכתוב ש…" note wins; else the summarized important details; else base.
    notes: notes ?? (m.importantDetails.length ? m.importantDetails.join('; ') : m.notes) ?? null,
    durationMinutes: m.durationMinutes,
    durationLabel: m.durationLabel,
    category: CATEGORY.find(([re]) => re.test(cleaned))?.[1] ?? 'general',
    confidence: Math.max(0.2, 1 - missingFields.length * 0.2),
    missingFields,
    importantDetails: m.importantDetails,
    inferredEvening: m.inferredEvening,
  }
}

/** Backward-compatible SmartMeeting view (same single source: buildEventV2). Used by
 *  the AI chat draft synthesis so notes + the clean title/location apply there too. */
export function buildSmartMeetingV2(raw: string): SmartMeeting {
  const e = buildEventV2(raw)
  const base = understandMeetingSmart(extractNotes(raw).cleaned)
  return { ...base, who: e.who, time: e.time, location: e.location, title: e.title, notes: e.notes, importantDetails: e.importantDetails }
}
