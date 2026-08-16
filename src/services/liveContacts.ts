/*
 * liveContacts.ts — Abu AI, Milestone 2/3: DETERMINISTIC contact resolution.
 * ════════════════════════════════════════════════════════════════════════════
 * The ONE place person-identity is decided for the live path. It is intentionally
 * NOT a family-graph engine and NOT a relationship reasoner — the Realtime model
 * derives "Leo is Mor's brother" for free from the family knowledge. This module
 * only answers one narrow, safety-critical question:
 *
 *     resolve_contact(name_as_spoken) -> { id } | AMBIGUOUS | NOT_FOUND
 *
 * Calendar attendees, WhatsApp recipients and call targets accept ONLY an id that
 * this function returned. That makes "אח של מור" -> Leo STRUCTURALLY impossible
 * (a relationship phrase resolves to AMBIGUOUS, never to a person) rather than
 * merely discouraged by prompt text.
 *
 * PRIVACY BY CONSTRUCTION: the registry is built from knowledge/family_data.json
 * NAMES and ALIASES only. No phone number is ever read, stored, or returned here —
 * numbers live exclusively in the contacts store and never enter the model context.
 *
 * The registry is a flat name→id map. ids are opaque, stable handles derived from
 * each person's canonical (Latin) name; they carry no private data.
 */
import familyData from '../../knowledge/family_data.json'

export type ContactResolution =
  | { status: 'resolved'; id: string; label: string }
  | { status: 'ambiguous'; candidates: Array<{ id: string; label: string }>; phrase: string }
  | { status: 'not_found'; phrase: string }

interface PersonRecord {
  id: string
  /** The Hebrew display name Martita uses. */
  label: string
  canonical: string
  /** Lowercased match keys: hebrew name, canonical name, aliases. */
  keys: string[]
  /** True for a person in the `deceased` group — resolvable for who/remember, but
   *  NEVER reachable (call/message). Reaching them is a gentle decline, not a card. */
  deceased: boolean
  /** True for an ACTUAL contact (a real phone): immediate family by default, or a friend/relative
   *  the data opts in with `reachable:true`. A known-but-not-a-contact person is answered for
   *  who-they-are but NEVER offered a message/call card (device: a friend's care-facility son). */
  reachable: boolean
}

interface RawPerson {
  canonical_name?: string
  hebrew_name?: string
  aliases?: string[]
  deceased?: boolean
  reachable?: boolean
}

/** Immediate-family groups whose members are real contacts by default; everyone else is opt-in. */
const REACHABLE_GROUPS: readonly string[] = ['children', 'children_related', 'grandchildren_mor', 'grandchildren_leo', 'grandchildren_spouses']

/** The person-bearing groups of family_data.json. Pets are intentionally excluded. */
const PERSON_GROUPS = [
  'matriarch', 'deceased', 'children', 'children_related',
  'grandchildren_mor', 'grandchildren_leo', 'grandchildren_spouses',
  'great_grandchildren', 'close_friends', 'extended_family',
] as const

