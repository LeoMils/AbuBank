/*
 * Family Knowledge Loader
 * ═══════════════════════
 * The editable Family Knowledge System. Loads TWO layers with a clean separation:
 *   1. STRUCTURED graph  (knowledge/family_graph.json) — the ONLY source for
 *      relationship reasoning. Validated before use; contradictions are rejected.
 *   2. SOFT knowledge     (knowledge/family_notes.md)   — freeform personal notes,
 *      stories, preferences, places. Never used for relationship answers.
 *
 * Aliases (Leo / לאו / ליאו) resolve to one person. `reloadFamilyKnowledge(raw?)`
 * re-reads updated knowledge without code changes (inject `raw` in tests).
 */
import rawGraph from '../../../knowledge/family_graph.json'
import notesMd from '../../../knowledge/family_notes.md?raw'
import { validateFamilyGraph, type RawFamilyGraph, type RawPerson } from './familyKnowledgeValidator'
import type { RelNode } from './familyPathReasoner'

export interface LoadedPerson extends RelNode {
  id: string
  aliases: string[]
  noteRefs: string[]
}
export interface LoadedFamilyKnowledge {
  people: LoadedPerson[]
  /** alias / hebrew / id (lowercased) → person id */
  aliasIndex: Map<string, string>
  /** person id → soft note text */
  notes: Map<string, string>
  valid: boolean
  errors: string[]
  warnings: string[]
}

function uniq(a: string[]): string[] { return [...new Set(a)] }

/** Build the runtime graph from a validated raw graph, backfilling symmetry so the
 *  path reasoner always sees bidirectional edges. Never invents people. */
function build(raw: RawFamilyGraph, notesText: string): LoadedFamilyKnowledge {
  const v = validateFamilyGraph(raw)
  const byId = new Map(raw.people.map(p => [p.id, p]))
  // Graph reasoning is keyed by hebrew (the path reasoner's node key); edges in the
  // file reference ids, so resolve id → hebrew and drop any dangling reference.
  const heb = (id: string): string | null => byId.get(id)?.hebrew ?? null
  const toHeb = (arr?: string[]) => uniq((arr ?? []).map(heb).filter((x): x is string => !!x))
  const people: LoadedPerson[] = raw.people.map(p => ({
    hebrew: p.hebrew, id: p.id, aliases: p.aliases ?? [], gender: p.gender ?? 'unknown',
    parentsHe: toHeb(p.parents), childrenHe: toHeb(p.children),
    spousesHe: toHeb(p.spouses), exSpousesHe: toHeb(p.exSpouses), partnersHe: toHeb(p.partners),
    noteRefs: p.noteRefs ?? [p.id],
  }))
  const byHeb = new Map(people.map(p => [p.hebrew, p]))
  const link = (a: string, field: keyof Pick<LoadedPerson, 'parentsHe' | 'childrenHe' | 'spousesHe' | 'exSpousesHe' | 'partnersHe'>, b: string) => {
    const node = byHeb.get(a); if (node && !node[field].includes(b)) node[field].push(b)
  }
  // backfill inverses (by hebrew): child⇄parent, spouse⇄spouse, ex⇄ex, partner⇄partner.
  for (const p of people) {
    for (const c of p.childrenHe) link(c, 'parentsHe', p.hebrew)
    for (const pa of p.parentsHe) link(pa, 'childrenHe', p.hebrew)
    for (const s of p.spousesHe) link(s, 'spousesHe', p.hebrew)
    for (const e of p.exSpousesHe) link(e, 'exSpousesHe', p.hebrew)
    for (const pt of p.partnersHe) link(pt, 'partnersHe', p.hebrew)
  }

  // alias / id / hebrew (lowercased) → canonical hebrew graph key.
  const aliasIndex = new Map<string, string>()
  for (const p of raw.people) for (const a of [p.id, p.hebrew, ...(p.aliases ?? [])]) if (a) aliasIndex.set(a.toLowerCase(), p.hebrew)

  return { people, aliasIndex, notes: parseNotes(notesText, byId), valid: v.ok, errors: v.errors, warnings: v.warnings }
}

/** Parse family_notes.md: each "## <person>" section becomes that person's soft note. */
function parseNotes(md: string, byId: Map<string, RawPerson>): Map<string, string> {
  const out = new Map<string, string>()
  // section heading (name/alias/id) → canonical hebrew, matching aliasIndex.
  const hebByAny = new Map<string, string>()
  for (const [id, p] of byId) for (const a of [id, p.hebrew, ...(p.aliases ?? [])]) if (a) hebByAny.set(a.toLowerCase(), p.hebrew)
  const sections = md.split(/^##\s+/m).slice(1)
  for (const sec of sections) {
    const nl = sec.indexOf('\n')
    const head = (nl === -1 ? sec : sec.slice(0, nl)).trim()
    const body = (nl === -1 ? '' : sec.slice(nl + 1)).trim()
    const hebrew = hebByAny.get(head.toLowerCase())
    if (hebrew && body) out.set(hebrew, body)
  }
  return out
}

let cache: LoadedFamilyKnowledge | null = null

/** Load (cached). `reloadFamilyKnowledge` clears + re-reads with updated knowledge. */
export function loadFamilyKnowledge(): LoadedFamilyKnowledge {
  if (!cache) cache = build(rawGraph as RawFamilyGraph, notesMd as string)
  return cache
}
export function reloadFamilyKnowledge(raw?: RawFamilyGraph, notesText?: string): LoadedFamilyKnowledge {
  cache = build(raw ?? (rawGraph as RawFamilyGraph), notesText ?? (notesMd as string))
  return cache
}

/** Resolve "Leo" / "לאו" / "ליאו" → the canonical person id, or null. */
export function resolvePerson(name: string, k: LoadedFamilyKnowledge = loadFamilyKnowledge()): string | null {
  return k.aliasIndex.get(name.trim().toLowerCase()) ?? null
}

/** Soft, contextual note for a person (never a relationship answer). */
export function personNotes(name: string, k: LoadedFamilyKnowledge = loadFamilyKnowledge()): string | null {
  const id = resolvePerson(name, k)
  return id ? (k.notes.get(id) ?? null) : null
}

/** The structured nodes for the path reasoner — relationship answers ONLY. */
export function familyGraphNodes(k: LoadedFamilyKnowledge = loadFamilyKnowledge()): RelNode[] { return k.people }
