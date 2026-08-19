/*
 * Meta Reasoner (Phase 2)
 * ═══════════════════════
 * Determines what the user ACTUALLY asked, before any domain answers. Composes the
 * runtime intent planner, the family relation parser (directional subject/target),
 * and the smart calendar understanding into one structured `MetaResult`.
 *
 * Hard rules encoded here:
 *  - relation questions carry subject+target (so a domain never answers identity).
 *  - a calendar SEARCH ("מתי יש לי פגישה עם X") never asks "באיזה יום".
 */
import { classifyIntent, type RuntimeIntent, type RuntimeState, IDLE_RUNTIME } from './cognitiveRuntime'
import { parseRelationQuery } from './familyRelationEngine'
import { understandMeetingSmart } from './calendarIntelligence'

export type MetaDomain =
  | 'calendar' | 'family' | 'online' | 'general' | 'continuation'
  | 'confirmation' | 'frustration' | 'audio' | 'date' | 'unknown'

export interface MetaResult {
  actualQuestion: string
  domain: MetaDomain
  intent: RuntimeIntent
  subject: string | null
  target: string | null
  entities: Record<string, string | null>
  missingFields: string[]
  confidence: number
  shouldClarify: boolean
  clarificationQuestion: string | null
}

const DOMAIN_OF: Record<RuntimeIntent, MetaDomain> = {
  date_query: 'date',
  calendar_read: 'calendar', calendar_search: 'calendar', calendar_create: 'calendar',
  calendar_recurring: 'calendar', calendar_update: 'calendar', calendar_delete: 'calendar',
  reminder: 'calendar',
  confirmation: 'confirmation', family: 'family', online: 'online',
  continuation: 'continuation', frustration: 'frustration', audio_complaint: 'audio',
  memory: 'general', math: 'general', general: 'general', unknown: 'unknown',
  whatsapp: 'general', // owned by runCognitiveTurn precedence, not classifyIntent
}

export function metaReason(text: string, state: RuntimeState = IDLE_RUNTIME): MetaResult {
  const q = (text ?? '').trim()
  const intent = classifyIntent(q, state)
  const domain = DOMAIN_OF[intent]

  const result: MetaResult = {
    actualQuestion: q, domain, intent,
    subject: null, target: null, entities: {}, missingFields: [],
    confidence: 0.85, shouldClarify: false, clarificationQuestion: null,
  }

  if (domain === 'family') {
    const p = parseRelationQuery(q)
    if (p.ok && p.subject && p.target) { result.subject = p.subject; result.target = p.target; result.confidence = 0.96 }
    else { result.confidence = 0.7 } // a family turn we couldn't split into a directional pair
  } else if (intent === 'calendar_create') {
    const m = understandMeetingSmart(q)
    result.entities = { who: m.who, date: m.date, time: m.time, location: m.location, duration: m.durationLabel }
    result.subject = m.who
    if (!m.who) result.missingFields.push('who')
    if (!m.date) result.missingFields.push('date')
    if (!m.time) result.missingFields.push('time')
    if (!m.location) result.missingFields.push('location')
    // Only clarify a truly incomplete event (who+date+time is the confirm floor).
    const hasCore = !!(m.who && m.date && m.time)
    result.shouldClarify = !hasCore && result.missingFields.length > 0
    result.clarificationQuestion = result.shouldClarify
      ? (result.missingFields.includes('who') ? 'עם מי לקבוע?'
        : result.missingFields.includes('date') ? 'באיזה יום?'
          : result.missingFields.includes('time') ? 'באיזו שעה?' : null)
      : null
    result.confidence = m.confidence
  } else if (intent === 'calendar_search') {
    // Search-all NEVER asks "באיזה יום".
    const nm = q.match(/עם\s+([א-ת]{2,})|אצל\s+([א-ת]{2,})/u)
    result.target = nm?.[1] ?? nm?.[2] ?? null
    result.shouldClarify = false
    result.clarificationQuestion = null
    result.confidence = 0.95
  } else if (intent === 'date_query') {
    result.confidence = 0.99
  }

  return result
}
