/*
 * Regression: Ofir is female — Martita's GRANDDAUGHTER, married to Gilad.
 * ════════════════════════════════════════════════════════════════════
 * DATA FIX guard. Ofir (אופיר) was previously mis-encoded as male / grandson,
 * which cascaded into "same-sex parents" wording and made "אמא של אנאבל"
 * unresolvable. These tests lock the corrected fact across every layer:
 *   1. Ofir is treated as female (structured graph + gender reasoning).
 *   2. Ofir is Martita's granddaughter (kinship path).
 *   3. Parent wording says "אמא של אנאבל/ארי", never "אבא", for Ofir.
 *   4. No old male wording remains for Ofir in the source authorities.
 *
 * If any of these fail, the gender correction has regressed at its source.
 */
import { describe, it, expect } from 'vitest'
import { loadGraph, describeRelation } from './familyGraph'
import { explainRelation } from './familyPathReasoner'
import { resolvePersonPhrase } from '../AbuCalendar/familyResolve'
import familyData from '../../../knowledge/family_data.json'
import familyGraph from '../../../knowledge/family_graph.json'

const ofirNode = () => loadGraph().find((n) => n.hebrew === 'אופיר')

describe('Ofir gender DATA FIX — regression guard', () => {
  // ── 1. Ofir is treated as female ──────────────────────────────────────
  describe('1. Ofir is female', () => {
    it('graph node gender is female', () => {
      const ofir = ofirNode()
      expect(ofir).toBeDefined()
      expect(ofir!.gender).toBe('female')
    })

    it('structured source (family_graph.json) marks Ofir female', () => {
      const p = familyGraph.people.find((x) => x.id === 'אופיר')
      expect(p?.gender).toBe('female')
    })
  })

  // ── 2. Ofir is Martita's granddaughter ────────────────────────────────
  describe('2. Ofir is Martita\'s granddaughter', () => {
    it('family_data.json relationship is granddaughter', () => {
      const ofir = familyData.family.grandchildren_mor.find((g) => g.canonical_name === 'Ofir')
      expect(ofir?.relationship).toBe('granddaughter')
    })

    it('kinship path: Martita is the grandmother (סבתא) of Ofir', () => {
      const rel = describeRelation('מרטיטה', 'אופיר', 'he')
      expect(rel).toBeTruthy()
      expect(rel).toContain('סבתא')      // grandmother → Ofir is the granddaughter
      expect(rel).not.toContain('סבא ')  // not grandfather-side wording
    })
  })

  // ── 3. Parent wording: "אמא של אנאבל/ארי", never "אבא", for Ofir ───────
  describe('3. Ofir is the אמא (mother) of Anabel & Ari, never אבא', () => {
    for (const child of ['אנאבל', 'ארי']) {
      it(`explainRelation(${child} → אופיר) says "אמא", not "אבא"`, () => {
        const s = explainRelation(child, 'אופיר')
        expect(s).toContain('אמא')
        expect(s).not.toContain('אבא')
      })
    }

    it('"אמא של אנאבל" resolves to אופיר', () => {
      const r = resolvePersonPhrase('אמא של אנאבל')
      expect(r.status).toBe('resolved')
      if (r.status === 'resolved') expect(r.name).toBe('אופיר')
    })

    it('"אבא של אנאבל" resolves to גלעד — the father is Gilad, not Ofir', () => {
      const r = resolvePersonPhrase('אבא של אנאבל')
      expect(r.status).toBe('resolved')
      if (r.status === 'resolved') expect(r.name).toBe('גלעד')
    })

    it('describeRelation(אופיר → אנאבל) labels Ofir as האמא', () => {
      const rel = describeRelation('אופיר', 'אנאבל', 'he')
      expect(rel).toContain('אמא')
      expect(rel).not.toContain('אבא')
    })
  })

  // ── 4. No old male wording remains for Ofir in the source authorities ──
  describe('4. No old male (grandson) wording remains for Ofir', () => {
    it('family_data.json: relationship is not "grandson"', () => {
      const ofir = familyData.family.grandchildren_mor.find((g) => g.canonical_name === 'Ofir')
      expect(ofir?.relationship).not.toBe('grandson')
      expect(ofir?.relationship_hebrew).toMatch(/^נכדה/)   // granddaughter, not נכד (male)
    })

    it('family_graph.json: Ofir is not male', () => {
      const p = familyGraph.people.find((x) => x.id === 'אופיר')
      expect(p?.gender).not.toBe('male')
    })

    it('gender reasoning never renders Ofir with male parent/marriage wording', () => {
      const toAnabel = describeRelation('אופיר', 'אנאבל', 'he') ?? ''
      // Ofir must never be "האבא" (father) or "נשוי" (male-married) in output.
      expect(toAnabel).not.toContain('האבא')
      expect(toAnabel).not.toMatch(/\bנשוי\b/)
    })
  })
})
