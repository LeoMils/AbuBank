/*
 * kinship-audit.mjs — DIAGNOSE the family graph before changing it (owner P0). Runs EVERY ordered
 * pair through the resolver and reports the three failure kinds, so a wrong EDGE and a wrong
 * DERIVATION are told apart:
 *   1. LONG CHAIN  — the rendered relation is a path of ≥3 hops ("… של … של … של …") — a traversal
 *                    artifact, not a term.
 *   2. TERM-ABSENT — no Hebrew term derived (the resolver fell to a path). Candidates for a new term.
 *   3. CONTRADICTION — composition inconsistency: X→M and M→Y are both single terms whose composition
 *                    has a KNOWN answer (e.g. nephew∘son ⇒ great-nephew), but X→Y disagrees with it.
 * Prints a report; writes docs/eval/KINSHIP_AUDIT.json. Read-only — changes nothing.
 */
import { loadPeople } from '../../src/services/people/peopleModel.ts'
import { relationBetween, relationshipOf } from '../../src/services/people/kinship.ts'

const ALL = loadPeople()                                  // resolver needs the FULL roster (deceased incl.)
const P = ALL.filter((p) => !p.deceased)                  // iterate living pairs
const name = (id) => ALL.find((p) => p.id === id)?.hebrewName ?? id
const hops = (text) => (text.match(/ של /g) ?? []).length

const longChains = [], termAbsent = []
for (const x of P) for (const y of P) {
  if (x.id === y.id) continue
  const r = relationBetween(x.id, y.id, ALL)
  if (!r) continue
  if (r.termAbsent) termAbsent.push(`${name(x.id)} ↔ ${name(y.id)} : ${r.text}`)
  if (hops(r.text) >= 3) longChains.push(`${name(x.id)} ↔ ${name(y.id)} (${hops(r.text)} hops) : ${r.text}`)
}

// Composition contradiction: for X→M (term t1) and M→Y (term t2), is X→Y a DIRECT term? If a direct
// term exists AND a 2-step term-path exists but they name a DIFFERENT kind, flag it. (Coarse but real.)
const contradictions = []
const directKind = (a, b) => relationshipOf(a, b, ALL)?.kind ?? null
for (const x of P) for (const y of P) {
  if (x.id === y.id) continue
  const xy = directKind(x.id, y.id)
  // find an intermediate M with both single terms
  for (const m of P) {
    if (m.id === x.id || m.id === y.id) continue
    const xm = directKind(x.id, m.id), my = directKind(m.id, y.id)
    if (!xm || !my) continue
    // nephew/niece ∘ child ⇒ great-nephew; if x→y is a DIFFERENT direct term, that is suspicious
    if (xm === 'nephew_niece' && my === 'child' && xy && xy !== 'nephew_niece') {
      contradictions.push(`${name(x.id)}→${name(y.id)}=${xy} but ${name(x.id)}→${name(m.id)}=nephew ∘ ${name(m.id)}→${name(y.id)}=child ⇒ should be great-nephew`)
    }
    break
  }
}

const out = { longChains, termAbsent, contradictions, counts: { longChains: longChains.length, termAbsent: termAbsent.length, contradictions: contradictions.length } }
import('node:fs').then((fs) => fs.writeFileSync('docs/eval/KINSHIP_AUDIT.json', JSON.stringify(out, null, 2)))
console.log('=== KINSHIP AUDIT ===')
console.log(`LONG CHAINS (≥3 hops): ${longChains.length}`); longChains.slice(0, 15).forEach((s) => console.log('  ' + s))
console.log(`TERM-ABSENT (fell to a path): ${termAbsent.length}`); termAbsent.slice(0, 25).forEach((s) => console.log('  ' + s))
console.log(`COMPOSITION CONTRADICTIONS: ${contradictions.length}`); contradictions.slice(0, 15).forEach((s) => console.log('  ' + s))
