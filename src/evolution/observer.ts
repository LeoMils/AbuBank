/*
 * Evolution OS — OBSERVE_ONLY observer (the serving-plane seam)
 * ════════════════════════════════════════════════════════════
 * The ONE function the serving plane calls per turn. It captures a redacted trace
 * envelope, enqueues it durably, runs signal detection over a small window, and
 * opens a case for GOLD signals. It is:
 *   • OBSERVE_ONLY — it returns void and never affects the served answer.
 *   • Crash-proof — every path is wrapped; it can never throw into a live turn.
 *   • Config-gated — a global/per-domain kill switch silences it instantly.
 *
 * This is the structural embodiment of the Central Law (Section 3): raw production
 * evidence flows IN, but nothing here can flow back OUT into the live behavior.
 */
import { buildEnvelope, type AbuTraceEnvelope, type TurnFacts } from './traceEnvelope'
import { EvidenceQueue, createMemoryQueue, createDurableQueue } from './evidenceQueue'
import { detectSignals, mayDriveLearning, type Signal } from './signals'
import { createCase, transition, type EvolutionCase, type Actor } from './stateMachine'
import { DEFAULT_EVOLUTION_CONFIG, isObservationAllowed, isDomainEnabled, type EvolutionConfig, type EvolutionDomain } from './config'
import { isRecorderOff } from './recorderSwitch'

const AUTOMATION: Actor = { kind: 'automation', name: 'evolution-observer' }

function intentToDomain(intent: string): EvolutionDomain {
  if (/family|relation|gender/i.test(intent)) return 'family'
  if (/calendar|event|appointment|reminder/i.test(intent)) return 'calendar'
  if (/online|search|web/i.test(intent)) return 'online'
  if (/memory|recall/i.test(intent)) return 'memory'
  if (/diary/i.test(intent)) return 'diary'
  if (/voice|speech|tts|stt/i.test(intent)) return 'voice'
  return 'response'
}

export interface ObservationResult {
  captured: boolean
  deduped: boolean
  envelope?: AbuTraceEnvelope
  signals: Signal[]
  openedCaseIds: string[]
}

const EMPTY: ObservationResult = { captured: false, deduped: false, signals: [], openedCaseIds: [] }

/**
 * Stateful observer. Holds the durable queue, a rolling window of recent envelopes
 * (for cross-turn signals), and the open cases. In production a singleton; in tests
 * constructed fresh with a MemoryBackend.
 */
export class EvolutionObserver {
  private window: AbuTraceEnvelope[] = []
  private cases = new Map<string, EvolutionCase>()
  private readonly WINDOW = 8
  constructor(
    private queue: EvidenceQueue,
    private cfg: EvolutionConfig = DEFAULT_EVOLUTION_CONFIG,
  ) {}

  async init(): Promise<void> { try { await this.queue.init() } catch { /* never fatal */ } }

  /** The serving-plane seam. Never throws; returns a result for tests/telemetry. */
  observe(facts: TurnFacts): ObservationResult {
    try {
      if (!isObservationAllowed(this.cfg)) return EMPTY
      const domain = intentToDomain(facts.intent)
      if (!isDomainEnabled(this.cfg, domain)) return EMPTY

      const envelope = buildEnvelope(facts)
      const enq = this.queue.enqueue(envelope, facts.ts)
      const deduped = enq.ok ? enq.deduped : false
      if (enq.ok && enq.deduped) {
        // Same turn already seen — do not re-signal or re-open cases.
        return { captured: true, deduped: true, envelope, signals: [], openedCaseIds: [] }
      }

      this.window.push(envelope)
      if (this.window.length > this.WINDOW) this.window.shift()

      const signals = detectSignals(this.window)
      const openedCaseIds: string[] = []
      for (const s of signals) {
        if (s.polarity !== 'failure') continue
        if (s.strength !== 'gold') continue // OBSERVE_ONLY: only GOLD opens a case; silver/bronze cluster only
        const caseId = `case:${s.kind}:${s.turnId}`
        if (this.cases.has(caseId)) continue
        let c = createCase(caseId, domain, `${s.kind} at ${s.turnId}`, envelope.startedAt, AUTOMATION)
        // Advance through the deterministic early states we can justify right now.
        c = this.advance(c, 'SIGNAL_CLASSIFIED', `signal ${s.kind} (${s.strength})`, [envelope.integrity.idempotencyKey], s.confidence)
        c = this.advance(c, 'EVIDENCE_VALIDATED', 'envelope schema valid + integrity hash present', [envelope.integrity.payloadHash], 0.9)
        c = this.advance(c, 'PRIVACY_REDACTED', `redacted (${envelope.privacy.piiClassesDetected.join(',') || 'none'})`, [], 1)
        c = this.advance(c, 'DUPLICATE_CHECKED', 'idempotency-deduped queue', [envelope.integrity.idempotencyKey], 1)
        this.cases.set(caseId, c)
        openedCaseIds.push(caseId)
      }
      return { captured: true, deduped, envelope, signals, openedCaseIds }
    } catch {
      return EMPTY // OBSERVE_ONLY must never break a turn
    }
  }

  private advance(c: EvolutionCase, to: Parameters<typeof transition>[1], reason: string, evidenceRefs: string[], confidence: number): EvolutionCase {
    const r = transition(c, to, { actor: AUTOMATION, at: c.createdAt, reason, evidenceRefs, confidence, policy: this.cfg.mode })
    return r.ok ? r.case : c
  }

  getCases(): EvolutionCase[] { return [...this.cases.values()] }
  getQueue(): EvidenceQueue { return this.queue }
  getWindow(): AbuTraceEnvelope[] { return [...this.window] }
}

/** Test/SSR factory — memory-backed, default config. */
export function createMemoryObserver(cfg: EvolutionConfig = DEFAULT_EVOLUTION_CONFIG): EvolutionObserver {
  return new EvolutionObserver(createMemoryQueue(cfg.queue), cfg)
}

// ── Production singleton (lazy, crash-proof) ─────────────────────────────────
let _singleton: EvolutionObserver | null = null
let _initStarted = false

/** Get (and lazily create) the production observer. Uses the durable IndexedDB
 *  queue in the browser, memory otherwise. Never throws. */
export function getObserver(cfg: EvolutionConfig = DEFAULT_EVOLUTION_CONFIG): EvolutionObserver {
  if (_singleton) return _singleton
  try {
    // createDurableQueue uses the durable IndexedDB backend in the browser (its
    // `idb` import is itself lazy) and falls back to memory otherwise.
    _singleton = new EvolutionObserver(createDurableQueue(cfg.queue), cfg)
  } catch {
    _singleton = createMemoryObserver(cfg)
  }
  if (!_initStarted) { _initStarted = true; void _singleton.init() }
  return _singleton
}

/**
 * The crash-proof one-liner the serving plane calls. Fire-and-forget, never throws,
 * OBSERVE_ONLY. If Evolution OS is disabled, this is a cheap no-op.
 */
export function observeTurn(facts: TurnFacts, cfg: EvolutionConfig = DEFAULT_EVOLUTION_CONFIG): void {
  try {
    if (!isObservationAllowed(cfg)) return
    // User off switch (Settings → Flight Recorder). Read per-turn so toggling takes
    // effect immediately; can only make capture SAFER, never escalate it.
    if (isRecorderOff()) return
    getObserver(cfg).observe(facts)
  } catch { /* OBSERVE_ONLY must never break a turn */ }
}
