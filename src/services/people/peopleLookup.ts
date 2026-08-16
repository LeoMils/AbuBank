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
import { loadPeople, resolvePersonId, personById, subsetResolve, type Person, type Gender } from './peopleModel'
import { relationshipOf, relativesOfKind, hebrewTerm, describePathBetween, type KinKind } from './kinship'
import { fuzzyResolvePersonId, fuzzyCandidates, skeletonMatchIds, hebrewPhonetic, similarity } from './fuzzyMatch'
import { normalizeName } from './peopleModel'

/**
 * SUGGEST the closest person for a name that did NOT resolve — the misheard-word P0. When STT
 * mangles a name ("טוצ'י" → "טורקי") the resolver correctly declines, but declining SILENTLY made
 * Abu lecture about "Turkish coffee". Instead, offer the closest candidate so she can ASK
 * "התכוונת ל…?". A suggestion is looser than a resolution (it does NOT need to be unambiguous — a
 * question is safe), but it still needs real closeness so genuine GARBLE gets no suggestion (→ the
 * caller says "לא שמעתי טוב, תגידי שוב" instead of confirming noise). Returns the best if its
 * similarity ≥ 0.5, else null. Never used to ANSWER — only to ask.
 */
export function suggestClosestPerson(
  name: string,
  people: Person[] = loadPeople(),
  minSimilarity = 0.5,
): { id: string; label: string; score: number } | null {
  const q = normalizeName(name)
  if (!q || q.length < 2) return null
  const qp = hebrewPhonetic(name)
  let best: { id: string; score: number } | null = null
  for (const c of fuzzyCandidates(people)) {
    let s = 0
    for (const k of c.keys) {
      s = Math.max(s, similarity(q, normalizeName(k)))
      if (qp.length >= 2) s = Math.max(s, similarity(qp, hebrewPhonetic(k)) * 0.98)
    }
    if (!best || s > best.score) best = { id: c.id, score: s }
  }
  if (!best || best.score < minSimilarity) return null
  const p = personById(best.id, people)
  return p ? { id: p.id, label: p.hebrewName, score: best.score } : null
}

/** The person to ASK about when a name did not resolve. A subset CONFLICT ("given name + an
 *  unconfirmed surname") names its exact candidate — ask about THAT person by name; otherwise fall
 *  back to the closest phonetic match. Null → genuine garble (the caller asks her to repeat). */
export function suggestForMiss(name: string, people: Person[] = loadPeople()): { id: string; label: string } | null {
  const sub = subsetResolve(name, people)
  if (sub.status === 'conflict') { const p = personById(sub.id, people); if (p) return { id: p.id, label: p.hebrewName } }
  const sug = suggestClosestPerson(name, people)
  return sug ? { id: sug.id, label: sug.label } : null
}

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
  /** KNOWN person, but not an actual contact (no phone) — Abu says who they are, never offers to reach. */
  | { status: 'not_a_contact'; id: string; label: string }
  | { status: 'not_found' }

/** Resolve a matched person to a REACH status: deceased (gone) > not_a_contact (known, no phone) >
 *  resolved (a real contact). Every resolveContactTarget success path goes through this so the
 *  reachability gate is applied uniformly (a name, a nickname, a fuzzy/subset match — all identical). */
