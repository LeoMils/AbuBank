/*
 * kinship.ts — DERIVE Hebrew kinship at query time (M3). Never stored.
 * ════════════════════════════════════════════════════════════════════════════
 * relationshipOf(X, Y) answers "X is Y's ___" with the correct gendered Hebrew term,
 * computed from the direct edges in peopleModel. Gender is applied ONLY where known;
 * an unknown-gender person yields the "m/f" form, never a guessed gender.
 *
 * Covered: אח/אחות · דוד/דודה · אחיין/אחיינית · בן דוד/בת דודה · סבא/סבתא ·
 * נכד/נכדה · נין/נינה · גיס/גיסה · חתן/כלה · חם/חמות · מחותנים — plus
 * parent/child/spouse/former-spouse/partner. Death does not remove genealogy.
 */
import { type Person, type Gender, loadPeople, personById } from './peopleModel'

export type KinKind =
  | 'spouse' | 'former_spouse' | 'partner'
  | 'parent' | 'child' | 'sibling'
  | 'grandparent' | 'grandchild' | 'great_grandchild'
  | 'uncle_aunt' | 'nephew_niece' | 'cousin'
  | 'sibling_in_law' | 'child_in_law' | 'parent_in_law' | 'co_in_law' | 'grandchild_in_law'

const TERMS: Record<KinKind, { m: string; f: string }> = {
  spouse: { m: 'בעל', f: 'אישה' },
  former_spouse: { m: 'בעל לשעבר', f: 'אישה לשעבר' },
  partner: { m: 'בן זוג', f: 'בת זוג' },
  parent: { m: 'אבא', f: 'אמא' },
  child: { m: 'בן', f: 'בת' },
  sibling: { m: 'אח', f: 'אחות' },
  grandparent: { m: 'סבא', f: 'סבתא' },
  grandchild: { m: 'נכד', f: 'נכדה' },
  great_grandchild: { m: 'נין', f: 'נינה' },
  uncle_aunt: { m: 'דוד', f: 'דודה' },
  nephew_niece: { m: 'אחיין', f: 'אחיינית' },
  cousin: { m: 'בן דוד', f: 'בת דודה' },
  sibling_in_law: { m: 'גיס', f: 'גיסה' },
  child_in_law: { m: 'חתן', f: 'כלה' },
  parent_in_law: { m: 'חם', f: 'חמות' },
  co_in_law: { m: 'מחותן', f: 'מחותנת' },
  // spouse of a grandchild — "בעל הנכדה" / "אשת הנכד". Hebrew has no one-word term, but this
  // reads naturally as "X בעל הנכדה של מרטיטה" (X, the husband of Martita's granddaughter).
  grandchild_in_law: { m: 'בעל הנכדה', f: 'אשת הנכד' },
}

export function hebrewTerm(kind: KinKind, gender: Gender): string {
  const t = TERMS[kind]
  return gender === 'male' ? t.m : gender === 'female' ? t.f : `${t.m}/${t.f}`
}

export interface Relationship { kind: KinKind; he: string; gender: Gender }

function siblingsOf(p: Person, byId: Map<string, Person>): Set<string> {
  const out = new Set<string>()
  for (const parId of p.parents) { const par = byId.get(parId); for (const c of par?.children ?? []) if (c !== p.id) out.add(c) }
  return out
}

