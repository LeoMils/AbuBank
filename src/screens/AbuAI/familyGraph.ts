/*
 * AbuAI B2.5 — Complete Family Intelligence Matrix.
 *
 * Loads knowledge/family_data.json into a normalized in-memory family
 * graph and answers two-name relationship questions deterministically,
 * with a human kinship label and a short reasoning trail.
 *
 * Truth Contract:
 *  • Returns null / no_direct_relation_found when no representable
 *    path exists. Never invents a relation, never fabricates a name.
 *  • Every derived edge comes from explicit fields in family_data.json
 *    (spouse / partner / ex_spouse / children) or from the JSON's
 *    structural placement (matriarch / children / grandchildren_*).
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
  notes?: string
}

/** Inferred gender from the `relationship` field; "unknown" when neither
 *  list matches. Used to pick the right kinship label (גיס vs גיסה /
 *  cuñado vs cuñada / brother-in-law vs sister-in-law). */
export type Gender = 'female' | 'male' | 'unknown'

const FEMALE_ROLES = new Set([
  'matriarch', 'daughter', 'granddaughter', 'great_granddaughter',
  'daughter_partner', 'daughter-partner', 'granddaughter_in_law',
])
const MALE_ROLES = new Set([
  'son', 'grandson', 'husband_deceased',
  'son_in_law', 'ex_son_in_law', 'grandson_in_law',
])

function inferGender(role: string): Gender {
  if (FEMALE_ROLES.has(role)) return 'female'
  if (MALE_ROLES.has(role)) return 'male'
  return 'unknown'
}

export interface GraphNode {
  canonical: string
  hebrew: string
  aliases: string[]
  matchNames: string[]
  childrenHe: string[]
  parentsHe: string[]
  spousesHe: string[]
  partnersHe: string[]
  exSpousesHe: string[]
  role: string
  gender: Gender
}

export type RelationType =
  | 'same_person'
  | 'spouse' | 'ex_spouse' | 'partner'
  | 'parent' | 'child'
  | 'sibling'
  | 'grandparent' | 'grandchild'
  | 'great_grandparent' | 'great_grandchild'
  | 'uncle_aunt' | 'niece_nephew'
  | 'cousin'
  | 'brother_in_law' | 'sister_in_law'
  | 'former_brother_in_law' | 'former_sister_in_law'
  | 'son_in_law' | 'daughter_in_law'
  | 'former_son_in_law' | 'former_daughter_in_law'
  | 'father_in_law' | 'mother_in_law'
  | 'former_father_in_law' | 'former_mother_in_law'
  | 'grandchild_in_law' | 'grandparent_in_law'
  | 'indirect_family_relation'
  | 'no_direct_relation_found'

export interface RelationResult {
  type: RelationType
  confidence: 'derived_from_explicit_data' | 'not_found'
  people: [string, string]
  connectorPath: string[]
  facts: string[]
  he: string
  es: string
  en: string
}

export type Lang = 'he' | 'es' | 'en'

// ─── Graph load ────────────────────────────────────────────────────────────

