/*
 * Family reasoner — property + fuzz tests.
 * Property (real graph): relationOf is inverse-consistent, deterministic, and never
 * self-contradicts; every known relation has a BFS path. Fuzz (random graphs): the
 * BFS path reasoner is symmetric, loop-free, bounded, and total.
 */
import { describe, it, expect } from 'vitest'
import { loadGraph } from './familyGraph'
import { relationOf, type RelationKind } from './familyRelationEngine'
import { findRelationPath, type RelNode } from './familyPathReasoner'

// Inverse of each relationOf kind (A→B kind ⇒ allowed B→A kinds).
const INVERSE: Record<RelationKind, RelationKind[]> = {
  self: ['self'], unknown: ['unknown'],
  spouse: ['spouse'], ex_spouse: ['ex_spouse'], partner: ['partner'],
  parent: ['child'], child: ['parent'], sibling: ['sibling'],
  grandparent: ['grandchild'], grandchild: ['grandparent'],
  uncle_aunt: ['nephew_niece'], uncle_aunt_in_law: ['nephew_niece'],
  nephew_niece: ['uncle_aunt', 'uncle_aunt_in_law'],
  great_grandparent: ['great_grandchild'], great_grandchild: ['great_grandparent'],
  great_uncle_aunt: ['great_nephew_niece'], great_nephew_niece: ['great_uncle_aunt'],
  cousin: ['cousin'],
  parent_in_law: ['child_in_law'], child_in_law: ['parent_in_law'],
  ex_child_in_law: ['ex_parent_in_law'], ex_parent_in_law: ['ex_child_in_law'],
  sibling_in_law: ['sibling_in_law'], ex_sibling_in_law: ['ex_sibling_in_law'],
  // A composed in-law (spouse of a blood relative) is an in-law in both directions.
  in_law: ['in_law'],
}

describe('Family reasoner — PROPERTY (real graph)', () => {
  const people = loadGraph().map(n => n.hebrew)

  it('relationOf is deterministic and never throws', () => {
    for (const a of people) for (const b of people) {
      const r1 = relationOf(a, b), r2 = relationOf(a, b)
      expect(r1.kind).toBe(r2.kind)
    }
  })

  it('every ordered pair is inverse-consistent (no contradictions)', () => {
    const bad: string[] = []
    for (const a of people) for (const b of people) {
      if (a === b) continue
      const k = relationOf(a, b).kind, kr = relationOf(b, a).kind
      if (!INVERSE[k].includes(kr)) bad.push(`${a}->${b}=${k} but ${b}->${a}=${kr}`)
    }
    if (bad.length) console.error('[INVERSE] ' + bad.join(' | '))
    expect(bad).toEqual([])
  })

  it('every KNOWN relation has a BFS path (computed, not memorized)', () => {
    const bad: string[] = []
    for (const a of people) for (const b of people) {
      if (a === b) continue
      if (relationOf(a, b).known && !findRelationPath(a, b).found) bad.push(`${a}->${b}`)
    }
    expect(bad).toEqual([])
  })
})

// ── deterministic PRNG + random graph generator (reproducible) ──
function makeRng(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0x100000000 } }

function randomGraph(seed: number, size: number): RelNode[] {
  const rng = makeRng(seed)
  const nodes: RelNode[] = Array.from({ length: size }, (_, i) => ({
    hebrew: `P${i}`, parentsHe: [], childrenHe: [], spousesHe: [], partnersHe: [], exSpousesHe: [],
    gender: rng() < 0.5 ? 'female' : 'male',
  }))
  const idx = new Map(nodes.map(n => [n.hebrew, n]))
  // parent edges only from an EARLIER node → acyclic (a forest of couples).
  for (let i = 1; i < size; i++) {
    if (rng() < 0.7) {
      const p = Math.floor(rng() * i)
      nodes[i]!.parentsHe.push(`P${p}`); idx.get(`P${p}`)!.childrenHe.push(`P${i}`)
      if (rng() < 0.5) { const p2 = Math.floor(rng() * i); if (p2 !== p) { nodes[i]!.parentsHe.push(`P${p2}`); idx.get(`P${p2}`)!.childrenHe.push(`P${i}`) } }
    }
  }
  // a few marriages between non-ancestor pairs
  for (let m = 0; m < size / 3; m++) {
    const a = Math.floor(rng() * size), b = Math.floor(rng() * size)
    if (a === b) continue
    const bucket = rng() < 0.75 ? 'spousesHe' : 'exSpousesHe'
    if (!nodes[a]![bucket].includes(`P${b}`)) { nodes[a]![bucket].push(`P${b}`); nodes[b]![bucket].push(`P${a}`) }
  }
  return nodes
}

describe('Family reasoner — FUZZ (random graphs)', () => {
  it('BFS is total, loop-free, bounded, symmetric across 2000 random queries', () => {
    let queries = 0
    for (let seed = 1; seed <= 200; seed++) {
      const size = 5 + (seed % 12)
      const g = randomGraph(seed, size)
      const names = g.map(n => n.hebrew)
      for (let k = 0; k < 10; k++) {
        const a = names[(seed + k) % size]!, b = names[(seed * 3 + k) % size]!
        const p = findRelationPath(a, b, g)
        queries++
        // no throw (implicit), deterministic:
        expect(findRelationPath(a, b, g).found).toBe(p.found)
        if (p.found) {
          // loop-free: unique nodes; bounded: hops < V; well-formed: edges = hops
          expect(new Set(p.nodes).size).toBe(p.nodes.length)
          expect(p.hops).toBeLessThan(size)
          expect(p.edges.length).toBe(p.hops)
          expect(p.nodes[0]).toBe(a); expect(p.nodes[p.nodes.length - 1]).toBe(b)
        }
        // symmetry: a path A→B exists iff a path B→A exists (edges bidirectional)
        expect(findRelationPath(b, a, g).found).toBe(p.found)
      }
    }
    expect(queries).toBe(2000)
  })
})
