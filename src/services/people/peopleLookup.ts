/*
 * peopleLookup.ts — the ONE people tool (M3). Retires resolve_contact.
 * ════════════════════════════════════════════════════════════════════════════
 * Answers, over the single people model:
 *   • who is X                       → identity + how they relate to Martita
 *   • the relationship between X, Y   → derived Hebrew term (gendered)
 *   • X's relatives of a kind         → list (e.g. every נכד)
 *   • contact for a person named directly OR by relationship ("הבת שלי")
 * Numbers NEVER enter the model — contact resolution returns an id + label; the UI
 * layer turns an id into a phone number, exactly as the card system already does.
 */
import { loadPeople, resolvePersonId, personById, type Person, type Gender } from './peopleModel'
import { relationshipOf, relativesOfKind, hebrewTerm, type KinKind } from './kinship'

const SELF = 'martita' // "שלי" / "my" is relative to Martita (the user)

/** Hebrew kinship words → the derived kind (+ gender filter for gendered words). */
const WORD_TO_KIND: Record<string, { kind: KinKind; gender?: Gender }> = {
  'בת': { kind: 'child', gender: 'female' }, 'בן': { kind: 'child', gender: 'male' },
  'אח': { kind: 'sibling', gender: 'male' }, 'אחות': { kind: 'sibling', gender: 'female' },
  'נכד': { kind: 'grandchild', gender: 'male' }, 'נכדה': { kind: 'grandchild', gender: 'female' },
  'נין': { kind: 'great_grandchild', gender: 'male' }, 'נינה': { kind: 'great_grandchild', gender: 'female' },
  'דוד': { kind: 'uncle_aunt', gender: 'male' }, 'דודה': { kind: 'uncle_aunt', gender: 'female' },
}

export interface WhoIs { status: 'ok'; name: string; gender: Gender; relationToMartita: string | null; notes?: string }
export interface NotFound { status: 'not_found' }
export type ContactResult =
  | { status: 'resolved'; id: string; label: string }
  | { status: 'ambiguous'; candidates: Array<{ id: string; label: string }> }
  | { status: 'not_found' }

export function whoIs(name: string, people: Person[] = loadPeople()): WhoIs | NotFound {
  const id = resolvePersonId(name, people)
  const p = id ? personById(id, people) : null
  if (!p) return { status: 'not_found' }
  const relRec = p.id === SELF ? null : relationshipOf(p.id, SELF, people)
  return {
    status: 'ok', name: p.hebrewName, gender: p.gender,
    relationToMartita: relRec ? `${relRec.he} של מרטיטה` : (p.role ?? null),
    ...(p.notes ? { notes: p.notes } : {}),
  }
}

/** "X is Y's ___" in Hebrew, or an honest "not related" / "not found". */
export function relationshipBetween(nameX: string, nameY: string, people: Person[] = loadPeople()): { status: 'ok'; text: string } | { status: 'unrelated' } | NotFound {
  const x = resolvePersonId(nameX, people), y = resolvePersonId(nameY, people)
  if (!x || !y) return { status: 'not_found' }
  const r = relationshipOf(x, y, people)
  if (!r) return { status: 'unrelated' }
  return { status: 'ok', text: `${personById(x, people)!.hebrewName} ${r.he} של ${personById(y, people)!.hebrewName}` }
}

export function relativesByKind(name: string, kind: KinKind, people: Person[] = loadPeople()): { status: 'ok'; kind: KinKind; term: string; people: string[] } | NotFound {
  const id = resolvePersonId(name, people)
  if (!id) return { status: 'not_found' }
  const rel = relativesOfKind(id, kind, people).map((rid) => personById(rid, people)!.hebrewName)
  return { status: 'ok', kind, term: hebrewTerm(kind, 'unknown'), people: rel }
}

/** A relationship phrase like "הבת שלי" / "הנכד שלי" → the kind + gender filter, or null. */
function parseRelationshipPhrase(phrase: string): { kind: KinKind; gender?: Gender } | null {
  const cleaned = phrase.normalize('NFC').replace(/של[יו]?|ה(?=[א-ת])/g, ' ').trim()
  for (const word of Object.keys(WORD_TO_KIND)) if (new RegExp(`(^|\\s)${word}(\\s|$)`).test(` ${cleaned} `)) return WORD_TO_KIND[word]!
  return null
}

/** Resolve a contact target by a DIRECT name OR by a relationship to Martita. Returns
 *  an id + label (never a number). Ambiguous relationships (e.g. "נכד" → 6 people)
 *  come back as candidates so Abu asks which one. */
export function resolveContactTarget(phrase: string, people: Person[] = loadPeople()): ContactResult {
  const direct = resolvePersonId(phrase, people)
  if (direct) { const p = personById(direct, people)!; return { status: 'resolved', id: p.id, label: p.hebrewName } }
  const rk = parseRelationshipPhrase(phrase)
  if (!rk) return { status: 'not_found' }
  let matches = relativesOfKind(SELF, rk.kind, people).map((id) => personById(id, people)!)
  if (rk.gender) matches = matches.filter((p) => p.gender === rk.gender)
  if (matches.length === 1) return { status: 'resolved', id: matches[0]!.id, label: matches[0]!.hebrewName }
  if (matches.length > 1) return { status: 'ambiguous', candidates: matches.map((p) => ({ id: p.id, label: p.hebrewName })) }
  return { status: 'not_found' }
}
