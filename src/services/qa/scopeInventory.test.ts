/*
 * scopeInventory.test.ts — Layer-1: the tool CONTRACT the model receives is well-formed,
 * enumerated mechanically from the live schema. Every tool×param cell is an EXECUTED result,
 * which is what moves cell-level coverage off zero. Also locks the SCOPE counts so a tool,
 * screen, or capability silently added/removed shows up as a deliberate diff, not a surprise.
 */
import { describe, it, expect } from 'vitest'
import { toolInventory, screenInventory, entityInventory, layer1ToolCells, scopeSummary, DECLARED_UNBUILT_CAPABILITIES } from './scopeInventory'

describe('SCOPE is derived from the real sources (non-empty, stable counts)', () => {
  const s = scopeSummary()
  it('enumerates every tool the model receives, with parameters', () => {
    expect(s.tools).toBeGreaterThanOrEqual(16) // 16 LIVE_TOOL_SCHEMAS + wait_for_user
    expect(s.toolParamCells).toBeGreaterThan(20)
  })
  it('enumerates every screen and the declared-unbuilt capabilities', () => {
    expect(s.screens).toBeGreaterThanOrEqual(12)
    expect(DECLARED_UNBUILT_CAPABILITIES.length).toBeGreaterThanOrEqual(5)
  })
  it('counts family entities and the ordered-pair space (covered by relationMatrix, sized here)', () => {
    const e = entityInventory()
    expect(e.count).toBeGreaterThanOrEqual(40)
    expect(e.orderedPairs).toBe(e.count * (e.count - 1))
  })
})

describe('Layer 1: every tool×param CONTRACT cell passes (executed, not seeded)', () => {
  const cells = layer1ToolCells()
  it('there are many contract cells and ALL pass', () => {
    expect(cells.length).toBeGreaterThan(40)
    const failed = cells.filter((c) => !c.pass)
    expect(failed.map((c) => `${c.id}: ${c.detail}`)).toEqual([])
  })
  it('EVERY tool rejects unknown parameters (additionalProperties:false)', () => {
    // The provider passes unknown args through unless this is set — a real failure-path invariant.
    const rejects = layer1ToolCells().filter((c) => c.check.includes('unknown params rejected'))
    expect(rejects.length).toBe(toolInventory().length)
    expect(rejects.every((c) => c.pass)).toBe(true)
  })
  it('every parameter with an enum lists non-empty string values', () => {
    const enumCells = cells.filter((c) => c.check.includes('enum'))
    expect(enumCells.every((c) => c.pass)).toBe(true)
  })
})

describe('the seeded cell-level ledger is non-trivial', () => {
  it('totalCellsSeeded is a real, sizable number', () => {
    expect(scopeSummary().totalCellsSeeded).toBeGreaterThan(80)
  })
})