/** "X is Y's ___" — the closest structural relationship, gendered by X. Null if none. */
export function relationshipOf(xId: string, yId: string, people: Person[] = loadPeople()): Relationship | null {
  if (xId === yId) return null
  const byId = new Map(people.map((p) => [p.id, p]))
  const X = byId.get(xId), Y = byId.get(yId)
  if (!X || !Y) return null
  const g = X.gender
  const R = (kind: KinKind): Relationship => ({ kind, he: hebrewTerm(kind, g), gender: g })

  const sibsY = siblingsOf(Y, byId)
  const parentsY = new Set(Y.parents)
  const childrenY = new Set(Y.children)

  // ── direct ties first ──
  if (Y.spouses.includes(xId)) return R('spouse')
  if (Y.formerSpouses.includes(xId)) return R('former_spouse')
  if (Y.partners.includes(xId)) return R('partner')
  if (parentsY.has(xId)) return R('parent')
  if (childrenY.has(xId)) return R('child')
  if (sibsY.has(xId)) return R('sibling')

  // ── two-step blood ties ──
  // grandparent: X is a parent of one of Y's parents
  for (const parId of Y.parents) if (byId.get(parId)?.parents.includes(xId)) return R('grandparent')
  // grandchild: X is a child of one of Y's children
  for (const chId of Y.children) if (byId.get(chId)?.children.includes(xId)) return R('grandchild')
  // great-grandchild: X is a child of one of Y's grandchildren
  for (const chId of Y.children) for (const gcId of byId.get(chId)?.children ?? []) if (byId.get(gcId)?.children.includes(xId)) return R('great_grandchild')
  // uncle/aunt: X is a sibling of one of Y's parents
  for (const parId of Y.parents) if (siblingsOf(byId.get(parId)!, byId).has(xId)) return R('uncle_aunt')
  // nephew/niece: X is a child of one of Y's siblings
  for (const sibId of sibsY) if (byId.get(sibId)?.children.includes(xId)) return R('nephew_niece')
  // cousin: X is a child of a sibling of one of Y's parents
  for (const parId of Y.parents) for (const uncleId of siblingsOf(byId.get(parId)!, byId)) if (byId.get(uncleId)?.children.includes(xId)) return R('cousin')

  // ── affinity (in-law) ties ──
  // A committed PARTNER confers the same in-law terms a spouse does (Yael is Mor's partner, so Yael
  // is Leo's גיסה) — an 81-year-old names the couple, not the marriage certificate. Former spouses too.
  const marriedTo = (p: Person | undefined): string[] => [...(p?.spouses ?? []), ...(p?.formerSpouses ?? []), ...(p?.partners ?? [])]
  // brother/sister-in-law: X is a sibling of Y's spouse/partner, OR X is a spouse/partner of Y's sibling
  const spousesY = marriedTo(Y)
  for (const spId of spousesY) if (siblingsOf(byId.get(spId)!, byId).has(xId)) return R('sibling_in_law')
  for (const sibId of sibsY) { const sib = byId.get(sibId); if (sib && marriedTo(sib).includes(xId)) return R('sibling_in_law') }
  // son/daughter-in-law: X is a spouse/partner of one of Y's children
  for (const chId of Y.children) { const ch = byId.get(chId); if (ch && marriedTo(ch).includes(xId)) return R('child_in_law') }
  // grandchild-in-law: X is a spouse/partner of one of Y's GRANDchildren (the Gilad→Martita gap:
  // Gilad is the husband of Ofir, Martita's granddaughter → never null again). One marriage hop.
  for (const chId of Y.children) for (const gcId of byId.get(chId)?.children ?? []) { const gc = byId.get(gcId); if (gc && marriedTo(gc).includes(xId)) return R('grandchild_in_law') }
  // father/mother-in-law: X is a parent of one of Y's spouses
  for (const spId of spousesY) if (byId.get(spId)?.parents.includes(xId)) return R('parent_in_law')
  // co-in-laws (מחותנים): a child of X married a child of Y
  for (const cx of X.children) { const cxp = byId.get(cx); const married = new Set([...(cxp?.spouses ?? []), ...(cxp?.formerSpouses ?? [])]); for (const cy of Y.children) if (married.has(cy)) return R('co_in_law') }

  return null
}

/** Put the definite article on a term's HEAD noun: "נכד"→"הנכד", "בן דוד"→"בן הדוד". */
export function withArticle(term: string): string {
  return term.includes(' ') ? term.replace(/ (\S+)$/, ' ה$1') : `ה${term}`
}
/** S (a spouse/partner of Y) expressed possessively relative to Y — "אשתו של גלעד", "בעלה של רותי",
 *  "בן זוגו של Y". The noun agrees with S's gender; the possessive suffix agrees with the POSSESSOR Y. */
function spouseOfPhrase(sGender: Gender, yGender: Gender, yName: string, partner: boolean): string {
  const suf = yGender === 'female' ? 'ה' : 'ו'
  const noun = partner ? (sGender === 'female' ? 'בת זוג' : 'בן זוג') : (sGender === 'female' ? 'אשת' : 'בעל')
  return `${noun}${suf} של ${yName}`
}
/** How X (the spouse/partner of someone) is named in construct: "אשת"/"בעל"/"בן זוג"/"בת זוג". */
function spousalNoun(g: Gender): string { return g === 'female' ? 'אשת' : g === 'male' ? 'בעל' : 'בן זוג' }