function collectRaw(): RawMember[] {
  const out: RawMember[] = []
  const f = familyRaw.family as Record<string, unknown>
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
let _byHebrew: Map<string, GraphNode> | null = null

function buildGraph(): GraphNode[] {
  const raw = collectRaw()
  const nodes: GraphNode[] = raw.map((m) => {
    const aliases = m.aliases ?? []
    const matchNames = [
      m.canonical_name.toLowerCase(),
      m.hebrew_name.toLowerCase(),
      ...aliases.map((a) => a.toLowerCase()),
    ]
    const role = m.relationship ?? ''
    return {
      canonical: m.canonical_name,
      hebrew: m.hebrew_name,
      aliases,
      matchNames,
      childrenHe: [...(m.children ?? [])],
      parentsHe: [],
      spousesHe: m.spouse ? [m.spouse] : [],
      partnersHe: m.partner ? [m.partner] : [],
      exSpousesHe: m.ex_spouse ? [m.ex_spouse] : [],
      role,
      gender: inferGender(role),
    }
  })

  const byHe = new Map<string, GraphNode>()
  for (const n of nodes) byHe.set(n.hebrew, n)

  // Structural parent edges from the JSON layout.
  const f = familyRaw.family as Record<string, unknown>
  const matriarchRaw = f['matriarch'] as RawMember | undefined
  if (matriarchRaw) {
    const matriarch = byHe.get(matriarchRaw.hebrew_name)
    const matriarchKids = (f['children'] as RawMember[] | undefined ?? []).map((c) => c.hebrew_name)
    if (matriarch) matriarch.childrenHe.push(...matriarchKids)
  }

  // Rafi is the father of Mor's children (notes encode this).
  const rafi = nodes.find((n) => n.canonical === 'Raphi')
  if (rafi) {
    const morKids = (f['grandchildren_mor'] as RawMember[] | undefined ?? []).map((g) => g.hebrew_name)
    rafi.childrenHe.push(...morKids)
  }

  // Ofir + Gilad are parents of every great-grandchild.
  const greatGrandKids = (f['great_grandchildren'] as RawMember[] | undefined ?? []).map((g) => g.hebrew_name)
  for (const parentCanonical of ['Ofir', 'Gilad']) {
    const p = nodes.find((n) => n.canonical === parentCanonical)
    if (p) p.childrenHe.push(...greatGrandKids)
  }

  // Symmetric edges.
  for (const n of nodes) {
    for (const childHe of n.childrenHe) {
      const child = byHe.get(childHe)
      if (child && !child.parentsHe.includes(n.hebrew)) child.parentsHe.push(n.hebrew)
    }
    for (const sp of n.spousesHe) {
      const other = byHe.get(sp)
      if (other && !other.spousesHe.includes(n.hebrew)) other.spousesHe.push(n.hebrew)
    }
    for (const pa of n.partnersHe) {
      const other = byHe.get(pa)
      if (other && !other.partnersHe.includes(n.hebrew)) other.partnersHe.push(n.hebrew)
    }
    for (const ex of n.exSpousesHe) {
      const other = byHe.get(ex)
      if (other && !other.exSpousesHe.includes(n.hebrew)) other.exSpousesHe.push(n.hebrew)
    }
  }

  _byHebrew = byHe
  return nodes
}

export function loadGraph(): GraphNode[] {
  if (_nodes) return _nodes
  _nodes = buildGraph()
  return _nodes
}

export function findNode(name: string): GraphNode | null {
  const q = name.trim().toLowerCase()
  if (!q) return null
  for (const n of loadGraph()) if (n.matchNames.includes(q)) return n
  const first = q.split(/[\s,?¿!.]+/)[0] ?? ''
  if (first && first !== q) {
    for (const n of loadGraph()) if (n.matchNames.includes(first)) return n
  }
  return null
}

function nodeByHebrew(he: string): GraphNode | null {
  if (!_byHebrew) loadGraph()
  return _byHebrew!.get(he) ?? null
}

export function displayName(n: GraphNode, lang: Lang): string {
  if (lang === 'he') return n.hebrew
  // ES/EN: prefer the canonical name when it's already Latin-script (the
  // common case for this family — Martita, Leo, Mor, Adi, Ofir, etc.).
  // The earlier "first Latin alias wins" policy mistakenly demoted
  // "Martita" to "Abu" and "Eili" to "Ilai".
  if (/^[A-Za-z]/.test(n.canonical)) {
    // Single hand-coded override: the canonical "Raphi" is a less-common
    // transliteration; the family uses "Rafi" in daily speech. This is the
    // only entry in family_data.json with that mismatch.
    if (n.canonical === 'Raphi' && n.aliases.includes('Rafi')) return 'Rafi'
    return n.canonical
  }
  // Canonical is non-Latin (e.g., Hebrew-only entries). Use first Latin
  // alias if available; otherwise fall back to canonical.
  const latinAlias = n.aliases.find((a) => /^[A-Za-z]/.test(a))
  return latinAlias ?? n.canonical
}

function allPeople(): GraphNode[] {
  return loadGraph().filter((n) => n.role !== 'pet' && n.role !== 'close_friend' && n.role !== 'family_friend')
}

// ─── Public exports for the all-pairs harness ─────────────────────────────

export function listFamilyPeople(): GraphNode[] {
  return allPeople()
}

// ─── Resolver — structured RelationResult ─────────────────────────────────

export function resolveRelationship(aQuery: string, bQuery: string, lang: Lang = 'he'): RelationResult {
  const a = findNode(aQuery)
  const b = findNode(bQuery)
  const peopleNames: [string, string] = [aQuery, bQuery]

  if (!a || !b) return notFound(peopleNames, lang)
  peopleNames[0] = displayName(a, lang)
  peopleNames[1] = displayName(b, lang)
  if (a.hebrew === b.hebrew) {
    return {
      type: 'same_person', confidence: 'derived_from_explicit_data',
      people: peopleNames, connectorPath: [a.hebrew],
      facts: [`${displayName(a, lang)} = ${displayName(b, lang)}`],
      he: `זה אותו אדם.`, es: `Es la misma persona.`, en: `That is the same person.`,
    }
  }

  // ── 1) Direct couple edges.
  if (a.spousesHe.includes(b.hebrew)) return resultSpouse(a, b, lang)
  if (a.partnersHe.includes(b.hebrew)) return resultPartner(a, b, lang)
  if (a.exSpousesHe.includes(b.hebrew)) return resultExSpouse(a, b, lang)

  // ── 2) Parent ↔ child.
  if (a.childrenHe.includes(b.hebrew)) return resultParentChild(a, b, lang)
  if (b.childrenHe.includes(a.hebrew)) return resultParentChild(b, a, lang)

  // ── 3) Siblings.
  const sharedParent = a.parentsHe.find((p) => b.parentsHe.includes(p))
  if (sharedParent) return resultSibling(a, b, nodeByHebrew(sharedParent), lang)

  // ── 4) Sibling-of-spouse (brother-/sister-in-law).
  const inLaw = detectSiblingOfSpouse(a, b)
  if (inLaw) return resultSiblingOfSpouse(inLaw, lang)

  // ── 5) Parent-of-spouse / spouse-of-child (parent-in-law / child-in-law).
  const parentOfSpouse = detectParentOfSpouse(a, b)
  if (parentOfSpouse) return resultParentOfSpouse(parentOfSpouse, lang)

  // ── 6) Grandparent ↔ grandchild.
  for (const childHe of a.childrenHe) {
    const mid = nodeByHebrew(childHe)
    if (mid && mid.childrenHe.includes(b.hebrew)) return resultGrandparent(a, b, mid, lang)
  }
  for (const childHe of b.childrenHe) {
    const mid = nodeByHebrew(childHe)
    if (mid && mid.childrenHe.includes(a.hebrew)) return resultGrandparent(b, a, mid, lang, /*flip*/ true)
  }

  // ── 7) Great-grandparent ↔ great-grandchild (2-hop ancestor).
  const gg = detectGreatGrandparent(a, b)
  if (gg) return resultGreatGrandparent(gg, lang)

  // ── 8) Aunt / uncle ↔ niece / nephew.
  const auntUncle = detectAuntUncle(a, b)
  if (auntUncle) return resultAuntUncle(auntUncle, lang)

  // ── 9) Cousins (parents are siblings).
  const cousin = detectCousins(a, b)
  if (cousin) return resultCousins(cousin, lang)

  // ── 10) Grandchild-in-law (spouse of grandchild) — the Gilad ↔ Martita case.
  const grandInLaw = detectGrandchildInLaw(a, b)
  if (grandInLaw) return resultGrandchildInLaw(grandInLaw, lang)

  return notFound(peopleNames, lang)
}

/** Backward-compat thin wrapper used by service.ts. */
export function describeRelation(aQuery: string, bQuery: string, lang: Lang): string | null {
  const r = resolveRelationship(aQuery, bQuery, lang)
  if (r.type === 'no_direct_relation_found') return null
  return lang === 'es' ? r.es : lang === 'en' ? r.en : r.he
}

// ─── Detectors ────────────────────────────────────────────────────────────

interface SiblingOfSpouseHit {
  a: GraphNode; b: GraphNode; connector: GraphNode
  edgeType: 'spouse' | 'partner' | 'ex_spouse'
}

function detectSiblingOfSpouse(a: GraphNode, b: GraphNode): SiblingOfSpouseHit | null {
  const one = oneWaySiblingOfSpouse(a, b)
  if (one) return one
  const reverse = oneWaySiblingOfSpouse(b, a)
  if (reverse) return { a: reverse.b, b: reverse.a, connector: reverse.connector, edgeType: reverse.edgeType }
  return null
}

function oneWaySiblingOfSpouse(a: GraphNode, b: GraphNode): SiblingOfSpouseHit | null {
  const tries: Array<[string[], 'spouse' | 'partner' | 'ex_spouse']> = [
    [a.spousesHe, 'spouse'], [a.partnersHe, 'partner'], [a.exSpousesHe, 'ex_spouse'],
  ]
  for (const [list, edgeType] of tries) {
    for (const connHe of list) {
      const conn = nodeByHebrew(connHe)
      if (!conn || conn.hebrew === b.hebrew) continue
      const shared = conn.parentsHe.find((p) => b.parentsHe.includes(p))
      if (shared) return { a, b, connector: conn, edgeType }
    }
  }
  return null
}

interface ParentOfSpouseHit {
  parent: GraphNode; child: GraphNode; spouse: GraphNode
  edgeType: 'spouse' | 'partner' | 'ex_spouse'
}

function detectParentOfSpouse(a: GraphNode, b: GraphNode): ParentOfSpouseHit | null {
  for (const childHe of a.childrenHe) {
    const child = nodeByHebrew(childHe)
    if (!child) continue
    if (child.spousesHe.includes(b.hebrew)) return { parent: a, child, spouse: b, edgeType: 'spouse' }
    if (child.partnersHe.includes(b.hebrew)) return { parent: a, child, spouse: b, edgeType: 'partner' }
    if (child.exSpousesHe.includes(b.hebrew)) return { parent: a, child, spouse: b, edgeType: 'ex_spouse' }
  }
  for (const childHe of b.childrenHe) {
    const child = nodeByHebrew(childHe)
    if (!child) continue
    if (child.spousesHe.includes(a.hebrew)) return { parent: b, child, spouse: a, edgeType: 'spouse' }
    if (child.partnersHe.includes(a.hebrew)) return { parent: b, child, spouse: a, edgeType: 'partner' }
    if (child.exSpousesHe.includes(a.hebrew)) return { parent: b, child, spouse: a, edgeType: 'ex_spouse' }
  }
  return null
}

interface GreatGrandparentHit {
  ancestor: GraphNode; descendant: GraphNode; mid: GraphNode; bridge: GraphNode
}

function detectGreatGrandparent(a: GraphNode, b: GraphNode): GreatGrandparentHit | null {
  // A → child → grandchild → great-grandchild = B
  for (const c1 of a.childrenHe) {
    const m = nodeByHebrew(c1)
    if (!m) continue
    for (const c2 of m.childrenHe) {
      const g = nodeByHebrew(c2)
      if (!g) continue
      if (g.childrenHe.includes(b.hebrew)) return { ancestor: a, descendant: b, mid: m, bridge: g }
    }
  }
  for (const c1 of b.childrenHe) {
    const m = nodeByHebrew(c1)
    if (!m) continue
    for (const c2 of m.childrenHe) {
      const g = nodeByHebrew(c2)
      if (!g) continue
      if (g.childrenHe.includes(a.hebrew)) return { ancestor: b, descendant: a, mid: m, bridge: g }
    }
  }
  return null
}

interface AuntUncleHit {
  auntUncle: GraphNode; nieceNephew: GraphNode; midParent: GraphNode
}

function detectAuntUncle(a: GraphNode, b: GraphNode): AuntUncleHit | null {
  // A is sibling of one of B's parents.
  for (const pHe of b.parentsHe) {
    const p = nodeByHebrew(pHe)
    if (!p) continue
    const shared = a.parentsHe.find((x) => p.parentsHe.includes(x))
    if (shared && a.hebrew !== p.hebrew) return { auntUncle: a, nieceNephew: b, midParent: p }
  }
  for (const pHe of a.parentsHe) {
    const p = nodeByHebrew(pHe)
    if (!p) continue
    const shared = b.parentsHe.find((x) => p.parentsHe.includes(x))
    if (shared && b.hebrew !== p.hebrew) return { auntUncle: b, nieceNephew: a, midParent: p }
  }
  return null
}

interface CousinHit {
  a: GraphNode; b: GraphNode; aParent: GraphNode; bParent: GraphNode; sharedGrandparent: GraphNode
}

function detectCousins(a: GraphNode, b: GraphNode): CousinHit | null {
  // A's parent and B's parent share a parent (and are not the same).
  for (const apHe of a.parentsHe) {
    const ap = nodeByHebrew(apHe)
    if (!ap) continue
    for (const bpHe of b.parentsHe) {
      const bp = nodeByHebrew(bpHe)
      if (!bp || ap.hebrew === bp.hebrew) continue
      const shared = ap.parentsHe.find((x) => bp.parentsHe.includes(x))
      if (shared) {
        const grand = nodeByHebrew(shared)
        if (grand) return { a, b, aParent: ap, bParent: bp, sharedGrandparent: grand }
      }
    }
  }
  return null
}

interface GrandchildInLawHit {
  grandparent: GraphNode; grandchild: GraphNode; spouse: GraphNode
  edgeType: 'spouse' | 'partner' | 'ex_spouse'
}

function detectGrandchildInLaw(a: GraphNode, b: GraphNode): GrandchildInLawHit | null {
  // A is spouse/partner/ex of someone whose parent is B's child
  // ⇒ A is married to B's grandchild ⇒ A is B's grandchild-in-law.
  const tries: Array<[GraphNode, GraphNode]> = [[a, b], [b, a]]
  for (const [inLaw, grand] of tries) {
    const sps: Array<[string[], 'spouse' | 'partner' | 'ex_spouse']> = [
      [inLaw.spousesHe, 'spouse'], [inLaw.partnersHe, 'partner'], [inLaw.exSpousesHe, 'ex_spouse'],
    ]
    for (const [list, edgeType] of sps) {
      for (const spHe of list) {
        const sp = nodeByHebrew(spHe)
        if (!sp) continue
        // sp must be a grandchild of grand: sp's parent is grand's child.
        for (const pHe of sp.parentsHe) {
          const p = nodeByHebrew(pHe)
          if (!p) continue
          if (grand.childrenHe.includes(p.hebrew)) {
            return { grandparent: grand, grandchild: sp, spouse: inLaw, edgeType }
          }
        }
      }
    }
  }
  return null
}

// ─── Result shapers (HE/ES/EN, gender-aware) ──────────────────────────────

function dispAll(a: GraphNode, b: GraphNode, lang: Lang): { A: string; B: string } {
  return { A: displayName(a, lang), B: displayName(b, lang) }
}

function notFound(people: [string, string], lang: Lang): RelationResult {
  const [a, b] = people
  return {
    type: 'no_direct_relation_found', confidence: 'not_found',
    people, connectorPath: [], facts: [],
    he: `לא מצאתי קשר ישיר בין ${a} ל${b}.`,
    es: `No encontré una relación directa entre ${a} y ${b}.`,
    en: `I did not find a direct relation between ${a} and ${b}.`,
  }
}

function resultSpouse(a: GraphNode, b: GraphNode, lang: Lang): RelationResult {
  const { A, B } = dispAll(a, b, lang)
  return {
    type: 'spouse', confidence: 'derived_from_explicit_data',
    people: [A, B], connectorPath: [a.hebrew, b.hebrew],
    facts: [`${displayName(a, 'en')} is married to ${displayName(b, 'en')}`],
    he: `${A} ו${B} נשואים.`,
    es: `${A} y ${B} están casados.`,
    en: `${A} and ${B} are married.`,
  }
}

function resultPartner(a: GraphNode, b: GraphNode, lang: Lang): RelationResult {
  const { A, B } = dispAll(a, b, lang)
  return {
    type: 'partner', confidence: 'derived_from_explicit_data',
    people: [A, B], connectorPath: [a.hebrew, b.hebrew],
    facts: [`${displayName(a, 'en')} and ${displayName(b, 'en')} are partners`],
    he: `${A} ו${B} בני זוג.`,
    es: `${A} y ${B} son pareja.`,
    en: `${A} and ${B} are partners.`,
  }
}

function resultExSpouse(a: GraphNode, b: GraphNode, lang: Lang): RelationResult {
  const { A, B } = dispAll(a, b, lang)
  return {
    type: 'ex_spouse', confidence: 'derived_from_explicit_data',
    people: [A, B], connectorPath: [a.hebrew, b.hebrew],
    facts: [`${displayName(a, 'en')} and ${displayName(b, 'en')} are divorced`],
    he: `${A} ו${B} גרושים.`,
    es: `${A} y ${B} están divorciados.`,
    en: `${A} and ${B} are divorced.`,
  }
}

function resultParentChild(parent: GraphNode, child: GraphNode, lang: Lang): RelationResult {
  const P = displayName(parent, lang), C = displayName(child, lang)
  const labelHe = parent.gender === 'female' ? 'האמא' : parent.gender === 'male' ? 'האבא' : 'ההורה'
  const labelEs = parent.gender === 'female' ? 'madre' : parent.gender === 'male' ? 'padre' : 'progenitor/a'
  const labelEn = parent.gender === 'female' ? 'mother' : parent.gender === 'male' ? 'father' : 'parent'
  return {
    type: parent.hebrew === parent.hebrew ? 'parent' : 'child',
    confidence: 'derived_from_explicit_data',
    people: [P, C], connectorPath: [parent.hebrew, child.hebrew],
    facts: [`${displayName(parent, 'en')} is the ${labelEn} of ${displayName(child, 'en')}`],
    he: `${P} ${labelHe} של ${C}.`,
    es: `${P} es ${labelEs} de ${C}.`,
    en: `${P} is the ${labelEn} of ${C}.`,
  }
}

function resultSibling(a: GraphNode, b: GraphNode, parent: GraphNode | null, lang: Lang): RelationResult {
  const A = displayName(a, lang), B = displayName(b, lang)
  const P = parent ? displayName(parent, lang) : null
  const bothFemale = a.gender === 'female' && b.gender === 'female'

  // Hebrew: agreement on the noun + on the demonstrative.
  let he: string
  if (P) {
    const noun = bothFemale ? 'אחיות' : 'אחים'
    const demon = bothFemale ? 'שתיהן' : 'שניהם'
    const kidWord = bothFemale ? 'הבנות' : 'הילדים'
    he = `${A} ו${B} ${noun}, ${demon} ${kidWord} של ${P}.`
  } else {
    const each = a.gender === 'female' ? 'אחות' : 'אח'
    he = `${A} ה${each} של ${B}.`
  }

  let es: string
  if (P) {
    const plural = bothFemale ? 'hermanas' : 'hermanos'
    const childrenWord = bothFemale ? 'hijas' : 'hijos'
    es = `${A} y ${B} son ${plural}, ambos ${childrenWord} de ${P}.`
  } else {
    const plural = bothFemale ? 'hermanas' : 'hermanos'
    es = `${A} y ${B} son ${plural}.`
  }

  const en = P
    ? `${A} and ${B} are siblings, both children of ${P}.`
    : `${A} and ${B} are siblings.`

  const facts: string[] = []
  if (parent) facts.push(`${displayName(parent, 'en')} is the parent of both ${displayName(a, 'en')} and ${displayName(b, 'en')}`)
  return {
    type: 'sibling', confidence: 'derived_from_explicit_data',
    people: [A, B], connectorPath: parent ? [a.hebrew, parent.hebrew, b.hebrew] : [a.hebrew, b.hebrew],
    facts, he, es, en,
  }
}

function resultSiblingOfSpouse(hit: SiblingOfSpouseHit, lang: Lang): RelationResult {
  const { a, b, connector, edgeType } = hit
  const A = displayName(a, lang), B = displayName(b, lang), C = displayName(connector, lang)
  const isFormer = edgeType === 'ex_spouse'
  const isPartner = edgeType === 'partner'
  const bothFemale = a.gender === 'female' && b.gender === 'female'

  // Hebrew label + half-sentences (subject agreement with A; connector role uses connector gender).
  const labelHeBase = bothFemale ? 'גיסות' : 'גיסים'
  const labelHe = isFormer ? `${labelHeBase} לשעבר` : labelHeBase
  let half1He: string
  if (isPartner) {
    half1He = a.gender === 'female' ? `${A} בת הזוג של ${C}` : `${A} בן הזוג של ${C}`
  } else {
    half1He = a.gender === 'female'
      ? (isFormer ? `${A} הייתה נשואה ל${C}` : `${A} נשואה ל${C}`)
      : (isFormer ? `${A} היה נשוי ל${C}` : `${A} נשוי ל${C}`)
  }
  const connRoleHe = connector.gender === 'female' ? 'אחות' : 'אח'
  const copulaHe = connector.gender === 'female' ? 'היא' : 'הוא'
  const half2He = `${C} ${copulaHe} ${connRoleHe} של ${B}`
  const he = `${A} ו${B} ${labelHe}: ${half1He}, ו${half2He}.`

  const labelEsBase = bothFemale ? 'cuñadas' : 'cuñados'
  const labelEs = isFormer ? `fueron ${labelEsBase}` : `son ${labelEsBase}`
  const half1Es = isPartner
    ? `${A} ${a.gender === 'female' ? 'es pareja' : 'es pareja'} de ${C}`
    : (a.gender === 'female'
        ? (isFormer ? `${A} estuvo casada con ${C}` : `${A} está casada con ${C}`)
        : (isFormer ? `${A} estuvo casado con ${C}` : `${A} está casado con ${C}`))
  const connRoleEs = connector.gender === 'female' ? 'hermana' : 'hermano'
  const half2Es = `${C} es ${connRoleEs} de ${B}`
  const es = `${A} y ${B} ${labelEs}: ${half1Es}, y ${half2Es}.`

  const labelEnBase = bothFemale ? 'sisters-in-law' : 'brothers-in-law'
  const labelEn = isFormer ? `former ${labelEnBase}` : labelEnBase
  const verbBe = isFormer ? 'were' : 'are'
  const half1En = isPartner
    ? `${A} is the partner of ${C}`
    : (isFormer ? `${A} was married to ${C}` : `${A} is married to ${C}`)
  const connRoleEn = connector.gender === 'female' ? 'sister' : 'brother'
  const half2En = `${C} is ${B}'s ${connRoleEn}`
  const en = `${A} and ${B} ${verbBe} ${labelEn}: ${half1En}, and ${half2En}.`

  const type: RelationType = isFormer
    ? (bothFemale ? 'former_sister_in_law' : 'former_brother_in_law')
    : (bothFemale ? 'sister_in_law' : 'brother_in_law')
  return {
    type, confidence: 'derived_from_explicit_data',
    people: [A, B], connectorPath: [a.hebrew, connector.hebrew, b.hebrew],
    facts: [
      `${displayName(a, 'en')} ${isFormer ? 'was married to' : isPartner ? 'is partner of' : 'is married to'} ${displayName(connector, 'en')}`,
      `${displayName(connector, 'en')} is ${displayName(b, 'en')}'s ${connRoleEn}`,
    ],
    he, es, en,
  }
}

function resultParentOfSpouse(hit: ParentOfSpouseHit, lang: Lang): RelationResult {
  const { parent, child, spouse, edgeType } = hit
  const P = displayName(parent, lang), C = displayName(child, lang), S = displayName(spouse, lang)
  const isFormer = edgeType === 'ex_spouse'
  const isPartner = edgeType === 'partner'

  // Hebrew copula agrees with the CHILD (the subject of "married to spouse").
  const childGender = child.gender
  const verbHe = isPartner
    ? (childGender === 'female' ? 'בת הזוג של' : 'בן הזוג של')
    : (childGender === 'female'
        ? (isFormer ? 'הייתה נשואה ל' : 'נשואה ל')
        : (isFormer ? 'היה נשוי ל' : 'נשוי ל'))
  const parentLabelHe = parent.gender === 'female' ? 'האמא' : parent.gender === 'male' ? 'האבא' : 'ההורה'
  const he = `${P} ${parentLabelHe} של ${C}, ו${C} ${verbHe}${verbHe.endsWith('ל') ? '' : ' '}${S}.`

  const childGenderEs = childGender === 'female' ? 'casada' : 'casado'
  const parentLabelEs = parent.gender === 'female' ? 'madre' : parent.gender === 'male' ? 'padre' : 'progenitor/a'
  const verbEs = isPartner
    ? 'es pareja de'
    : (isFormer ? `estuvo ${childGenderEs} con` : `está ${childGenderEs} con`)
  const es = `${P} es ${parentLabelEs} de ${C}, y ${C} ${verbEs} ${S}.`

  const parentLabelEn = parent.gender === 'female' ? 'mother' : parent.gender === 'male' ? 'father' : 'parent'
  const verbEn = isPartner ? 'is the partner of' : (isFormer ? 'was married to' : 'is married to')
  const en = `${P} is the ${parentLabelEn} of ${C}, and ${C} ${verbEn} ${S}.`

  // Type label depends on which side asked: A is the in-law to B's
  // family. The caller doesn't pin A vs B here — we name the relation
  // from `spouse`'s perspective: spouse is mother/father-in-law of
  // the parent's side, OR son/daughter-in-law from parent's side. We
  // pick the in-law-of-child type by spouse gender.
  const type: RelationType = isFormer
    ? (spouse.gender === 'female' ? 'former_daughter_in_law' : 'former_son_in_law')
    : (spouse.gender === 'female' ? 'daughter_in_law' : 'son_in_law')
  return {
    type, confidence: 'derived_from_explicit_data',
    people: [P, S], connectorPath: [parent.hebrew, child.hebrew, spouse.hebrew],
    facts: [
      `${displayName(parent, 'en')} is the ${parentLabelEn} of ${displayName(child, 'en')}`,
      `${displayName(child, 'en')} ${verbEn} ${displayName(spouse, 'en')}`,
    ],
    he, es, en,
  }
}

function resultGrandparent(grand: GraphNode, child: GraphNode, mid: GraphNode, lang: Lang, _flip = false): RelationResult {
  const G = displayName(grand, lang), C = displayName(child, lang), M = displayName(mid, lang)
  const roleHe = grand.gender === 'female' ? 'הסבתא' : grand.gender === 'male' ? 'הסבא' : 'הסב/ה'
  const roleEs = grand.gender === 'female' ? 'abuela' : grand.gender === 'male' ? 'abuelo' : 'abuelo/a'
  const roleEn = grand.gender === 'female' ? 'grandmother' : grand.gender === 'male' ? 'grandfather' : 'grandparent'
  return {
    type: 'grandparent', confidence: 'derived_from_explicit_data',
    people: [G, C], connectorPath: [grand.hebrew, mid.hebrew, child.hebrew],
    facts: [
      `${displayName(grand, 'en')} is the parent of ${displayName(mid, 'en')}`,
      `${displayName(mid, 'en')} is the parent of ${displayName(child, 'en')}`,
    ],
    he: `${G} ${roleHe} של ${C} (דרך ${M}).`,
    es: `${G} es ${roleEs} de ${C} (a través de ${M}).`,
    en: `${G} is the ${roleEn} of ${C} (through ${M}).`,
  }
}

function resultGreatGrandparent(hit: GreatGrandparentHit, lang: Lang): RelationResult {
  const G = displayName(hit.ancestor, lang)
  const D = displayName(hit.descendant, lang)
  const M = displayName(hit.mid, lang)
  const B = displayName(hit.bridge, lang)
  const roleHe = hit.ancestor.gender === 'female' ? 'סבתא רבא' : hit.ancestor.gender === 'male' ? 'סבא רבא' : 'סב/ה רבא'
  const roleEs = hit.ancestor.gender === 'female' ? 'bisabuela' : hit.ancestor.gender === 'male' ? 'bisabuelo' : 'bisabuelo/a'
  const roleEn = hit.ancestor.gender === 'female' ? 'great-grandmother' : hit.ancestor.gender === 'male' ? 'great-grandfather' : 'great-grandparent'
  return {
    type: 'great_grandparent', confidence: 'derived_from_explicit_data',
    people: [G, D], connectorPath: [hit.ancestor.hebrew, hit.mid.hebrew, hit.bridge.hebrew, hit.descendant.hebrew],
    facts: [
      `${displayName(hit.ancestor, 'en')} is the parent of ${displayName(hit.mid, 'en')}`,
      `${displayName(hit.mid, 'en')} is the parent of ${displayName(hit.bridge, 'en')}`,
      `${displayName(hit.bridge, 'en')} is the parent of ${displayName(hit.descendant, 'en')}`,
    ],
    he: `${G} ה${roleHe} של ${D} (דרך ${M} ו${B}).`,
    es: `${G} es ${roleEs} de ${D} (a través de ${M} y ${B}).`,
    en: `${G} is the ${roleEn} of ${D} (through ${M} and ${B}).`,
  }
}

function resultAuntUncle(hit: AuntUncleHit, lang: Lang): RelationResult {
  const A = displayName(hit.auntUncle, lang)
  const N = displayName(hit.nieceNephew, lang)
  const M = displayName(hit.midParent, lang)
  const auntUncleHe = hit.auntUncle.gender === 'female' ? 'דודה' : hit.auntUncle.gender === 'male' ? 'דוד' : 'דוד/ה'
  const auntUncleEs = hit.auntUncle.gender === 'female' ? 'tía' : hit.auntUncle.gender === 'male' ? 'tío' : 'tío/a'
  const auntUncleEn = hit.auntUncle.gender === 'female' ? 'aunt' : hit.auntUncle.gender === 'male' ? 'uncle' : 'aunt/uncle'
  // Sibling word in the parenthetical agrees with the aunt/uncle's gender
  // (since they are the sibling of the mid-parent).
  const siblingWordHe = hit.auntUncle.gender === 'female' ? 'אחות' : hit.auntUncle.gender === 'male' ? 'אח' : 'אח/ות'
  const siblingWordEs = hit.auntUncle.gender === 'female' ? 'hermana' : hit.auntUncle.gender === 'male' ? 'hermano' : 'hermano/a'
  return {
    type: 'uncle_aunt', confidence: 'derived_from_explicit_data',
    people: [A, N], connectorPath: [hit.auntUncle.hebrew, hit.midParent.hebrew, hit.nieceNephew.hebrew],
    facts: [
      `${displayName(hit.auntUncle, 'en')} is the sibling of ${displayName(hit.midParent, 'en')}`,
      `${displayName(hit.midParent, 'en')} is the parent of ${displayName(hit.nieceNephew, 'en')}`,
    ],
    he: `${A} ה${auntUncleHe} של ${N} (${siblingWordHe} של ${M}).`,
    es: `${A} es ${auntUncleEs} de ${N} (${siblingWordEs} de ${M}).`,
    en: `${A} is the ${auntUncleEn} of ${N} (sibling of ${M}).`,
  }
}

function resultCousins(hit: CousinHit, lang: Lang): RelationResult {
  const A = displayName(hit.a, lang)
  const B = displayName(hit.b, lang)
  const G = displayName(hit.sharedGrandparent, lang)
  return {
    type: 'cousin', confidence: 'derived_from_explicit_data',
    people: [A, B],
    connectorPath: [hit.a.hebrew, hit.aParent.hebrew, hit.sharedGrandparent.hebrew, hit.bParent.hebrew, hit.b.hebrew],
    facts: [
      `${displayName(hit.aParent, 'en')} and ${displayName(hit.bParent, 'en')} are siblings`,
      `${displayName(hit.sharedGrandparent, 'en')} is the grandparent of both`,
    ],
    he: `${A} ו${B} בני דודים (הנכדים של ${G}).`,
    es: `${A} y ${B} son primos (nietos de ${G}).`,
    en: `${A} and ${B} are cousins (grandchildren of ${G}).`,
  }
}

function resultGrandchildInLaw(hit: GrandchildInLawHit, lang: Lang): RelationResult {
  const I = displayName(hit.spouse, lang)
  const G = displayName(hit.grandparent, lang)
  const C = displayName(hit.grandchild, lang)
  const isFormer = hit.edgeType === 'ex_spouse'
  const isPartner = hit.edgeType === 'partner'

  // Hebrew: there is no single-word standard. Use a clear two-clause sentence.
  const verbHe = isPartner
    ? (hit.spouse.gender === 'female' ? 'בת הזוג של' : 'בן הזוג של')
    : (hit.spouse.gender === 'female'
        ? (isFormer ? 'הייתה נשואה ל' : 'נשואה ל')
        : (isFormer ? 'היה נשוי ל' : 'נשוי ל'))
  const grandRoleHe = hit.grandparent.gender === 'female' ? 'הסבתא' : hit.grandparent.gender === 'male' ? 'הסבא' : 'הסב/ה'
  const he = `${I} ${verbHe}${verbHe.endsWith('ל') ? '' : ' '}${C}, ש${hit.grandchild.gender === 'female' ? 'היא הנכדה' : 'הוא הנכד'} של ${G}.`

  const verbEs = isPartner ? 'es pareja de' : (isFormer ? `estuvo ${hit.spouse.gender === 'female' ? 'casada' : 'casado'} con` : `está ${hit.spouse.gender === 'female' ? 'casada' : 'casado'} con`)
  const grandRoleEs = hit.grandparent.gender === 'female' ? 'abuela' : hit.grandparent.gender === 'male' ? 'abuelo' : 'abuelo/a'
  const grandchildRoleEs = hit.grandchild.gender === 'female' ? 'nieta' : 'nieto'
  const es = `${I} ${verbEs} ${C}, que es ${grandchildRoleEs} de ${G}.`

  const verbEn = isPartner ? 'is the partner of' : (isFormer ? 'was married to' : 'is married to')
  const grandRoleEn = hit.grandparent.gender === 'female' ? 'grandmother' : hit.grandparent.gender === 'male' ? 'grandfather' : 'grandparent'
  const grandchildRoleEn = hit.grandchild.gender === 'female' ? 'granddaughter' : 'grandson'
  const en = `${I} ${verbEn} ${C}, who is ${G}'s ${grandchildRoleEn}.`

  // Side-step: the variable names above use `grandRoleHe/Es/En` but in the
  // sentence we explicitly use "הנכד/ה של G" / "nieto/a de G" / "G's
  // grandson/granddaughter" instead. Ignore unused locals.
  void grandRoleHe; void grandRoleEs; void grandRoleEn

  return {
    type: isFormer ? 'grandchild_in_law' : 'grandchild_in_law',
    confidence: 'derived_from_explicit_data',
    people: [I, G], connectorPath: [hit.spouse.hebrew, hit.grandchild.hebrew, hit.grandparent.hebrew],
    facts: [
      `${displayName(hit.spouse, 'en')} ${verbEn} ${displayName(hit.grandchild, 'en')}`,
      `${displayName(hit.grandchild, 'en')} is the ${grandchildRoleEn} of ${displayName(hit.grandparent, 'en')}`,
    ],
    he, es, en,
  }
}
