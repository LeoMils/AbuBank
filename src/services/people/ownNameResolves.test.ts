/*
 * ownNameResolves.test.ts — device defect: people_lookup("מרטה") → not_found, and Abu told MARTITA she
 * is not in the database (then the same string resolved next turn). Root cause: ט↔ת homophones — the
 * tet spellings missed while the tav spellings resolved, and different resolver paths disagreed.
 * She must NEVER be told she does not exist; every spelling of her name resolves the same.
 */
import { describe, it, expect } from 'vitest'
import { whoIs } from './peopleLookup'
import { resolvePersonId, foldHomophones, loadPeople } from './peopleModel'

describe('Martita resolves from every spelling (ט↔ת), on every path', () => {
  for (const n of ['מרטה', 'מרטיטה', 'מרתה', 'מרתיטה', 'למרטה', 'למרטיטה']) {
    it(`"${n}" → martita (resolvePersonId + whoIs agree)`, () => {
      expect(resolvePersonId(n)).toBe('martita')
      expect(whoIs(n).status).toBe('ok')
    })
  }
})

describe('the ט↔ת fold is collision-free across the roster', () => {
  it('no two people share a homophone-folded name key', () => {
    const seen = new Map<string, string>()
    for (const p of loadPeople()) {
      for (const key of [p.hebrewName, ...p.hebrewAliases]) {
        if (!key) continue
        const f = foldHomophones(key)
        const prev = seen.get(f)
        if (prev && prev !== p.id) throw new Error(`collision: ${f} → ${prev} vs ${p.id}`)
        seen.set(f, p.id)
      }
    }
    expect(seen.size).toBeGreaterThan(50)
  })
})
