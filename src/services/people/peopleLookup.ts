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
import { relationshipOf, relativesOfKind, hebrewTerm, describePathBetween, type KinKind } from './kinship'
import { fuzzyResolvePersonId, fuzzyCandidates } from './fuzzyMatch'

/** A misheard direct name → a person id, or null (P8). Confident + unambiguous only; never a
 *  wrong guess. Used ONLY after an exact match AND descriptive-phrase parse have both missed. */
function fuzzyId(name: string, people: Person[]): string | null {
  const r = fuzzyResolvePersonId(name, fuzzyCandidates(people))
  return r ? r.id : null
}

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
  | { status: 'deceased'; label: string }
  | { status: 'not_found' }

export function whoIs(name: string, people: Person[] = loadPeople()): WhoIs | NotFound {
  // Direct name first (a real person named like a kinship word stays that person).
  // Then a descriptive phrase ("הבת של רפי") — but only when it resolves to EXACTLY
  // ONE person; 0 or >1 → not_found, never a guessed identity.
  let id = resolvePersonId(name, people)
  if (!id) {
    const desc = resolveDescriptive(name, people)
    // A descriptive phrase resolves structurally; a plain (possibly MISHEARD) name that is not a
    // phrase gets one confident fuzzy/phonetic try before we give up (P8).
    id = desc === null ? fuzzyId(name, people) : desc.length === 1 ? desc[0]! : null
  }
  const p = id ? personById(id, people) : null
  if (!p) return { status: 'not_found' }
  const relRec = p.id === SELF ? null : relationshipOf(p.id, SELF, people)
  return {
    status: 'ok', name: p.hebrewName, gender: p.gender,
    relationToMartita: relRec ? `${relRec.he} של מרטיטה` : (p.role ?? null),
    ...(p.notes ? { notes: p.notes } : {}),
  }
}

/** "X is Y's ___" in Hebrew. A single kinship term when one exists; otherwise the DESCRIBED
 *  PATH (FIX 2 — a by-marriage tie is never "no relation"); only truly disconnected people
 *  are 'unrelated'. Unknown names are 'not_found'. */
export function relationshipBetween(nameX: string, nameY: string, people: Person[] = loadPeople()): { status: 'ok'; text: string } | { status: 'unrelated' } | NotFound {
  const x = resolvePersonId(nameX, people), y = resolvePersonId(nameY, people)
  if (!x || !y) return { status: 'not_found' }
  const r = relationshipOf(x, y, people)
  if (r) return { status: 'ok', text: `${personById(x, people)!.hebrewName} ${r.he} של ${personById(y, people)!.hebrewName}` }
  const path = describePathBetween(x, y, people)
  if (path) return { status: 'ok', text: path }
  return { status: 'unrelated' }
}

/** "My friends" — Martita's friend circle: living role-bearers who relate to her as FRIENDS,
 *  i.e. have NO blood/marriage path into the family graph (that excludes role-bearing relatives
 *  like Nili, the partner of an ex-son-in-law, who is kin by a path). Friends relate by role,
 *  not kinship, but must be reachable on the SAME tool as everyone else. Returns Hebrew names. */
export function friendsOf(_name: string = SELF, people: Person[] = loadPeople()): string[] {
  return people
    .filter((p) => !p.deceased && p.role !== undefined && /חבר/.test(p.role) && p.id !== SELF)
    .filter((p) => relationshipOf(p.id, SELF, people) === null && describePathBetween(p.id, SELF, people) === null)
    .map((p) => p.hebrewName)
}

export function relativesByKind(name: string, kind: KinKind, people: Person[] = loadPeople()): { status: 'ok'; kind: KinKind; term: string; people: string[] } | NotFound {
  const id = resolvePersonId(name, people)
  if (!id) return { status: 'not_found' }
  const rel = relativesOfKind(id, kind, people).map((rid) => personById(rid, people)!.hebrewName)
  return { status: 'ok', kind, term: hebrewTerm(kind, 'unknown'), people: rel }
}

/** A descriptive relationship phrase, decomposed into the kinship kind (+ optional
 *  gender filter) and its ANCHOR — the person the relationship is relative to. The
 *  anchor is either Martita (the SELF sentinel, from "שלי" or a bare kinship word) or a
 *  NAMED person (from "של <name>", e.g. "הבת של רפי" → anchor "רפי"). */
interface DescriptivePhrase { kind: KinKind; gender?: Gender; anchor: string }

