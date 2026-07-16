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
  | 'parent_in_law' | 'child_in_law' | 'ex_child_in_law' | 'ex_parent_in_law'
  | 'sibling_in_law' | 'ex_sibling_in_law'
  | 'in_law'
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
  ex_parent_in_law:  ['החמות לשעבר', 'החם לשעבר'],
  sibling_in_law:    ['הגיסה', 'הגיס'],
  ex_sibling_in_law: ['הגיסה לשעבר', 'הגיס לשעבר'],
  // Composed in-law: the sentence is built inline (a composition, not a single
  // word), so this placeholder is never surfaced via labelFor.
  in_law:            ['בת משפחה בנישואין', 'בן משפחה בנישואין'],
}

// Spanish gendered relation nouns — parity with LABEL so relationOf can answer a
// Spanish "¿qué relación hay entre X y Y?" in Spanish (Rioplatense), covering every
// RelationKind (describeRelation does not cover the deeper ones like grand-niece).
const LABEL_ES: Record<Exclude<RelationKind, 'self' | 'unknown'>, [string, string]> = {
  //                    female,              male
  spouse:            ['esposa', 'esposo'],
  ex_spouse:         ['ex esposa', 'ex esposo'],
  partner:           ['pareja', 'pareja'],
  parent:            ['madre', 'padre'],
  child:             ['hija', 'hijo'],
  sibling:           ['hermana', 'hermano'],
  grandparent:       ['abuela', 'abuelo'],
  grandchild:        ['nieta', 'nieto'],
  uncle_aunt:        ['tía', 'tío'],
  uncle_aunt_in_law: ['tía política', 'tío político'],
  nephew_niece:      ['sobrina', 'sobrino'],
  great_grandparent: ['bisabuela', 'bisabuelo'],
  great_grandchild:  ['bisnieta', 'bisnieto'],
  great_uncle_aunt:  ['tía abuela', 'tío abuelo'],
  great_nephew_niece:['sobrina nieta', 'sobrino nieto'],
  cousin:            ['prima', 'primo'],
  parent_in_law:     ['suegra', 'suegro'],
  child_in_law:      ['nuera', 'yerno'],
  ex_child_in_law:   ['ex nuera', 'ex yerno'],
  ex_parent_in_law:  ['ex suegra', 'ex suegro'],
  sibling_in_law:    ['cuñada', 'cuñado'],
  ex_sibling_in_law: ['ex cuñada', 'ex cuñado'],
  in_law:            ['familiar política', 'familiar político'],
}

