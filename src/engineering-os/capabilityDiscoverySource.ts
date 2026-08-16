/*
 * CAPABILITY-DISCOVERY SOURCE-COMPLETENESS ORACLE.  (Stage 3C §3–4)
 * ════════════════════════════════════════════════════════════════════════════════
 * The static capability producer (scripts/discover-capabilities.ts) reads THREE
 * signals: SCREEN_DIR, SCREEN_ENUM, TOOL_REGISTRY. Three signals do not PROVE static
 * discovery is complete — a user-capability registered through any OTHER mechanism
 * (a deep-link/query-param route, a device-gated feature flag, an overlay opened
 * outside the Screen enum, an API-backed action) would be silently absent, and the
 * "33 capabilities" number would look complete while omitting real surface.
 *
 * This oracle does NOT re-discover capabilities. It answers the prior question:
 * "have we enumerated the repository's CLASSES of user-capability registration, and is
 * every RELEASE-RELEVANT class actually consumed by the producer?" A release-relevant
 * source class the producer does not read → CAPABILITY_DISCOVERY_SOURCE_UNCOVERED
 * (blocking). An UNKNOWN class cannot silently shrink discovery →
 * CAPABILITY_DISCOVERY_SOURCE_UNKNOWN (blocking). A class that genuinely registers no
 * NEW user capability may be excluded ONLY with a machine-recorded proof.
 *
 * Sensitivity: a real uncovered release-relevant class blocks. Specificity: a helper /
 * infra mechanism excluded WITH proof does NOT block. Non-vacuity: a fully-covered set
 * yields zero blockers (the oracle is not always-red).
 */

export type SourceReleaseRelevance =
  | 'RELEASE_RELEVANT'
  | 'NON_RELEASE_RELEVANT_WITH_PROOF'
  | 'UNKNOWN'

export interface DiscoverySourceClass {
  /** Stable id, e.g. 'DEVICE_GATED_FLAG', 'DEEP_LINK_ROUTE'. */
  id: string
  /** What the mechanism is + where it lives in the repo (human/audit). */
  mechanism: string
  relevance: SourceReleaseRelevance
  /** Does the capability producer actually consume this class today? */
  coveredByProducer: boolean
  /** REQUIRED iff relevance === 'NON_RELEASE_RELEVANT_WITH_PROOF'. */
  exclusionProof?: string
  /** Optional: capabilities this class would surface that the producer misses today. */
  exampleUncoveredCapabilities?: string[]
}

export interface SourceCompletenessInput {
  sourceClasses: DiscoverySourceClass[]
}

export interface SourceBlocker {
  code:
    | 'CAPABILITY_DISCOVERY_SOURCE_UNCOVERED'
    | 'CAPABILITY_DISCOVERY_SOURCE_UNKNOWN'
    | 'INVALID_SOURCE_EXCLUSION'
  reason: string
}

export interface SourceCompletenessResult {
  blockers: SourceBlocker[]
  distribution: Record<string, number>
  /** True iff every release-relevant class is covered and no class is UNKNOWN/unproven. */
  complete: boolean
}

/**
 * Evaluate whether the producer's source coverage is complete.
 *  - RELEASE_RELEVANT + not covered → CAPABILITY_DISCOVERY_SOURCE_UNCOVERED.
 *  - UNKNOWN                        → CAPABILITY_DISCOVERY_SOURCE_UNKNOWN.
 *  - NON_RELEASE_RELEVANT_WITH_PROOF w/o proof → INVALID_SOURCE_EXCLUSION.
 *  - NON_RELEASE_RELEVANT_WITH_PROOF w/ proof  → excluded (no blocker).
 *  - RELEASE_RELEVANT + covered     → covered (no blocker).
 */
export function evaluateSourceCompleteness(input: SourceCompletenessInput): SourceCompletenessResult {
  const blockers: SourceBlocker[] = []
  const distribution: Record<string, number> = { COVERED: 0, UNCOVERED_RELEASE: 0, EXCLUDED_WITH_PROOF: 0, UNKNOWN: 0 }

  for (const s of input.sourceClasses) {
    if (s.relevance === 'UNKNOWN') {
      distribution.UNKNOWN!++
      blockers.push({
        code: 'CAPABILITY_DISCOVERY_SOURCE_UNKNOWN',
        reason: `source class '${s.id}' (${s.mechanism}) is UNKNOWN — it cannot silently shrink discovery; classify it release-relevant or exclude it with proof`,
      })
      continue
    }
    if (s.relevance === 'NON_RELEASE_RELEVANT_WITH_PROOF') {
      if (!s.exclusionProof || !s.exclusionProof.trim()) {
        blockers.push({
          code: 'INVALID_SOURCE_EXCLUSION',
          reason: `source class '${s.id}' claims NON_RELEASE_RELEVANT but supplies no exclusion proof`,
        })
      } else {
        distribution.EXCLUDED_WITH_PROOF!++
      }
      continue
    }
    // RELEASE_RELEVANT
    if (!s.coveredByProducer) {
      distribution.UNCOVERED_RELEASE!++
      const eg = s.exampleUncoveredCapabilities?.length ? ` (e.g. ${s.exampleUncoveredCapabilities.join(', ')})` : ''
      blockers.push({
        code: 'CAPABILITY_DISCOVERY_SOURCE_UNCOVERED',
        reason: `release-relevant source class '${s.id}' (${s.mechanism}) is NOT consumed by the capability producer${eg} — static discovery cannot be trusted complete`,
      })
    } else {
      distribution.COVERED!++
    }
  }

  return { blockers, distribution, complete: blockers.length === 0 }
}

