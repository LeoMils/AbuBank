/*
 * Family Knowledge Validator
 * ══════════════════════════
 * Validates a structured family graph BEFORE it is used, so Leo can keep editing
 * knowledge/family_graph.json without ever breaking relationship reasoning or
 * introducing a contradiction. Pure — no I/O, so it is trivially testable.
 *
 * Rejects: missing fields, bad gender, duplicate id, alias collision, dangling
 * edge references, self-reference, parent⇄child contradictions, ancestor cycles,
 * and spouse/ex-spouse contradictions.
 */
export type RawGender = 'male' | 'female' | 'unknown'
export interface RawPerson {
  id: string
  hebrew: string
  aliases?: string[]
  gender?: RawGender
  parents?: string[]
  children?: string[]
  spouses?: string[]
  exSpouses?: string[]
  partners?: string[]
  noteRefs?: string[]
}
export interface RawFamilyGraph { version: number; source?: string; people: RawPerson[] }

export interface ValidationResult { ok: boolean; errors: string[]; warnings: string[] }

const EDGE_FIELDS = ['parents', 'children', 'spouses', 'exSpouses', 'partners'] as const

export function validateFamilyGraph(raw: unknown): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const add = (e: string) => errors.push(e)

  if (!raw || typeof raw !== 'object') return { ok: false, errors: ['graph is not an object'], warnings }
  const g = raw as Partial<RawFamilyGraph>
  if (!Array.isArray(g.people)) return { ok: false, errors: ['graph.people must be an array'], warnings }
  const people = g.people as RawPerson[]

  // ids + aliases must be present and globally unique.
  const idOf = new Map<string, RawPerson>()
  const aliasOwner = new Map<string, string>()
  for (const p of people) {
    if (!p || typeof p.id !== 'string' || !p.id.trim()) { add(`person missing id: ${JSON.stringify(p)}`); continue }
    if (typeof p.hebrew !== 'string' || !p.hebrew.trim()) add(`${p.id}: missing hebrew name`)
    if (p.gender && !['male', 'female', 'unknown'].includes(p.gender)) add(`${p.id}: invalid gender "${p.gender}"`)
    if (idOf.has(p.id)) add(`duplicate id "${p.id}"`)
    idOf.set(p.id, p)
  }
  // alias collisions (an alias or hebrew that resolves to two different people).
  for (const p of people) {
    for (const a of [p.hebrew, ...(p.aliases ?? [])]) {
      if (!a) continue
      const key = a.toLowerCase()
      const owner = aliasOwner.get(key)
      if (owner && owner !== p.id) add(`alias "${a}" maps to both "${owner}" and "${p.id}"`)
      aliasOwner.set(key, p.id)
      // an alias must not equal a DIFFERENT person's id.
      if (idOf.has(a) && a !== p.id) add(`alias "${a}" of "${p.id}" collides with another person's id`)
    }
  }

  // referential integrity + self-reference.
  for (const p of people) {
    for (const f of EDGE_FIELDS) {
      for (const ref of (p[f] ?? [])) {
        if (ref === p.id) add(`${p.id}: ${f} references itself`)
        if (!idOf.has(ref)) add(`${p.id}: ${f} references unknown person "${ref}"`)
      }
    }
  }

  // contradictions: A can't be both parent and child of B; can't be spouse AND ex.
  for (const p of people) {
    const parents = new Set(p.parents ?? []), children = new Set(p.children ?? [])
    for (const x of parents) if (children.has(x)) add(`${p.id}: "${x}" is listed as BOTH parent and child`)
    const spouses = new Set(p.spouses ?? []), ex = new Set(p.exSpouses ?? [])
    for (const x of spouses) if (ex.has(x)) add(`${p.id}: "${x}" is listed as BOTH spouse and ex-spouse`)
  }

  // ancestor cycle (an impossible loop: someone is their own ancestor).
  const parentMap = new Map(people.map(p => [p.id, p.parents ?? []]))
  for (const p of people) {
    const seen = new Set<string>(); const stack = [...(parentMap.get(p.id) ?? [])]
    while (stack.length) {
      const cur = stack.pop()!
      if (cur === p.id) { add(`ancestor cycle: "${p.id}" is its own ancestor`); break }
      if (seen.has(cur)) continue
      seen.add(cur); stack.push(...(parentMap.get(cur) ?? []))
    }
  }

  // symmetry: not fatal (the loader backfills), but flag so edits stay clean.
  const has = (id: string, f: typeof EDGE_FIELDS[number], v: string) => (idOf.get(id)?.[f] ?? []).includes(v)
  for (const p of people) {
    for (const c of p.children ?? []) if (!has(c, 'parents', p.id)) warnings.push(`asymmetry: ${p.id} has child ${c} but ${c} has no parent ${p.id} (will backfill)`)
    for (const s of p.spouses ?? []) if (!has(s, 'spouses', p.id)) warnings.push(`asymmetry: ${p.id}↔${s} spouse not mutual (will backfill)`)
  }

  return { ok: errors.length === 0, errors, warnings }
}
