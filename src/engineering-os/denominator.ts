/*
 * ACCEPTANCE DENOMINATOR (o-denominator).  (Stage 3C §7 / §9)
 * ════════════════════════════════════════════════════════════════════════════════════════
 * The canonical capability manifest (o-capability, PROVEN) answers "what exists". The
 * denominator answers "what must be PROVEN, at what evidence class, at what risk" — the set of
 * acceptance CELLS a release must satisfy. Risk is assigned HERE (never before, §2): a certified
 * model derives it from capability shape (side-effect / irreversibility / grounding / playback /
 * family-truth), not from a guess that "all N new capabilities are HIGH_RISK".
 *
 * Applicability is DERIVED, not Cartesian: a UI surface does not get a SIDE_EFFECT_SAFETY claim;
 * a pure read tool does not get a PLAYBACK claim. Cross-surface/stateful invariants are explicit
 * cells (family-text↔Live/TTS, calendar-action↔persisted↔spoken, current-info↔cache↔follow-up,
 * voice-cancel↔queue↔audible, deployment↔SW↔runtime).
 *
 * QA-of-QA (denominator.test.ts): sensitivity (a required claim missing is caught), specificity
 * (an inapplicable claim is not demanded), monotonicity (adding a capability never shrinks the
 * denominator), non-vacuity (not empty, not all-one-tier).
 */

export type CapabilityType = 'UI_SURFACE' | 'VOICE_CHANNEL' | 'ACTION_CAPABILITY' | 'INTEGRATION_CAPABILITY' | 'FEATURE_CAPABILITY'
export type ClaimFamily = 'REACHABILITY' | 'CORRECTNESS' | 'GROUNDING' | 'SIDE_EFFECT_SAFETY' | 'PLAYBACK' | 'CROSS_SURFACE' | 'PRIVACY'
export type Channel = 'TYPED' | 'VOICE' | 'UI'
export type RiskTier = 'P0' | 'P1' | 'P2'
export type EvidenceClass = 'CODE' | 'MOCK' | 'BROWSER' | 'PREVIEW' | 'PHYSICAL_DEVICE' | 'PRODUCTION'

export interface CapabilitySpec {
  id: string
  type: CapabilityType
  /** Does invoking it cause a real external/persistent side effect (write/call/message/reminder)? */
  hasSideEffect?: boolean
  /** Does it ground an answer from data/retrieval the model must not fabricate? */
  grounds?: boolean
  /** Does it assert family/kinship truth? */
  familyTruth?: boolean
  /** Is it part of the voice/Live playback path? */
  playback?: boolean
}

export interface DenominatorCell {
  capability: string
  claimFamily: ClaimFamily
  channel: Channel
  riskTier: RiskTier
  minEvidenceClass: EvidenceClass
  rationale: string
}

/** Risk model — assigned HERE, from capability shape + AbuBank's failure history. */
function riskFor(spec: CapabilitySpec, family: ClaimFamily): RiskTier {
  if (family === 'SIDE_EFFECT_SAFETY') return 'P0'                       // med-reminder / calendar-write / message harm
  if (family === 'GROUNDING') return 'P0'                                // NO TOOL RESULT = NO CLAIM (stale-fact incident)
  if (family === 'PLAYBACK') return 'P0'                                 // device voice incidents
  if (family === 'CROSS_SURFACE') return 'P0'                            // write-then-readback / follow-up incidents
  if (family === 'PRIVACY') return 'P0'                                  // the shipped-bundle key leak
  if (spec.familyTruth) return 'P0'                                      // Ofir-gender / kinship correctness
  if (family === 'CORRECTNESS') return spec.hasSideEffect ? 'P0' : 'P1'
  // REACHABILITY:
  if (spec.type === 'UI_SURFACE') return ['AbuAI', 'AbuCalendar', 'Live', 'AbuWhatsApp', 'AbuNews'].includes(spec.id) ? 'P1' : 'P2'
  if (spec.type === 'FEATURE_CAPABILITY') return 'P1'
  return 'P1'
}

