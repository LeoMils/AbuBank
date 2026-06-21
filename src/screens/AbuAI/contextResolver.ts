/*
 * Cross-turn context resolver for AbuAI conversations.
 *
 * Handles conversational follow-ups like:
 *   "מה יש לי היום?" → "ומחר?"  (expands to "מה יש לי מחר?")
 *   "מי זה נועם?" → "ומור?"     (expands to "מי זה מור?")
 *   "מה יש לי היום?" → "ובשלישי?" (expands to "מה יש לי ביום שלישי?")
 *
 * Pure function — no side effects, no API calls.
 */

import type { ChatMessage } from './types'
import { routePersonalQuery, type RouteType } from './router'

// Short temporal fragments — bare time references that need context.
// These are follow-ups like "ומחר?", "ובשלישי?", "והשבוע?", "ואתמול?"
// Short temporal fragments — bare time references that need context.
// Includes "בעצם" prefix for corrections: "בעצם מחר", "בעצם בשלישי"
const TEMPORAL_FRAGMENT = /^(?:ו|בעצם\s+)?(?:מחר|היום|אתמול|השבוע|שבוע הבא|בשבוע הבא|ב?יום (?:ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת)|ב?(?:ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת))\??$/i
// Spanish temporal follow-ups: "¿Y mañana?", "¿Y hoy?", "¿Y esta semana?"
const TEMPORAL_FRAGMENT_ES = /^(?:¿?\s*)?(?:y\s+)?(?:mañana|hoy|ayer|esta\s+semana|la\s+semana\s+que\s+viene)\s*\??$/i

// Short name fragments — bare names that need context.
// "ומור?", "ולאו?", "ונועם?", "ויעל?"
// Captured group 1 = the name (after optional ו).
const NAME_FRAGMENT = /^ו?(\S{2,})[\s?]*$/

// Route types that count as "calendar context"
const CALENDAR_ROUTES = new Set<RouteType>([
  'calendar_today', 'calendar_tomorrow', 'calendar_upcoming',
  'calendar_exact_date', 'calendar_month',
])

// Route types that count as "family context"
const FAMILY_ROUTES = new Set<RouteType>([
  'family_lookup', 'family_location', 'family_relationship_between',
  'birthday_lookup', 'memorial_lookup',
])

/**
 * Find the last route type from recent assistant messages by re-routing
 * the last USER message (the one that triggered the grounded answer).
 */
function findLastContext(messages: ChatMessage[]): RouteType | null {
  // Walk backwards to find the last user message before the current one
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]!
    if (msg.role === 'user') {
      const route = routePersonalQuery(msg.content)
      if (route.type !== 'non_personal') return route.type
    }
  }
  return null
}

/** Like findLastContext but also returns the user message text, for follow-up extraction. */
function findLastContextWithMsg(messages: ChatMessage[], routeSet: Set<RouteType>): { type: RouteType; userMsg: string } | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]!
    if (msg.role === 'user') {
      const route = routePersonalQuery(msg.content)
      if (routeSet.has(route.type)) return { type: route.type, userMsg: msg.content }
    }
  }
  return null
}

/**
 * Expand a short temporal fragment into a full calendar query.
 * "ומחר?" → "מה יש לי מחר?"
 * "ובשלישי?" → "מה יש לי ביום שלישי?"
 */
function expandTemporal(fragment: string): string {
  // Strip leading ו, "בעצם", and trailing ?
  let core = fragment.replace(/^(?:ו|בעצם\s*)/i, '').replace(/\?$/, '').trim()

  // Weekday without "ביום" prefix? Add it: "שלישי" → "ביום שלישי", "בשלישי" → "ביום שלישי"
  const BARE_WEEKDAY = /^(ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת)$/
  const B_WEEKDAY = /^ב(ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת)$/
  if (BARE_WEEKDAY.test(core)) {
    core = `ביום ${core}`
  } else if (B_WEEKDAY.test(core)) {
    core = `ביום ${core.slice(1)}`
  }

  return `מה יש לי ${core}?`
}

/**
 * Expand a short name fragment into a full family query.
 * "ומור?" → "מי זה מור?" (or "מי זאת מור?" — we use generic "ספרי לי על")
 */
function expandName(name: string): string {
  return `ספרי לי על ${name}`
}

