/*
 * Family Relation Engine (Phase 4)
 * ════════════════════════════════
 * Directional, gender-correct graph reasoning for "what is X for Y". It composes
 * the `familyGraph` primitives (parents/children/spouses/ex are already back-
 * filled bidirectionally) — it does NOT duplicate the graph.
 *
 * Why it exists: `describeRelation` is symmetric (it describes the pair the same
 * way regardless of who is the subject), returns null for great-uncle/aunt, and
 * has gender slips ("לאו … אחות של מור"). This engine answers the DIRECTIONAL
 * question — "what is A for B" — from A's perspective, with the correct gendered
 * noun, covers great-uncle/aunt/cousin and (ex-)in-laws, and says "unknown"
 * honestly instead of guessing.
 */
import { loadGraph, findNode, type GraphNode } from './familyGraph'

export type RelationKind =
  | 'self' | 'spouse' | 'ex_spouse' | 'partner'
  | 'parent' | 'child' | 'sibling'
  | 'grandparent' | 'grandchild'
  | 'uncle_aunt' | 'uncle_aunt_in_law' | 'nephew_niece'
  | 'great_grandparent' | 'great_grandchild'
  | 'great_uncle_aunt' | 'great_nephew_niece'
  | 'cousin'
  | 'parent_in_law' | 'child_in_law' | 'ex_child_in_law'
  | 'sibling_in_law' | 'ex_sibling_in_law'
  | 'unknown'

export interface RelationResult {
  subject: string          // A (the "what is A …" person), Hebrew
  target: string           // B ("… for B"), Hebrew
  kind: RelationKind
  known: boolean
  /** natural Hebrew sentence: "A is the <REL> of B." */
  sentence: string
}

type G = 'female' | 'male' | 'unknown'

// Gendered relation nouns (subject A's gender picks the form).
const LABEL: Record<Exclude<RelationKind, 'self' | 'unknown'>, [string, string]> = {
  //                                          female,           male
  spouse:            ['אשתו', 'בעלה'],
  ex_spouse:         ['גרושתו', 'גרושה'],
  partner:           ['בת הזוג', 'בן הזוג'],
  parent:            ['אמא', 'אבא'],
  child:             ['הבת', 'הבן'],
  sibling:           ['אחות', 'אח'],
  grandparent:       ['סבתא', 'סבא'],
  grandchild:        ['נכדה', 'נכד'],
  uncle_aunt:        ['דודה', 'דוד'],
  uncle_aunt_in_law: ['דודה (בנישואין)', 'דוד (בנישואין)'],
  nephew_niece:      ['אחיינית', 'אחיין'],
  great_grandparent: ['סבתא רבתא', 'סבא רבא'],
  great_grandchild:  ['נינה', 'נין'],
  great_uncle_aunt:  ['דודה רבתא', 'דוד רבא'],
  great_nephew_niece:['נכדת-אחיין', 'נכד-אחיין'],
  cousin:            ['בת דודה', 'בן דוד'],
  parent_in_law:     ['החמות', 'החם'],
  child_in_law:      ['הכלה', 'החתן'],
  ex_child_in_law:   ['הכלה לשעבר', 'החתן לשעבר'],
  sibling_in_law:    ['הגיסה', 'הגיס'],
  ex_sibling_in_law: ['הגיסה לשעבר', 'הגיס לשעבר'],
}

function labelFor(kind: RelationKind, g: G): string {
  if (kind === 'self' || kind === 'unknown') return ''
  const pair = LABEL[kind]
  return g === 'female' ? pair[0] : pair[1]
}

interface Index { byName: Map<string, GraphNode> }
function buildIndex(): Index {
  const byName = new Map<string, GraphNode>()
  for (const n of loadGraph()) {
    byName.set(n.hebrew, n)
    for (const a of n.matchNames) byName.set(a, n)
  }
  return { byName }
}

const names = (arr: string[]) => arr
const parentsOf = (n: GraphNode) => names(n.parentsHe)
const childrenOf = (n: GraphNode) => names(n.childrenHe)
const currentSpousesOf = (n: GraphNode) => [...n.spousesHe, ...n.partnersHe]
const exSpousesOf = (n: GraphNode) => names(n.exSpousesHe)

function get(idx: Index, name: string): GraphNode | null { return idx.byName.get(name) ?? null }

function siblingsOf(idx: Index, n: GraphNode): string[] {
  const out = new Set<string>()
  for (const pHe of parentsOf(n)) {
    const p = get(idx, pHe)
    if (!p) continue
    for (const cHe of childrenOf(p)) if (cHe !== n.hebrew) out.add(cHe)
  }
  return [...out]
}

/**
 * Compute what A is for B (directional). Returns the most specific relation.
 */
