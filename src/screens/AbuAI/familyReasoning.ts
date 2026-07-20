/*
 * Family-graph reasoning — relationship chains over knowledge/family_data.json
 * (via loadGraph). No guessing: multiple correct answers are ALL returned; an
 * unknown relation returns []. Colloquial matriarch/patriarch ("סבתא/סבא") for a
 * great-grandchild resolves up the ancestor chain to Martita / Pepe.
 */
import { loadGraph, findNode, type GraphNode } from './familyGraph'
import { parseRelationQuery, type RelationType } from '../../truth/relationMorphology'

interface FamilyIndex { byName: Map<string, GraphNode>; nodes: GraphNode[] }

function index(): FamilyIndex {
  const nodes = loadGraph()
  const byName = new Map<string, GraphNode>()
  for (const n of nodes) {
    byName.set(n.hebrew, n)
    for (const a of n.matchNames ?? []) byName.set(a, n)
  }
  return { byName, nodes }
}
const uniq = (a: string[]) => [...new Set(a)]
const node = (ix: FamilyIndex, name: string) => ix.byName.get(name) ?? ix.byName.get(name.toLowerCase())

function parentsOf(ix: FamilyIndex, name: string): string[] {
  const n = node(ix, name); return n ? uniq(n.parentsHe ?? []) : []
}
function childrenOf(ix: FamilyIndex, name: string): string[] {
  const n = node(ix, name); return n ? uniq(n.childrenHe ?? []) : []
}
function spousesOf(ix: FamilyIndex, name: string): string[] {
  const n = node(ix, name); return n ? uniq([...(n.spousesHe ?? []), ...(n.partnersHe ?? [])]) : []
}
function exSpousesOf(ix: FamilyIndex, name: string): string[] {
  const n = node(ix, name); return n ? uniq(n.exSpousesHe ?? []) : []
}
function genderOf(ix: FamilyIndex, name: string): string | undefined { return node(ix, name)?.gender }

/** All ancestors up the parent chain (grandparents, great-grandparents, …). */
function ancestorsAbove(ix: FamilyIndex, name: string, minLevel: number): string[] {
  let frontier = parentsOf(ix, name)   // level 1 = parents
  const out: string[] = []
  for (let level = 2; level <= 5 && frontier.length; level++) {
    frontier = uniq(frontier.flatMap(p => parentsOf(ix, p)))
    if (level >= minLevel) out.push(...frontier)
  }
  return uniq(out)
}

/** Grandmother/grandfather (or all, gender-neutral). For a great-grandchild this
 * naturally includes the matriarch/patriarch (Martita/Pepe) up the chain. */
export function grandparentsOf(name: string, gender?: 'female' | 'male'): string[] {
  const ix = index()
  let anc = ancestorsAbove(ix, name, 2)
  // Include the matriarch/patriarch explicitly (family calls them סבתא/סבא even
  // for great-grandchildren, and a deceased patriarch may not be graph-linked).
  const roots = ix.nodes.filter(n => n.role === 'matriarch' || n.role === 'patriarch').map(n => n.hebrew)
  anc = uniq([...anc, ...roots.filter(r => isDescendant(ix, name, r))])
  if (gender) anc = anc.filter(a => genderOf(ix, a) === gender)
  return anc
}

/** Is `name` a descendant of `ancestor` (up to 5 generations)? */
function isDescendant(ix: FamilyIndex, name: string, ancestor: string): boolean {
  let frontier = parentsOf(ix, name)
  for (let i = 0; i < 5 && frontier.length; i++) {
    if (frontier.includes(ancestor)) return true
    frontier = uniq(frontier.flatMap(p => parentsOf(ix, p)))
  }
  return false
}

/** Uncles/aunts: the siblings of the person's parents (+ their spouses). */
export function unclesAuntsOf(name: string, gender?: 'female' | 'male'): string[] {
  const ix = index()
  const parents = parentsOf(ix, name)
  const grandparents = uniq(parents.flatMap(p => parentsOf(ix, p)))
  const parentSiblings = uniq(grandparents.flatMap(gp => childrenOf(ix, gp)))
    .filter(c => !parents.includes(c) && c !== name)
  const withSpouses = uniq([...parentSiblings, ...parentSiblings.flatMap(s => spousesOf(ix, s))])
  return gender ? withSpouses.filter(a => genderOf(ix, a) === gender) : withSpouses
}

