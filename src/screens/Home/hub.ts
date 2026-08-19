/*
 * hub.ts — the Abu-ela HUB model (pure, testable).
 * ════════════════════════════════════════════════════════════════════════════
 * Home is now a HUB that lists the Abu family of apps and nothing else. This file
 * is the single source of truth for WHICH apps the hub shows, in WHAT order, and
 * WHERE each one goes. Keeping it as pure data (no JSX) lets a test lock the
 * routing — most importantly the hard constraint that Abu AI opens the LIVE path
 * (the __abubankOpenLive overlay), never the deprecated legacy AbuAI screen.
 */
import { Screen } from '../../state/types'

/** How a hub tile navigates. 'live' = open the live-conversation overlay via the
 *  global App exposes; 'screen' = a normal in-app screen switch. */
export type HubAction =
  | { kind: 'live' }
  | { kind: 'screen'; screen: Screen }

export interface HubApp {
  id: string
  /** Martita-facing label (Latin "Abu" + Hebrew, matching the brand family). */
  hebrewLabel: string
  /** Per-app accent colour (each app keeps its identity within one system). */
  accent: string
  action: HubAction
}

/**
 * The hub, in the order Leo specified: Abu AI, Abu Bank, Abu יומן, Abu WhatsApp,
 * Abu Games, Abu מזג אוויר, Abu News. Abu AI is FIRST and routes to the live path.
 */
export const HUB_APPS: readonly HubApp[] = [
  { id: 'ai',       hebrewLabel: 'Abu AI',         accent: '#FCD34D', action: { kind: 'live' } },
  { id: 'bank',     hebrewLabel: 'Abu Bank',       accent: '#5EEAD4', action: { kind: 'screen', screen: Screen.AbuBank } },
  { id: 'calendar', hebrewLabel: 'Abu יומן',       accent: '#C4B5FD', action: { kind: 'screen', screen: Screen.AbuCalendar } },
  { id: 'whatsapp', hebrewLabel: 'Abu WhatsApp',   accent: '#4ADE80', action: { kind: 'screen', screen: Screen.AbuWhatsApp } },
  { id: 'games',    hebrewLabel: 'Abu Games',      accent: '#FCA5A5', action: { kind: 'screen', screen: Screen.AbuGames } },
  { id: 'weather',  hebrewLabel: 'Abu מזג אוויר',  accent: '#7DD3FC', action: { kind: 'screen', screen: Screen.AbuWeather } },
  { id: 'news',     hebrewLabel: 'Abu News',       accent: '#FDBA74', action: { kind: 'screen', screen: Screen.AbuNews } },
] as const

/** Open the live Abu conversation (the ONE Abu AI). Mirrors the family-phones /
 *  diagnostics openers. The legacy AbuAI screen is reachable ONLY via ?legacy=1
 *  and never from the hub — this preserves the live cutover. */
export function openLiveAbu(): void {
  const w = window as unknown as { __abubankOpenLive?: () => void }
  if (typeof w.__abubankOpenLive === 'function') w.__abubankOpenLive()
}