/**
 * Parse a descriptive phrase deterministically, or return null when it is not one.
 * Examples: "הבת שלי" → {child/female, anchor SELF}; "הבת של רפי" → {child/female,
 * anchor "רפי"}; "הנכד שלי" → {grandchild/male, anchor SELF}; a bare "הבת" → SELF.
 * A possessive PRONOUN anchor ("שלו"/"שלה"/"שלך" — his/her/your) has no deterministic
 * referent here (no working-memory context), so it returns null → the caller declines
 * rather than guessing whose daughter is meant.
 */
function parseDescriptivePhrase(phrase: string): DescriptivePhrase | null {
  const s = phrase.normalize('NFC').trim()
  // Find the kinship word (optionally with a leading ה־), as a whole token.
  let found: { kind: KinKind; gender?: Gender } | null = null
  for (const word of Object.keys(WORD_TO_KIND)) {
    if (new RegExp(`(^|\\s)ה?${word}(\\s|$)`).test(s)) { found = WORD_TO_KIND[word]!; break }
  }
  if (!found) return null
  // Anchor = a NAMED person: "... של <name>" (name = the rest of the string). Anchored
  // on whitespace/start, NOT \b — \b is ASCII-only and never fires before a Hebrew letter.
  const named = s.match(/(?:^|\s)של\s+([א-ת][^]*?)\s*$/)
  if (named && named[1]!.trim()) return { ...found, anchor: named[1]!.trim() }
  // Anchor = Martita: explicit "שלי" (my) or a bare kinship word with no "של".
  if (/שלי(\s|$)/.test(s) || !/של/.test(s)) return { ...found, anchor: SELF }
  // Possessive pronoun (שלו/שלה/שלך) — no deterministic anchor → do not guess.
  return null
}

/**
 * Resolve a descriptive phrase to the list of people it denotes, deterministically:
 *   • null  → the phrase is NOT descriptive (caller should try a direct-name match)
 *   • []    → descriptive but the anchor/relatives could not be resolved → not_found
 *   • [ids] → the exact relatives of the correct anchor (never a fuzzy substitute)
 * A NAMED anchor that does not resolve returns [] (not_found) — it NEVER falls back to
 * Martita, which was the "הבת של רפי → wrong person" defect.
 */
function resolveDescriptive(phrase: string, people: Person[]): string[] | null {
  const desc = parseDescriptivePhrase(phrase)
  if (!desc) return null
  const anchorId = desc.anchor === SELF ? SELF : resolvePersonId(desc.anchor, people)
  if (!anchorId) return [] // named anchor unknown → not_found, never guess
  let matches = relativesOfKind(anchorId, desc.kind, people)
  if (desc.gender) matches = matches.filter((id) => personById(id, people)!.gender === desc.gender)
  return matches
}

/** Resolve a contact target by a DIRECT name OR a descriptive relationship phrase.
 *  Direct name FIRST (so a real person named like a kinship word — e.g. "דוד"/David —
 *  is the person, not "my uncle"); only a phrase with no direct match is parsed
 *  structurally. Returns an id + label (never a number). Ambiguous relationships
 *  (e.g. "נכד" → 6 people) come back as candidates so Abu asks which one; an unknown
 *  named anchor ("הבת של <someone unknown>") is not_found, never a guess. */
export function resolveContactTarget(phrase: string, people: Person[] = loadPeople()): ContactResult {
  const direct = resolvePersonId(phrase, people)
  if (direct) {
    const p = personById(direct, people)!
    // A deceased person is an identity, not a reachable contact — never a call/message.
    if (p.deceased) return { status: 'deceased', label: p.hebrewName }
    return { status: 'resolved', id: p.id, label: p.hebrewName }
  }
  const desc = resolveDescriptive(phrase, people)
  if (desc === null) {
    // not a descriptive phrase and no exact match → one confident fuzzy/phonetic try (P8) before not_found
    const fid = fuzzyId(phrase, people)
    if (fid) { const p = personById(fid, people)!; return p.deceased ? { status: 'deceased', label: p.hebrewName } : { status: 'resolved', id: p.id, label: p.hebrewName } }
    return { status: 'not_found' }
  }
  const matches = desc.map((id) => personById(id, people)!)
  if (matches.length === 1) {
    const p = matches[0]!
    if (p.deceased) return { status: 'deceased', label: p.hebrewName }
    return { status: 'resolved', id: p.id, label: p.hebrewName }
  }
  if (matches.length > 1) return { status: 'ambiguous', candidates: matches.map((p) => ({ id: p.id, label: p.hebrewName })) }
  return { status: 'not_found' }
}
