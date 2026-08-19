/*
 * Health-alert decision (O5) — turn the /api/health heartbeat into an ACTUAL alert so a
 * silent failure cannot pass unnoticed. Pure + deterministic: the nightly cron probes its
 * own /api/health, feeds the result here, and this decides the Hebrew status line and
 * whether to fire Leo's notification (via the existing sendNotification sink).
 *
 * Before this, the cron always emitted "🟢 הכל תקין" WITHOUT checking anything — a deployed
 * outage or a missing-env misconfig would report green. That is the silent failure this closes.
 */
export interface HealthProbe {
  /** the probe actually reached /api/health (false = network error / 5xx / timeout). */
  reachable: boolean
  /** the endpoint's `ok` flag (true only when every required server env var is present). */
  ok: boolean
  /** the deployed build version reported by /api/health (for the alert body). */
  buildVersion?: string | null
}

export interface HealthDecision {
  healthy: boolean
  /** fire Leo's notification when true (an unhealthy or unreachable deployment). */
  alert: boolean
  hebrewLine: string
  reason: string
}

/** Decide the status line + whether to alert. Total and deterministic. */
export function evaluateHealth(p: HealthProbe): HealthDecision {
  if (!p.reachable) {
    return { healthy: false, alert: true, hebrewLine: '🔴 האתר לא מגיב — בדקי מיד', reason: 'health endpoint unreachable' }
  }
  if (!p.ok) {
    return { healthy: false, alert: true, hebrewLine: '🔴 תקלה בשרת — הגדרות חסרות', reason: 'health ok=false (missing required env)' }
  }
  const ver = p.buildVersion ? ` (${p.buildVersion})` : ''
  return { healthy: true, alert: false, hebrewLine: `🟢 הכל תקין${ver}`, reason: 'health ok' }
}

/**
 * Probe a deployment's /api/health and evaluate it. Any throw/timeout/non-2xx ⇒ unreachable
 * ⇒ alert. `origin` is the deployment origin (derived from the cron request URL).
 */
export async function probeHealth(
  origin: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 8_000,
): Promise<HealthDecision> {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null
  try {
    const res = await fetchImpl(`${origin}/api/health`, ctrl ? { signal: ctrl.signal } : {})
    if (!res.ok) return evaluateHealth({ reachable: true, ok: false })
    const body = await res.json().catch(() => null) as { ok?: boolean; buildVersion?: string } | null
    return evaluateHealth({ reachable: true, ok: body?.ok === true, buildVersion: body?.buildVersion ?? null })
  } catch {
    return evaluateHealth({ reachable: false, ok: false })
  } finally {
    if (timer) clearTimeout(timer)
  }
}
