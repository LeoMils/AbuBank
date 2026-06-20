/*
 * AbuAI B2.4.1 — Semantic family relationship resolver.
 *
 * Loads knowledge/family_data.json into a small in-memory family graph,
 * then answers two-name relationship questions with a HUMAN kinship
 * label, not a generic graph-database path.
 *
 *   Bad  : "Rafi is connected to Leo through Mor."
 *   Good : "Rafi and Leo were former brothers-in-law: Rafi was married
 *           to Mor, and Mor is Leo's sister."
 *
 * Truth Contract: returns null when no representable path exists; the
 * caller surfaces an honest "no direct relation found" string. Never
 * invents a relation, never fabricates a name.
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
  /** ALL names this node answers to, lowercased: canonical + hebrew + aliases. */
  matchNames: string[]
  /** Hebrew names of children. */
  childrenHe: string[]
  /** Hebrew names of (current) parents — built bidirectionally during load. */
  parentsHe: string[]
  /** Hebrew names of current spouse(s); symmetric. */
  spousesHe: string[]
  /** Hebrew names of current partner(s); symmetric. */
  partnersHe: string[]
  /** Hebrew names of ex-spouse(s); symmetric. */
  exSpousesHe: string[]
  /** "son" / "daughter" / "matriarch" / "ex_son_in_law" / etc. — verbatim. */
  role: string
  gender: Gender
}

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

  // ── Backfill family-level parent edges that the JSON only encodes
  //    structurally (i.e., "children" arrays under matriarch / parents).
  //
  // The JSON places Mor and Leo under family.children[] (their parent
  // is the matriarch). It also places grandchildren under
  // family.grandchildren_mor / _leo (their parents are Mor / Leo and,
  // for Mor's side, Rafi as the ex-husband/father). great_grandchildren
  // are children of Ofir + Gilad. Make every relation explicit so the
  // resolver can walk parents-of and siblings.
  const f = familyRaw.family as Record<string, unknown>
  const matriarchRaw = f['matriarch'] as RawMember | undefined
  if (matriarchRaw) {
    const matriarch = byHe.get(matriarchRaw.hebrew_name)
    const matriarchKids = (f['children'] as RawMember[] | undefined ?? []).map((c) => c.hebrew_name)
    if (matriarch) matriarch.childrenHe.push(...matriarchKids)
  }

  // Rafi is the father of Mor's children (per his notes), even though
  // his record does not enumerate them. Add the edge so siblings-via-
  // common-parent resolves correctly for grandchild ↔ grandchild and
  // for in-law detection.
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

  // ── Make every relational edge symmetric.
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

/** Look up a node by ANY known name (canonical / Hebrew / alias). */
export function findNode(name: string): GraphNode | null {
  const q = name.trim().toLowerCase()
  if (!q) return null
  for (const n of loadGraph()) {
    if (n.matchNames.includes(q)) return n
  }
  const first = q.split(/[\s,?¿!.]+/)[0] ?? ''
  if (first && first !== q) {
    for (const n of loadGraph()) {
      if (n.matchNames.includes(first)) return n
    }
  }
  return null
}

function nodeByHebrew(he: string): GraphNode | null {
  if (!_byHebrew) loadGraph()
  return _byHebrew!.get(he) ?? null
}

/** Preferred display name for a node in the target language.
 *  Hebrew always uses the Hebrew name. Spanish/English prefer the first
 *  Latin-script alias if present (so "רפי" → "Rafi", not "Raphi"),
 *  falling back to the canonical name. */
export type Lang = 'he' | 'es' | 'en'

export function displayName(n: GraphNode, lang: Lang): string {
  if (lang === 'he') return n.hebrew
  const latinAlias = n.aliases.find((a) => /^[A-Za-z]/.test(a))
  return latinAlias ?? n.canonical
}

// ─── Resolver ──────────────────────────────────────────────────────────────

