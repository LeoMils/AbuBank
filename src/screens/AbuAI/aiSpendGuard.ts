/*
 * AbuAI Spend Guard (B2.2)
 *
 * Pure function that decides whether the next costly operation is
 * allowed based on per-day caps. Never exposes internal costs to
 * Martita — the user-facing message is generic warm copy.
 *
 * No persistence is wired today. Callers pass the current usage
 * counters; the guard returns the decision. A future storage layer
 * (localStorage or server KV) can persist counters; the contract here
 * is intentionally storage-agnostic.
 *
 * TODO: integrate persistent storage so counters survive page reloads.
 */

export const SPEND_LIMITS = {
  maxOnlineSearchesPerDay: 30,
  maxVoiceMinutesPerDay: 20,
  maxEstimatedSpendPerDayUSD: 3,
} as const

export type SpendOperation = 'online_search' | 'voice' | 'chat'

export type SpendLang = 'he' | 'es' | 'en' | 'mixed'

export interface SpendUsage {
  /** Today's count of online searches done so far. */
  onlineSearchesToday: number
  /** Today's voice minutes consumed so far. */
  voiceMinutesToday: number
  /** Today's estimated spend in USD. */
  estimatedSpendUsdToday: number
}

export interface SpendCheckInput {
  operation: SpendOperation
  usage: SpendUsage
  /** Estimated cost of THIS call (USD). Optional; we still cap on totals. */
  estimatedCostUsd?: number
  /** Language preference for the user-facing copy. */
  lang?: SpendLang
}

export type SpendReasonCode =
  | 'allowed'
  | 'online_searches_limit'
  | 'voice_minutes_limit'
  | 'daily_spend_limit'
  | 'invalid_usage_input'

export interface SpendCheckResult {
  allowed: boolean
  reason: SpendReasonCode
  safeUserMessage: string
  operatorMessage?: string
}

function safeUserMessage(code: SpendReasonCode, lang: SpendLang): string {
  if (code === 'allowed') {
    switch (lang) {
      case 'es': return 'Sí, puedo seguir.'
      case 'en': return 'Sure, I can keep going.'
      case 'mixed':
      case 'he':
      default: return 'בסדר, נמשיך.'
    }
  }
  // Generic, NON-financial copy. Martita does not need to know about USD.
  switch (lang) {
    case 'es': return 'Para hoy ya hicimos bastante. Mañana seguimos.'
    case 'en': return 'We have done enough for today. Let us continue tomorrow.'
    case 'mixed':
    case 'he':
    default: return 'להיום זה מספיק. נמשיך מחר.'
  }
}

/**
 * Check whether the operation is allowed today. Pure.
 */
export function checkSpendAllowed(input: SpendCheckInput): SpendCheckResult {
  const lang: SpendLang = input.lang ?? 'he'
  const u = input.usage
  if (!u || typeof u.onlineSearchesToday !== 'number' || typeof u.voiceMinutesToday !== 'number' || typeof u.estimatedSpendUsdToday !== 'number') {
    return {
      allowed: false,
      reason: 'invalid_usage_input',
      safeUserMessage: safeUserMessage('online_searches_limit', lang),
      operatorMessage: 'invalid SpendUsage input',
    }
  }

  // Spend cap is checked first because it implies all sub-quotas are spent.
  if (u.estimatedSpendUsdToday >= SPEND_LIMITS.maxEstimatedSpendPerDayUSD) {
    return {
      allowed: false,
      reason: 'daily_spend_limit',
      safeUserMessage: safeUserMessage('daily_spend_limit', lang),
      operatorMessage: `daily spend cap reached (>= $${SPEND_LIMITS.maxEstimatedSpendPerDayUSD})`,
    }
  }

  switch (input.operation) {
    case 'online_search':
      if (u.onlineSearchesToday >= SPEND_LIMITS.maxOnlineSearchesPerDay) {
        return {
          allowed: false,
          reason: 'online_searches_limit',
          safeUserMessage: safeUserMessage('online_searches_limit', lang),
          operatorMessage: `online search cap reached (>= ${SPEND_LIMITS.maxOnlineSearchesPerDay})`,
        }
      }
      break
    case 'voice':
      if (u.voiceMinutesToday >= SPEND_LIMITS.maxVoiceMinutesPerDay) {
        return {
          allowed: false,
          reason: 'voice_minutes_limit',
          safeUserMessage: safeUserMessage('voice_minutes_limit', lang),
          operatorMessage: `voice minutes cap reached (>= ${SPEND_LIMITS.maxVoiceMinutesPerDay})`,
        }
      }
      break
    case 'chat':
      // Chat does not have its own quota — only the global spend cap applies.
      break
    default:
      break
  }

  return {
    allowed: true,
    reason: 'allowed',
    safeUserMessage: safeUserMessage('allowed', lang),
  }
}

/**
 * Convenience: empty usage (for tests / first-of-day initialisation).
 */
export function emptyUsage(): SpendUsage {
  return { onlineSearchesToday: 0, voiceMinutesToday: 0, estimatedSpendUsdToday: 0 }
}