/**
 * relationBetween — the TERM-FIRST relation between X and Y, the way a Hebrew-speaking family member
 * would actually say it. Order is the owner's rule, NOT the graph's shortest path:
 *   1. a single kinship term (relationshipOf) — "רפי גיס של לאו", "יעל גיסה של לאו".
 *   2. a term via the SPOUSE/partner — the connecting person is the spouse, not whatever node a search
 *      passed: "עדי בן דוד של אשתו של גלעד" (Adi is the cousin of Gilad's WIFE); or via X's own spouse
 *      "ירדן אשת בן הדוד של עדי" (Yarden is the WIFE of Adi's cousin).
 *   3. ONLY if no term exists: the shortest path in one phrase, flagged `termAbsent` so QA can audit it.
 * Never routes through Martita (possessivePathBetween excludes her as an intermediate). Never "בני משפחה".
 */
export function relationBetween(xId: string, yId: string, people: Person[] = loadPeople()): { text: string; termAbsent: boolean } | null {
  const byId = new Map(people.map((p) => [p.id, p]))
  const X = byId.get(xId), Y = byId.get(yId)
  if (!X || !Y || xId === yId) return null
  // 1. a direct kinship term
  const direct = relationshipOf(xId, yId, people)
  if (direct) return { text: `${X.hebrewName} ${direct.he} של ${Y.hebrewName}`, termAbsent: false }
  // 2. a term reached through Y's spouse/partner — expressed relative to that spouse
  for (const [ids, partner] of [[Y.spouses, false], [Y.formerSpouses, false], [Y.partners, true]] as const) {
    for (const sId of ids) {
      const s = byId.get(sId); if (!s) continue
      const t = relationshipOf(xId, sId, people)
      if (t) return { text: `${X.hebrewName} ${t.he} של ${spouseOfPhrase(s.gender, Y.gender, Y.hebrewName, partner)}`, termAbsent: false }
    }
  }
  // 3. a term reached through X's OWN spouse/partner — "X [אשת/בעל] [the spouse's term] של Y"
  for (const ids of [X.spouses, X.formerSpouses, X.partners]) {
    for (const sId of ids) {
      const ts = relationshipOf(sId, yId, people)
      if (ts) return { text: `${X.hebrewName} ${spousalNoun(X.gender)} ${withArticle(ts.he)} של ${Y.hebrewName}`, termAbsent: false }
    }
  }
  // 4. no Hebrew term exists — the shortest path in one natural phrase, FLAGGED term-absent
  const path = possessivePathBetween(xId, yId, people)
  if (path) return { text: `${X.hebrewName} ${X.gender === 'female' ? 'היא' : 'הוא'} ${path}`, termAbsent: true }
  return null
}

/** All of Y's relatives of a given kind (their ids). e.g. every נכד of Martita. */
export function relativesOfKind(yId: string, kind: KinKind, people: Person[] = loadPeople()): string[] {
  return people.filter((p) => p.id !== yId && relationshipOf(p.id, yId, people)?.kind === kind).map((p) => p.id)
}

export function describeRelationship(xId: string, yId: string, people: Person[] = loadPeople()): string | null {
  const r = relationshipOf(xId, yId, people)
  if (!r) return null
  const X = personById(xId, people), Y = personById(yId, people)
  if (!X || !Y) return null
  return `${X.hebrewName} ${r.he} של ${Y.hebrewName}`
}

/** Adjacency for path-finding: everyone one structural hop from p (blood + marriage + sibling). */
function neighboursOf(p: Person, byId: Map<string, Person>): string[] {
  const sibs = siblingsOf(p, byId)
  return [...new Set([...p.parents, ...p.children, ...p.spouses, ...p.formerSpouses, ...p.partners, ...sibs])]
    .filter((id) => byId.has(id))
}

/** Shortest chain of person ids from X to Y over the family graph, or null. Bounded so a
 *  description stays legible (a 4-hop path is the furthest we render — beyond that, fall back
 *  to the person's role rather than a sprawling sentence). */
function shortestPath(xId: string, yId: string, byId: Map<string, Person>, maxHops = 4): string[] | null {
  if (xId === yId) return null
  const prev = new Map<string, string>()
  const seen = new Set<string>([xId])
  let frontier = [xId]
  for (let depth = 0; depth < maxHops && frontier.length; depth++) {
    const next: string[] = []
    for (const id of frontier) {
      for (const nb of neighboursOf(byId.get(id)!, byId)) {
        if (seen.has(nb)) continue
        seen.add(nb); prev.set(nb, id)
        if (nb === yId) { // reconstruct
          const path = [yId]; let cur = yId
          while (cur !== xId) { cur = prev.get(cur)!; path.unshift(cur) }
          return path
        }
        next.push(nb)
      }
    }
    frontier = next
  }
  return null
}