export function describeRelation(aQuery: string, bQuery: string, lang: Lang): string | null {
  const a = findNode(aQuery)
  const b = findNode(bQuery)
  if (!a || !b || a.hebrew === b.hebrew) return null

  // 1) Direct spouse / partner / ex-spouse.
  if (a.spousesHe.includes(b.hebrew)) return phraseSpouse(a, b, lang)
  if (a.partnersHe.includes(b.hebrew)) return phrasePartner(a, b, lang)
  if (a.exSpousesHe.includes(b.hebrew)) return phraseExSpouse(a, b, lang)

  // 2) Parent ↔ child.
  if (a.childrenHe.includes(b.hebrew)) return phraseParentChild(a, b, lang)
  if (b.childrenHe.includes(a.hebrew)) return phraseParentChild(b, a, lang)

  // 3) Siblings (share at least one parent).
  const shared = a.parentsHe.find((p) => b.parentsHe.includes(p))
  if (shared) {
    const parentNode = nodeByHebrew(shared)
    return phraseSiblings(a, b, parentNode, lang)
  }

  // 4) In-law via spouse/ex-spouse/partner of one, who is the SIBLING
  //    of the other. This is the Rafi ↔ Leo case (Rafi is Mor's ex,
  //    Leo is Mor's brother → former brothers-in-law).
  const inLaw = detectSiblingOfSpouse(a, b)
  if (inLaw) return phraseSiblingOfSpouse(inLaw, lang)

  // 5) Parent-of-spouse (mother/father-in-law) or spouse-of-child.
  const parentOfSpouse = detectParentOfSpouse(a, b)
  if (parentOfSpouse) return phraseParentOfSpouse(parentOfSpouse, lang)

  // 6) Aunt / uncle: A is a sibling of a parent of B (or vice versa).
  const auntUncle = detectAuntUncle(a, b)
  if (auntUncle) return phraseAuntUncle(auntUncle, lang)

  // 7) First cousins: a parent of A and a parent of B are siblings.
  const cousins = detectCousins(a, b)
  if (cousins) return phraseCousins(cousins, lang)

  // 8) Ancestor ↔ descendant at any depth (grandparent at 2 hops,
  //    great-grandparent at 3, …). Generalizes the old one-hop walk so
  //    Martita ↔ great-grandchild resolves instead of returning null.
  const aAncOfB = findAncestor(b, a)
  if (aAncOfB) return phraseAncestor(a, b, aAncOfB.mid, aAncOfB.distance, lang)
  const bAncOfA = findAncestor(a, b)
  if (bAncOfA) return phraseAncestor(b, a, bAncOfA.mid, bAncOfA.distance, lang)

  return null
}

// ─── Generation / collateral detectors ─────────────────────────────────────

interface AuntUncleHit {
  /** The aunt or uncle. */
  auntUncle: GraphNode
  /** The niece or nephew. */
  nephew: GraphNode
  /** The connecting parent (auntUncle's sibling, nephew's parent). */
  via: GraphNode
}

/** A is aunt/uncle of B when A shares a parent with one of B's parents. */
function detectAuntUncle(a: GraphNode, b: GraphNode): AuntUncleHit | null {
  const oneWay = (x: GraphNode, y: GraphNode): AuntUncleHit | null => {
    for (const pHe of y.parentsHe) {
      if (pHe === x.hebrew) continue
      const p = nodeByHebrew(pHe)
      if (!p) continue
      const shared = x.parentsHe.find((q) => p.parentsHe.includes(q))
      if (shared) return { auntUncle: x, nephew: y, via: p }
    }
    return null
  }
  return oneWay(a, b) ?? oneWay(b, a)
}

interface CousinHit {
  a: GraphNode
  b: GraphNode
  /** A's parent and B's parent, who are siblings. */
  via1: GraphNode
  via2: GraphNode
}

