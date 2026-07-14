/*
 * Family-graph reasoning — relationship chains over knowledge/family_data.json
 * (via loadGraph). No guessing: multiple correct answers are ALL returned; an
 * unknown relation returns []. Colloquial matriarch/patriarch ("סבתא/סבא") for a
 * great-grandchild resolves up the ancestor chain to Martita / Pepe.
 */
import { loadGraph, type GraphNode } from './familyGraph'

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
export function partnerOf(name: string): string[] { return spousesOf(index(), name) }
/** Ex-spouse(s). The graph edge is SYMMETRIC, so this answers both directions
 *  ("Mor's ex-husband" and "whose ex-husband is Rafi"). */
export function exSpouseOf(name: string): string[] { return exSpousesOf(index(), name) }

export interface FamilyAnswer { relation: string; subject: string; results: string[]; ambiguous: boolean; known: boolean }

const REL = [
  { re: /(?:מי\s+)?(?:זאת\s+|זה\s+|היא\s+|הוא\s+)?ה?סבתא(?:\s+רבתא)?\s+של\s+(\S+)/u, rel: 'grandmother', fn: (n: string) => grandparentsOf(n, 'female') },
  { re: /(?:מי\s+)?(?:זה\s+|זאת\s+|הוא\s+|היא\s+)?ה?סבא(?:\s+רבא)?\s+של\s+(\S+)/u, rel: 'grandfather', fn: (n: string) => grandparentsOf(n, 'male') },
  { re: /(?:מי\s+ה?)?דוד(?:ות|ה)\s+של\s+(\S+)/u, rel: 'aunt', fn: (n: string) => unclesAuntsOf(n, 'female') },
  { re: /(?:מי\s+ה?)?דוד(?:ים)?\s+של\s+(\S+)/u, rel: 'uncle', fn: (n: string) => unclesAuntsOf(n, 'male') },
  { re: /(?:ה?ילדים|ה?בנים|ה?ילדות)\s+של\s+(\S+)|מי\s+ה?ילדים\s+של\s+(\S+)/u, rel: 'children', fn: (n: string) => childrenOfPublic(n) },
  { re: /(?:בן|בת|בני)\s+ה?זוג\s+של\s+(\S+)|ה?בעל\s+של\s+(\S+)|ה?אישה\s+של\s+(\S+)|פרטנר.*של\s+(\S+)/u, rel: 'partner', fn: (n: string) => partnerOf(n) },
  // Ex-spouse — symmetric edge, so all shapes resolve to exSpouseOf(the named person):
  //   reverse  "רפי (הוא) הגרוש של מי"  → capture רפי  (Rafi is whose ex-husband)
  { re: /([֐-׿]+)\s+(?:הוא\s+|היא\s+)?ה?גרוש(?:ה)?\s+של\s+מי/u, rel: 'ex_spouse', fn: (n: string) => exSpouseOf(n) },
  //   from-whom "ממי מור גרושה" / "מור גרושה ממי" → capture מור
  { re: /ממי\s+([֐-׿]+)\s+גרוש(?:ה)?|([֐-׿]+)\s+גרוש(?:ה)?\s+ממי/u, rel: 'ex_spouse', fn: (n: string) => exSpouseOf(n) },
  //   forward  "(מי) הגרוש/הגרושה של מור" → capture מור (never the interrogative מי)
  { re: /(?:מי\s+)?ה?גרוש(?:ה)?\s+של\s+(?!מי(?![֐-׿]))([֐-׿]+)/u, rel: 'ex_spouse', fn: (n: string) => exSpouseOf(n) },
]

/** Resolve a Hebrew relationship question deterministically from the graph.
 * Returns null if it is not a recognised relationship query. */
export function answerFamilyRelation(text: string): FamilyAnswer | null {
  const t = text.trim().replace(/[?？]/g, '')
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