export function childrenOfPublic(name: string): string[] { return childrenOf(index(), name) }
/** Grandchildren: children of the person's children. Deterministic count/list source. */
export function grandchildrenOfPublic(name: string): string[] {
  const ix = index()
  return uniq(childrenOf(ix, name).flatMap(c => childrenOf(ix, c)))
}
/** Great-grandchildren: children of the grandchildren. */
export function greatGrandchildrenOfPublic(name: string): string[] {
  const ix = index()
  const gc = uniq(childrenOf(ix, name).flatMap(c => childrenOf(ix, c)))
  return uniq(gc.flatMap(g => childrenOf(ix, g)))
}
/** Daughters/sons: the person's children filtered by the child's gender. Lets a
 *  singular "מי הבת/הבן של X" resolve from the graph instead of punting to the LLM. */
export function childrenByGenderPublic(name: string, gender: 'female' | 'male'): string[] {
  const ix = index()
  return uniq(childrenOf(ix, name).filter(c => genderOf(ix, c) === gender))
}
/** Mother/father: the person's parents filtered by the parent's gender. Lets a
 *  singular "מי אמא/אבא של X" resolve from the graph instead of punting to the LLM. */
export function parentsByGenderPublic(name: string, gender: 'female' | 'male'): string[] {
  const ix = index()
  return uniq(parentsOf(ix, name).filter(p => genderOf(ix, p) === gender))
}
/** Siblings: the OTHER children of the person's parents, optionally by gender.
 *  Lets "מי אח/אחות של X" resolve from the graph instead of the LLM. */
export function siblingsByGenderPublic(name: string, gender?: 'female' | 'male'): string[] {
  const ix = index()
  const self = node(ix, name)
  const sibs = uniq(parentsOf(ix, name).flatMap(p => childrenOf(ix, p)))
    .filter(c => (self ? node(ix, c)?.hebrew !== self.hebrew : c !== name))
  return gender ? sibs.filter(s => genderOf(ix, s) === gender) : sibs
}
export function partnerOf(name: string): string[] { return spousesOf(index(), name) }
/** Ex-spouse(s). The graph edge is SYMMETRIC, so this answers both directions
 *  ("Mor's ex-husband" and "whose ex-husband is Rafi"). */
export function exSpouseOf(name: string): string[] { return exSpousesOf(index(), name) }
/** Is `name` a real family member (canonical / Hebrew / alias)? Used to gate ledger
 *  chapter facts to FAMILY people — Martita's own things stay in personal memory. */
export function isKnownFamilyPerson(name: string): boolean { return findNode(name) !== null }
/** Both parents, gender-neutral ("מי ההורה של X"). */
export function parentsPublic(name: string): string[] { return parentsOf(index(), name) }
/** Children-in-law: the gendered spouses of the person's children.
 *  חתן (son-in-law) = male spouse of a child; כלה (daughter-in-law) = female. */
export function childInLawOf(name: string, gender: 'female' | 'male'): string[] {
  const ix = index()
  return uniq(childrenOf(ix, name).flatMap(c => spousesOf(ix, c)).filter(s => genderOf(ix, s) === gender))
}
/** Siblings-in-law: spouses of the person's siblings + siblings of the person's
 *  spouse, gender-filtered. גיס (brother-in-law) = male; גיסה (sister-in-law) = female. */
export function siblingInLawOf(name: string, gender: 'female' | 'male'): string[] {
  const ix = index()
  const self = node(ix, name)
  const sibs = uniq(parentsOf(ix, name).flatMap(p => childrenOf(ix, p)))
    .filter(c => (self ? node(ix, c)?.hebrew !== self.hebrew : c !== name))
  const spousesOfSiblings = sibs.flatMap(s => spousesOf(ix, s))
  const siblingsOfSpouses = spousesOf(ix, name).flatMap(sp => {
    const spNode = node(ix, sp)
    return uniq(parentsOf(ix, sp).flatMap(p => childrenOf(ix, p)))
      .filter(c => (spNode ? node(ix, c)?.hebrew !== spNode.hebrew : c !== sp))
  })
  return uniq([...spousesOfSiblings, ...siblingsOfSpouses]).filter(s => genderOf(ix, s) === gender)
}
/** Parents-in-law: the gendered parents of the person's spouse.
 *  חם (father-in-law) = male; חמות (mother-in-law) = female. */
export function parentInLawOf(name: string, gender: 'female' | 'male'): string[] {
  const ix = index()
  return uniq(spousesOf(ix, name).flatMap(sp => parentsOf(ix, sp)).filter(p => genderOf(ix, p) === gender))
}

/** Canonical relation type → graph resolver. The ONE place a normalized relation
 *  becomes a set of people, so every path resolves identically. */