/** A and B are first cousins when a parent of A and a parent of B are siblings. */
function detectCousins(a: GraphNode, b: GraphNode): CousinHit | null {
  for (const paHe of a.parentsHe) {
    for (const pbHe of b.parentsHe) {
      if (paHe === pbHe) continue
      const pa = nodeByHebrew(paHe)
      const pb = nodeByHebrew(pbHe)
      if (!pa || !pb) continue
      const shared = pa.parentsHe.find((q) => pb.parentsHe.includes(q))
      if (shared) return { a, b, via1: pa, via2: pb }
    }
  }
  return null
}

/** Walk up B's parent edges to find ancestor A; return generational distance
 *  (1 = parent, 2 = grandparent, 3 = great-grandparent) and the ancestor's
 *  direct child on the path (for "דרך X" phrasing). */
function findAncestor(descendant: GraphNode, ancestor: GraphNode): { distance: number; mid: GraphNode } | null {
  const targetHe = ancestor.hebrew
  const visited = new Set<string>([descendant.hebrew])
  const cameFrom = new Map<string, string>() // parentHe → child-on-path
  let frontier: Array<{ he: string; dist: number }> = [{ he: descendant.hebrew, dist: 0 }]
  while (frontier.length) {
    const next: Array<{ he: string; dist: number }> = []
    for (const cur of frontier) {
      const node = nodeByHebrew(cur.he)
      if (!node) continue
      for (const pHe of node.parentsHe) {
        if (visited.has(pHe)) continue
        visited.add(pHe)
        cameFrom.set(pHe, cur.he)
        if (pHe === targetHe) {
          const mid = nodeByHebrew(cameFrom.get(targetHe)!)
          return mid ? { distance: cur.dist + 1, mid } : null
        }
        next.push({ he: pHe, dist: cur.dist + 1 })
      }
    }
    frontier = next
  }
  return null
}

// ─── Pattern detectors ─────────────────────────────────────────────────────

interface SiblingOfSpouseHit {
  /** The person whose spouse/partner/ex is the other's sibling. */
  a: GraphNode
  /** The other person — sibling of the connector. */
  b: GraphNode
  /** The connector — A's (ex-)spouse/partner AND B's sibling. */
  connector: GraphNode
  edgeType: 'spouse' | 'partner' | 'ex_spouse'
}

function detectSiblingOfSpouse(a: GraphNode, b: GraphNode): SiblingOfSpouseHit | null {
  // Look at A's spouse/partner/ex; if any of them shares a parent with B,
  // A and B are (former) brothers-/sisters-in-law.
  const tries: Array<[string[], 'spouse' | 'partner' | 'ex_spouse']> = [
    [a.spousesHe, 'spouse'],
    [a.partnersHe, 'partner'],
    [a.exSpousesHe, 'ex_spouse'],
  ]
  for (const [list, edgeType] of tries) {
    for (const connHe of list) {
      const conn = nodeByHebrew(connHe)
      if (!conn) continue
      // conn must be a SIBLING of B (share a parent), not B itself.
      if (conn.hebrew === b.hebrew) continue
      const shared = conn.parentsHe.find((p) => b.parentsHe.includes(p))
      if (shared) return { a, b, connector: conn, edgeType }
    }
  }
  // Symmetric check: B's (ex-)spouse is A's sibling.
  const reverse = detectSiblingOfSpouseOneWay(b, a)
  return reverse
}

function detectSiblingOfSpouseOneWay(a: GraphNode, b: GraphNode): SiblingOfSpouseHit | null {
  const tries: Array<[string[], 'spouse' | 'partner' | 'ex_spouse']> = [
    [a.spousesHe, 'spouse'],
    [a.partnersHe, 'partner'],
    [a.exSpousesHe, 'ex_spouse'],
  ]
  for (const [list, edgeType] of tries) {
    for (const connHe of list) {
      const conn = nodeByHebrew(connHe)
      if (!conn) continue
      if (conn.hebrew === b.hebrew) continue
      const shared = conn.parentsHe.find((p) => b.parentsHe.includes(p))
      if (shared) return { a, b, connector: conn, edgeType }
    }
  }
  return null
}

