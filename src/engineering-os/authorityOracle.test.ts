/*
 * authorityOracle.test.ts — proof of the owner/human authority + P2 oracles. (C11 §44 / §45 / B11)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * §44 attacks: relabelling machine work as OWNER with a non-class ("engineering difficulty") must BLOCK;
 * a human residual without negative proof must BLOCK. §45: no P2 may mask an intended capability.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
// @ts-expect-error — pure ESM sibling of the CLI; shared verbatim, no types.
import { deriveAuthorityState, deriveP2State, OWNER_CLASSES } from '../../scripts/authority-oracle-lib.mjs'

const auth = () => JSON.parse(readFileSync(resolve('docs/engineering-os/qa/OWNER_HUMAN_AUTHORITY.json'), 'utf8'))
const p2 = () => JSON.parse(readFileSync(resolve('docs/engineering-os/qa/P2_REGISTER.json'), 'utf8')).p2

describe('Owner/Human Authority Oracle (C11/§44)', () => {
  it('the real registers pass: every owner action has authority proof, every residual has negative proof', () => {
    const a = auth()
    const s = deriveAuthorityState(a.ownerActions, a.humanResiduals)
    expect(s.OWNER_ACTIONS_WITHOUT_AUTHORITY_PROOF).toBe(0)
    expect(s.HUMAN_RESIDUALS_WITHOUT_NEGATIVE_PROOF).toBe(0)
    expect(s.ok).toBe(true)
  })

  it('THE §44 ATTACK: machine work relabelled OWNER with class "engineering difficulty" → BLOCK', () => {
    const a = auth()
    a.ownerActions.push({ id: 'fake-owner', authorityClass: 'ENGINEERING_DIFFICULTY', whyMachineCannotClose: 'hard', machineApproachesAttempted: ['x'] })
    const s = deriveAuthorityState(a.ownerActions, a.humanResiduals)
    expect(s.ownerWithoutProof).toContain('fake-owner')
    expect(s.ok).toBe(false)
  })

  it('MUTATION: owner action missing machineApproachesAttempted → BLOCK', () => {
    const a = auth()
    a.ownerActions.push({ id: 'lazy-owner', authorityClass: 'PRODUCT_POLICY', whyMachineCannotClose: 'policy' })
    const s = deriveAuthorityState(a.ownerActions, a.humanResiduals)
    expect(s.ownerWithoutProof).toContain('lazy-owner')
  })

  it('THE §44 ATTACK: a machine-observable property claimed HUMAN residual without negative proof → BLOCK', () => {
    const a = auth()
    a.humanResiduals.push({ id: 'fake-human', property: 'button is reachable', negativeProofStatus: 'DOCUMENTED' })
    const s = deriveAuthorityState(a.ownerActions, a.humanResiduals)
    expect(s.humanWithoutNegProof).toContain('fake-human')
    expect(s.ok).toBe(false)
  })

  it('the 6 allowed owner classes are exactly the constitution set (engineering is not among them)', () => {
    expect(OWNER_CLASSES.has('ENGINEERING_DIFFICULTY')).toBe(false)
    expect(OWNER_CLASSES.size).toBe(6)
  })
})

describe('P2 enumeration (§45)', () => {
  it('the real P2 register is fully classified and masks no intended capability', () => {
    const s = deriveP2State(p2())
    expect(s.misclassified).toEqual([])
    expect(s.ok).toBe(true)
    expect(s.OPEN_P2).toBeGreaterThanOrEqual(0)
  })

  it('MUTATION: a P2 that masks an intended capability → misclassified (must be P0/P1)', () => {
    const bad = [...p2(), { id: 'sneaky', description: 'calendar readback silently fails', masksIntendedCapability: true, whyP2NotP0P1: 'shrug', disposition: 'ignore' }]
    const s = deriveP2State(bad)
    expect(s.misclassified).toContain('sneaky')
    expect(s.ok).toBe(false)
  })
})
