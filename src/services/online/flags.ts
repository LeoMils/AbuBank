/*
 * flags.ts — CODE-LEVEL online flags with MEASURED defaults.
 * ════════════════════════════════════════════════════════════════════════════
 * ONLINE_DEEP_FETCH used to be a Preview-scoped Vercel env var. That is a production
 * hazard: it does NOT survive a merge to production, so Martita would silently get shallow
 * snippet answers with nobody noticing. A capability's default belongs in CODE, with the
 * measurement that justifies it — not in an env panel that a merge drops.
 *
 * The env var is kept ONLY as an ops override (a kill-switch / force-on), never as the source
 * of the default. The DEFAULT is set here from the acceptance measurement (docs/eval/
 * ONLINE_ACCEPTANCE.md): the general search loop is "never worse than the snippet", so it
 * defaults ON. Flip a default here (with new evidence), not in a dashboard.
 */

/** The general search loop (fetch pages → cheap-model judge → refine → synthesize) is ON by
 *  default: measured never-worse-than-snippet across the acceptance question set. */
export const ONLINE_GENERAL_SEARCH_DEFAULT = true

/** Prefetch warm store (cinema/weather/headlines/transit cached, served <1s): default decided
 *  by the off/on freshness-vs-latency measurement. Kept OFF until that measurement is on-device
 *  (serving cache trades a little freshness for latency; the code default is the honest place). */
export const ONLINE_PREFETCH_WARM_DEFAULT = false

const truthy = (v: string | undefined): boolean => v === '1' || v === 'true'
const falsy = (v: string | undefined): boolean => v === '0' || v === 'false'

/** Is the general deep-fetch search loop enabled? Env override wins (ops kill-switch / force-on);
 *  otherwise the measured code default. Accepts the legacy ONLINE_DEEP_FETCH name. */
export function onlineGeneralSearchEnabled(env: Record<string, string | undefined> = {}): boolean {
  const v = env.ONLINE_DEEP_FETCH ?? env.ONLINE_GENERAL_SEARCH
  if (falsy(v)) return false
  if (truthy(v)) return true
  return ONLINE_GENERAL_SEARCH_DEFAULT
}

/** Is the prefetch warm store enabled? Env override wins, else the code default. */
export function onlinePrefetchWarmEnabled(env: Record<string, string | undefined> = {}): boolean {
  const v = env.LIVE_PREFETCH_WARM ?? env.ONLINE_PREFETCH_WARM
  if (falsy(v)) return false
  if (truthy(v)) return true
  return ONLINE_PREFETCH_WARM_DEFAULT
}