interface ParentOfSpouseHit {
  parent: GraphNode
  child: GraphNode
  spouse: GraphNode
  /** Whether the spouse edge is current or ex. */
  edgeType: 'spouse' | 'partner' | 'ex_spouse'
}

function detectParentOfSpouse(a: GraphNode, b: GraphNode): ParentOfSpouseHit | null {
  // A is parent of someone whose (ex-)spouse is B; or vice versa.
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

// ─── Phrase shapers (semantic, kinship-labelled) ───────────────────────────

function phraseSpouse(a: GraphNode, b: GraphNode, lang: Lang): string {
  const A = displayName(a, lang), B = displayName(b, lang)
  if (lang === 'es') return `${A} y ${B} están casados.`
  if (lang === 'en') return `${A} and ${B} are married.`
  return `${A} ו${B} נשואים.`
}

function phrasePartner(a: GraphNode, b: GraphNode, lang: Lang): string {
  const A = displayName(a, lang), B = displayName(b, lang)
  if (lang === 'es') return `${A} y ${B} son pareja.`
  if (lang === 'en') return `${A} and ${B} are partners.`
  return `${A} ו${B} בני זוג.`
}

function phraseExSpouse(a: GraphNode, b: GraphNode, lang: Lang): string {
  const A = displayName(a, lang), B = displayName(b, lang)
  if (lang === 'es') return `${A} y ${B} están divorciados.`
  if (lang === 'en') return `${A} and ${B} are divorced.`
  return `${A} ו${B} גרושים.`
}

function phraseParentChild(parent: GraphNode, child: GraphNode, lang: Lang): string {
  const P = displayName(parent, lang), C = displayName(child, lang)
  const parentLabel = lang === 'he'
    ? (parent.gender === 'female' ? 'אמא' : parent.gender === 'male' ? 'אבא' : 'הורה')
    : lang === 'es'
      ? (parent.gender === 'female' ? 'madre' : parent.gender === 'male' ? 'padre' : 'progenitor/a')
      : (parent.gender === 'female' ? 'mother' : parent.gender === 'male' ? 'father' : 'parent')
  if (lang === 'es') return `${P} es ${parentLabel} de ${C}.`
  if (lang === 'en') return `${P} is the ${parentLabel} of ${C}.`
  return `${P} ה${parentLabel} של ${C}.`
}

function phraseSiblings(a: GraphNode, b: GraphNode, parent: GraphNode | null, lang: Lang): string {
  const A = displayName(a, lang), B = displayName(b, lang)
  const P = parent ? displayName(parent, lang) : null

  // Hebrew: gender-aware sibling label.
  if (lang === 'he') {
    const both = a.gender === 'female' && b.gender === 'female' ? 'אחיות' : 'אחים'
    const each = a.gender === 'female' ? 'אחות' : 'אח'
    // "A is B's sibling" — directed phrasing for the second half.
    if (P) return `${A} ו${B} ${both}, שניהם הילדים של ${P}.`
    return `${A} ה${each} של ${B}.`
  }

  if (lang === 'es') {
    const plural = a.gender === 'female' && b.gender === 'female' ? 'hermanas' : 'hermanos'
    if (P) return `${A} y ${B} son ${plural}, ambos hijos de ${P}.`
    return `${A} y ${B} son ${plural}.`
  }

  // English
  if (P) return `${A} and ${B} are siblings, both children of ${P}.`
  return `${A} and ${B} are siblings.`
}

function phraseSiblingOfSpouse(hit: SiblingOfSpouseHit, lang: Lang): string {
  // Build the kinship label. Plural form by default (pair). Use male
  // plural when at least one is male, female plural when both female.
  const { a, b, connector, edgeType } = hit
  const A = displayName(a, lang), B = displayName(b, lang), C = displayName(connector, lang)
  const isFormer = edgeType === 'ex_spouse'
  const verbBe = isFormer ? 'were' : 'are'

  // Hebrew: גיסים / גיסות / גיסים לשעבר / גיסות לשעבר.
  if (lang === 'he') {
    const bothFemale = a.gender === 'female' && b.gender === 'female'
    const labelBase = bothFemale ? 'גיסות' : 'גיסים'
    const label = isFormer ? `${labelBase} לשעבר` : labelBase
    // Half 1: A was/is married/in-partnership-with connector.
    const half1 = edgeType === 'partner'
      ? `${A} ובת/בן זוג של ${C}`
      : (a.gender === 'female'
          ? (isFormer ? `${A} הייתה נשואה ל${C}` : `${A} נשואה ל${C}`)
          : (isFormer ? `${A} היה נשוי ל${C}` : `${A} נשוי ל${C}`))
    // Half 2: connector is B's sister/brother (gender of connector,
    // indefinite — "אחות של לאו", not "האחות של לאו" — matches the
    // way a person would actually say it).
    const connRole = connector.gender === 'female' ? 'אחות' : 'אח'
    const copula = connector.gender === 'female' ? 'היא' : 'הוא'
    const half2 = `${C} ${copula} ${connRole} של ${B}`
    return `${A} ו${B} ${label}: ${half1}, ו${half2}.`
  }

  if (lang === 'es') {
    const bothFemale = a.gender === 'female' && b.gender === 'female'
    const labelBase = bothFemale ? 'cuñadas' : 'cuñados'
    const label = isFormer ? `fueron ${labelBase}` : `son ${labelBase}`
    const half1 = edgeType === 'partner'
      ? `${A} fue/es pareja de ${C}`
      : (a.gender === 'female'
          ? (isFormer ? `${A} estuvo casada con ${C}` : `${A} está casada con ${C}`)
          : (isFormer ? `${A} estuvo casado con ${C}` : `${A} está casado con ${C}`))
    const connRole = connector.gender === 'female' ? 'hermana' : 'hermano'
    const half2 = `${C} es ${connRole} de ${B}`
    return `${A} y ${B} ${label}: ${half1}, y ${half2}.`
  }

  // English
  const bothFemale = a.gender === 'female' && b.gender === 'female'
  const labelBase = bothFemale ? 'sisters-in-law' : 'brothers-in-law'
  const label = isFormer ? `former ${labelBase}` : labelBase
  const half1 = edgeType === 'partner'
    ? `${A} was/is the partner of ${C}`
    : (isFormer ? `${A} was married to ${C}` : `${A} is married to ${C}`)
  const connRole = connector.gender === 'female' ? 'sister' : 'brother'
  const half2 = `${C} is ${B}'s ${connRole}`
  return `${A} and ${B} ${verbBe} ${label}: ${half1}, and ${half2}.`
}

function phraseParentOfSpouse(hit: ParentOfSpouseHit, lang: Lang): string {
  const { parent, child, spouse, edgeType } = hit
  const P = displayName(parent, lang), C = displayName(child, lang), S = displayName(spouse, lang)
  const isFormer = edgeType === 'ex_spouse'

  if (lang === 'he') {
    const childRole = child.gender === 'female' ? 'הבת' : 'הבן'
    const verb = edgeType === 'partner'
      ? 'בת/בן הזוג של'
      : (spouse.gender === 'female'
          ? (isFormer ? 'הייתה נשואה ל' : 'נשואה ל')
          : (isFormer ? 'היה נשוי ל' : 'נשוי ל'))
    return `${P} ${parent.gender === 'female' ? 'אמא' : parent.gender === 'male' ? 'אבא' : 'הורה'} של ${C}, ו${C} ${verb}${S}.`
  }

  if (lang === 'es') {
    const parentLabel = parent.gender === 'female' ? 'madre' : parent.gender === 'male' ? 'padre' : 'progenitor/a'
    const verb = edgeType === 'partner'
      ? 'es pareja de'
      : (spouse.gender === 'female'
          ? (isFormer ? 'estuvo casada con' : 'está casada con')
          : (isFormer ? 'estuvo casado con' : 'está casado con'))
    return `${P} es ${parentLabel} de ${C}, y ${C} ${verb} ${S}.`
  }

  const parentLabel = parent.gender === 'female' ? 'mother' : parent.gender === 'male' ? 'father' : 'parent'
  const verb = edgeType === 'partner'
    ? 'is the partner of'
    : (isFormer ? 'was married to' : 'is married to')
  return `${P} is the ${parentLabel} of ${C}, and ${C} ${verb} ${S}.`
}

function phraseAuntUncle(hit: AuntUncleHit, lang: Lang): string {
  const { auntUncle, nephew, via } = hit
  const A = displayName(auntUncle, lang), N = displayName(nephew, lang), V = displayName(via, lang)
  if (lang === 'es') {
    const role = auntUncle.gender === 'female' ? 'tía' : auntUncle.gender === 'male' ? 'tío' : 'tía/tío'
    return `${A} es ${role} de ${N}.`
  }
  if (lang === 'en') {
    const role = auntUncle.gender === 'female' ? 'aunt' : auntUncle.gender === 'male' ? 'uncle' : 'aunt/uncle'
    return `${A} is the ${role} of ${N}.`
  }
  const role = auntUncle.gender === 'female' ? 'הדודה' : auntUncle.gender === 'male' ? 'הדוד' : 'הדוד/ה'
  const sib = via.gender === 'female' ? 'אחות' : 'אח'
  return `${A} ${role} של ${N} (${sib} של ${V}).`
}

function phraseCousins(hit: CousinHit, lang: Lang): string {
  const { a, b, via1, via2 } = hit
  const A = displayName(a, lang), B = displayName(b, lang)
  const V1 = displayName(via1, lang), V2 = displayName(via2, lang)
  const bothFemale = a.gender === 'female' && b.gender === 'female'
  if (lang === 'es') {
    const label = bothFemale ? 'primas' : 'primos'
    return `${A} y ${B} son ${label}, hijos de ${V1} y ${V2}.`
  }
  if (lang === 'en') {
    return `${A} and ${B} are cousins, children of ${V1} and ${V2}.`
  }
  const label = bothFemale ? 'בנות דוד' : 'בני דוד'
  return `${A} ו${B} ${label}, הילדים של ${V1} ו${V2}.`
}

/** Ancestor phrasing at any depth. distance 2 = grandparent, 3 = great-grandparent. */
function phraseAncestor(grand: GraphNode, child: GraphNode, mid: GraphNode, distance: number, lang: Lang): string {
  const G = displayName(grand, lang), C = displayName(child, lang), M = displayName(mid, lang)
  const f = grand.gender === 'female', m = grand.gender === 'male'
  if (lang === 'es') {
    const role = distance >= 3
      ? (f ? 'bisabuela' : m ? 'bisabuelo' : 'bisabuelo/a')
      : (f ? 'abuela' : m ? 'abuelo' : 'abuelo/a')
    return `${G} es ${role} de ${C} (a través de ${M}).`
  }
  if (lang === 'en') {
    const role = distance >= 3
      ? (f ? 'great-grandmother' : m ? 'great-grandfather' : 'great-grandparent')
      : (f ? 'grandmother' : m ? 'grandfather' : 'grandparent')
    return `${G} is the ${role} of ${C} (through ${M}).`
  }
  const role = distance >= 3
    ? (f ? 'הסבתא רבתא' : m ? 'הסבא רבא' : 'הסב/ה רבא')
    : (f ? 'הסבתא' : m ? 'הסבא' : 'הסב/ה')
  return `${G} ${role} של ${C} (דרך ${M}).`
}
