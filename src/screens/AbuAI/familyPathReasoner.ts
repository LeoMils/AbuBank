/*
 * Family Path Reasoner
 * ════════════════════
 * The graph ALGORITHM the family engine was missing: a breadth-first shortest-path
 * search over typed kinship edges (parent / child / spouse / ex_spouse / partner)
 * that computes HOW two people are connected — and renders the edge-by-edge
 * explanation ("through whom / how exactly"). Pure graph reasoning: it never uses a
 * memorized sentence, and it works on ANY node set (so property/fuzz tests can feed
 * thousands of random graphs). Complexity: O(V + E) per query.
 */
import { loadGraph, type Gender } from './familyGraph'

export type EdgeType = 'parent' | 'child' | 'spouse' | 'ex_spouse' | 'partner'

/** Minimal node shape the reasoner needs (a subset of GraphNode). */
export interface RelNode {
  hebrew: string
  parentsHe: string[]
  childrenHe: string[]
  spousesHe: string[]
  partnersHe: string[]
  exSpousesHe: string[]
  gender?: Gender
}

export interface RelationPath {
  found: boolean
  from: string
  to: string
  nodes: string[]      // [A, …, B]
  edges: EdgeType[]    // edges[i] = relation FROM nodes[i] TO nodes[i+1]
  hops: number
  missing?: string     // when unknown: exactly what the graph lacks
  explanation: string  // edge-by-edge Hebrew chain
}

function adjacency(nodes: RelNode[]): Map<string, Array<{ to: string; edge: EdgeType }>> {
  const present = new Set(nodes.map(n => n.hebrew))
  const adj = new Map<string, Array<{ to: string; edge: EdgeType }>>()
  const add = (a: string, to: string, edge: EdgeType) => {
    if (!present.has(a) || !present.has(to)) return
    const arr = adj.get(a) ?? []; arr.push({ to, edge }); adj.set(a, arr)
  }
  for (const n of nodes) {
    for (const p of n.parentsHe) add(n.hebrew, p, 'parent')
    for (const c of n.childrenHe) add(n.hebrew, c, 'child')
    for (const s of n.spousesHe) add(n.hebrew, s, 'spouse')
    for (const s of n.partnersHe) add(n.hebrew, s, 'partner')
    for (const e of n.exSpousesHe) add(n.hebrew, e, 'ex_spouse')
  }
  return adj
}

/** BFS shortest kinship path A → B. Never invents; returns `missing` when unknown. */
export function findRelationPath(aName: string, bName: string, nodes: RelNode[] = loadGraph() as unknown as RelNode[]): RelationPath {
  const base = { from: aName, to: bName }
  const idx = new Map(nodes.map(n => [n.hebrew, n]))
  if (!idx.has(aName) || !idx.has(bName)) {
    return { ...base, found: false, nodes: [], edges: [], hops: 0, missing: `הגרף לא מכיל את ${!idx.has(aName) ? aName : bName}`, explanation: '' }
  }
  if (aName === bName) return { ...base, found: true, nodes: [aName], edges: [], hops: 0, explanation: `${aName} — אותו אדם.` }

  const adj = adjacency(nodes)
  const prev = new Map<string, { from: string; edge: EdgeType }>()
  const seen = new Set<string>([aName])
  const q: string[] = [aName]
  let head = 0
  while (head < q.length) {
    const cur = q[head++]!
    if (cur === bName) break
    for (const { to, edge } of adj.get(cur) ?? []) {
      if (seen.has(to)) continue
      seen.add(to); prev.set(to, { from: cur, edge }); q.push(to)
    }
  }
  if (!seen.has(bName)) return { ...base, found: false, nodes: [], edges: [], hops: 0, missing: `אין נתיב קשר ידוע בין ${aName} ל${bName} בגרף`, explanation: '' }

  const nodesPath: string[] = [bName]; const edges: EdgeType[] = []
  let cur = bName
  while (cur !== aName) { const p = prev.get(cur)!; edges.unshift(p.edge); nodesPath.unshift(p.from); cur = p.from }
  return { ...base, found: true, nodes: nodesPath, edges, hops: edges.length, explanation: explainChain(nodesPath, edges, idx) }
}

const ROLE: Record<EdgeType, [string, string]> = {
  //        female,        male
  parent:    ['אמא', 'אבא'],
  child:     ['הבת', 'הבן'],
  spouse:    ['אשתו', 'בעלה'],
  ex_spouse: ['גרושתו', 'גרוש'],
  partner:   ['בת הזוג', 'בן הזוג'],
}

/** Render the path edge-by-edge: "B הוא הבן של A; A היא האמא של …". */
function explainChain(nodesPath: string[], edges: EdgeType[], idx: Map<string, RelNode>): string {
  const parts: string[] = []
  for (let i = 0; i < edges.length; i++) {
    const a = nodesPath[i]!, b = nodesPath[i + 1]!, e = edges[i]!
    const gb = idx.get(b)?.gender
    const role = gb === 'female' ? ROLE[e][0] : ROLE[e][1]
    parts.push(`${b} ${role} של ${a}`)
  }
  return parts.join('; ') + '.'
}

/** Public "how exactly / through whom" explanation for a pair. */
export function explainRelation(aName: string, bName: string, nodes?: RelNode[]): string {
  const p = findRelationPath(aName, bName, nodes)
  if (!p.found) return `אין לי מספיק מידע: ${p.missing}.`
  if (p.hops === 0) return p.explanation
  const via = p.nodes.slice(1, -1)
  const through = via.length ? ` (דרך ${via.join(', ')})` : ''
  return `${p.explanation}${through}`
}
