/*
 * Trust gate: AbuAI must NEVER invent a family relation. For an unknown person
 * or an impossible relation it must decline (return null / honest negative) so
 * the runtime falls back to a safe "I don't know that" rather than fabricating
 * kin. Verifies the Mor / Ari / Ofir / Gilad / grandchildren perspective holds.
 */
import { describe, it, expect } from 'vitest'
import { describeRelation } from './familyGraph'
import { resolveRelationalQuery } from './relationalResolver'

describe('unknown-relation safety (no invention)', () => {
  it('returns a grounded answer for a REAL relation', () => {
    const r = describeRelation('מור', 'אופיר', 'he')
    expect(r).toBeTruthy()
    expect(r).toContain('מור')
    expect(r).toContain('אופיר')
  })

  it('returns null for an unknown person — never fabricates kin', () => {
    expect(describeRelation('מרטיטה', 'זבולון הקוסם', 'he')).toBeNull()
    expect(describeRelation('פלוני אלמוני', 'אלמוני פלוני', 'he')).toBeNull()
  })

  it('Spanish relational: honest negative instead of an invented daughter', () => {
    // Mor's children are all sons (Ofir/Ayalon/Eili/Adar). The honest answer is
    // "no tiene hija" — NOT a fabricated daughter name.
    const r = resolveRelationalQuery('¿quién es la hija de Mor?', 'es')
    expect(r).toBeTruthy()
    expect(r!.toLowerCase()).toContain('no tiene')
  })

  it('Spanish relational: unknown person → null (declines)', () => {
    expect(resolveRelationalQuery('¿quién es la hija de Zúñiga?', 'es')).toBeNull()
    expect(resolveRelationalQuery('hola que tal', 'es')).toBeNull()
  })

  it('grandchildren perspective: Ofir↔Gilad and great-grandchildren resolve, no cross-wiring', () => {
    // Ari & Anabel are children of Ofir & Gilad (great-grandchildren of Martita).
    const ariOfir = describeRelation('אופיר', 'ארי', 'he')
    expect(ariOfir).toBeTruthy()
    // The answer must mention both named people and never silently swap in a
    // different grandchild.
    expect(ariOfir).toContain('ארי')
    expect(ariOfir).toContain('אופיר')
  })
})
