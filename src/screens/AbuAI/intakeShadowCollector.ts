/*
 * INTAKE SHADOW COLLECTOR — the live sink for the per-turn understanding shadow.
 * Bounded ring buffer (last N turns) so memory is capped. Surfaces correctness
 * risks (disagree / regressed) immediately and logs a rolling understanding-KPI
 * line every SUMMARY_EVERY turns (obligation #7 — KPIs, not test counts). Logging
 * only; it NEVER affects a reply. Real-provider numbers are PREVIEW-class.
 */
import { aggregateKPIs, kpiSummaryLine, type ShadowRecord, type UnderstandingKPIs } from './understandingShadow'

const RING_MAX = 200
const SUMMARY_EVERY = 20
const ring: ShadowRecord[] = []

export function recordIntakeShadow(rec: ShadowRecord): void {
  ring.push(rec)
  if (ring.length > RING_MAX) ring.shift()
  try {
    if (rec.bucket === 'disagree' || rec.bucket === 'regressed') {
      // A correctness risk (must be 0) — surface the exact turn for root-cause.
      console.warn(`[AbuAI][SHADOW|RISK] ${rec.bucket} in="${rec.input}" old=${JSON.stringify(rec.old.people)} new=${JSON.stringify(rec.grounded.people)}`)
    }
    if (ring.length % SUMMARY_EVERY === 0) {
      console.info(`[AbuAI][SHADOW|KPI] ${kpiSummaryLine(aggregateKPIs(ring))}`)
    }
  } catch { /* logging never breaks a turn */ }
}

export function intakeShadowKPIs(): UnderstandingKPIs { return aggregateKPIs(ring) }
export function intakeShadowCount(): number { return ring.length }
export function resetIntakeShadow(): void { ring.length = 0 }