function resolveByType(type: RelationType, subject: string): string[] {
  switch (type) {
    case 'grandmother':    return grandparentsOf(subject, 'female')
    case 'grandfather':    return grandparentsOf(subject, 'male')
    case 'grandparent':    return grandparentsOf(subject)
    case 'mother':         return parentsByGenderPublic(subject, 'female')
    case 'father':         return parentsByGenderPublic(subject, 'male')
    case 'parent':         return parentsPublic(subject)
    case 'daughter':       return childrenByGenderPublic(subject, 'female')
    case 'son':            return childrenByGenderPublic(subject, 'male')
    case 'children':       return childrenOfPublic(subject)
    case 'sister':         return siblingsByGenderPublic(subject, 'female')
    case 'brother':        return siblingsByGenderPublic(subject, 'male')
    case 'siblings':       return siblingsByGenderPublic(subject)
    case 'grandchildren':  return grandchildrenOfPublic(subject)
    case 'partner':        return partnerOf(subject)
    case 'ex_spouse':      return exSpouseOf(subject)
    case 'aunt':           return unclesAuntsOf(subject, 'female')
    case 'uncle':          return unclesAuntsOf(subject, 'male')
    case 'son_in_law':     return childInLawOf(subject, 'male')
    case 'daughter_in_law':return childInLawOf(subject, 'female')
    case 'brother_in_law': return siblingInLawOf(subject, 'male')
    case 'sister_in_law':  return siblingInLawOf(subject, 'female')
    case 'father_in_law':  return parentInLawOf(subject, 'male')
    case 'mother_in_law':  return parentInLawOf(subject, 'female')
  }
}

export interface FamilyAnswer { relation: string; subject: string; results: string[]; ambiguous: boolean; known: boolean }

const REL = [
  { re: /(?:מי\s+)?(?:זאת\s+|זה\s+|היא\s+|הוא\s+)?ה?סבתא(?:\s+רבתא)?\s+של\s+(\S+)/u, rel: 'grandmother', fn: (n: string) => grandparentsOf(n, 'female') },
  { re: /(?:מי\s+)?(?:זה\s+|זאת\s+|הוא\s+|היא\s+)?ה?סבא(?:\s+רבא)?\s+של\s+(\S+)/u, rel: 'grandfather', fn: (n: string) => grandparentsOf(n, 'male') },
  { re: /(?:מי\s+ה?)?דוד(?:ות|ה)\s+של\s+(\S+)/u, rel: 'aunt', fn: (n: string) => unclesAuntsOf(n, 'female') },
  { re: /(?:מי\s+ה?)?דוד(?:ים)?\s+של\s+(\S+)/u, rel: 'uncle', fn: (n: string) => unclesAuntsOf(n, 'male') },
  { re: /(?:ה?ילדים|ה?בנים|ה?ילדות)\s+של\s+(\S+)|מי\s+ה?ילדים\s+של\s+(\S+)/u, rel: 'children', fn: (n: string) => childrenOfPublic(n) },
  // Grandchildren of X (children-of-children). Handles singular + plural (נכד/נכדים/נכדות).
  // Placed BEFORE grandparent rules so "נכד של" (grandchild) is not confused with "סבא של".
  { re: /(?:מי\s+ה?)?נכד(?:ים|ות)?\s+של\s+(\S+)/u, rel: 'grandchildren', fn: (n: string) => grandchildrenOfPublic(n) },
  // Partner/spouse — includes the POSSESSIVE suffix forms "בעלה" (her husband) and
  // "אשתו"/"אשתה" (his/her wife), not only "הבעל של" / "האישה של". A common family
  // question ("מי בעלה של אופיר") must resolve from the graph, never punt to the LLM.
  { re: /(?:בן|בת|בני)\s+ה?זוג\s+של\s+(\S+)|ה?בעל[הוהּ]?\s+של\s+(\S+)|ה?איש[הת][הו]?\s+של\s+(\S+)|אשת[הו]\s+של\s+(\S+)|פרטנר.*של\s+(\S+)/u, rel: 'partner', fn: (n: string) => partnerOf(n) },
  // SINGULAR daughter/son — AFTER the partner rule so "בת/בן הזוג של" is a spouse, not
  // a child. Gender-filtered so "מי הבת של מרטיטה" → מור (not Leo), never the LLM.
  { re: /(?:מי\s+)?ה?בת\s+של\s+(\S+)/u, rel: 'daughter', fn: (n: string) => childrenByGenderPublic(n, 'female') },
  { re: /(?:מי\s+)?ה?בן\s+של\s+(\S+)/u, rel: 'son', fn: (n: string) => childrenByGenderPublic(n, 'male') },
  // SINGULAR mother/father — gender-filtered parents. "מי אמא של אופיר" → מור.
  { re: /(?:מי\s+)?ה?(?:אמא|אימא|אם)\s+של\s+(\S+)/u, rel: 'mother', fn: (n: string) => parentsByGenderPublic(n, 'female') },
  { re: /(?:מי\s+)?ה?(?:אבא|אב)\s+של\s+(\S+)/u, rel: 'father', fn: (n: string) => parentsByGenderPublic(n, 'male') },
  // Siblings — brother/sister/(plural). "מי אח של מור" → לאו. Plural forms first so
  // "אחים/אחיות" are not shadowed by the bare "אח" rule (which needs "אח" + space).
  { re: /(?:מי\s+ה?)?אח(?:ים|יות)\s+של\s+(\S+)/u, rel: 'siblings', fn: (n: string) => siblingsByGenderPublic(n) },
  { re: /(?:מי\s+ה?)?אחות\s+של\s+(\S+)/u, rel: 'sister', fn: (n: string) => siblingsByGenderPublic(n, 'female') },
  { re: /(?:מי\s+ה?)?אח\s+של\s+(\S+)/u, rel: 'brother', fn: (n: string) => siblingsByGenderPublic(n, 'male') },
  // Ex-spouse — symmetric edge, so all shapes resolve to exSpouseOf(the named person):
  //   reverse  "רפי (הוא) הגרוש של מי"  → capture רפי  (Rafi is whose ex-husband)
  { re: /([֐-׿]+)\s+(?:הוא\s+|היא\s+)?ה?גרוש(?:ה)?\s+של\s+מי/u, rel: 'ex_spouse', fn: (n: string) => exSpouseOf(n) },
  //   from-whom "ממי מור גרושה" / "מור גרושה ממי" → capture מור
  { re: /ממי\s+([֐-׿]+)\s+גרוש(?:ה)?|([֐-׿]+)\s+גרוש(?:ה)?\s+ממי/u, rel: 'ex_spouse', fn: (n: string) => exSpouseOf(n) },
  //   forward  "(מי) הגרוש/הגרושה של מור" → capture מור (never the interrogative מי)
  { re: /(?:מי\s+)?ה?גרוש(?:ה)?\s+של\s+(?!מי(?![֐-׿]))([֐-׿]+)/u, rel: 'ex_spouse', fn: (n: string) => exSpouseOf(n) },
]

