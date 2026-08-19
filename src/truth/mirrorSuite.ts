/*
 * METAMORPHIC MIRROR SUITE — the oracle-free scale weapon (Constitution §4).
 * ════════════════════════════════════════════════════════════════════════
 * Auto-generates thousands of consistency checks that need NO expected answers —
 * only that the system agrees with ITSELF. Each mirror is a metamorphic relation over
 * the real family engine (familyGraph.describeRelation):
 *   • inverse-existence — a relation exists X→Y iff it exists Y→X (never one-directional).
 *   • paraphrase-alias — the SAME person named by any alias must yield the SAME answer.
 * Plus a structural ledger-symmetry mirror (every spouse edge mutual) used to prove a
 * planted asymmetry is caught by MIRRORS ALONE, independent of the write gate.
 *
 * A mirror BREAK is a bug with an auto-repro (its id + detail).
 */
import { loadGraph, describeRelation } from '../screens/AbuAI/familyGraph'
import type { Ledger } from './familyLaws'

export type MirrorLang = 'he' | 'es'
export interface Mirror { id: string; kind: string; pass: boolean; detail: string }

/** Generate the family-relation mirror set over the REAL graph. Oracle-free. */
export function generateRelationMirrors(langs: MirrorLang[] = ['he', 'es']): Mirror[] {
  const g = loadGraph()
  const names = g.map((n) => n.hebrew)
  const out: Mirror[] = []

  // Inverse-existence: describeRelation(X,Y) non-null ⟺ describeRelation(Y,X) non-null.
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      for (const lang of langs) {
        const ab = describeRelation(names[i]!, names[j]!, lang)
        const ba = describeRelation(names[j]!, names[i]!, lang)
        out.push({ id: `inv:${names[i]}~${names[j]}:${lang}`, kind: 'inverse-existence', pass: !!ab === !!ba, detail: `${names[i]}→${names[j]}=${!!ab} | ${names[j]}→${names[i]}=${!!ba}` })
      }
    }
  }

  // Paraphrase-alias invariance: the SAME person named by canonical vs any alias must
  // yield the SAME answer — whether the alias is in the FIRST or the SECOND position.
  for (const x of g) {
    for (const y of g) {
      if (y.hebrew === x.hebrew) continue
      for (const lang of langs) {
        const base = describeRelation(x.hebrew, y.hebrew, lang)
        for (const alias of x.aliases) {
          if (!alias || alias === x.hebrew) continue
          const via = describeRelation(alias, y.hebrew, lang)
          out.push({ id: `paraA:${x.hebrew}[${alias}]→${y.hebrew}:${lang}`, kind: 'paraphrase-alias', pass: base === via, detail: `${base ?? 'null'} vs ${via ?? 'null'}` })
        }
        for (const alias of y.aliases) {
          if (!alias || alias === y.hebrew) continue
          const via = describeRelation(x.hebrew, alias, lang)
          out.push({ id: `paraB:${x.hebrew}→${y.hebrew}[${alias}]:${lang}`, kind: 'paraphrase-alias', pass: base === via, detail: `${base ?? 'null'} vs ${via ?? 'null'}` })
        }
      }
    }
  }
  return out
}

/** Structural symmetry mirror over a ledger: every current-spouse edge must be mutual. */
export function ledgerSpouseSymmetryMirrors(l: Ledger): Mirror[] {
  const out: Mirror[] = []
  for (const p of l.values()) {
    for (const s of p.spouses) {
      const other = l.get(s)
      out.push({ id: `sym:spouse:${p.id}~${s}`, kind: 'symmetry-spouse', pass: !!other && other.spouses.includes(p.id), detail: `${p.id}→${s}; reverse=${other ? other.spouses.includes(p.id) : 'missing'}` })
    }
  }
  return out
}

export interface MirrorRun { total: number; passed: number; breaks: Mirror[] }
export function runMirrors(mirrors: Mirror[]): MirrorRun {
  const breaks = mirrors.filter((m) => !m.pass)
  return { total: mirrors.length, passed: mirrors.length - breaks.length, breaks }
}