function toId(canonical: string): string {
  return canonical.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

/** Test/harness seam: when set, the registry is built from THIS data instead of the
 *  bundled knowledge/family_data.json. Lets the text harness inject a fake family
 *  graph per scenario. Default (null) is the real bundled data — runtime is unchanged. */
let DATA_OVERRIDE: { family: Record<string, unknown> } | null = null

function collectPeople(): PersonRecord[] {
  const fam = (DATA_OVERRIDE ?? (familyData as { family: Record<string, unknown> })).family
  const out: PersonRecord[] = []
  for (const group of PERSON_GROUPS) {
    const raw = fam[group]
    const list: RawPerson[] = Array.isArray(raw) ? raw : raw ? [raw as RawPerson] : []
    for (const p of list) {
      const canonical = (p.canonical_name ?? p.hebrew_name ?? '').trim()
      if (!canonical) continue
      const label = (p.hebrew_name ?? p.canonical_name ?? '').trim()
      const keys = new Set<string>()
      if (p.hebrew_name) keys.add(normalize(p.hebrew_name))
      if (p.canonical_name) keys.add(normalize(p.canonical_name))
      for (const a of p.aliases ?? []) if (a) keys.add(normalize(a))
      const deceased = group === 'deceased' || !!p.deceased
      out.push({ id: toId(canonical), label, canonical, keys: [...keys], deceased, reachable: !deceased && (p.reachable ?? REACHABLE_GROUPS.includes(group)) })
    }
  }
  return out
}

/** Lazily-built, cached registry (family_data.json is static at build time). */
let REGISTRY: PersonRecord[] | null = null
function registry(): PersonRecord[] {
  if (!REGISTRY) REGISTRY = collectPeople()
  return REGISTRY
}

/** Test seam: rebuild the registry (used only if the data is swapped in a test). */
export function __resetContactRegistry(): void { REGISTRY = null }

/** Test/harness seam: inject a fake family graph (or null to restore the bundled
 *  data). Rebuilds the registry on the next resolve. Never used by runtime. */
export function __setContactData(fake: { family: Record<string, unknown> } | null): void {
  DATA_OVERRIDE = fake
  REGISTRY = null
}

/** Every known contact id (for validating an id the model hands back). */
export function knownContactIds(): Set<string> {
  return new Set(registry().map((r) => r.id))
}

/** The Hebrew display label for a resolved id, or null if the id is unknown. */
export function contactLabel(id: string): string | null {
  return registry().find((r) => r.id === id)?.label ?? null
}

/** True if a resolved contact id belongs to a DECEASED person. Reaching them (call /
 *  message) must be a gentle "he is no longer with us", never a call/message card. */
export function isDeceasedContact(id: string): boolean {
  return registry().find((r) => r.id === id)?.deceased ?? false
}

/** True if a resolved contact id is an ACTUAL contact Abu may message/call. A known person who is
 *  NOT a contact (no phone) is answered for who-they-are but never offered a message/call card. */
export function isReachableContact(id: string): boolean {
  return registry().find((r) => r.id === id)?.reachable ?? false
}

// ─── Normalization ───────────────────────────────────────────────────────────
// Fold case, collapse whitespace, and strip a SINGLE leading Hebrew one-letter
// prepositional prefix (ל/ב/מ/ה/ו/כ/ש) so "למור"/"למרתה" match "מור"/"מרתה".
// We do NOT strip anything that would change identity.
function normalize(s: string): string {
  return s.normalize('NFC').trim().toLowerCase().replace(/\s+/g, ' ')
}

function stripHebrewPrefix(s: string): string {
  // Only strip when the remainder is a plausible name (≥ 2 chars) so we never
  // eat the first letter of a genuinely short name. ש is EXCLUDED (name-initial:
  // שרון/Sharon, שאול/Saul, שושנה) — stripping it collapsed "שרון" → "רון".
  const m = s.match(/^([לבמהוכ])(.{2,})$/)
  return m ? m[2]! : s
}

// ─── Relationship-phrase detection ───────────────────────────────────────────
// A relationship phrase ("אח של מור", "הבת של אופיר", "בן הזוג של מור") must
// NEVER resolve to a specific person — it resolves to AMBIGUOUS so Abu asks who.
// This is the structural guarantee: the model cannot construct a valid action
// naming a specific relative from a relationship word.
const KINSHIP_WORDS = [
  'אח', 'אחות', 'בן', 'בת', 'אבא', 'אמא', 'אב', 'אם', 'בעל', 'בעלה', 'אישה', 'אשת',
  'סבא', 'סבתא', 'נכד', 'נכדה', 'דוד', 'דודה', 'גיס', 'גיסה', 'חתן', 'כלה',
  'בן הזוג', 'בת הזוג', 'הבן', 'הבת', 'האח', 'האחות',
]

export function isRelationshipPhrase(phraseRaw: string): boolean {
  const p = normalize(phraseRaw)
  if (!p) return false
  // "X של Y" — a possessive relationship, in any position.
  if (/\bשל\b/.test(p) || / של /.test(` ${p} `)) return true
  // A bare kinship word on its own ("האח", "הבן") is also a relationship reference.
  const bare = p.replace(/^ה/, '')
  return KINSHIP_WORDS.some((k) => {
    const kk = k.replace(/^ה/, '')
    return bare === kk
  })
}

// ─── The resolver ────────────────────────────────────────────────────────────
/**
 * Resolve a spoken name to exactly one contact id, or report AMBIGUOUS / NOT_FOUND.
 * Relationship phrases are always AMBIGUOUS (never a specific person). No phone
 * numbers are read or returned. Pure and deterministic.
 */
export function resolveContact(nameAsSpoken: string | null | undefined): ContactResolution {
  const phrase = (nameAsSpoken ?? '').trim()
  if (!phrase) return { status: 'not_found', phrase: '' }

  // A relationship phrase can never become a specific person.
  if (isRelationshipPhrase(phrase)) {
    return { status: 'ambiguous', candidates: [], phrase }
  }

  const norm = normalize(phrase)
  const candidates = new Map<string, PersonRecord>()
  for (const rec of registry()) {
    if (rec.keys.includes(norm)) candidates.set(rec.id, rec)
  }
  // Retry with a stripped Hebrew prefix if nothing matched exactly.
  if (candidates.size === 0) {
    const stripped = stripHebrewPrefix(norm)
    if (stripped !== norm) {
      for (const rec of registry()) if (rec.keys.includes(stripped)) candidates.set(rec.id, rec)
    }
  }

  const found = [...candidates.values()]
  if (found.length === 1) return { status: 'resolved', id: found[0]!.id, label: found[0]!.label }
  if (found.length > 1) {
    return { status: 'ambiguous', candidates: found.map((r) => ({ id: r.id, label: r.label })), phrase }
  }
  return { status: 'not_found', phrase }
}

/**
 * Calendar participant resolver (adapter for the calendar draft kernel, whose
 * RelationshipResolver contract is `phrase -> name | null`). Rules that satisfy
 * the milestone acceptance:
 *   • resolved contact          → the person's Hebrew label (added by name)
 *   • AMBIGUOUS (relationship/  → null → the draft holds it as an UNRESOLVED
 *     multiple matches)            relationship and blocks confirm → Abu asks who
 *   • NOT_FOUND, plain name     → the name itself as a plain label (e.g. "Gabi",
 *                                  someone not in contacts) → the event can be made
 *   • NOT_FOUND, phrase-like    → null (never a plain label)
 */
export function resolveCalendarParticipant(phrase: string | null | undefined): string | null {
  const r = resolveContact(phrase)
  if (r.status === 'resolved') return r.label
  if (r.status === 'ambiguous') return null
  // not_found: accept ANY spoken proper name as a plain free-text label — a participant
  // does NOT have to be a contact (device defect 5). We still refuse a RELATIONSHIP
  // phrase ("אח של מור", a bare "הדוד") — those must be resolved to a person first, never
  // guessed — but an ordinary name, including a two-word name like "דודה רבקה" or a
  // full name, is written on the event as-is. The relationship guard (not a blanket
  // whitespace ban) is what keeps an unresolved relationship from sneaking in as a label.
  const p = (phrase ?? '').trim()
  if (!p) return null
  if (isRelationshipPhrase(p)) return null
  if (p.length > 40) return null // sanity bound — a name, not a sentence
  return p
}
