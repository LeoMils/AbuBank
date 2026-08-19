/*
 * DENOMINATOR QA-of-QA (Stage 3C §7,§9). DN1–DN8 spec-derived.
 * sensitivity: an applicable required claim IS demanded. specificity: an inapplicable claim is
 * NOT demanded. monotonicity: adding a capability never shrinks the denominator. non-vacuity:
 * the denominator is real and multi-tier. Risk is assigned HERE, from capability shape.
 */
import { describe, it, expect } from 'vitest'
import { buildDenominator, crossSurfaceCells, type CapabilitySpec } from './denominator'

const ui = (id: string): CapabilitySpec => ({ id, type: 'UI_SURFACE' })
const readTool = (id: string): CapabilitySpec => ({ id, type: 'ACTION_CAPABILITY', grounds: true })
const writeTool = (id: string): CapabilitySpec => ({ id, type: 'ACTION_CAPABILITY', hasSideEffect: true })
const integration = (id: string): CapabilitySpec => ({ id, type: 'INTEGRATION_CAPABILITY', hasSideEffect: true })
const familyTool = (id: string): CapabilitySpec => ({ id, type: 'ACTION_CAPABILITY', familyTruth: true, grounds: true })

const cellsFor = (spec: CapabilitySpec) => buildDenominator([spec]).cells.filter((c) => c.capability === spec.id)
const families = (spec: CapabilitySpec) => new Set(cellsFor(spec).map((c) => c.claimFamily))

describe('denominator — non-vacuity + risk assigned here', () => {
  it('DN1 · a real mixed capability set yields cells across multiple risk tiers (not vacuous, not all-one-tier)', () => {
    const r = buildDenominator([ui('Home'), ui('AbuAI'), readTool('read_calendar'), writeTool('confirm_calendar_event'), integration('phone_call')])
    expect(r.cells.length).toBeGreaterThan(10)
    expect(r.byRisk.P0).toBeGreaterThan(0)
    expect(r.byRisk.P1 + r.byRisk.P2).toBeGreaterThan(0)
  })
})

describe('denominator — specificity (no Cartesian over-demand)', () => {
  it('DN2 · a UI surface does NOT get SIDE_EFFECT_SAFETY or GROUNDING or PLAYBACK', () => {
    const f = families(ui('Settings'))
    expect(f.has('SIDE_EFFECT_SAFETY')).toBe(false)
    expect(f.has('GROUNDING')).toBe(false)
    expect(f.has('PLAYBACK')).toBe(false)
    expect(f.has('REACHABILITY')).toBe(true)
  })
  it('DN3 · a pure READ tool does NOT get SIDE_EFFECT_SAFETY', () => {
    expect(families(readTool('read_calendar')).has('SIDE_EFFECT_SAFETY')).toBe(false)
  })
})

describe('denominator — sensitivity (applicable claims ARE demanded, risk assigned here)', () => {
  it('DN4 · a side-effect tool gets a SIDE_EFFECT_SAFETY cell at P0', () => {
    const cells = cellsFor(writeTool('confirm_calendar_event'))
    const safety = cells.filter((c) => c.claimFamily === 'SIDE_EFFECT_SAFETY')
    expect(safety.length).toBeGreaterThan(0)
    expect(safety.every((c) => c.riskTier === 'P0')).toBe(true)
  })
  it('DN5 · a grounding tool gets a GROUNDING cell at P0 with PREVIEW min-evidence', () => {
    const g = cellsFor(readTool('get_current_info')).filter((c) => c.claimFamily === 'GROUNDING')
    expect(g.length).toBe(1)
    expect(g[0]!.riskTier).toBe('P0')
    expect(g[0]!.minEvidenceClass).toBe('PREVIEW')
  })
  it('DN6 · a family-truth tool gets CORRECTNESS at P0 (Ofir/kinship class)', () => {
    const c = cellsFor(familyTool('people_lookup')).filter((x) => x.claimFamily === 'CORRECTNESS')
    expect(c.length).toBeGreaterThan(0)
    expect(c.every((x) => x.riskTier === 'P0')).toBe(true)
  })
  it('DN7 · an integration side-effect (phone) demands PHYSICAL_DEVICE for safety', () => {
    const s = cellsFor(integration('phone_call')).find((c) => c.claimFamily === 'SIDE_EFFECT_SAFETY')
    expect(s?.minEvidenceClass).toBe('PHYSICAL_DEVICE')
  })
})

describe('denominator — monotonicity + cross-surface', () => {
  it('DN8 · adding a capability never shrinks the denominator', () => {
    const base = buildDenominator([ui('Home')]).cells.length
    const more = buildDenominator([ui('Home'), writeTool('set_reminder')]).cells.length
    expect(more).toBeGreaterThanOrEqual(base)
  })
  it('the 5 cross-surface/stateful invariant cells are always present at P0', () => {
    const x = crossSurfaceCells()
    expect(x.length).toBe(5)
    expect(x.every((c) => c.riskTier === 'P0' && c.claimFamily === 'CROSS_SURFACE')).toBe(true)
    const ids = x.map((c) => c.capability)
    expect(ids).toContain('calendar-action↔persisted↔spoken')
    expect(ids).toContain('current-info↔cache↔follow-up')
    expect(ids).toContain('deployment↔SW↔runtime')
  })
})