/**
 * The source-class manifest as it ACTUALLY stands for AbuBank at 0.286 — derived from a
 * real repository inspection (App.tsx routing, deviceGatedFlags.ts, online/flags.ts,
 * api/*, public/manifest.json, vite-plugin-pwa). This is the honest current state:
 *  COVERED  : SCREEN_DIR, SCREEN_ENUM, TOOL_REGISTRY (the producer's 3 signals).
 *  UNCOVERED (release-relevant, real): DEVICE_GATED_FLAG, ONLINE_FLAG, DEEP_LINK_ROUTE.
 *  EXCLUDED-with-proof: API_ROUTE, PWA_MANIFEST, SERVICE_WORKER.
 * The three UNCOVERED classes are why the static 33 is NOT yet source-complete.
 */
export function currentDiscoverySourceManifest(): DiscoverySourceClass[] {
  return [
    // ── Covered by the producer today ──────────────────────────────────────────
    { id: 'SCREEN_DIR', mechanism: 'src/screens/* directories', relevance: 'RELEASE_RELEVANT', coveredByProducer: true },
    { id: 'SCREEN_ENUM', mechanism: 'Screen union in src/state/types.ts', relevance: 'RELEASE_RELEVANT', coveredByProducer: true },
    { id: 'TOOL_REGISTRY', mechanism: 'src/services/liveTools.ts name: registrations', relevance: 'RELEASE_RELEVANT', coveredByProducer: true },
    // ── Discovered but NOT covered (real static gaps) ──────────────────────────
    {
      id: 'DEVICE_GATED_FLAG',
      mechanism: 'src/services/deviceGatedFlags.ts — DEVICE_GATED_FLAGS registry',
      relevance: 'RELEASE_RELEVANT',
      coveredByProducer: false,
      exampleUncoveredCapabilities: ['LIVE_AUDIO_TUNE_V2', 'LIVE_BARGE_IN_TRUNCATE', 'LIVE_PREFETCH_WARM', 'LIVE_PREAMBLE_TWO_RESPONSE', 'LIVE_CLASSIFIED_MONITOR'],
    },
    {
      id: 'ONLINE_FLAG',
      mechanism: 'src/services/online/flags.ts — online search/prefetch capability gates',
      relevance: 'RELEASE_RELEVANT',
      coveredByProducer: false,
      exampleUncoveredCapabilities: ['ONLINE_GENERAL_SEARCH', 'ONLINE_PREFETCH_WARM'],
    },
    {
      id: 'DEEP_LINK_ROUTE',
      mechanism: 'src/App.tsx query-param/path/hash routing (?live=1, /settings/family-phones, ?diagnostics=1, ?screen=, ?legacy=1)',
      relevance: 'RELEASE_RELEVANT',
      coveredByProducer: false,
      // The diagnostics overlay is user-reachable but is NOT a src/screens/* dir and NOT
      // in the Screen enum — the producer's SCREEN_DIR/SCREEN_ENUM signals cannot see it.
      exampleUncoveredCapabilities: ['DiagnosticOverlay (?diagnostics / #diagnostics)'],
    },
    // ── Mechanisms that exist but register NO new user capability (proof-backed) ─
    {
      id: 'API_ROUTE',
      mechanism: 'api/*.ts serverless endpoints',
      relevance: 'NON_RELEASE_RELEVANT_WITH_PROOF',
      coveredByProducer: false,
      exclusionProof: 'each user-facing endpoint is the server side of an already-registered capability: abuai-chat/tts/stt/realtime-token back Live+AbuAI; abuai-online backs get_current_info; abuai-news backs AbuNews. health/cron are infra, not user-invokable capabilities.',
    },
    {
      id: 'PWA_MANIFEST',
      mechanism: 'public/manifest.json',
      relevance: 'NON_RELEASE_RELEVANT_WITH_PROOF',
      coveredByProducer: false,
      exclusionProof: 'manifest declares no shortcuts, share_target, or protocol_handlers; start_url is "/" only — it registers no user-entry capability beyond the SPA root already covered.',
    },
    {
      id: 'SERVICE_WORKER',
      mechanism: 'vite-plugin-pwa service worker + src/hooks/useSWUpdate.ts',
      relevance: 'NON_RELEASE_RELEVANT_WITH_PROOF',
      coveredByProducer: false,
      exclusionProof: 'the SW provides offline caching and the update lifecycle, not a distinct user capability; its only user-visible surface is UpdateToast, an existing UI affordance. (Warm-runtime provenance is separately governed by obligation o-sw.)',
    },
  ]
}