/**
 * Resolve short conversational follow-ups using conversation context.
 *
 * Returns the expanded text if a follow-up was detected, or the
 * original text if no expansion is needed.
 */
// Hebrew month names → month numbers for date extraction
const HE_MONTHS: Record<string, string> = {
  'ינואר': '01', 'פברואר': '02', 'מרץ': '03', 'אפריל': '04',
  'מאי': '05', 'יוני': '06', 'יולי': '07', 'אוגוסט': '08',
  'ספטמבר': '09', 'אוקטובר': '10', 'נובמבר': '11', 'דצמבר': '12',
}

/**
 * Extract a date from a birthday response like "יום ההולדת של נועם — 15 במרץ."
 * Returns YYYY-MM-DD or null.
 */
function extractDateFromBirthdayResponse(messages: ChatMessage[]): string | null {
  // Scan last 3 messages for birthday response pattern
  for (let i = messages.length - 1; i >= Math.max(0, messages.length - 3); i--) {
    const msg = messages[i]!
    if (msg.role !== 'assistant') continue
    // Pattern: "X — DD בMONTH" or "DD בMONTH"
    const match = msg.content.match(/(\d{1,2})\s+ב(ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)/)
    if (match) {
      const day = match[1]!.padStart(2, '0')
      const month = HE_MONTHS[match[2]!]
      if (month) {
        const year = new Date().getFullYear()
        return `${year}-${month}-${day}`
      }
    }
  }
  return null
}

/** Last substantive (non-fragment, non-family/calendar) user topic, scaffolding
 *  stripped — e.g. "באיזה שנה הייתה המהפכה הצרפתית" → "המהפכה הצרפתית". */
function findLastUserTopic(messages: ChatMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]!
    if (m.role !== 'user') continue
    const t = m.content.trim()
    if (t.split(/\s+/).length < 2) continue // fragment
    if (/^(מי\b|מה יש לי|מתי|תקבעי|תזכירי|עליה|עליו|ו?עוד|תמשיכי|על זה|ומה עם זה)/.test(t)) continue // family/calendar/fragment
    const topic = t
      .replace(/^(?:באיזה|איזה|מה|מתי|איפה|כמה|למה|ספרי לי עוד על|ספרי לי על|תספרי לי על|ספרי לי)\s+/i, '')
      .replace(/^(?:שנה|זמן|תאריך)\s+(?:הייתה|היה|הי?תה)\s+/, '')
      .replace(/^ו?על\s+/, '') // avoid "ספרי לי עוד על על X" when the topic already starts with "על"
      .replace(/[?？]/g, '').trim()
    return topic.length >= 2 ? topic : null
  }
  return null
}