/**
 * Resolve a relation PHRASE inside free text to concrete family member(s) —
 * the ONE seam every path uses to turn "עם בת הזוג של מור" / "הבת של מרטיטה"
 * into real names. Forward phrases only (a reference that denotes a person);
 * returns the matched span (for in-place substitution) + the resolved people,
 * or null when it is not a relation phrase or resolves to nobody known.
 */
export function resolvePersonReference(text: string): { span: string; people: string[] } | null {
  const q = parseRelationQuery(text)
  if (!q || q.reverse) return null
  const people = uniq(resolveByType(q.type, q.subject).filter(Boolean))
  if (people.length === 0) return null
  return { span: q.match, people }
}

/** Resolve a relation phrase to a SINGLE person, or null. Used where exactly one
 *  referent is required (a meeting companion, a fact subject) — ambiguous
 *  multi-person references (e.g. "הילדים של מור") return null on purpose. */
export function resolveSinglePerson(text: string): { span: string; person: string } | null {
  const r = resolvePersonReference(text)
  if (!r || r.people.length !== 1) return null
  return { span: r.span, person: r.people[0]! }
}

/** Resolve a Hebrew relationship question deterministically from the graph.
 * Returns null if it is not a recognised relationship query. */
export function answerFamilyRelation(text: string): FamilyAnswer | null {
  const t = text.trim().replace(/[?？]/g, '')
  // 1) The morphology normalization seam (systematic inflection space) is the gate.
  const q = parseRelationQuery(t)
  if (q) {
    const results = uniq(resolveByType(q.type, q.subject).filter(Boolean))
    return { relation: q.type, subject: q.subject, results, ambiguous: results.length > 1, known: results.length > 0 }
  }
  // 2) Legacy REL fallback — shapes not yet migrated into the seam (e.g. the
  //    "ממי X גרושה" from-whom ex form). Being pruned as the seam absorbs them.
  for (const { re, rel, fn } of REL) {
    const m = re.exec(t)
    if (m) {
      const subject = (m.slice(1).find(Boolean) ?? '').trim()
      if (!subject) continue
      const results = uniq(fn(subject).filter(Boolean))
      return { relation: rel, subject, results, ambiguous: results.length > 1, known: results.length > 0 }
    }
  }
  return null
}
