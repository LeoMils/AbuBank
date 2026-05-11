/*
 * AbuAI B2.4 — Family relationship resolver.
 *
 * Builds a small family graph from knowledge/family_data.json and
 * answers "what is the relation between A and B?" with a concise,
 * truth-anchored sentence. No invention: if no path is found, the
 * resolver returns null and the caller surfaces an honest
 * "no direct relation found" message.
 *
 * Pure module — no React, no fetch, no LLM, no env vars.
 */

import familyRaw from '../../../knowledge/family_data.json'

interface RawMember {
  canonical_name: string
  hebrew_name: string
  aliases?: string[]
  relationship?: string
  partner?: string
  spouse?: string
  ex_spouse?: string
  children?: string[]
}

export interface GraphNode {
  canonical: string
  hebrew: string
  aliases: string[]
  /** ALL names this node answers to, lowercased: canonical + hebrew + aliases. */
  matchNames: string[]
  /** Hebrew names of children (the source of truth in family_data uses Hebrew). */
  childrenHe: string[]
  /** Hebrew name of current spouse, if any. */
  spouseHe?: string
  /** Hebrew name of current partner (e.g., Yael as Mor's partner). */
  partnerHe?: string
  /** Hebrew name of ex-spouse, if any. */
  exSpouseHe?: string
  /** "son" / "daughter" / "matriarch" / "ex_son_in_law" / etc. — verbatim. */
  role: string
}

function collectMembers(): RawMember[] {
  const out: RawMember[] = []
  const f = familyRaw.family as Record<string, unknown>
  // Matriarch + deceased are objects, the rest are arrays.
  if (f['matriarch']) out.push(f['matriarch'] as RawMember)
  if (f['deceased']) out.push(f['deceased'] as RawMember)
  for (const key of ['children', 'children_related', 'grandchildren_mor',
                     'grandchildren_leo', 'grandchildren_spouses',
                     'great_grandchildren']) {
    const arr = f[key]
    if (Array.isArray(arr)) for (const m of arr) out.push(m as RawMember)
  }
  return out
}

let _nodes: GraphNode[] | null = null

export function loadGraph(): GraphNode[] {
  if (_nodes) return _nodes
  const raw = collectMembers()
  _nodes = raw.map((m) => {
    const aliases = m.aliases ?? []
    const matchNames = [
      m.canonical_name.toLowerCase(),
      m.hebrew_name.toLowerCase(),
      ...aliases.map((a) => a.toLowerCase()),
    ]
    const node: GraphNode = {
      canonical: m.canonical_name,
      hebrew: m.hebrew_name,
      aliases,
      matchNames,
      childrenHe: m.children ?? [],
      role: m.relationship ?? '',
    }
    if (m.spouse) node.spouseHe = m.spouse
    if (m.partner) node.partnerHe = m.partner
    if (m.ex_spouse) node.exSpouseHe = m.ex_spouse
    return node
  })
  return _nodes
}

/** Look up a node by ANY known name (canonical / Hebrew / alias), case-insensitive. */
export function findNode(name: string): GraphNode | null {
  const q = name.trim().toLowerCase()
  if (!q) return null
  for (const n of loadGraph()) {
    if (n.matchNames.includes(q)) return n
  }
  // Tolerant first-token match (e.g., "Rafi," → "rafi").
  const first = q.split(/[\s,?¿!.]+/)[0] ?? ''
  if (first && first !== q) {
    for (const n of loadGraph()) {
      if (n.matchNames.includes(first)) return n
    }
  }
  return null
}

/** Hebrew name → node helper for graph traversal (children are stored in Hebrew). */
function nodeByHebrew(he: string): GraphNode | null {
  const q = he.trim().toLowerCase()
  for (const n of loadGraph()) {
    if (n.hebrew.toLowerCase() === q) return n
  }
  return null
}

function parentsOf(node: GraphNode): GraphNode[] {
  const out: GraphNode[] = []
  for (const candidate of loadGraph()) {
    if (candidate.childrenHe.includes(node.hebrew)) out.push(candidate)
  }
  return out
}

/**
 * Compute a concise Hebrew / Spanish / English description of the relation
 * between A and B. Returns null when no representable relation is found —
 * the caller is responsible for the honest "no direct relation" copy.
 */
export type Lang = 'he' | 'es' | 'en'