/**
 * FIX 2 — when NO single kinship term exists (a niece's husband, a grand-nephew, a grandson's
 * wife), DESCRIBE THE PATH instead of saying "no relation". Find the shortest structural chain
 * X→…→Y and render each hop with its real gendered term, chained naturally in Hebrew
 * ("רוסיטה היא הבת של X, שהוא האח של פפי, שהוא הבעל של מרטיטה"). Every hop is a structurally
 * present edge — nothing is invented. Null only when the two are genuinely disconnected (or
 * further apart than we will narrate). Death never removes a path (genealogy persists).
 */
/**
 * The relation BETWEEN X and Y as ONE natural possessive phrase — NEVER routed through Martita, never
 * a generic "בני משפחה" bucket (both were owner rejections). Walks the shortest path X→…→Y and renders
 * it as a nested possessive that names ONLY Y at the end, dropping intermediate names:
 *   ירדן→עילי→לאו   →  "האישה של האחיין של לאו"   (Yarden is the wife of the nephew of Leo)
 *   עדי→אופיר→גלעד  →  "בן הדוד של האישה של גלעד"  (Adi is the cousin of the wife of Gilad)
 * Each hop is a real structural edge with its gendered term; nothing is invented. Null only when the
 * two are genuinely disconnected.
 */
export function possessivePathBetween(xId: string, yId: string, people: Person[] = loadPeople()): string | null {
  const byId = new Map(people.map((p) => [p.id, p]))
  // SEMANTIC adjacency: two people are one hop apart when a SINGLE derived kinship term connects them
  // (cousin, nephew, uncle…), not only a raw blood/marriage edge. This gives the SHORT relation the
  // owner wants — "cousin of his wife", "wife of the nephew" — instead of a long parent/child chain.
  const SELF = 'martita'
  const semanticNeighbours = (id: string): string[] =>
    people.filter((q) => q.id !== id && relationshipOf(id, q.id, people) !== null).map((q) => q.id)
  const path = ((): string[] | null => {
    if (xId === yId) return null
    const prev = new Map<string, string>(); const seen = new Set<string>([xId]); let frontier = [xId]
    for (let depth = 0; depth < 4 && frontier.length; depth++) {
      const next: string[] = []
      for (const id of frontier) for (const nb of semanticNeighbours(id)) {
        if (seen.has(nb)) continue
        // NEVER route the relation BETWEEN two people THROUGH Martita (owner: she is not in the answer
        // unless she is one of the two asked about). She may still be an endpoint.
        if (nb === SELF && nb !== yId) { seen.add(nb); continue }
        seen.add(nb); prev.set(nb, id)
        if (nb === yId) { const p = [yId]; let cur = yId; while (cur !== xId) { cur = prev.get(cur)!; p.unshift(cur) } return p }
        next.push(nb)
      }
      frontier = next
    }
    return null
  })()
  if (!path || path.length < 2) return null
  const terms: string[] = []
  for (let i = 0; i < path.length - 1; i++) {
    const rel = relationshipOf(path[i]!, path[i + 1]!, people)
    if (!rel) return null // adjacent nodes must have a direct term (safety)
    terms.push(rel.he)
  }
  const yName = byId.get(yId)!.hebrewName
  // ה-prefix each term (article), join with " של ", end at Y's name. Multi-word terms take the ה on the
  // HEAD noun ("בן דוד"→"בן הדוד", "בת זוג"→"בת הזוג"). Collapse any accidental doubled ה.
  const withArticle = (t: string): string => (t.includes(' ') ? t.replace(/ (\S+)$/, ' ה$1') : `ה${t}`)
  const chain = terms.map(withArticle).join(' של ') + ` של ${yName}`
  return chain.replace(/הה+/g, 'ה')
}

export function describePathBetween(xId: string, yId: string, people: Person[] = loadPeople()): string | null {
  const byId = new Map(people.map((p) => [p.id, p]))
  const path = shortestPath(xId, yId, byId)
  if (!path || path.length < 2) return null
  const pron = (g: Gender, fallbackName: string): string => (g === 'female' ? 'שהיא' : g === 'male' ? 'שהוא' : `ש${fallbackName}`)
  const parts: string[] = []
  for (let i = 0; i < path.length - 1; i++) {
    const a = byId.get(path[i]!)!, b = byId.get(path[i + 1]!)!
    const r = relationshipOf(a.id, b.id, people)
    if (!r) return null // adjacent nodes must have a direct term; safety only
    parts.push(i === 0 ? `${a.hebrewName} ${r.he} של ${b.hebrewName}` : `${pron(a.gender, a.hebrewName)} ${r.he} של ${b.hebrewName}`)
  }
  return parts.join(', ')
}