function contactStatusFor(p: Person): ContactResult {
  if (p.deceased) return { status: 'deceased', label: p.hebrewName }
  if (!p.reachable) return { status: 'not_a_contact', id: p.id, label: p.hebrewName }
  return { status: 'resolved', id: p.id, label: p.hebrewName }
}

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
  // SUBSET fallback (device P0): "גלעד אבורדי" = a known given name + an unknown surname. If the
  // spoken name uniquely names ONE person in the dataset, that person wins — never not_found for
  // someone who IS in the dataset. (Ambiguous across several people falls through to not_found.)
  if (!id) { const sub = subsetResolve(name, people); if (sub.status === 'resolved') id = sub.id }
  const p = id ? personById(id, people) : null
  if (!p) return { status: 'not_found' }
  // relationToMartita is NEVER null for a connected entity (the Gilad defect: the resolver
  // returned null and an 81-year-old had to name her own grandson-in-law). Order: a single
  // derived kinship term → else the person's stated role (a short, human phrase like
  // "אחייניתו של פפי") → else, if they are connected at all, a plain "family member". We NEVER
  // hand the raw multi-hop PATH to speech (class RAW-TOOL-OUTPUT: the same sprawl fixed for
  // relationshipBetween) — a "who is X" answer needs one phrase, not a chain of hops.
  let relationToMartita: string | null = null
  if (p.id !== SELF) {
    const relRec = relationshipOf(p.id, SELF, people)
    if (relRec) relationToMartita = `${relRec.he} של מרטיטה`
    else if (p.role) relationToMartita = p.role
    else if (describePathBetween(p.id, SELF, people)) relationToMartita = p.gender === 'female' ? 'בת משפחה של מרטיטה' : 'בן משפחה של מרטיטה'
  }
  return {
    status: 'ok', name: p.hebrewName, gender: p.gender,
    relationToMartita,
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
  // No single kinship term for the pair. Martita wants the relation as ONE short phrase, never a
  // transitive chain ("גלעד הבעל של אופיר, שהיא הבת של מור, שהיא…") — that sprawl was the device
  // defect. Anchor BOTH to the person she knows best, herself: if each relates to Martita by a real
  // term, say exactly that. It is the shortest true thing and it never narrates a hop chain to her.
  if (x !== SELF && y !== SELF) {
    const rx = relationshipOf(x, SELF, people), ry = relationshipOf(y, SELF, people)
    if (rx && ry) {
      const X = personById(x, people)!, Y = personById(y, people)!
      return { status: 'ok', text: `${X.hebrewName} ${rx.he} שלך ו${Y.hebrewName} ${ry.he} שלך` }
    }
  }
  // One side is only reachable by a longer path (no clean anchor term) — still never a chain: say the
  // shortest honest thing, that they are family. describePathBetween is used only as an EXISTENCE test.
  if (describePathBetween(x, y, people)) {
    return { status: 'ok', text: `${personById(x, people)!.hebrewName} ו${personById(y, people)!.hebrewName} בני משפחה` }
  }
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
    // A deceased person is an identity, not a reachable contact; a known-but-not-a-contact person
    // (a friend's care-facility son, a Vancouver relative) is answered but never offered to reach.
    return contactStatusFor(p)
  }
  const desc = resolveDescriptive(phrase, people)
  if (desc === null) {
    // A misheard DIRECT name (no exact match, not a phrase). Exhaust normalization before
    // not_found (the "גילעד" defect): the matres-lectionis SKELETON collapses STT yud/vav noise.
    // Several living people share a skeleton (short names like רון/רוני) → ASK which one, never
    // not_found and never a silent wrong guess. Exactly one → the fuzzy layer resolves it below.
    // Skeleton takes PRECEDENCE over edit-distance: a unique match resolves, several ASK. This
    // recovers the matres-mangled name AND prevents an edit-distance guess to the wrong person
    // (the "עדי→lydia"/"ארי→mor" class). The unique/ambiguous decision is made on the FULL set
    // INCLUDING deceased — otherwise a mishearing of a deceased person (פפי→"פופי") whose skeleton
    // also matches a living one (פופה) would drop the deceased and silently resolve to the living
    // person. Edit-distance runs only when the skeleton gives no signal at all.
    const skel = skeletonMatchIds(phrase, fuzzyCandidates(people)).map((id) => personById(id, people)!).filter(Boolean)
    if (skel.length === 1) { const p = skel[0]!; return contactStatusFor(p) }
    if (skel.length >= 2) {
      // Ambiguous → ask, offering ALL matches INCLUDING the deceased. Filtering the deceased here
      // hid the intended person when a mishearing of a deceased name (פפי/Pepe → "פופי") also
      // matched a living one (פופה) — it silently offered only the living one. Naming both keeps
      // the clarifying question honest ("did you mean Pepe, who passed, or Pupa?").
      return { status: 'ambiguous', candidates: skel.map((p) => ({ id: p.id, label: p.hebrewName })) }
    }
    // no skeleton signal → one confident edit-distance try (P8) before not_found
    const fid = fuzzyId(phrase, people)
    if (fid) { const p = personById(fid, people)!; return contactStatusFor(p) }
    // SUBSET fallback (device P0): "given name + surname". A CONFIRMED surname resolves; an
    // UNCONFIRMED/conflicting surname (a public figure sharing a given name) is NOT resolved
    // silently — it becomes an ask ("did you mean <the one person by that given name>?").
    const sub = subsetResolve(phrase, people)
    if (sub.status === 'resolved') { const p = personById(sub.id, people)!; return contactStatusFor(p) }
    if (sub.status === 'ambiguous') return { status: 'ambiguous', candidates: sub.ids.map((id) => ({ id, label: personById(id, people)!.hebrewName })) }
    if (sub.status === 'conflict') return { status: 'ambiguous', candidates: [{ id: sub.id, label: personById(sub.id, people)!.hebrewName }] }
    return { status: 'not_found' }
  }
  const matches = desc.map((id) => personById(id, people)!)
  if (matches.length === 1) {
    const p = matches[0]!
    return contactStatusFor(p)
  }
  if (matches.length > 1) return { status: 'ambiguous', candidates: matches.map((p) => ({ id: p.id, label: p.hebrewName })) }
  return { status: 'not_found' }
}
