/*
 * intentInstructions.test.ts — M5 decomposition is loss-less, byte-safe, and measured.
 * Proves: (1) the shipped full assembly is UNCHANGED; (2) every section is classified —
 * no rule is silently dropped; (3) core + all intent blocks together preserve every
 * section; (4) the measured per-turn projection matches the numbers we report.
 */
import { describe, it, expect } from 'vitest'
import { buildLiveInstructions } from './liveInstructions'
import { parseSections, classifySections, buildCoreInstructions, intentGuidance, measureBundlePlan } from './intentInstructions'

const full = buildLiveInstructions()

describe('the shipped assembly is untouched (decomposition is derivation only)', () => {
  it('buildLiveInstructions still assembles the full always-on bundle', () => {
    expect(full.length).toBe(13764) // deliberate change v0.278: calendar-decisiveness + online-follow-up nudges (still under the 14000 ratchet) — it is the flag-OFF payload
  })
})

describe('decomposition is loss-less', () => {
  it('every section classifies (an unknown header throws, never silently drops a rule)', () => {
    expect(() => classifySections()).not.toThrow()
  })
  it('core + all intent blocks together contain every section header', () => {
    const all = parseSections().map((s) => s.header).sort()
    const d = classifySections()
    const kept = [...d.core, ...d.intents.family, ...d.intents.profile, ...d.intents.tools].map((s) => s.header).sort()
    expect(kept).toEqual(all)
  })
  it('no section is orphaned or duplicated across core/intents', () => {
    const d = classifySections()
    const counts = new Map<string, number>()
    for (const s of [...d.core, ...d.intents.family, ...d.intents.profile, ...d.intents.tools])
      counts.set(s.header, (counts.get(s.header) ?? 0) + 1)
    for (const [, n] of counts) expect(n).toBe(1)
  })
})

describe('SAFETY is always-on (never intent-injected)', () => {
  it('the distress/safety section is in the core, not behind an intent', () => {
    const d = classifySections()
    expect(d.core.some((s) => s.header.includes('במצוקה'))).toBe(true)
    for (const intent of ['family', 'profile', 'tools'] as const)
      expect(d.intents[intent].some((s) => s.header.includes('במצוקה'))).toBe(false)
  })
})

describe('measured per-turn plan (the honest M5 numbers)', () => {
  const plan = measureBundlePlan()
  it('core is materially smaller than the full always-on bundle', () => {
    expect(plan.core).toBeLessThan(plan.full)
    expect(plan.core).toBeLessThan(6200) // measured ~5.9k
  })
  it('a chit-chat turn carries only the core; a tools turn carries the most', () => {
    expect(plan.perTurn.chitchat).toBe(plan.core)
    expect(plan.perTurn.tools).toBeGreaterThan(plan.perTurn.family)
    expect(plan.perTurn.tools).toBeGreaterThan(plan.perTurn.profile)
  })
  it('HONEST LIMIT: core is NOT yet under 5,000 — safety+persona dominate (device-condense pending)', () => {
    // This is deliberately asserted FALSE-today so the claim in the ledger stays truthful.
    // When the persona is condensed (device-measured off/on) and core drops under 5,000,
    // this flips and the assertion is updated with the evidence — it will not rot silently.
    expect(plan.coreUnderTarget).toBe(false)
  })
  it('core + one intent block reconstructs a valid non-empty injection for every intent', () => {
    for (const intent of ['family', 'profile', 'tools'] as const) {
      expect(intentGuidance(intent).length).toBeGreaterThan(0)
      // perTurn is defined as core + block (plain sum), so this must match exactly.
      expect(buildCoreInstructions().length + intentGuidance(intent).length).toBe(plan.perTurn[intent])
    }
  })
})
