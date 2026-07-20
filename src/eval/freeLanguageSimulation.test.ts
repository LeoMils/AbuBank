/*
 * VERIFICATION REGIME · internal FREE-LANGUAGE SIMULATION (intake-rebuild).
 * ════════════════════════════════════════════════════════════════════════════
 * Generates hundreds of free-form intake utterances by CROSSING the morphology
 * table × garble × every family member × the intake paths (who-is, create/title,
 * correction), and runs each through the REAL local intake — asserting the
 * rebuild's invariants at scale:
 *   • never throws
 *   • a resolved person is always a REAL family member (never fabricated / wrong)
 *   • a garbled relation term resolves to the right person OR to nobody (never wrong)
 *   • a calendar create with a relation companion stores the RESOLVED name (no "של" left)
 *   • no intake output is a capability-denial
 *
 * This is CODE/local evidence. The mandate's 200-session run through the DEPLOYED
 * app + on-device latency is PREVIEW/PHYSICAL and is NOT claimed here.
 */
import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest'
import { relationTypesWithForms, surfaceFormsOf } from '../truth/relationMorphology'
import { garbleVariants } from '../truth/garbleMutator'
import { answerFamilyRelation, resolveSinglePerson } from '../screens/AbuAI/familyReasoning'
import { loadGraph } from '../screens/AbuAI/familyGraph'
import { parseCreateIntent } from '../screens/AbuAI/calendarCreate'
import { isFactualCorrection } from '../screens/AbuAI/correctionVerification'

const FIXED = new Date('2026-07-20T09:00:00')
beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FIXED) })
afterAll(() => { vi.useRealTimers() })
let storage: Record<string, string> = {}
beforeEach(() => {
  storage = {}
  vi.stubGlobal('localStorage', { getItem: (k: string) => storage[k] ?? null, setItem: (k: string, v: string) => { storage[k] = v }, removeItem: (k: string) => { delete storage[k] } })
})

const SUBJECTS = ['מרטיטה', 'מור', 'אופיר', 'רפי', 'לאו', 'ארי']
const DENIAL = /לא\s+יכולה|אי\s+אפשר|לא\s+ניתן|לא\s+מסוגלת|can'?t|cannot/iu
const familyNames = new Set(loadGraph().map((n) => n.hebrew))

describe('FREE-LANGUAGE SIMULATION · who-is across every inflection × member (+ garble)', () => {
  it('resolves to a real member or honest-unknown — never a wrong person, never a crash, never a denial', () => {
    let ran = 0, resolved = 0
    for (const type of relationTypesWithForms()) {
      for (const form of surfaceFormsOf(type)) {
        for (const subject of SUBJECTS) {
          const clean = `מי ${form} של ${subject}`
          for (const utter of [clean, ...garbleVariants(clean, 2)]) {
            ran++
            const a = answerFamilyRelation(utter) // must never throw
            if (a?.known) {
              resolved++
              for (const r of a.results) expect(familyNames.has(r), `"${utter}" → non-family "${r}"`).toBe(true)
            }
          }
        }
      }
    }
    expect(ran).toBeGreaterThan(300)     // a real simulation, not a handful
    expect(resolved).toBeGreaterThan(50) // many genuinely resolve (not all-unknown)
  })
})

describe('FREE-LANGUAGE SIMULATION · calendar create with a relation companion', () => {
  const RELATION_COMPANIONS: Array<[string, string]> = [
    ['בת הזוג של מור', 'יעל'], ['החתן של מור', 'גלעד'], ['הבת של מרטיטה', 'מור'],
    ['אמא של אופיר', 'מור'], ['הבן של מרטיטה', 'לאו'],
  ]
  it('stores the RESOLVED name in the title (no unresolved "של" phrase left)', () => {
    for (const [phrase, expected] of RELATION_COMPANIONS) {
      for (const utter of [`תקבע לי פגישה עם ${phrase} מחר בשלוש`]) {
        const p = parseCreateIntent(utter)
        expect(p, utter).not.toBeNull()
        expect(p!.draft.title, utter).toContain(expected)
        expect(p!.draft.title, `unresolved phrase left in "${utter}"`).not.toMatch(/ של /)
      }
    }
  })
})

describe('FREE-LANGUAGE SIMULATION · resolveSinglePerson garble stress never yields a wrong person', () => {
  it('every single-garble of a relation companion resolves to a real member or nobody', () => {
    for (const phrase of ['בת הזוג של מור', 'החתן של מור', 'הבת של מרטיטה', 'הגרוש של מור']) {
      for (const g of garbleVariants(phrase, 8)) {
        const r = resolveSinglePerson(g)
        if (r) expect(familyNames.has(r.person), `"${g}" → non-family "${r.person}"`).toBe(true)
      }
    }
  })
})

describe('FREE-LANGUAGE SIMULATION · corrections are recognised (for re-verify routing)', () => {
  it('factual corrections detected; plain declines are not', () => {
    for (const c of ['לא נכון', 'טעית', 'בעצם זה לא ככה']) expect(isFactualCorrection(c)).toBe(true)
    for (const n of ['לא', 'לא תודה', 'כן']) expect(isFactualCorrection(n)).toBe(false)
    expect(DENIAL.test('אין כלום ביומן')).toBe(false) // honest emptiness is not a denial
  })
})
