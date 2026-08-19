/*
 * Evolution OS — configuration, feature flags, and kill switches
 * ══════════════════════════════════════════════════════════════
 * Evolution OS is the evidence / diagnosis / evaluation / controlled-improvement
 * system that lives BENEATH AbuAI (the user-facing intelligence). This module is
 * the single place that decides whether any Evolution machinery is allowed to run.
 *
 * THE CENTRAL LAW (Section 3): the live assistant must never rewrite itself from
 * raw feedback. Evolution OS therefore ships in OBSERVE_ONLY by default — it may
 * only look, never change serving behavior. Promotion past OBSERVE_ONLY is a
 * human decision, encoded as a mode change here, never inferred from data.
 *
 * Everything is a pure constant + tiny helpers so it is trivially testable and can
 * never throw into a live turn.
 */

/** Operating modes, lowest → highest capability. Only OBSERVE_ONLY is default-on. */
export type EvolutionMode =
  | 'off'          // Evolution OS fully disabled (global kill switch).
  | 'observe_only' // Capture + classify evidence. NEVER affects serving behavior.
  | 'shadow'       // Additionally run candidates against live-shaped traffic, compare. No user impact.
  | 'preview'      // Candidate reachable in a preview environment only.
  | 'canary'       // Candidate on a small, reversible slice. Requires human approval to reach here.

/** Per-domain kill switches — a single domain can be silenced without disabling all. */
export type EvolutionDomain =
  | 'family' | 'memory' | 'calendar' | 'diary' | 'online'
  | 'voice' | 'mobile' | 'tool' | 'response' | 'identity'

export interface EvolutionConfig {
  /** Global mode. The single most important safety control. */
  mode: EvolutionMode
  /** Global kill switch — when false, NOTHING in Evolution OS runs, whatever `mode` says. */
  enabled: boolean
  /** Per-domain kill switches. A domain absent from the map is treated as enabled. */
  domainKill: Partial<Record<EvolutionDomain, boolean>>
  /** Durable evidence-queue caps (Section 18). */
  queue: {
    maxEvents: number       // ring cap — oldest non-dead-letter events drop first
    maxPayloadBytes: number // reject/ truncate an oversized single event
    maxRetries: number      // → dead-letter after this many failed uploads
    baseBackoffMs: number   // exponential backoff base
    maxBackoffMs: number    // backoff ceiling
  }
  /** Retention (Section 19): evidence older than this is eligible for deletion. */
  retentionDays: number
}

/**
 * Production default: OBSERVE_ONLY, globally enabled so evidence is collected, but
 * structurally incapable of changing a served answer. This is the safe steady state.
 * `enabled` gates ALL machinery; flip it false for a true global kill.
 */
export const DEFAULT_EVOLUTION_CONFIG: EvolutionConfig = {
  mode: 'observe_only',
  enabled: true,
  domainKill: {},
  queue: {
    maxEvents: 500,
    maxPayloadBytes: 32 * 1024,
    maxRetries: 6,
    baseBackoffMs: 2_000,
    maxBackoffMs: 5 * 60_000,
    // NOTE: backoff jitter is applied by the queue, not stored here.
  },
  retentionDays: 30,
}

/** True only when Evolution OS may capture/classify evidence at all. */
export function isObservationAllowed(cfg: EvolutionConfig): boolean {
  return cfg.enabled && cfg.mode !== 'off'
}

/**
 * True only when Evolution OS is allowed to affect (or shadow-compare) serving
 * behavior. OBSERVE_ONLY returns false — the structural guarantee that raw
 * production evidence cannot flow back into the live answer.
 */
export function isBehaviorChangeAllowed(cfg: EvolutionConfig): boolean {
  if (!cfg.enabled) return false
  return cfg.mode === 'shadow' || cfg.mode === 'preview' || cfg.mode === 'canary'
}

/** True when a given domain is live (global + per-domain kill both pass). */
export function isDomainEnabled(cfg: EvolutionConfig, domain: EvolutionDomain): boolean {
  if (!isObservationAllowed(cfg)) return false
  return cfg.domainKill[domain] !== true
}

/**
 * Read the effective config. Env can only ever make Evolution *safer* (turn it
 * off) — it can never silently escalate mode past OBSERVE_ONLY. Escalation is a
 * code + human-approval change, by design.
 */
export function resolveConfig(env?: Record<string, string | undefined>): EvolutionConfig {
  const cfg: EvolutionConfig = { ...DEFAULT_EVOLUTION_CONFIG, domainKill: { ...DEFAULT_EVOLUTION_CONFIG.domainKill } }
  const kill = env?.VITE_EVOLUTION_KILL ?? env?.EVOLUTION_KILL
  if (kill === '1' || kill === 'true') { cfg.enabled = false; cfg.mode = 'off' }
  return cfg
}