export function resolveFollowUp(
  text: string,
  recentMessages: ChatMessage[],
): { resolved: string; wasFollowUp: boolean } {
  const trimmed = text.trim()

  // "באותו יום" / "באותו תאריך" — reference to a date mentioned in
  // a previous birthday/calendar response. Extract the date and convert
  // to a calendar query. Must run BEFORE the word-count check.
  if (/באותו\s+(יום|תאריך)/.test(trimmed)) {
    const date = extractDateFromBirthdayResponse(recentMessages)
    if (date) {
      // Expand: "יש לי משהו באותו יום?" → "מה יש לי ב-DATE?"
      const d = new Date(date + 'T00:00:00')
      const day = d.getDate()
      const monthName = Object.keys(HE_MONTHS).find(k => HE_MONTHS[k] === String(d.getMonth() + 1).padStart(2, '0')) ?? ''
      return { resolved: `מה יש לי ב-${day} ב${monthName}?`, wasFollowUp: true }
    }
  }

  // Only operate on short fragments (≤ 4 words)
  if (trimmed.split(/\s+/).length > 4) {
    return { resolved: text, wasFollowUp: false }
  }

  // Check for temporal follow-up: "ומחר?", "ובשלישי?", "¿Y mañana?"
  if (TEMPORAL_FRAGMENT.test(trimmed) || TEMPORAL_FRAGMENT_ES.test(trimmed)) {
    const lastContext = findLastContext(recentMessages)
    if (lastContext && CALENDAR_ROUTES.has(lastContext)) {
      return { resolved: expandTemporal(trimmed), wasFollowUp: true }
    }
    // Even without calendar context, a bare "מחר?" is almost certainly
    // asking about tomorrow's schedule
    if (trimmed.replace(/^(?:ו|בעצם\s*)/i, '').replace(/\?$/, '').trim() === 'מחר') {
      return { resolved: 'מה יש לי מחר?', wasFollowUp: true }
    }
    // Spanish: "¿Y mañana?" → "מה יש לי מחר?"
    if (/ma[nñ]ana/i.test(trimmed)) {
      return { resolved: 'מה יש לי מחר?', wasFollowUp: true }
    }
  }

  // Multi-word calendar follow-ups: "ומה אחרי זה?", "ומה בשבוע הבא?"
  const CALENDAR_FOLLOWUP = /^ו?מה\s+(אחרי זה|אחר כך|הלאה|בשבוע הבא|בחודש הבא|ביום הבא|למחרת)\??$/i
  const calFollowUp = trimmed.match(CALENDAR_FOLLOWUP)
  if (calFollowUp) {
    const lastContext = findLastContext(recentMessages)
    if (lastContext && CALENDAR_ROUTES.has(lastContext)) {
      const phrase = calFollowUp[1]!
      if (/אחרי זה|אחר כך|הלאה/.test(phrase)) {
        // "what's after that" after today → upcoming/week
        return { resolved: 'מה יש לי השבוע?', wasFollowUp: true }
      }
      if (/ביום הבא|למחרת/.test(phrase)) {
        // "and the next day" → tomorrow's schedule
        return { resolved: 'מה יש לי מחר?', wasFollowUp: true }
      }
      return { resolved: `מה יש לי ${phrase}?`, wasFollowUp: true }
    }
  }

  // Check for name follow-up: "ומור?", "ולאו?"
  const nameMatch = trimmed.match(NAME_FRAGMENT)
  if (nameMatch?.[1] && trimmed.startsWith('ו')) {
    const name = nameMatch[1].replace(/\?$/, '')

    // Guard: "ועוד?" means "tell me more", not a name lookup.
    // If the previous context was family, re-route to "tell me more about <name>".
    if (/^עוד\??$/.test(name)) {
      const familyCtx = findLastContextWithMsg(recentMessages, FAMILY_ROUTES)
      if (familyCtx) {
        const nameInPrev = familyCtx.userMsg.match(/על\s+(\S+)|מי\s+(?:זה|זאת)\s+(\S+)/)?.[1]
          ?? familyCtx.userMsg.match(/על\s+(\S+)|מי\s+(?:זה|זאת)\s+(\S+)/)?.[2]
        if (nameInPrev) {
          return { resolved: `ספרי לי עוד על ${nameInPrev}`, wasFollowUp: true }
        }
      }
      // Not family — continue the last general topic so the thread holds.
      const topic = findLastUserTopic(recentMessages)
      return { resolved: topic ? `ספרי לי עוד על ${topic}` : 'ספרי לי עוד', wasFollowUp: true }
    }

    // Only expand if we have family context AND the fragment is short (a name)
    const lastContext = findLastContext(recentMessages)
    if (lastContext && FAMILY_ROUTES.has(lastContext) && name.length <= 10) {
      return { resolved: expandName(name), wasFollowUp: true }
    }
  }

  // General-topic continuation (NOT family/calendar): "תמשיכי", "עוד", "על זה",
  // "ומה עם זה", "על ההיסטוריה" → continue the last substantive topic so the LLM
  // keeps the thread instead of losing it. (Family/calendar already handled above.)
  const CONTINUE_FRAG = /^(?:עוד|תמשיכי|תמשיך|המשיכי|הלאה|על זה|ועל זה|ומה עם זה)\??$/i
  const aboutMatch = trimmed.match(/^ו?על\s+(.{2,40}?)\??$/)
  if (CONTINUE_FRAG.test(trimmed) || aboutMatch) {
    const lastCtx = findLastContext(recentMessages)
    const familyOrCal = !!lastCtx && (FAMILY_ROUTES.has(lastCtx) || CALENDAR_ROUTES.has(lastCtx))
    if (!familyOrCal) {
      const topic = (aboutMatch && !/^זה$/.test(aboutMatch[1]!.trim())) ? aboutMatch[1]!.trim() : findLastUserTopic(recentMessages)
      if (topic) return { resolved: `ספרי לי עוד על ${topic}`, wasFollowUp: true }
    }
  }

  return { resolved: text, wasFollowUp: false }
}
