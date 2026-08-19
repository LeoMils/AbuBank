/*
 * AbuAI COST METER + graceful-degrade controls (Item 2).
 * ════════════════════════════════════════════════════════════════════════════
 * A running counter (per session / day / month) plus the budget policy the brief
 * requires:
 *   • a live counter of estimated spend,
 *   • an alert to LEO at 70% of a configurable ceiling (once, not spammed),
 *   • at the ceiling: NEVER disconnect Martita. Degrade gracefully — a cheaper
 *     realtime model and shorter responses — and tell LEO, never Martita.
 *
 * This is the deliberate FIX to the older `aiSpendGuard.checkSpendAllowed`, which
 * returned allowed:false ("we have done enough today, continue tomorrow") at the
 * cap — i.e. it cut Martita off. That hard block is kept ONLY for the online-search
 * sub-quota (a discrete, skippable action); a live CONVERSATION must never be
 * disconnected — it degrades. costMeter is the single accounting+decision surface
 * for conversation spend (composes the pricing from aiCostModel).
 *
 * Pure core + a thin localStorage persistence adapter (mirrors aiSpendGuard's
 * storage-agnostic contract). All money is USD internally; ₪ is derived for display.
 */
import { RATES } from './aiCostModel'

export interface CostTotals {
  sessionUsd: number
  dayUsd: number
  monthUsd: number
  /** ISO day (YYYY-MM-DD) and month (YYYY-MM) the day/month buckets belong to. */
  day: string
  month: string
}

export function emptyTotals(day: string, month: string): CostTotals {
  return { sessionUsd: 0, dayUsd: 0, monthUsd: 0, day, month }
}

/**
 * Add a spend delta, rolling the day/month buckets over when the date changes.
 * Pure: returns the next totals; the caller persists. `now` is injected (no
 * Date.now() here) so it is deterministic and testable.
 */
export function recordSpend(
  prev: CostTotals,
  deltaUsd: number,
  now: { day: string; month: string },
  opts?: { newSession?: boolean },
): CostTotals {
  const d = deltaUsd > 0 ? deltaUsd : 0
  const dayUsd = prev.day === now.day ? prev.dayUsd + d : d
  const monthUsd = prev.month === now.month ? prev.monthUsd + d : d
  const sessionUsd = (opts?.newSession ? 0 : prev.sessionUsd) + d
  return { sessionUsd, dayUsd, monthUsd, day: now.day, month: now.month }
}

// ─── Budget policy ───────────────────────────────────────────────────────────
export const ALERT_FRACTION = 0.7 // alert Leo at 70% of the ceiling

export type CostTier = 'normal' | 'warn' | 'degraded'

export interface BudgetDecision {
  tier: CostTier
  /** Fraction of the daily ceiling used (0..1+). */
  fraction: number
  /** Alert Leo now? True crossing 70% and at the ceiling — the caller de-dups. */
  notifyLeo: boolean
  /** The realtime model to use — cheaper tier when degraded. Never null. */
  realtimeModel: string
  /** Cap on Abu's response length when degraded (undefined = no cap). */
  maxResponseTokens?: number
  /** ALWAYS true — a live conversation is never disconnected. */
  connected: true
  /** ALWAYS null — Martita is never shown a cost/limit message. */
  martitaMessage: null
  /** Operator-facing line for Leo (only when notifyLeo). */
  leoMessage?: string
}

export const REALTIME_MODEL_NORMAL = 'gpt-4o-realtime'
export const REALTIME_MODEL_CHEAP = 'gpt-4o-mini-realtime'
export const DEGRADED_MAX_RESPONSE_TOKENS = 320 // shorter (still 2–4 sentences), never terse-to-rude

/**
 * Decide the budget tier for the current day spend against a configurable ceiling.
 * The invariant: `connected` is always true and `martitaMessage` is always null —
 * degradation is invisible to Martita and only Leo is ever told.
 */
export function budgetDecision(dayUsd: number, ceilingUsd: number): BudgetDecision {
  const ceiling = ceilingUsd > 0 ? ceilingUsd : 1
  const fraction = dayUsd / ceiling
  const ilsCeil = Math.round(ceilingUsd * RATES.usdToIls)
  if (fraction >= 1) {
    return {
      tier: 'degraded',
      fraction: round(fraction),
      notifyLeo: true,
      realtimeModel: REALTIME_MODEL_CHEAP,
      maxResponseTokens: DEGRADED_MAX_RESPONSE_TOKENS,
      connected: true,
      martitaMessage: null,
      leoMessage: `AbuAI daily budget ceiling reached (~$${round(dayUsd, 2)} of $${ceilingUsd} / ~₪${ilsCeil}). Degraded to ${REALTIME_MODEL_CHEAP} + shorter replies. Martita was NOT disconnected or told.`,
    }
  }
  if (fraction >= ALERT_FRACTION) {
    return {
      tier: 'warn',
      fraction: round(fraction),
      notifyLeo: true,
      realtimeModel: REALTIME_MODEL_NORMAL,
      connected: true,
      martitaMessage: null,
      leoMessage: `AbuAI daily spend at ${Math.round(fraction * 100)}% of the ceiling (~$${round(dayUsd, 2)} of $${ceilingUsd}). No change for Martita yet; degrade begins at 100%.`,
    }
  }
  return {
    tier: 'normal',
    fraction: round(fraction),
    notifyLeo: false,
    realtimeModel: REALTIME_MODEL_NORMAL,
    connected: true,
    martitaMessage: null,
  }
}

/**
 * Whether to actually fire Leo's alert, given the last tier we already alerted on.
 * Prevents spamming: fire once when entering 'warn', and once when entering
 * 'degraded'. `lastAlertedTier` is persisted by the caller.
 */
export function shouldFireAlert(decision: BudgetDecision, lastAlertedTier: CostTier | null): boolean {
  if (!decision.notifyLeo) return false
  return decision.tier !== lastAlertedTier
}

function round(n: number, dp = 4): number {
  const f = 10 ** dp
  return Math.round(n * f) / f
}

// ─── Thin localStorage persistence (browser only; no-op-safe) ────────────────
const KEY = 'abubank-cost-totals'
const ALERT_KEY = 'abubank-cost-alert-tier'

export function loadTotals(now: { day: string; month: string }): CostTotals {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null
    if (!raw) return emptyTotals(now.day, now.month)
    const t = JSON.parse(raw) as CostTotals
    // Roll buckets if the persisted day/month is stale.
    return {
      sessionUsd: 0, // a fresh load is a fresh session
      dayUsd: t.day === now.day ? t.dayUsd : 0,
      monthUsd: t.month === now.month ? t.monthUsd : 0,
      day: now.day,
      month: now.month,
    }
  } catch {
    return emptyTotals(now.day, now.month)
  }
}

export function saveTotals(t: CostTotals): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(t))
  } catch { /* ignore */ }
}

export function loadLastAlertedTier(): CostTier | null {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(ALERT_KEY) : null
    return raw === 'warn' || raw === 'degraded' || raw === 'normal' ? raw : null
  } catch { return null }
}

export function saveLastAlertedTier(tier: CostTier): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(ALERT_KEY, tier)
  } catch { /* ignore */ }
}
