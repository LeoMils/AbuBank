/*
 * familyReconciliation.test.ts — Part C.4: reconcile the family sources.
 * ════════════════════════════════════════════════════════════════════════════
 * Two sources describe the family:
 *   • knowledge/family_data.json  — the machine source (liveContacts reads it)
 *   • knowledge/abu-family.md      — the prose Abu reads (embedded in instructions)
 * They must not CONTRADICT each other, and Abu must never GUESS a relationship.
 *
 * This is the reconciliation GUARD: it enforces the hard spelling invariants in
 * BOTH sources, proves every family_data.json person resolves (reachable, no
 * parallel store), and reports the DRIFT between the two sources so the family
 * milestone (canonical rebuild + family_lookup) can resolve it. It does NOT pick a
 * winner or rewrite data — reconciliation-report only.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveContact } from './liveContacts'
import { buildLiveInstructions } from './liveInstructions'
import familyData from '../../knowledge/family_data.json'

const HERE = dirname(fileURLToPath(import.meta.url))
const KNOWLEDGE = resolve(HERE, '..', '..', 'knowledge')
const abuFamilyMd = readFileSync(resolve(KNOWLEDGE, 'abu-family.md'), 'utf8')

/** Hebrew names in family_data.json across every person-bearing group. */
function jsonPeople(): string[] {
  const fam = (familyData as { family: Record<string, unknown> }).family
  const out: string[] = []
  for (const [group, v] of Object.entries(fam)) {
    if (group === 'pets') continue
    const list = Array.isArray(v) ? v : (v && typeof v === 'object' ? [v] : [])
    for (const p of list as Array<{ hebrew_name?: string }>) if (p?.hebrew_name) out.push(p.hebrew_name)
  }
  return out
}

describe('Part C.4 — family source reconciliation', () => {
  it('CANONICAL spellings are correct (aliases may tolerate typos; prose declares the rule)', () => {
    // family_data.json: the canonical hebrew_names are the correct spelling. The
    // common mis-spellings (הדר / אילון) may appear ONLY as aliases (so a typo/voice
    // slip still resolves) — never as a canonical name.
    const canonical = jsonPeople() // hebrew_name values only, never aliases
    expect(canonical).toContain('אדר')
    expect(canonical).not.toContain('הדר')
    expect(canonical).toContain('איילון')
    expect(canonical).not.toContain('אילון')

    // abu-family.md: uses the Duani surname and DECLARES the mandatory spellings
    // (the forbidden forms appear there only inside the "never write X" rule).
    expect(abuFamilyMd).toContain('דואני')
    expect(abuFamilyMd).toMatch(/לא "הדר"/)
    expect(abuFamilyMd).toMatch(/לא "אילון"/)
  })

  it('every family_data.json person RESOLVES (one reachable identity, no parallel store)', () => {
    const unresolved: string[] = []
    for (const name of jsonPeople()) {
      if (resolveContact(name).status !== 'resolved') unresolved.push(name)
    }
    expect(unresolved, `these people do not resolve: ${unresolved.join(', ')}`).toEqual([])
  })

  it('Abu is instructed to never GUESS a relationship (says she does not know)', () => {
    const instr = buildLiveInstructions()
    // Companion Brain wording (Phase 3): she KNOWS the family, but must never invent and must
    // say warmly when she is unsure — the same "no guessing" invariant, restated.
    expect(instr).toMatch(/Never invent a name, gender, date, or relationship/i)
    expect(instr).toMatch(/say warmly that you are not sure|do not guess/i)
  })

  it('RECONCILIATION REPORT — drift between the two sources (findings for the rebuild)', () => {
    // People named in abu-family.md via "## <name>" headers.
    const mdPeople = [...abuFamilyMd.matchAll(/^##\s+(.+)$/gm)].map((m) => m[1]!.trim())
    const json = jsonPeople()
    // A person is "covered" in the prose if any prose header includes their first name.
    const missingInMd = json.filter((n) => !mdPeople.some((h) => h.includes(n)))
    const report = {
      jsonCount: json.length,
      mdHeaderCount: mdPeople.length,
      jsonPeopleMissingFromProse: missingInMd,
    }
    console.log('FAMILY_RECONCILIATION_REPORT:', JSON.stringify(report, null, 2))
    // Guard: the CORE family (not friends) must appear in BOTH. Friends may be
    // JSON-only. So we only hard-assert the matriarch + children + grandchildren.
    for (const core of ['מרטיטה', 'מור', 'לאו', 'אופיר', 'עילי', 'אדר', 'איילון', 'עדי', 'נועם']) {
      expect(json, `${core} missing from family_data.json`).toContain(core)
      expect(mdPeople.some((h) => h.includes(core)), `${core} missing from abu-family.md`).toBe(true)
    }
  })
})

describe('Adi and Noam are MALE (data correction — the prose had their gender unknown)', () => {
  it('family_data.json records them as grandson / בן (male)', () => {
    const leo = (familyData as { family: { grandchildren_leo: Array<{ canonical_name: string; relationship: string; relationship_hebrew?: string }> } }).family.grandchildren_leo
    for (const name of ['Adi', 'Noam']) {
      const p = leo.find((x) => x.canonical_name === name)!
      expect(p.relationship).toBe('grandson')
      expect(p.relationship_hebrew).toMatch(/בן של לאו/)   // male: בן, not בת/ילד-ה
    }
  })

  it('abu-family.md declares both as בן (male), not gender-ambiguous or unknown', () => {
    expect(abuFamilyMd).not.toContain('ילד/ה של לאו')          // the ambiguous slash form is gone
    expect(abuFamilyMd).not.toMatch(/המגדר של עדי ונועם/)      // removed from the "unknown" section
    expect(abuFamilyMd).toMatch(/##\s*עדי[^#]*בן של לאו/)
    expect(abuFamilyMd).toMatch(/##\s*נועם[^#]*בן של לאו/)
  })

  it('the assembled live instructions never mark their gender unknown', () => {
    expect(buildLiveInstructions()).not.toContain('המגדר של עדי ונועם')
  })
})

describe('Spanish-spelling aliases resolve to the right person (eilon → Ayalon, ilay → Eili)', () => {
  it('eilon resolves to איילון', () => {
    const r = resolveContact('eilon')
    expect(r.status).toBe('resolved')
    expect(r.status === 'resolved' && r.label).toBe('איילון')
  })
  it('ilay resolves to עילי', () => {
    const r = resolveContact('ilay')
    expect(r.status).toBe('resolved')
    expect(r.status === 'resolved' && r.label).toBe('עילי')
  })
})
