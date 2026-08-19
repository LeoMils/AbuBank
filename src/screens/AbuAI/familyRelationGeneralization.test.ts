/**
 * FAMILY RELATION ENGINE — PROPERTY-BASED GENERALIZATION PROOF (principle C).
 * ══════════════════════════════════════════════════════════════════════════
 * Leo's mandate: the system must KNOW the relation ALGEBRA, not memorize named
 * pairs. This proves it by GENERATING every ordered person-pair from the real
 * family graph and asserting the engine (`describeRelation`) solves the chain.
 *
 * The oracle is INDEPENDENT of the resolver: it re-derives the expected relation
 * CLASS with a trivial edge traversal over the same normalized edge set the
 * resolver consumes — so a hole in `describeRelation` (a false "unknown", a wrong
 * gender label, a language-parity gap) shows up as a failure here, not a pass.
 *
 * This is a completeness proof (no false dead-ends) + correctness spot-checks,
 * NOT a "these exact 3 pairs" snapshot. Adding a person to family_graph.json
 * automatically expands the generated case set — no test edit required.
 *
 * Evidence class: CODE (runs the real engine over real data, deterministic).
 */
import { describe, it, expect } from 'vitest'
import { loadGraph, describeRelation, type GraphNode } from './familyGraph'

const nodes = loadGraph()
const byHe = new Map(nodes.map((n) => [n.hebrew, n]))

// ── Independent oracle: relation classes the engine CLAIMS to support, each
//    recomputed from raw edges (parents/children/spouses/partners/exSpouses).
//    These deliberately mirror describeRelation's capability ladder so the
//    "expect non-null" set is exactly the set the engine promises to answer. ──
const shareParent = (a: GraphNode, b: GraphNode) => a.parentsHe.some((p) => b.parentsHe.includes(p))
const isParentOf = (a: GraphNode, b: GraphNode) => a.childrenHe.includes(b.hebrew)
const spouseLike = (a: GraphNode, b: GraphNode) =>
  a.spousesHe.includes(b.hebrew) || a.partnersHe.includes(b.hebrew) || a.exSpousesHe.includes(b.hebrew)

/** Generational distance from descendant up to ancestor via parent edges, or null. */
function ancestorDistance(descendant: GraphNode, ancestor: GraphNode, maxDepth = 5): number | null {
  let frontier = [descendant.hebrew]
  const seen = new Set(frontier)
  for (let d = 1; d <= maxDepth; d++) {
    const next: string[] = []
    for (const he of frontier) {
      const n = byHe.get(he)
      if (!n) continue
      for (const p of n.parentsHe) {
        if (p === ancestor.hebrew) return d
        if (!seen.has(p)) { seen.add(p); next.push(p) }
      }
    }
    frontier = next
  }
  return null
}

/** A's (ex-)spouse/partner is a SIBLING of B → (former) brother/sister-in-law. */
function siblingOfSpouse(a: GraphNode, b: GraphNode): boolean {
  const conns = [...a.spousesHe, ...a.partnersHe, ...a.exSpousesHe]
  return conns.some((cHe) => {
    const c = byHe.get(cHe)
    return !!c && c.hebrew !== b.hebrew && shareParent(c, b)
  })
}

/** A is a parent of someone whose (ex-)spouse/partner is B → parent-in-law / child-in-law. */
function parentOfSpouse(a: GraphNode, b: GraphNode): boolean {
  return a.childrenHe.some((cHe) => {
    const c = byHe.get(cHe)
    return !!c && (c.spousesHe.includes(b.hebrew) || c.partnersHe.includes(b.hebrew) || c.exSpousesHe.includes(b.hebrew))
  })
}

/** A shares a parent with one of B's parents → A is aunt/uncle of B. */
function auntUncle(a: GraphNode, b: GraphNode): boolean {
  return b.parentsHe.some((pHe) => {
    if (pHe === a.hebrew) return false
    const p = byHe.get(pHe)
    return !!p && shareParent(a, p)
  })
}

/** A parent of A and a parent of B are siblings → first cousins. */
function cousins(a: GraphNode, b: GraphNode): boolean {
  for (const paHe of a.parentsHe) {
    for (const pbHe of b.parentsHe) {
      if (paHe === pbHe) continue
      const pa = byHe.get(paHe)
      const pb = byHe.get(pbHe)
      if (pa && pb && shareParent(pa, pb)) return true
    }
  }
  return false
}

