/*
 * registry.ts — the provider registry + endpoint selection.
 * The endpoint calls selectProvider(env): env ONLINE_PROVIDER picks the winner once
 * one is chosen; default 'openai' keeps today's behaviour (no regression).
 */
import { openaiProvider, tavilyProvider, braveProvider, perplexityProvider } from './adapters'
import type { OnlineProvider, Env } from './providerTypes'

export const ALL_PROVIDERS: readonly OnlineProvider[] = [openaiProvider, tavilyProvider, braveProvider, perplexityProvider]

export function providerById(id: string): OnlineProvider | null {
  return ALL_PROVIDERS.find((p) => p.id === id) ?? null
}

/** The provider the online endpoint uses. Default 'openai' (the incumbent) so nothing
 *  downstream changes until a keyed winner is selected via ONLINE_PROVIDER. */
export function selectProvider(env: Env): OnlineProvider {
  const id = (env.ONLINE_PROVIDER ?? 'openai').toLowerCase()
  return providerById(id) ?? openaiProvider
}

/** Providers whose key is present — the only ones the bake-off will run (never faked). */
export function availableProviders(env: Env): OnlineProvider[] {
  return ALL_PROVIDERS.filter((p) => p.available(env))
}
