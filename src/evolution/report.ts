/*
 * Evolution OS — operator health report (Section 28)
 * ══════════════════════════════════════════════════
 * Answers, from live state, the questions an operator who did NOT build the system
 * needs: is collection working? are uploads delayed? are events rejected? is
 * redaction working? are P0 signals present? are clusters growing? is it safe to
 * promote? Pure over the queue + cases + signals — no I/O, trivially testable.
 */
import type { EvidenceQueue } from './evidenceQueue'
import type { EvolutionCase } from './stateMachine'
import type { Signal } from './signals'
import type { EvolutionConfig } from './config'

export interface HealthReport {
  generatedAt: string
  mode: string
  enabled: boolean
  collection: { totalEvents: number; pending: number; uploaded: number; deadLetter: number }
  redaction: { eventsWithPii: number; secretsRemoved: number; ok: boolean }
  signals: { gold: number; silver: number; bronze: number; failures: number; successes: number }
  cases: { open: number; byState: Record<string, number> }
  p0Present: boolean
  safeToPromote: boolean
  warnings: string[]
}

export function buildHealthReport(
  queue: EvidenceQueue,
  cases: EvolutionCase[],
  recentSignals: Signal[],
  cfg: EvolutionConfig,
  nowIso: string,
): HealthReport {
  const all = queue.all()
  const pending = all.filter(r => r.status === 'pending').length
  const uploaded = all.filter(r => r.status === 'uploaded').length
  const deadLetter = all.filter(r => r.status === 'dead_letter').length

  const eventsWithPii = all.filter(r => (r.envelope.privacy.piiClassesDetected.length > 0)).length
  const secretsRemoved = all.reduce((s, r) => s + (r.envelope.privacy.secretsRemoved || 0), 0)
  // Redaction "ok": every stored envelope claims redacted status (never 'raw').
  const redactionOk = all.every(r => r.envelope.privacy.redactionStatus !== 'raw')

  const gold = recentSignals.filter(s => s.strength === 'gold').length
  const silver = recentSignals.filter(s => s.strength === 'silver').length
  const bronze = recentSignals.filter(s => s.strength === 'bronze').length
  const failures = recentSignals.filter(s => s.polarity === 'failure').length
  const successes = recentSignals.filter(s => s.polarity === 'success').length

  const byState: Record<string, number> = {}
  for (const c of cases) byState[c.state] = (byState[c.state] ?? 0) + 1
  const open = cases.filter(c => c.state !== 'CONFIRMED' && c.state !== 'REJECTED' && c.state !== 'ROLLED_BACK').length

  const p0Present = gold > 0
  const warnings: string[] = []
  if (deadLetter > 0) warnings.push(`${deadLetter} events in dead-letter — ingestion path needs review`)
  if (!redactionOk) warnings.push('a stored envelope is not marked redacted — STOP and inspect redaction')
  if (pending > all.length * 0.8 && all.length > 20) warnings.push('uploads appear delayed (most events still pending)')

  // OBSERVE_ONLY is never "safe to promote to production" from automation alone.
  const safeToPromote = false
  if (cfg.mode === 'observe_only') warnings.push('mode is OBSERVE_ONLY — promotion requires human approval (by design)')

  return {
    generatedAt: nowIso,
    mode: cfg.mode,
    enabled: cfg.enabled,
    collection: { totalEvents: all.length, pending, uploaded, deadLetter },
    redaction: { eventsWithPii, secretsRemoved, ok: redactionOk },
    signals: { gold, silver, bronze, failures, successes },
    cases: { open, byState },
    p0Present,
    safeToPromote,
    warnings,
  }
}

/** A compact human-readable rendering for a console dump / operator paste. */
export function renderHealthReport(r: HealthReport): string {
  return [
    `Evolution OS Health — ${r.generatedAt}`,
    `mode=${r.mode} enabled=${r.enabled} safeToPromote=${r.safeToPromote}`,
    `collection: total=${r.collection.totalEvents} pending=${r.collection.pending} uploaded=${r.collection.uploaded} deadLetter=${r.collection.deadLetter}`,
    `redaction: pii=${r.redaction.eventsWithPii} secretsRemoved=${r.redaction.secretsRemoved} ok=${r.redaction.ok}`,
    `signals: gold=${r.signals.gold} silver=${r.signals.silver} bronze=${r.signals.bronze} (fail=${r.signals.failures} ok=${r.signals.successes})`,
    `cases: open=${r.cases.open} ${JSON.stringify(r.cases.byState)}`,
    `P0 present: ${r.p0Present}`,
    ...(r.warnings.length ? ['warnings:', ...r.warnings.map(w => `  - ${w}`)] : ['warnings: none']),
  ].join('\n')
}
