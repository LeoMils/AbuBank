/*
 * AbuAI Realtime Cheap Source Router (B2.2)
 *
 * Pure routing decision: which CHEAP realtime source should fetch the
 * answer? Keeps cost low by sending weather → a dedicated weather API
 * (when wired), calendar/family/contacts → local tools, current/local
 * activity / news / open-now → the existing OpenAI online search, and
 * everything else → no realtime call.
 *
 * No new provider env vars are introduced today. If/when a weather API
 * is wired, it must not require a paid key (e.g. Open-Meteo is free,
 * key-less). For now this module just chooses the kind; the actual
 * fetch lives in `/api/abuai-online` for online search.
 */

import type { AbuAISource } from './sourceRouter'
import { chooseAbuAISource } from './sourceRouter'
import type { ContentMode } from './contentWorldEngine'

export type CheapRealtimeSource =
  | 'weather_api'
  | 'calendar_tool'
  | 'family_tool'
  | 'contacts_tool'
  | 'online_search'
  | 'none'

export interface CheapRealtimeRoute {
  source: CheapRealtimeSource
  /** True for realtime-fetching sources; false when no live call is needed. */
  realtime: boolean
  /** True when the upstream source needs an approximate location (e.g.
   *  weather, local activity). The runtime decides whether to pass one. */
  locationAware: boolean
  /** Pricing band — informational. Used by the spend guard. */
  costBand: 'free' | 'cheap' | 'paid'
  reason: string
}

/**
 * Choose the cheapest realtime source for a given input. Pure routing
 * — never makes a network call.
 */
export function chooseCheapRealtimeSource(input: string, contentMode?: ContentMode | null): CheapRealtimeRoute {
  const upstream = chooseAbuAISource(input, contentMode ?? null)
  return adaptToCheapBand(upstream.source, upstream.locationAware)
}

function adaptToCheapBand(source: AbuAISource, locationAware: boolean): CheapRealtimeRoute {
  switch (source) {
    case 'calendar_tool':
      return { source: 'calendar_tool', realtime: true, locationAware: false, costBand: 'free', reason: 'local calendar tool' }
    case 'family_tool':
      return { source: 'family_tool', realtime: true, locationAware: false, costBand: 'free', reason: 'local family tool' }
    case 'contacts_tool':
      return { source: 'contacts_tool', realtime: true, locationAware: false, costBand: 'free', reason: 'local contacts tool' }
    case 'weather_api':
      // Wiring a free key-less weather API (e.g. Open-Meteo) is the
      // cheapest path. Until then the runtime can fall back to
      // `online_search`. This router still flags `weather_api` so the
      // future integration is unambiguous.
      // TODO: integrate Open-Meteo as the actual fetcher.
      return { source: 'weather_api', realtime: true, locationAware: true, costBand: 'free', reason: 'weather → dedicated free API (TODO Open-Meteo)' }
    case 'online_search':
      return { source: 'online_search', realtime: true, locationAware, costBand: 'paid', reason: 'general live info → /api/abuai-online' }
    case 'open_conversation':
    case 'proactive_content':
    case 'practical_help':
    default:
      return { source: 'none', realtime: false, locationAware: false, costBand: 'free', reason: 'no realtime needed' }
  }
}