function labelFor(kind: RelationKind, g: G, lang: 'he' | 'es' = 'he'): string {
  if (kind === 'self' || kind === 'unknown') return ''
  const pair = (lang === 'es' ? LABEL_ES : LABEL)[kind]
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

// The BLOOD relations (no marriage edge) the algebra can name — the building
// blocks the general in-law composition is allowed to compose a marriage onto.
const BLOOD_KINDS: ReadonlySet<RelationKind> = new Set<RelationKind>([
  'parent', 'child', 'sibling', 'grandparent', 'grandchild', 'uncle_aunt', 'nephew_niece',
  'great_grandparent', 'great_grandchild', 'great_uncle_aunt', 'great_nephew_niece', 'cousin',
])

/**
 * The BLOOD relation A is for B (directional), or 'unknown'. Pure consanguinity —
 * no spouse/partner edges are followed. This is the shared algebra the in-law
 * composition rides on, so "cousin-in-law / grandchild-in-law / niece's-husband"
 * are DERIVED, not enumerated. Non-recursive (never calls relationOf).
 */
function bloodRelationKind(idx: Index, aHe: string, bHe: string): RelationKind {
  const A = get(idx, aHe), B = get(idx, bHe)
  if (!A || !B || aHe === bHe) return 'unknown'
  const nodesOf = (arr: string[]) => arr.map((x) => get(idx, x)).filter(Boolean) as GraphNode[]
  const parents = (n: GraphNode) => nodesOf(n.parentsHe)
  const children = (n: GraphNode) => nodesOf(n.childrenHe)
  const sibNodes = (n: GraphNode) => nodesOf(siblingsOf(idx, n))
  if (B.parentsHe.includes(aHe)) return 'parent'
  if (B.childrenHe.includes(aHe)) return 'child'
  if (siblingsOf(idx, B).includes(aHe)) return 'sibling'
  if (parents(B).some((p) => p.parentsHe.includes(aHe))) return 'grandparent'
  if (children(B).some((c) => c.childrenHe.includes(aHe))) return 'grandchild'
  for (const p of parents(B)) if (siblingsOf(idx, p).includes(aHe)) return 'uncle_aunt'
  if (sibNodes(B).some((s) => s.childrenHe.includes(aHe))) return 'nephew_niece'
  if (parents(B).some((p) => parents(p).some((gp) => gp.parentsHe.includes(aHe)))) return 'great_grandparent'
  if (children(B).some((c) => children(c).some((gc) => gc.childrenHe.includes(aHe)))) return 'great_grandchild'
  for (const p of parents(B)) for (const gp of parents(p)) if (siblingsOf(idx, gp).includes(aHe)) return 'great_uncle_aunt'
  if (sibNodes(B).some((s) => children(s).some((c) => c.childrenHe.includes(aHe)))) return 'great_nephew_niece'
  for (const p of parents(B)) for (const s of sibNodes(p)) if (s.childrenHe.includes(aHe)) return 'cousin'
  return 'unknown'
}

type Marriage = [string, 'spouse' | 'ex' | 'partner']
const marriagesOf = (n: GraphNode): Marriage[] => [
  ...n.spousesHe.map((s) => [s, 'spouse'] as Marriage),
  ...n.partnersHe.map((s) => [s, 'partner'] as Marriage),
  ...n.exSpousesHe.map((s) => [s, 'ex'] as Marriage),
]

/** "<person> is married to <name>" clause, gender + marriage-type + language correct. */
function marriedClause(person: GraphNode, m: 'spouse' | 'ex' | 'partner', name: string, lang: 'he' | 'es'): string {
  const f = person.gender === 'female'
  if (lang === 'es') {
    if (m === 'partner') return `es pareja de ${name}`
    if (m === 'ex') return `${f ? 'estuvo casada con' : 'estuvo casado con'} ${name}`
    return `${f ? 'está casada con' : 'está casado con'} ${name}`
  }
  if (m === 'partner') return `${f ? 'בת הזוג של' : 'בן הזוג של'} ${name}`
  if (m === 'ex') return `${f ? 'הייתה נשואה ל' : 'היה נשוי ל'}${name}`
  return `${f ? 'נשואה ל' : 'נשוי ל'}${name}`
}

/**
 * GENERAL in-law composition: an in-law is the spouse of a blood relative, or the
 * blood relative of a spouse — at ANY blood depth. One rule replaces a growing
 * list of named kinds (cousin-in-law, grandchild-in-law, nephew's-husband, …).
 * Runs ONLY after the direct ladder fails, so it never overrides a more specific
 * named relation. Returns null when no marriage+blood chain exists (honest unknown).
 */
function composeInLaw(idx: Index, A: GraphNode, B: GraphNode, lang: 'he' | 'es'): RelationResult | null {
  const es = lang === 'es'
  const nameOf = (n: GraphNode) => (es ? (n.canonical ?? n.hebrew) : n.hebrew)
  const result = (sentence: string): RelationResult => ({
    subject: A.hebrew, target: B.hebrew, kind: 'in_law', known: true, sentence,
  })
  // (a) A married to S, and S is a blood relative of B → A is B's <rel> by marriage.
  for (const [sHe, m] of marriagesOf(A)) {
    const S = get(idx, sHe)
    if (!S || S.hebrew === B.hebrew) continue
    const bk = bloodRelationKind(idx, S.hebrew, B.hebrew)
    if (!BLOOD_KINDS.has(bk)) continue
    const lbl = labelFor(bk, (S.gender ?? 'unknown') as G, lang)
    return result(es
      ? `${nameOf(A)} ${marriedClause(A, m, nameOf(S), 'es')}, y ${nameOf(S)} es ${lbl} de ${nameOf(B)}.`
      : `${nameOf(A)} ${marriedClause(A, m, nameOf(S), 'he')}, ו${nameOf(S)} ${lbl} של ${nameOf(B)}.`)
  }
  // (b) A is a blood relative of T, and T is married to B → A is the <rel> of B's spouse.
  for (const [tHe, m] of marriagesOf(B)) {
    const T = get(idx, tHe)
    if (!T || T.hebrew === A.hebrew) continue
    const bk = bloodRelationKind(idx, A.hebrew, T.hebrew)
    if (!BLOOD_KINDS.has(bk)) continue
    const lbl = labelFor(bk, (A.gender ?? 'unknown') as G, lang)
    return result(es
      ? `${nameOf(A)} es ${lbl} de ${nameOf(T)}, y ${nameOf(T)} ${marriedClause(T, m, nameOf(B), 'es')}.`
      : `${nameOf(A)} ${lbl} של ${nameOf(T)}, ו${nameOf(T)} ${marriedClause(T, m, nameOf(B), 'he')}.`)
  }
  return null
}

/**
 * Compute what A is for B (directional). Returns the most specific relation.
 */
export function relationOf(aName: string, bName: string, lang: 'he' | 'es' = 'he'): RelationResult {
  const idx = buildIndex()
  // Resolve Latin/alias names (e.g. "Mor", "Anabel") to their graph node via findNode
  // (richer than the local matchNames index), then look up by Hebrew in idx.
  const A = get(idx, findNode(aName)?.hebrew ?? aName), B = get(idx, findNode(bName)?.hebrew ?? bName)
  const es = lang === 'es'
  const subject = A?.hebrew ?? aName, target = B?.hebrew ?? bName
  // Spanish output uses the Latin/canonical name, Hebrew uses the Hebrew name.
  const subjEs = A?.canonical ?? aName, targEs = B?.canonical ?? bName
  const done = (kind: RelationKind): RelationResult => {
    if (kind === 'unknown') return { subject, target, kind, known: false,
      sentence: es ? `No sé qué es ${subjEs} para ${targEs}. No lo adivino.` : `אני לא יודעת מה ${subject} עבור ${target}. אני לא אנחש.` }
    if (kind === 'self') return { subject, target, kind, known: true, sentence: es ? `${subjEs} y ${targEs} son la misma persona.` : `${subject} ${target}.` }
    const g = (A?.gender ?? 'unknown') as G
    const lbl = labelFor(kind, g, lang)
    return { subject, target, kind, known: true,
      sentence: es ? `${subjEs} es ${lbl} de ${targEs}.` : `${subject} ${lbl} של ${target}.` }
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
  // 5) nephew/niece: child of a sibling of B (blood), OR child of a sibling of a
  // (current) spouse of B (by marriage) — the inverse of uncle_aunt_in_law.
  if (sibs(B).some(s => childrenOf(s).includes(aHe))) return done('nephew_niece')
  for (const spHe of currentSpousesOf(B)) { const sp = get(idx, spHe); if (sp && sibs(sp).some(s => childrenOf(s).includes(aHe))) return done('nephew_niece') }

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
  // ex-parent-in-law: A is a parent of an EX-spouse of B (Martita ↔ Rafi).
  for (const exHe of exSpousesOf(B)) { const ex = get(idx, exHe); if (ex && parentsOf(ex).includes(aHe)) return done('ex_parent_in_law') }
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
  // ex-sibling-in-law (reverse): A is a sibling of an EX-spouse of B (Leo ↔ Rafi).
  for (const spHe of exSpousesOf(B)) { const sp = get(idx, spHe); if (sp && siblingsOf(idx, sp).includes(aHe)) return done('ex_sibling_in_law') }

  // 11) GENERAL in-law composition — the spouse of a blood relative at ANY depth,
  // or the blood relative of a spouse. Derives cousin-in-law / grandchild-in-law /
  // niece's-husband from the blood algebra instead of enumerating each (mandate:
  // a general mechanism, never a growing pattern list). Runs last, so it only ever
  // fills a gap the named rules above left as a FALSE "unknown".
  const composed = composeInLaw(idx, A, B, lang)
  if (composed) return composed

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
  // "מה/מי (זה/זאת)? X עבור/בשביל Y" — skip the filler "זה/זאת".
  let m = t.match(/(?:מה|מי)\s+(?:ז[הא]\s+)?([א-ת]{2,})\s+(?:עבור|בשביל)\s+([א-ת]{2,})/u)
  if (m && m[1] !== 'זה' && m[1] !== 'זאת') return { subject: m[1]!, target: m[2]!, ok: true }
  // "מה הקשר בין X ל/לבין Y" — X is subject, Y is target (order preserved).
  m = t.match(/(?:הקשר|היחס)\s+בין\s+([א-ת]{2,})\s+(?:ל|לבין)\s*([א-ת]{2,})/u)
  if (m) return { subject: m[1]!, target: m[2]!, ok: true }
  // Spanish "¿qué relación hay entre X y Y?" / "relación entre X y Y".
  m = t.match(/relaci[óo]n\s+(?:hay\s+)?entre\s+([a-záéíóúñ]{2,})\s+y\s+([a-záéíóúñ]{2,})/i)
  if (m) return { subject: m[1]!, target: m[2]!, ok: true }
  // Spanish "¿qué es X para Y?" (directional).
  m = t.match(/qu[eé]\s+es\s+([a-záéíóúñ]{2,})\s+para\s+([a-záéíóúñ]{2,})/i)
  if (m) return { subject: m[1]!, target: m[2]!, ok: true }
  // "מי X של Y" → X is the relation word (ignore), Y target; not directional pair.
  return { subject: null, target: null, ok: false }
}

/** Answer a directional relation question, or null if it isn't one. */
export function answerRelationQuery(text: string, lang: 'he' | 'es' = 'he'): RelationResult | null {
  const p = parseRelationQuery(text)
  if (!p.ok || !p.subject || !p.target) return null
  if (!findNode(p.subject) || !findNode(p.target)) {
    return { subject: p.subject, target: p.target, kind: 'unknown', known: false,
      sentence: lang === 'es' ? `No conozco esa relación, así que no la adivino.` : `אני לא מכירה את הקשר הזה, אז לא אנחש.` }
  }
  return relationOf(p.subject, p.target, lang)
}
