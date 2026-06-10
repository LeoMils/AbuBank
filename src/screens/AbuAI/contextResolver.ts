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
const TEMPORAL_FRAGMENT = /^ו?(?:מחר|היום|אתמול|השבוע|שבוע הבא|בשבוע הבא|ב?יום (?:ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת)|ב?(?:ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת))\??$/i

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

/**
 * Expand a short temporal fragment into a full calendar query.
 * "ומחר?" → "מה יש לי מחר?"
 * "ובשלישי?" → "מה יש לי ביום שלישי?"
 */
function expandTemporal(fragment: string): string {
  // Strip leading ו and trailing ?
  let core = fragment.replace(/^ו/, '').replace(/\?$/, '').trim()

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
export function resolveFollowUp(
  text: string,
  recentMessages: ChatMessage[],
): { resolved: string; wasFollowUp: boolean } {
  const trimmed = text.trim()

  // Only operate on short fragments (≤ 4 words)
  if (trimmed.split(/\s+/).length > 4) {
    return { resolved: text, wasFollowUp: false }
  }

  // Check for temporal follow-up: "ומחר?", "ובשלישי?"
  if (TEMPORAL_FRAGMENT.test(trimmed)) {
    const lastContext = findLastContext(recentMessages)
    if (lastContext && CALENDAR_ROUTES.has(lastContext)) {
      return { resolved: expandTemporal(trimmed), wasFollowUp: true }
    }
    // Even without calendar context, a bare "מחר?" is almost certainly
    // asking about tomorrow's schedule
    if (trimmed.replace(/^ו/, '').replace(/\?$/, '').trim() === 'מחר') {
      return { resolved: 'מה יש לי מחר?', wasFollowUp: true }
    }
  }

  // Check for name follow-up: "ומור?", "ולאו?"
  const nameMatch = trimmed.match(NAME_FRAGMENT)
  if (nameMatch?.[1] && trimmed.startsWith('ו')) {
    const name = nameMatch[1].replace(/\?$/, '')
    // Only expand if we have family context AND the fragment is short (a name)
    const lastContext = findLastContext(recentMessages)
    if (lastContext && FAMILY_ROUTES.has(lastContext) && name.length <= 10) {
      return { resolved: expandName(name), wasFollowUp: true }
    }
  }

  return { resolved: text, wasFollowUp: false }
}
