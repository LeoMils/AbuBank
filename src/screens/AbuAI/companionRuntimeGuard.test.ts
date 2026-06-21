/*
 * Bypass-regression guard for the runtime answer paths.
 *
 * Proves (statically) that:
 *  (a) no hardcoded assistant string literal in index.tsx contains a banned
 *      customer-support/database/AI-self phrase — the deterministic emissions
 *      are clean by construction; and
 *  (b) the dynamic answer emissions are routed through enforceCompanion (the
 *      Companion Composer), so no raw LLM/tool answer reaches Martita.
 *
 * Source-grep level (MEDIUM evidence), but it catches a future edit that adds a
 * new answer path bypassing the composer or introduces a banned phrase.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { BANNED_PHRASES } from './companionComposer'

const SRC = readFileSync(resolve(__dirname, 'index.tsx'), 'utf-8')

describe('runtime answer-path guard', () => {
  it('no hardcoded assistant string literal contains a banned phrase', () => {
    // Extract content: '...' / "..." / `...` literals.
    const literals = [...SRC.matchAll(/content:\s*(['"`])((?:\\.|(?!\1).)*)\1/g)].map(m => m[2] ?? '')
    expect(literals.length).toBeGreaterThan(10) // sanity: we found the emissions
    for (const lit of literals) {
      const low = lit.toLowerCase()
      for (const banned of BANNED_PHRASES) {
        expect(low.includes(banned.toLowerCase()), `banned phrase "${banned}" in literal "${lit}"`).toBe(false)
      }
    }
  })

  it('the Companion Composer (enforceCompanion) is imported and used on many paths', () => {
    expect(SRC.includes("import { enforceCompanion }")).toBe(true)
    const uses = (SRC.match(/enforceCompanion\(/g) ?? []).length
    expect(uses).toBeGreaterThanOrEqual(8) // grounded, streaming(x2), pushAssistant, recall, proactive, content-world, online, recurring, gender, advisory
  })

  it('pushAssistant closures route through the composer', () => {
    // All 3 pushAssistant closures wrap their content in the composer.
    const closures = (SRC.match(/const pushAssistant = \(content: string\) => \{/g) ?? []).length
    const wrapped = (SRC.match(/content: enforceCompanion\(content, companionPlan\)/g) ?? []).length
    expect(closures).toBeGreaterThanOrEqual(3)
    expect(wrapped).toBeGreaterThanOrEqual(closures) // every closure is wrapped
  })

  it('the CompanionPlanner runs before responses (mandatory)', () => {
    expect(SRC.includes('planCompanionTurn(')).toBe(true)
    expect(SRC.includes('companionPlan')).toBe(true)
  })
})
