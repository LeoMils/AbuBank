/*
 * peopleModel.ts — ONE canonical people model (M3).
 * ════════════════════════════════════════════════════════════════════════════
 * Reads the single source of truth (knowledge/family_data.json) and normalises it
 * into people carrying DIRECT facts + DIRECT edges only. Kinship (uncle, cousin,
 * daughter-in-law…) is DERIVED at query time by kinship.ts — never stored — with
 * correct Hebrew terms and gender. This retires the triple-store problem: there is
 * ONE model; family_graph.json / abu-family.md are legacy and should be generated
 * from this source (staged), not authored in parallel.
 *
 * Edge rules (data-driven, no invented facts):
 *   • `children: [names]` on a person P ⇒ P is a parent of each; the co-parent is
 *     P's spouse OR former_spouse (NOT a partner — a partner implies nothing about
 *     parenthood, per the brief).
 *   • the `children` GROUP (Mor, Leo) are the children of the matriarch + deceased.
 *   • spouse / ex_spouse / partner are distinct edges and imply nothing about each
 *     other. cohabits_with is a distinct optional edge (data-driven).
 * Gender is set only where the data encodes it (relationship / explicit field);
 * otherwise 'unknown' — never guessed.
 */
import familyData from '../../../knowledge/family_data.json'

export type Gender = 'male' | 'female' | 'unknown'

export interface Person {
  id: string
  hebrewName: string
  canonicalName: string
  /** Latin spellings (canonical + Latin aliases) and Hebrew aliases, verbatim. */
  latinNames: string[]
  hebrewAliases: string[]
  gender: Gender
  pronunciation?: Record<string, string>
  birthday?: string
  notes?: string
  /** Non-family people carry a role instead of kinship (doctor, neighbour, friend). */
  role?: string
  deceased?: boolean
  // direct edges (hebrew names resolved to ids)
  parents: string[]
  children: string[]
  spouses: string[]
  formerSpouses: string[]
  partners: string[]
  cohabitsWith: string[]
}

interface RawPerson {
  canonical_name?: string
  hebrew_name?: string
  aliases?: string[]
  relationship?: string
  relationship_hebrew?: string
  gender?: Gender
  pronunciation?: Record<string, string>
  spouse?: string
  ex_spouse?: string
  partner?: string
  cohabits_with?: string
  children?: string[]
  birthday?: string
  notes?: string
  role?: string
  deceased?: boolean
}

const FAMILY_GROUPS = ['matriarch', 'deceased', 'children', 'children_related', 'grandchildren_mor', 'grandchildren_leo', 'grandchildren_spouses', 'great_grandchildren'] as const
// Role-based groups: known + resolvable people whose relation to Martita is carried by
// their `role`/relationship_hebrew, NOT derived through the kinship graph (keeps the
// derived graph stable while still making the extended family + friends known in speech).
const NONFAMILY_GROUPS = ['close_friends', 'extended_family'] as const
const HEBREW = /[֐-׿]/

const GENDER_BY_RELATIONSHIP: Record<string, Gender> = {
  matriarch: 'female', husband_deceased: 'male',
  daughter: 'female', son: 'male',
  daughter_partner: 'female',
  ex_son_in_law: 'male',
  granddaughter: 'female', grandson: 'male',
  granddaughter_in_law: 'female', grandson_in_law: 'male',
  great_granddaughter: 'female', great_grandson: 'male',
}

