/*
 * WARM PWA RUNTIME PROVENANCE (o-sw).  (Stage 3C §10)
 * ════════════════════════════════════════════════════════════════════════════════════════
 * A green `/sw.js 200` proves the service worker is DEPLOYED — not that a WARM client actually
 * serves the certified bundle. This control separates the machine-verifiable hops (read-only)
 * from the device-class hop:
 *   DEPLOYED    — /sw.js served (200, non-empty).                               [PREVIEW]
 *   PRECACHE    — the SW precache references the certified bundle asset hash.   [PREVIEW]
 *   WARM_SERVES — an installed warm client actually serves the certified build. [PHYSICAL_DEVICE]
 * The control is IMPLEMENTED when the read-only hops are checked; WARM_SERVES stays an honest
 * device-class claim (never upgraded from PREVIEW).
 */

export interface SwProvenanceInput {
  swDeployed: boolean
  swBytes: number
  /** Does the SW precache manifest reference the certified bundle asset (hash/path)? */
  precacheReferencesCertifiedBundle: boolean
  /** DEVICE-class: an installed warm client verified to serve the certified build. */
  warmClientVerifiedOnDevice?: boolean
}

export interface SwProvenanceResult {
  /** True iff the read-only (PREVIEW) hops pass — the control is implemented + current. */
  controlCurrent: boolean
  /** True only with device proof — never from the read-only hops. */
  warmServesProven: boolean
  blockers: { code: string; reason: string }[]
  deviceLimits: string[]
}

export function evaluateSwProvenance(input: SwProvenanceInput): SwProvenanceResult {
  const blockers: { code: string; reason: string }[] = []
  if (!input.swDeployed || input.swBytes <= 0) blockers.push({ code: 'SW_NOT_DEPLOYED', reason: '/sw.js not served or empty' })
  if (input.swDeployed && !input.precacheReferencesCertifiedBundle) blockers.push({ code: 'SW_PRECACHE_MISMATCH', reason: 'SW precache does not reference the certified bundle asset' })

  const controlCurrent = blockers.length === 0
  const warmServesProven = controlCurrent && input.warmClientVerifiedOnDevice === true
  const deviceLimits = warmServesProven ? [] : ['WARM_SERVES is a PHYSICAL_DEVICE claim — a warm installed client must be verified to serve the certified bundle; read-only checks cannot prove it']
  return { controlCurrent, warmServesProven, blockers, deviceLimits }
}