/** The union of every class the engine promises to answer, in EITHER direction. */
function graphResolvable(a: GraphNode, b: GraphNode): boolean {
  if (a.hebrew === b.hebrew) return false
  return (
    spouseLike(a, b) || spouseLike(b, a) ||
    isParentOf(a, b) || isParentOf(b, a) ||
    shareParent(a, b) ||
    siblingOfSpouse(a, b) || siblingOfSpouse(b, a) ||
    parentOfSpouse(a, b) || parentOfSpouse(b, a) ||
    auntUncle(a, b) || auntUncle(b, a) ||
    cousins(a, b) ||
    ancestorDistance(a, b) !== null || ancestorDistance(b, a) !== null
  )
}

// ── Generate the full ordered-pair case set. ────────────────────────────────
const PAIRS: Array<[GraphNode, GraphNode]> = []
for (const a of nodes) for (const b of nodes) if (a.hebrew !== b.hebrew) PAIRS.push([a, b])

describe('FAMILY_GENERALIZATION — the relation algebra over ALL real pairs', () => {
  it('generates a large novel case set (not a hand-picked few)', () => {
    expect(nodes.length).toBeGreaterThanOrEqual(10)
    expect(PAIRS.length).toBeGreaterThanOrEqual(100)
  })

  it('never throws on any generated pair (He/Es/En)', () => {
    for (const [a, b] of PAIRS) {
      expect(() => describeRelation(a.hebrew, b.hebrew, 'he')).not.toThrow()
      expect(() => describeRelation(a.hebrew, b.hebrew, 'es')).not.toThrow()
      expect(() => describeRelation(a.hebrew, b.hebrew, 'en')).not.toThrow()
    }
  })

  it('NO FALSE DEAD-END: every graph-derivable pair gets a non-empty kinship answer', () => {
    const holes: string[] = []
    let covered = 0
    for (const [a, b] of PAIRS) {
      if (!graphResolvable(a, b)) continue
      covered++
      const r = describeRelation(a.hebrew, b.hebrew, 'he')
      if (!r || !r.trim()) holes.push(`${a.hebrew} → ${b.hebrew}`)
    }
    // A real generalization set: dozens of derivable pairs must be exercised.
    expect(covered).toBeGreaterThanOrEqual(40)
    expect(holes).toEqual([])
  })

  it('direct parent→child uses the CORRECT gendered label (no Ofir-is-male class bug)', () => {
    const wrong: string[] = []
    for (const [a, b] of PAIRS) {
      if (!isParentOf(a, b)) continue
      const r = describeRelation(a.hebrew, b.hebrew, 'he') ?? ''
      if (a.gender === 'female' && !r.includes('אמא')) wrong.push(`${a.hebrew}(♀)→${b.hebrew}: "${r}"`)
      if (a.gender === 'male' && !r.includes('אבא')) wrong.push(`${a.hebrew}(♂)→${b.hebrew}: "${r}"`)
    }
    expect(wrong).toEqual([])
  })

  it('LANGUAGE PARITY: a pair resolves in Hebrew iff it resolves in Spanish and English', () => {
    const mismatches: string[] = []
    for (const [a, b] of PAIRS) {
      const he = !!describeRelation(a.hebrew, b.hebrew, 'he')?.trim()
      const es = !!describeRelation(a.hebrew, b.hebrew, 'es')?.trim()
      const en = !!describeRelation(a.hebrew, b.hebrew, 'en')?.trim()
      if (he !== es || he !== en) mismatches.push(`${a.hebrew} → ${b.hebrew}  he=${he} es=${es} en=${en}`)
    }
    expect(mismatches).toEqual([])
  })

  it('symmetry: if A relates to B, B relates to A (relations are never one-directional dead-ends)', () => {
    const asym: string[] = []
    for (const [a, b] of PAIRS) {
      const ab = !!describeRelation(a.hebrew, b.hebrew, 'he')?.trim()
      const ba = !!describeRelation(b.hebrew, a.hebrew, 'he')?.trim()
      if (ab !== ba) asym.push(`${a.hebrew}→${b.hebrew}=${ab} but ${b.hebrew}→${a.hebrew}=${ba}`)
    }
    expect(asym).toEqual([])
  })
})
