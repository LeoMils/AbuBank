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
  | 'sibling_in_law' | 'child_in_law' | 'parent_in_law' | 'co_in_law'

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
  // brother/sister-in-law: X is a sibling of Y's spouse, OR X is a spouse of Y's sibling
  const spousesY = [...Y.spouses, ...Y.formerSpouses]
  for (const spId of spousesY) if (siblingsOf(byId.get(spId)!, byId).has(xId)) return R('sibling_in_law')
  for (const sibId of sibsY) { const sib = byId.get(sibId); if (sib && [...sib.spouses, ...sib.formerSpouses].includes(xId)) return R('sibling_in_law') }
  // son/daughter-in-law: X is a spouse of one of Y's children
  for (const chId of Y.children) { const ch = byId.get(chId); if (ch && [...ch.spouses, ...ch.formerSpouses].includes(xId)) return R('child_in_law') }
  // father/mother-in-law: X is a parent of one of Y's spouses
  for (const spId of spousesY) if (byId.get(spId)?.parents.includes(xId)) return R('parent_in_law')
  // co-in-laws (מחותנים): a child of X married a child of Y
  for (const cx of X.children) { const cxp = byId.get(cx); const married = new Set([...(cxp?.spouses ?? []), ...(cxp?.formerSpouses ?? [])]); for (const cy of Y.children) if (married.has(cy)) return R('co_in_law') }

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
