/*
 * machineWorkGraph.test.ts — proof of the Machine Work Completeness Oracle. (C10 / §43 / B11)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * The keystone attack (§43 mutation): removing a required obligation from the registry while everything
 * else is green must NOT make MACHINE_CLOSABLE_REMAINING look like 0 — it must surface as OMITTED.
 * Also verifies the REAL registry has zero omissions (the denominator is fully covered).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
// @ts-expect-error — pure ESM sibling of the CLI; shared verbatim, no types.
import { deriveWorkGraphState, REQUIRED_OBLIGATION_IDS, TERMINAL_STATES } from '../../scripts/machine-work-graph-lib.mjs'

const realRegistry = () =>
  JSON.parse(readFileSync(resolve('docs/engineering-os/qa/MACHINE_WORK_GRAPH.json'), 'utf8')).obligations

describe('Machine Work Completeness Oracle (C10/§43)', () => {
  it('the committed registry covers EVERY required obligation (OMITTED=0, no invalid states)', () => {
    const s = deriveWorkGraphState(realRegistry(), REQUIRED_OBLIGATION_IDS)
    expect(s.omitted).toEqual([])
    expect(s.invalidState).toEqual([])
    expect(s.terminalWithoutEvidence).toEqual([])
    expect(s.ok).toBe(true)
  })

  it('MACHINE_CLOSABLE_REMAINING is DERIVED (equals the machine-closable list length), not hardcoded', () => {
    const s = deriveWorkGraphState(realRegistry(), REQUIRED_OBLIGATION_IDS)
    // The value is whatever the registry derives — the invariant is that it EQUALS the derived list,
    // never an asserted constant. (It legitimately reached 0 once all machine-closable work landed.)
    expect(s.MACHINE_CLOSABLE_REMAINING).toBe(s.machineClosableList.length)
    expect(s.MACHINE_CLOSABLE_REMAINING).toBeGreaterThanOrEqual(0)
    expect(s.REQUIRED_MACHINE_OBLIGATIONS_TOTAL).toBe(REQUIRED_OBLIGATION_IDS.length)
  })

  it('remaining buckets are DISTINCT — external/owner/human are NOT counted as machine-closable', () => {
    const s = deriveWorkGraphState(realRegistry(), REQUIRED_OBLIGATION_IDS)
    // no id appears in more than one remaining bucket
    const all = [...s.machineClosableList, ...s.externalBlockedList, ...s.ownerAuthorityList, ...s.humanResidualList]
    expect(new Set(all).size).toBe(all.length)
    // BLOCKED_EXTERNAL items must be in the external bucket, never the machine-closable one
    for (const id of s.externalBlockedList) expect(s.machineClosableList).not.toContain(id)
    expect(s.MACHINE_CLOSABLE_REMAINING).toBe(s.machineClosableList.length)
    expect(s.EXTERNAL_BLOCKED_REMAINING).toBe(s.externalBlockedList.length)
  })

  it('a NONTERMINAL obligation flagged machineClosable:false is a classification error (limbo) → not ok', () => {
    const reg = realRegistry().map((o: Record<string, unknown>) =>
      o.id === 'p2-enumeration' ? { id: 'p2-enumeration', terminalState: 'NONTERMINAL', machineClosable: false } : o)
    const s = deriveWorkGraphState(reg, REQUIRED_OBLIGATION_IDS)
    expect(s.nonTerminalNotMachineClosable).toContain('p2-enumeration')
    expect(s.ok).toBe(false)
  })

  it('THE §43 ATTACK: dropping a required obligation from the registry → OMITTED>0, never a false 0', () => {
    const trimmed = realRegistry().filter((o: { id: string }) => o.id !== 'capsule-integrity')
    const s = deriveWorkGraphState(trimmed, REQUIRED_OBLIGATION_IDS)
    expect(s.omitted).toContain('capsule-integrity')
    expect(s.OMITTED_MACHINE_OBLIGATIONS).toBeGreaterThan(0)
    expect(s.ok).toBe(false)
  })

  it('MUTATION: a PROVEN_PASS obligation with no evidence → pass-by-omission defect', () => {
    const reg = realRegistry().map((o: Record<string, unknown>) =>
      o.id === 'exit-contract' ? { id: 'exit-contract', terminalState: 'PROVEN_PASS' } : o)
    const s = deriveWorkGraphState(reg, REQUIRED_OBLIGATION_IDS)
    expect(s.terminalWithoutEvidence).toContain('exit-contract')
    expect(s.ok).toBe(false)
  })

  it('MUTATION: an invalid terminalState is rejected (not silently treated as terminal)', () => {
    const reg = realRegistry().map((o: Record<string, unknown>) =>
      o.id === 'p2-enumeration' ? { ...o, terminalState: 'DEFINITELY_DONE_TRUST_ME' } : o)
    const s = deriveWorkGraphState(reg, REQUIRED_OBLIGATION_IDS)
    expect(s.invalidState).toContain('p2-enumeration')
    expect(s.ok).toBe(false)
  })

  it('MUTATION: duplicate registry entry for one id is a defect', () => {
    const reg = [...realRegistry(), { id: 'p2-enumeration', terminalState: 'PROVEN_PASS', evidence: 'fake' }]
    const s = deriveWorkGraphState(reg, REQUIRED_OBLIGATION_IDS)
    expect(s.duplicates).toContain('p2-enumeration')
    expect(s.ok).toBe(false)
  })

  it('BLOCKED_EXTERNAL / OWNER / HUMAN residual are terminal-for-machine (do not inflate REMAINING)', () => {
    for (const st of ['BLOCKED_EXTERNAL_WITH_EVIDENCE', 'OWNER_AUTHORITY_REQUIRED_WITH_PROOF', 'HUMAN_RESIDUAL_WITH_NEGATIVE_PROOF', 'N/A_WITH_PROOF']) {
      expect(TERMINAL_STATES.has(st)).toBe(true)
    }
  })
})