function toId(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

/** NFC / lowercase / single-spaced — the base form, NO prefix stripping. */
export function normalizeBase(s: string): string {
  return s.normalize('NFC').trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Strip ONE leading grammatical prefix (ל/ב/מ/ה/ו/כ) so "למור"/"במור" reduce to "מור".
 *  ש is EXCLUDED (name-initial: שרון/שאול/שושנה). Returns the input unchanged if no prefix. */
export function stripHebrewPrefix(base: string): string {
  const m = base.match(/^([לבמהוכ])(.{2,})$/)
  return m ? m[2]! : base
}

/** Normalise a spoken/written name for matching (base + strip one prefix). NOTE: a name that
 *  itself STARTS with a prefix letter (לאו, מור, מרתה) is wrongly shortened by this — which is
 *  why resolution (resolvePersonId) indexes BOTH the base and the stripped form and tries the
 *  base FIRST, so "לאו" matches by its true form and "ללאו" still reduces to it. Kept for the
 *  phonetic/skeleton layers, which apply it consistently to query and candidate. */
export function normalizeName(s: string): string {
  return stripHebrewPrefix(normalizeBase(s))
}

interface RawPersonEntry { group: string; raw: RawPerson }

function collectRaw(data: { family: Record<string, unknown> }): RawPersonEntry[] {
  const out: RawPersonEntry[] = []
  for (const group of [...FAMILY_GROUPS, ...NONFAMILY_GROUPS]) {
    const v = data.family[group]
    const list = Array.isArray(v) ? v : v ? [v] : []
    for (const raw of list as RawPerson[]) if (raw && (raw.canonical_name || raw.hebrew_name)) out.push({ group, raw })
  }
  return out
}

let CACHE: { people: Person[]; byId: Map<string, Person>; byName: Map<string, string> } | null = null

/** Build (cached) the canonical people model from the source of truth. */
export function loadPeople(data: { family: Record<string, unknown> } = familyData as { family: Record<string, unknown> }): Person[] {
  if (data === (familyData as unknown) && CACHE) return CACHE.people
  const entries = collectRaw(data)
  const hebToId = new Map<string, string>()
  for (const { raw } of entries) {
    const canon = (raw.canonical_name ?? raw.hebrew_name)!
    if (raw.hebrew_name) hebToId.set(raw.hebrew_name, toId(canon))
  }
  const resolveHeb = (name?: string): string | null => (name ? hebToId.get(name.trim()) ?? null : null)

  const people: Person[] = entries.map(({ group, raw }) => {
    const canon = (raw.canonical_name ?? raw.hebrew_name)!
    const latin = [raw.canonical_name, ...(raw.aliases ?? []).filter((a) => !HEBREW.test(a))].filter((x): x is string => !!x)
    const hebAliases = (raw.aliases ?? []).filter((a) => HEBREW.test(a))
    const gender: Gender = raw.gender ?? GENDER_BY_RELATIONSHIP[raw.relationship ?? ''] ?? 'unknown'
    const nonFamily = (NONFAMILY_GROUPS as readonly string[]).includes(group)
    return {
      id: toId(canon), hebrewName: raw.hebrew_name ?? canon, canonicalName: canon,
      latinNames: [...new Set(latin)], hebrewAliases: [...new Set(hebAliases)], gender,
      ...(raw.pronunciation ? { pronunciation: raw.pronunciation } : {}),
      ...(raw.birthday ? { birthday: raw.birthday } : {}),
      ...(raw.notes ? { notes: raw.notes } : {}),
      ...(nonFamily ? { role: raw.role ?? 'friend' } : {}),
      // Deceased is the canonical `deceased` group OR any person carrying deceased:true
      // (extended relatives/friends who have passed) — so reaching them is declined gently.
      ...(group === 'deceased' || raw.deceased ? { deceased: true } : {}),
      parents: [], children: [], spouses: [], formerSpouses: [], partners: [], cohabitsWith: [],
    }
  })
  const byId = new Map(people.map((p) => [p.id, p]))
  const get = (id: string | null): Person | undefined => (id ? byId.get(id) : undefined)
  const link = (a: Person | undefined, field: keyof Pick<Person, 'parents' | 'children' | 'spouses' | 'formerSpouses' | 'partners' | 'cohabitsWith'>, b: Person | undefined) => {
    if (a && b && !a[field].includes(b.id)) a[field].push(b.id)
  }

  // spouse / ex / partner / cohabits — mutual
  for (const { raw } of entries) {
    const self = get(toId((raw.canonical_name ?? raw.hebrew_name)!))
    const sp = get(resolveHeb(raw.spouse)); const ex = get(resolveHeb(raw.ex_spouse))
    const pt = get(resolveHeb(raw.partner)); const co = get(resolveHeb(raw.cohabits_with))
    link(self, 'spouses', sp); link(sp, 'spouses', self)
    link(self, 'formerSpouses', ex); link(ex, 'formerSpouses', self)
    link(self, 'partners', pt); link(pt, 'partners', self)
    link(self, 'cohabitsWith', co); link(co, 'cohabitsWith', self)
  }
  // parent/child from `children` arrays; co-parent = spouse OR former_spouse (never partner)
  const matriarch = get(hebToId.get((entries.find((e) => e.group === 'matriarch')?.raw.hebrew_name) ?? '') ?? null)
  const deceased = get(hebToId.get((entries.find((e) => e.group === 'deceased')?.raw.hebrew_name) ?? '') ?? null)
  for (const { raw } of entries) {
    const self = get(toId((raw.canonical_name ?? raw.hebrew_name)!))
    if (!self) continue
    for (const childHeb of raw.children ?? []) {
      const child = get(resolveHeb(childHeb)); if (!child) continue
      link(self, 'children', child); link(child, 'parents', self)
      for (const coId of [...self.spouses, ...self.formerSpouses]) { const co = byId.get(coId); link(co, 'children', child); link(child, 'parents', co) }
    }
  }
  // the `children` group (Mor, Leo) are children of the matriarch + deceased
  for (const { group, raw } of entries) {
    if (group !== 'children') continue
    const kid = get(toId((raw.canonical_name ?? raw.hebrew_name)!))
    for (const parent of [matriarch, deceased]) { link(parent, 'children', kid); link(kid, 'parents', parent) }
  }

  if (data === (familyData as unknown)) CACHE = { people, byId, byName: buildNameIndex(people) }
  return people
}

function buildNameIndex(people: Person[]): Map<string, string> {
  const idx = new Map<string, string>()
  // Index each key under BOTH its true base form AND its prefix-stripped form, so a name that
  // starts with a prefix letter (לאו/מור/מרתה) is findable by its real spelling, and a prefixed
  // query still reduces onto it. A collision keeps the FIRST binding (base wins over stripped).
  for (const p of people) for (const key of [p.hebrewName, p.canonicalName, ...p.latinNames, ...p.hebrewAliases]) {
    if (!key) continue
    const base = normalizeBase(key), stripped = stripHebrewPrefix(base)
    if (!idx.has(base)) idx.set(base, p.id)
    if (!idx.has(stripped)) idx.set(stripped, p.id)
  }
  return idx
}

/** Resolve a spoken/written name to exactly one person id, or null (never guesses). Tries the
 *  BASE form first (so a prefix-initial name matches by its true spelling), then the
 *  prefix-stripped form (so "ללאו"/"המרתה"/"למור" reduce onto the name). */
export function resolvePersonId(name: string, people: Person[] = loadPeople()): string | null {
  const idx = people === (CACHE?.people) ? CACHE!.byName : buildNameIndex(people)
  const base = normalizeBase(name)
  return idx.get(base) ?? idx.get(stripHebrewPrefix(base)) ?? null
}

export function personById(id: string, people: Person[] = loadPeople()): Person | null {
  return people.find((p) => p.id === id) ?? null
}