export function relationOf(aName: string, bName: string): RelationResult {
  const idx = buildIndex()
  const A = get(idx, aName), B = get(idx, bName)
  const subject = A?.hebrew ?? aName, target = B?.hebrew ?? bName
  const done = (kind: RelationKind): RelationResult => {
    if (kind === 'unknown') return { subject, target, kind, known: false, sentence: `אני לא יודעת מה ${subject} עבור ${target}. אני לא אנחש.` }
    if (kind === 'self') return { subject, target, kind, known: true, sentence: `${subject} ${target}.` }
    const g = (A?.gender ?? 'unknown') as G
    const lbl = labelFor(kind, g)
    return { subject, target, kind, known: true, sentence: `${subject} ${lbl} של ${target}.` }
  }
  if (!A || !B) return done('unknown')
  if (A.hebrew === B.hebrew) return done('self')

  const aHe = A.hebrew
  const inA = (arr: string[]) => arr.includes(aHe)

  // helpers that resolve names → nodes
  const parents = (n: GraphNode) => parentsOf(n).map(x => get(idx, x)).filter(Boolean) as GraphNode[]
  const children = (n: GraphNode) => childrenOf(n).map(x => get(idx, x)).filter(Boolean) as GraphNode[]
  const sibs = (n: GraphNode) => siblingsOf(idx, n).map(x => get(idx, x)).filter(Boolean) as GraphNode[]

  // 1) spouse / ex / partner
  if (B.spousesHe.includes(aHe)) return done('spouse')
  if (B.partnersHe.includes(aHe)) return done('partner')
  if (B.exSpousesHe.includes(aHe)) return done('ex_spouse')

  // 2) direct line
  if (inA(parentsOf(B))) return done('parent')
  if (inA(childrenOf(B))) return done('child')
  if (siblingsOf(idx, B).includes(aHe)) return done('sibling')

  // 3) grandparent / grandchild
  if (parents(B).some(p => parentsOf(p).includes(aHe))) return done('grandparent')
  if (children(B).some(c => childrenOf(c).includes(aHe))) return done('grandchild')

  // 4) uncle/aunt (blood: sibling of a parent) or by-marriage (spouse of that sibling)
  for (const p of parents(B)) {
    if (siblingsOf(idx, p).includes(aHe)) return done('uncle_aunt')
    for (const s of sibs(p)) if (currentSpousesOf(s).includes(aHe)) return done('uncle_aunt_in_law')
  }
  // 5) nephew/niece (child of a sibling)
  if (sibs(B).some(s => childrenOf(s).includes(aHe))) return done('nephew_niece')

  // 6) great-grandparent / great-grandchild
  if (parents(B).some(p => parents(p).some(gp => parentsOf(gp).includes(aHe)))) return done('great_grandparent')
  if (children(B).some(c => children(c).some(gc => childrenOf(gc).includes(aHe)))) return done('great_grandchild')

  // 7) great-uncle/aunt (sibling — or spouse of a sibling — of a grandparent)
  for (const p of parents(B)) {
    for (const gp of parents(p)) {
      if (siblingsOf(idx, gp).includes(aHe)) return done('great_uncle_aunt')
      for (const s of sibs(gp)) if (currentSpousesOf(s).includes(aHe)) return done('great_uncle_aunt')
    }
  }
  // 8) great-nephew/niece (grandchild of a sibling)
  if (sibs(B).some(s => children(s).some(c => childrenOf(c).includes(aHe)))) return done('great_nephew_niece')

  // 9) cousin (child of a sibling of a parent)
  for (const p of parents(B)) for (const s of sibs(p)) if (childrenOf(s).includes(aHe)) return done('cousin')

  // 10) in-laws
  // parent-in-law: A is a parent of B's (current) spouse
  for (const spHe of currentSpousesOf(B)) { const sp = get(idx, spHe); if (sp && parentsOf(sp).includes(aHe)) return done('parent_in_law') }
  // child-in-law: A is (ex-)spouse of a child of B
  for (const c of children(B)) {
    if (currentSpousesOf(c).includes(aHe)) return done('child_in_law')
    if (exSpousesOf(c).includes(aHe)) return done('ex_child_in_law')
  }
  // sibling-in-law: A is (ex-)spouse of a sibling of B, OR A is a sibling of a (current) spouse of B
  for (const s of sibs(B)) {
    if (currentSpousesOf(s).includes(aHe)) return done('sibling_in_law')
    if (exSpousesOf(s).includes(aHe)) return done('ex_sibling_in_law')
  }
  for (const spHe of currentSpousesOf(B)) { const sp = get(idx, spHe); if (sp && siblingsOf(idx, sp).includes(aHe)) return done('sibling_in_law') }

  return done('unknown')
}

// ── Query parsing: "מה X עבור Y", "מי X בשביל Y", "מה הקשר בין X ל-Y" ─────────
export interface ParsedRelationQuery { subject: string | null; target: string | null; ok: boolean }

/**
 * Parse subject/target from a natural relation question, preserving ORDER so the
 * answer is directional. Both a known-name pair and the explicit "X ל-Y" forms
 * are supported.
 */
export function parseRelationQuery(text: string): ParsedRelationQuery {
  const t = text.trim()
  // "מה/מי X עבור/בשביל/ל Y"
  let m = t.match(/(?:מה|מי)\s+([א-ת]{2,})\s+(?:עבור|בשביל)\s+([א-ת]{2,})/u)
  if (m) return { subject: m[1]!, target: m[2]!, ok: true }
  // "מה הקשר בין X ל/לבין Y" — X is subject, Y is target (order preserved).
  m = t.match(/(?:הקשר|היחס)\s+בין\s+([א-ת]{2,})\s+(?:ל|לבין)\s*([א-ת]{2,})/u)
  if (m) return { subject: m[1]!, target: m[2]!, ok: true }
  // "מי X של Y" → X is the relation word (ignore), Y target; not directional pair.
  return { subject: null, target: null, ok: false }
}

/** Answer a directional relation question, or null if it isn't one. */
export function answerRelationQuery(text: string): RelationResult | null {
  const p = parseRelationQuery(text)
  if (!p.ok || !p.subject || !p.target) return null
  if (!findNode(p.subject) || !findNode(p.target)) {
    return { subject: p.subject, target: p.target, kind: 'unknown', known: false, sentence: `אני לא מכירה את הקשר הזה, אז לא אנחש.` }
  }
  return relationOf(p.subject, p.target)
}