export function describeRelation(aQuery: string, bQuery: string, lang: Lang): string | null {
  const a = findNode(aQuery)
  const b = findNode(bQuery)
  if (!a || !b) return null
  if (a.hebrew === b.hebrew) return null

  // 1) Direct spouse / partner / ex-spouse.
  if (a.spouseHe === b.hebrew || b.spouseHe === a.hebrew) {
    return spousePhrase(a, b, lang)
  }
  if (a.partnerHe === b.hebrew || b.partnerHe === a.hebrew) {
    return partnerPhrase(a, b, lang)
  }
  if (a.exSpouseHe === b.hebrew || b.exSpouseHe === a.hebrew) {
    return exSpousePhrase(a, b, lang)
  }

  // 2) Parent/child.
  if (a.childrenHe.includes(b.hebrew)) return parentChildPhrase(a, b, lang)
  if (b.childrenHe.includes(a.hebrew)) return parentChildPhrase(b, a, lang)

  // 3) Siblings (share at least one parent).
  const aParents = parentsOf(a).map((p) => p.hebrew)
  const bParents = parentsOf(b).map((p) => p.hebrew)
  const sharedParent = aParents.find((p) => bParents.includes(p))
  if (sharedParent) return siblingPhrase(a, b, sharedParent, lang)

  // 4) In-law via a shared connector (the most common Rafi <-> Leo case):
  //    A's ex/spouse/partner is B's sibling (or B's parent/child).
  const aConnectors = [a.spouseHe, a.partnerHe, a.exSpouseHe].filter(Boolean) as string[]
  for (const conn of aConnectors) {
    // conn is a Hebrew name. Is conn a sibling of B, or a parent/child of B?
    const connNode = nodeByHebrew(conn)
    if (!connNode) continue
    const connParents = parentsOf(connNode).map((p) => p.hebrew)
    const sharedConnParent = connParents.find((p) => bParents.includes(p))
    if (sharedConnParent) {
      // conn and B are siblings via sharedConnParent; A is in-law of B through conn.
      return inLawViaSiblingPhrase(a, b, connNode, lang)
    }
    if (connNode.childrenHe.includes(b.hebrew)) {
      return inLawViaParentPhrase(a, b, connNode, lang)
    }
    if (b.childrenHe.includes(connNode.hebrew)) {
      // B is parent of conn; A is conn's partner ⇒ A is "spouse of B's child".
      return inLawViaChildPhrase(a, b, connNode, lang)
    }
  }

  // 5) Grandparent / grandchild via one hop.
  for (const aChildHe of a.childrenHe) {
    const mid = nodeByHebrew(aChildHe)
    if (mid && mid.childrenHe.includes(b.hebrew)) {
      return grandparentPhrase(a, b, mid, lang)
    }
  }
  for (const bChildHe of b.childrenHe) {
    const mid = nodeByHebrew(bChildHe)
    if (mid && mid.childrenHe.includes(a.hebrew)) {
      return grandparentPhrase(b, a, mid, lang)
    }
  }

  return null
}

// ─── Phrase shapers ────────────────────────────────────────────────────────

function spousePhrase(a: GraphNode, b: GraphNode, lang: Lang): string {
  if (lang === 'es') return `${a.canonical} y ${b.canonical} están casados.`
  if (lang === 'en') return `${a.canonical} and ${b.canonical} are married.`
  return `${a.hebrew} ו${b.hebrew} נשואים.`
}

function partnerPhrase(a: GraphNode, b: GraphNode, lang: Lang): string {
  if (lang === 'es') return `${a.canonical} y ${b.canonical} son pareja.`
  if (lang === 'en') return `${a.canonical} and ${b.canonical} are partners.`
  return `${a.hebrew} ו${b.hebrew} בני זוג.`
}

function exSpousePhrase(a: GraphNode, b: GraphNode, lang: Lang): string {
  if (lang === 'es') return `${a.canonical} y ${b.canonical} están divorciados.`
  if (lang === 'en') return `${a.canonical} and ${b.canonical} are divorced.`
  return `${a.hebrew} ו${b.hebrew} גרושים.`
}

function parentChildPhrase(parent: GraphNode, child: GraphNode, lang: Lang): string {
  if (lang === 'es') return `${parent.canonical} es padre/madre de ${child.canonical}.`
  if (lang === 'en') return `${parent.canonical} is the parent of ${child.canonical}.`
  return `${parent.hebrew} הוא/היא ההורה של ${child.hebrew}.`
}

function siblingPhrase(a: GraphNode, b: GraphNode, sharedParentHe: string, lang: Lang): string {
  if (lang === 'es') return `${a.canonical} y ${b.canonical} son hermanos (hijos de ${sharedParentHe}).`
  if (lang === 'en') return `${a.canonical} and ${b.canonical} are siblings (children of ${sharedParentHe}).`
  return `${a.hebrew} ו${b.hebrew} אחים (הילדים של ${sharedParentHe}).`
}

function inLawViaSiblingPhrase(a: GraphNode, b: GraphNode, conn: GraphNode, lang: Lang): string {
  // A is connected to B's sibling (conn). Express it as "A is connected to B
  // through conn" — concise, truthful, no over-specification.
  if (lang === 'es') return `${a.canonical} está conectado/a con ${b.canonical} a través de ${conn.canonical}.`
  if (lang === 'en') return `${a.canonical} is connected to ${b.canonical} through ${conn.canonical}.`
  return `${a.hebrew} קשור/ה ל${b.hebrew} דרך ${conn.hebrew}.`
}

function inLawViaParentPhrase(a: GraphNode, b: GraphNode, conn: GraphNode, lang: Lang): string {
  // A's partner/spouse/ex (conn) is B's parent ⇒ A is connected to B through conn.
  if (lang === 'es') return `${a.canonical} está conectado/a con ${b.canonical} a través de ${conn.canonical}.`
  if (lang === 'en') return `${a.canonical} is connected to ${b.canonical} through ${conn.canonical}.`
  return `${a.hebrew} קשור/ה ל${b.hebrew} דרך ${conn.hebrew}.`
}

function inLawViaChildPhrase(a: GraphNode, b: GraphNode, conn: GraphNode, lang: Lang): string {
  if (lang === 'es') return `${a.canonical} está conectado/a con ${b.canonical} a través de ${conn.canonical}.`
  if (lang === 'en') return `${a.canonical} is connected to ${b.canonical} through ${conn.canonical}.`
  return `${a.hebrew} קשור/ה ל${b.hebrew} דרך ${conn.hebrew}.`
}

function grandparentPhrase(grand: GraphNode, child: GraphNode, mid: GraphNode, lang: Lang): string {
  if (lang === 'es') return `${grand.canonical} es abuelo/a de ${child.canonical} (a través de ${mid.canonical}).`
  if (lang === 'en') return `${grand.canonical} is the grandparent of ${child.canonical} (through ${mid.canonical}).`
  return `${grand.hebrew} הוא/היא הסבא/סבתא של ${child.hebrew} (דרך ${mid.hebrew}).`
}
