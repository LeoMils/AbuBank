/*
 * AbuAI Source Router (B2.2)
 *
 * Pure routing decision: which kind of source should answer this query?
 * No fetches, no LLM. Used by the runtime to dispatch to:
 *   • calendar / family / contacts → local tools
 *   • weather → weather API
 *   • current movies / local activities / news → online search
 *   • general culture / story / podcast → open conversation
 *   • vague / bored / no-topic → proactive content
 */

import type { ContentMode } from './contentWorldEngine'
import { routePersonalQuery } from './router'
import { isOnlineCurrentInfoQuery, shouldBlockOnlineForPersonal } from './onlineIntent'

export type AbuAISource =
  | 'calendar_tool'
  | 'family_tool'
  | 'contacts_tool'
  | 'weather_api'
  | 'online_search'
  | 'open_conversation'
  | 'proactive_content'
  | 'practical_help'

export interface SourceRouteResult {
  source: AbuAISource
  requiresEvidence: boolean
  requiresSources: boolean
  locationAware: boolean
  reason: string
}

export interface SourceRouteContext {
  /** Optional content-world choice — if provided we trust it for
   *  current-info hints (e.g. `local_activity` always wants location). */
  contentMode?: ContentMode
  /** Optional location hint passed by the runtime; the router only
   *  marks `locationAware`, never invents a location. */
  locationHint?: string
}

const WEATHER_HE = /מזג\s+ה?אוויר/i
const WEATHER_ES = /(?:^|[^a-záéíóúñ])(?:c[oó]mo\s+est[aá]\s+el\s+)?(?:clima|tiempo)\s+(?:hoy|ahora|esta\s+semana|ma[nñ]ana|en\s+kfar)/i
const WEATHER_EN = /\b(?:what'?s|how'?s)\s+the\s+weather\b|\bweather\s+(?:now|today|tomorrow|this\s+week)\b/i

const CONTACTS_HE = /טלפון\s+של|להתקשר\s+ל|מספר\s+ה?טלפון/
const CONTACTS_ES = /tel[eé]fono\s+de|llamar\s+a|n[uú]mero\s+de\s+tel[eé]fono/i
const CONTACTS_EN = /\bphone\s+(?:number\s+)?of\b|\bcall\s+(?:mom|dad|leo|mor|adar)\b/i

const VAGUE_HE = /משועממ[ת]?|משעמם לי|אין לי על מה לדבר/
const VAGUE_ES = /(?:^|[^a-záéíóúñ])(estoy\s+aburrid[oa]|me\s+aburro|no\s+s[eé]\s+(?:de\s+qu[eé]\s+hablar|qu[eé]\s+hacer))/i
const VAGUE_EN = /\b(i'?m\s+bored|i\s+don'?t\s+know\s+what\s+to\s+(talk\s+about|do))\b/i

export function chooseAbuAISource(input: string, contentWorld?: ContentMode | null, context?: SourceRouteContext): SourceRouteResult {
  const t = (input ?? '').trim()

  // Personal local tools first — single source of truth via routePersonalQuery.
  const route = routePersonalQuery(t)
  switch (route.type) {
    case 'calendar_today':
    case 'calendar_tomorrow':
    case 'calendar_upcoming':
    case 'calendar_exact_date':
    case 'calendar_month':
    case 'calendar_create':
      return { source: 'calendar_tool', requiresEvidence: true, requiresSources: false, locationAware: false, reason: 'calendar intent' }
    case 'family_lookup':
    case 'family_location':
    case 'birthday_lookup':
    case 'memorial_lookup':
      return { source: 'family_tool', requiresEvidence: true, requiresSources: false, locationAware: false, reason: 'family intent' }
    default: break
  }

  // Contacts — phone number / call intent.
  if (CONTACTS_HE.test(t) || CONTACTS_ES.test(t) || CONTACTS_EN.test(t)) {
    return { source: 'contacts_tool', requiresEvidence: true, requiresSources: false, locationAware: false, reason: 'contacts intent' }
  }

  // Weather — prefer a weather API (cheaper / more deterministic than
  // generic online search). When wired, the runtime decides which API;
  // the router only flags the source kind.
  if (WEATHER_HE.test(t) || WEATHER_ES.test(t) || WEATHER_EN.test(t)) {
    return { source: 'weather_api', requiresEvidence: true, requiresSources: false, locationAware: true, reason: 'weather intent' }
  }

  // Online current-info — movies now, news now, "open now", local
  // activities. Personal queries are blocked from online search.
  if (isOnlineCurrentInfoQuery(t) && !shouldBlockOnlineForPersonal(t)) {
    const mode = context?.contentMode ?? contentWorld
    const locationAware = mode === 'local_activity'
    return {
      source: 'online_search',
      requiresEvidence: true,
      requiresSources: true,
      locationAware,
      reason: 'online current-info intent',
    }
  }

  // Local activity content world — even when phrased without an explicit
  // "now" word, "qué hacemos hoy" implies local realtime discovery.
  if (contentWorld === 'local_activity') {
    return { source: 'online_search', requiresEvidence: true, requiresSources: true, locationAware: true, reason: 'local_activity content world' }
  }

  // Vague / bored → proactive content (no LLM call needed).
  if (VAGUE_HE.test(t) || VAGUE_ES.test(t) || VAGUE_EN.test(t)) {
    return { source: 'proactive_content', requiresEvidence: false, requiresSources: false, locationAware: false, reason: 'vague / bored — proactive' }
  }

  // Default — open conversation (general culture, story, podcast
  // discussion, memories, riddles).
  return { source: 'open_conversation', requiresEvidence: false, requiresSources: false, locationAware: false, reason: 'open conversation default' }
}