/** Minimum evidence class the cell must reach to count as PROVEN. */
function minEvidenceFor(family: ClaimFamily, spec: CapabilitySpec): EvidenceClass {
  if (family === 'PLAYBACK') return 'PHYSICAL_DEVICE'                    // audible truth is device-only
  if (family === 'SIDE_EFFECT_SAFETY') return spec.type === 'INTEGRATION_CAPABILITY' ? 'PHYSICAL_DEVICE' : 'PREVIEW'
  if (family === 'GROUNDING') return 'PREVIEW'                           // real provider retrieval
  if (family === 'CROSS_SURFACE') return 'PREVIEW'
  if (family === 'PRIVACY') return 'PREVIEW'                             // shipped-artifact scan
  if (family === 'REACHABILITY') return spec.type === 'UI_SURFACE' ? 'PREVIEW' : 'CODE'
  return 'CODE'
}

/** Which claim families APPLY to a capability (derived, not Cartesian). */
function applicableFamilies(spec: CapabilitySpec): ClaimFamily[] {
  const fams = new Set<ClaimFamily>(['REACHABILITY'])
  if (spec.type === 'ACTION_CAPABILITY' || spec.type === 'INTEGRATION_CAPABILITY') fams.add('CORRECTNESS')
  if (spec.hasSideEffect) fams.add('SIDE_EFFECT_SAFETY')
  if (spec.grounds) fams.add('GROUNDING')
  if (spec.playback) fams.add('PLAYBACK')
  if (spec.familyTruth) fams.add('CORRECTNESS')
  return [...fams]
}

/** Which channels apply. Tools/AI reach the SAME controller typed+voice (parity); pure UI is UI. */
function channelsFor(spec: CapabilitySpec): Channel[] {
  if (spec.type === 'FEATURE_CAPABILITY') return ['UI']
  if (spec.type === 'UI_SURFACE') return spec.id === 'AbuAI' || spec.id === 'Live' ? ['TYPED', 'VOICE'] : ['UI']
  return ['TYPED', 'VOICE'] // action/integration/voice tools: typed+voice parity is mandatory
}

/** The explicit cross-surface / stateful invariant cells (not derivable from one capability). */
export function crossSurfaceCells(): DenominatorCell[] {
  const c = (capability: string, rationale: string): DenominatorCell =>
    ({ capability, claimFamily: 'CROSS_SURFACE', channel: 'VOICE', riskTier: 'P0', minEvidenceClass: 'PREVIEW', rationale })
  return [
    c('family↔Live/TTS', 'a family/kinship fact stated in text must hold when spoken via Live/TTS'),
    c('calendar-action↔persisted↔spoken', 'a calendar write must be persisted AND read back AND spoken consistently in one session'),
    c('current-info↔cache↔follow-up', 'a grounded current-info answer must survive a follow-up without cache contamination'),
    c('voice-cancel↔queue↔audible', 'a cancelled/superseded turn must not still be audible (playback truth)'),
    c('deployment↔SW↔runtime', 'the warm PWA client must serve the certified deployed bundle'),
  ]
}

export interface DenominatorResult {
  cells: DenominatorCell[]
  byRisk: Record<RiskTier, number>
  byFamily: Record<string, number>
}

/** Build the full acceptance denominator from the canonical capability specs. */
export function buildDenominator(specs: CapabilitySpec[]): DenominatorResult {
  const cells: DenominatorCell[] = []
  for (const spec of specs) {
    const families = applicableFamilies(spec)
    const channels = channelsFor(spec)
    for (const family of families) {
      // REACHABILITY/CORRECTNESS/etc. are asserted per applicable channel; safety/grounding once.
      const perChannel = family === 'REACHABILITY' || family === 'CORRECTNESS' || family === 'PLAYBACK'
      const chans = perChannel ? channels : [channels[0]!]
      for (const channel of chans) {
        cells.push({
          capability: spec.id, claimFamily: family, channel,
          riskTier: riskFor(spec, family),
          minEvidenceClass: minEvidenceFor(family, spec),
          rationale: `${spec.type} ${spec.id} · ${family} · ${channel}`,
        })
      }
    }
  }
  cells.push(...crossSurfaceCells())
  const byRisk: Record<RiskTier, number> = { P0: 0, P1: 0, P2: 0 }
  const byFamily: Record<string, number> = {}
  for (const cell of cells) { byRisk[cell.riskTier]++; byFamily[cell.claimFamily] = (byFamily[cell.claimFamily] ?? 0) + 1 }
  return { cells, byRisk, byFamily }
}
