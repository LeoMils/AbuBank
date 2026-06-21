/*
 * Spanish / English relational query resolver.
 *
 * Resolves "la hija de Mor", "Ofir's mother", "quién es la abuela de Annabel?",
 * "who is X's uncle?" etc. against the SAME family graph the Hebrew resolver
 * uses — never inventing an unsupported relation. Names render Latin for ES/EN.
 * Handles mixed input (Spanish/English relation word + Hebrew/Latin name) via
 * findNode (which matches Hebrew, Latin, and aliases).
 *
 * Pure: no LLM, no fetch. Returns null when it is not a relational query (the
 * caller falls back to the normal family lookup).
 */
import { loadGraph, findNode, displayName, type GraphNode } from './familyGraph'

type RelType =
  | 'mother' | 'father' | 'daughter' | 'son'
  | 'grandmother' | 'grandfather' | 'granddaughter' | 'grandson'
  | 'greatgm' | 'greatgf'
  | 'wife' | 'husband' | 'partner'
  | 'sister' | 'brother' | 'aunt' | 'uncle' | 'cousin'

const byHe = (he: string): GraphNode | null => loadGraph().find((n) => n.hebrew === he) ?? null
const uniq = (xs: GraphNode[]): GraphNode[] => { const s = new Set<string>(); return xs.filter((n) => (s.has(n.hebrew) ? false : (s.add(n.hebrew), true))) }
const gOk = (n: GraphNode, g?: 'female' | 'male') => !g || n.gender === g

function ancestors(t: GraphNode, depth: number, g?: 'female' | 'male'): GraphNode[] {
  let frontier = [t]
  for (let i = 0; i < depth; i++) { const next: GraphNode[] = []; for (const node of frontier) for (const p of node.parentsHe) { const n = byHe(p); if (n) next.push(n) } frontier = next }
  return uniq(frontier).filter((n) => gOk(n, g))
}
function descendants(t: GraphNode, depth: number, g?: 'female' | 'male'): GraphNode[] {
  let frontier = [t]
  for (let i = 0; i < depth; i++) { const next: GraphNode[] = []; for (const node of frontier) for (const c of node.childrenHe) { const n = byHe(c); if (n) next.push(n) } frontier = next }
  return uniq(frontier).filter((n) => gOk(n, g))
}
function siblings(t: GraphNode, g?: 'female' | 'male'): GraphNode[] {
  const out: GraphNode[] = []; const seen = new Set([t.hebrew])
  for (const pHe of t.parentsHe) { const p = byHe(pHe); if (!p) continue; for (const cHe of p.childrenHe) { if (seen.has(cHe)) continue; seen.add(cHe); const c = byHe(cHe); if (c && gOk(c, g)) out.push(c) } }
  return out
}
function partners(t: GraphNode, g?: 'female' | 'male'): GraphNode[] {
  return uniq([...t.spousesHe, ...t.partnersHe].map(byHe).filter((n): n is GraphNode => !!n && gOk(n, g)))
}
function auntUncle(t: GraphNode, g: 'female' | 'male'): GraphNode[] {
  const out: GraphNode[] = []; const seen = new Set<string>()
  for (const pHe of t.parentsHe) { const p = byHe(pHe); if (!p) continue; for (const gpHe of p.parentsHe) { const gp = byHe(gpHe); if (!gp) continue; for (const sHe of gp.childrenHe) { if (sHe === p.hebrew || seen.has(sHe)) continue; seen.add(sHe); const s = byHe(sHe); if (s && gOk(s, g)) out.push(s) } } }
  return out
}
function cousins(t: GraphNode): GraphNode[] {
  const out: GraphNode[] = []; const seen = new Set([t.hebrew])
  for (const pHe of t.parentsHe) { const p = byHe(pHe); if (!p) continue; for (const gpHe of p.parentsHe) { const gp = byHe(gpHe); if (!gp) continue; for (const sHe of gp.childrenHe) { if (sHe === p.hebrew) continue; const sib = byHe(sHe); if (!sib) continue; for (const cHe of sib.childrenHe) { if (seen.has(cHe)) continue; seen.add(cHe); const c = byHe(cHe); if (c) out.push(c) } } } }
  return out
}

function resolveTargets(t: GraphNode, type: RelType): GraphNode[] {
  switch (type) {
    case 'mother': return ancestors(t, 1, 'female')
    case 'father': return ancestors(t, 1, 'male')
    case 'daughter': return descendants(t, 1, 'female')
    case 'son': return descendants(t, 1, 'male')
    case 'grandmother': return ancestors(t, 2, 'female')
    case 'grandfather': return ancestors(t, 2, 'male')
    case 'granddaughter': return descendants(t, 2, 'female')
    case 'grandson': return descendants(t, 2, 'male')
    case 'greatgm': return ancestors(t, 3, 'female')
    case 'greatgf': return ancestors(t, 3, 'male')
    case 'wife': return partners(t, 'female')
    case 'husband': return partners(t, 'male')
    case 'partner': return partners(t)
    case 'sister': return siblings(t, 'female')
    case 'brother': return siblings(t, 'male')
    case 'aunt': return auntUncle(t, 'female')
    case 'uncle': return auntUncle(t, 'male')
    case 'cousin': return cousins(t)
  }
}

// Relation words → type. Longest first so "bisabuela"/"great-grandmother" win.
const ES: Array<[RegExp, RelType]> = [
  [/^bisabuela$/, 'greatgm'], [/^bisabuelo$/, 'greatgf'],
  [/^abuela$/, 'grandmother'], [/^abuelo$/, 'grandfather'],
  [/^nieta$/, 'granddaughter'], [/^nieto$/, 'grandson'],
  [/^(?:madre|mam[aá])$/, 'mother'], [/^(?:padre|pap[aá])$/, 'father'],
  [/^hija$/, 'daughter'], [/^hijo$/, 'son'],
  [/^(?:esposa|mujer)$/, 'wife'], [/^(?:marido|esposo)$/, 'husband'], [/^(?:pareja|novia|novio)$/, 'partner'],
  [/^hermana$/, 'sister'], [/^hermano$/, 'brother'],
  [/^t[ií]a$/, 'aunt'], [/^t[ií]o$/, 'uncle'], [/^prim[ao]$/, 'cousin'],
]
const EN: Array<[RegExp, RelType]> = [
  [/^great-?grandmother$/, 'greatgm'], [/^great-?grandfather$/, 'greatgf'],
  [/^grandmother$/, 'grandmother'], [/^grandfather$/, 'grandfather'],
  [/^granddaughter$/, 'granddaughter'], [/^grandson$/, 'grandson'],
  [/^(?:mother|mom|mum)$/, 'mother'], [/^(?:father|dad)$/, 'father'],
  [/^daughter$/, 'daughter'], [/^son$/, 'son'],
  [/^wife$/, 'wife'], [/^husband$/, 'husband'], [/^partner$/, 'partner'],
  [/^sister$/, 'sister'], [/^brother$/, 'brother'],
  [/^aunt$/, 'aunt'], [/^uncle$/, 'uncle'], [/^cousin$/, 'cousin'],
]
function mapRel(word: string, lang: 'es' | 'en'): RelType | null {
  const w = word.toLowerCase().trim()
  for (const [re, type] of (lang === 'es' ? ES : EN)) if (re.test(w)) return type
  return null
}

const NOUN: Record<RelType, { es: string; en: string }> = {
  mother: { es: 'mamá', en: 'mother' }, father: { es: 'papá', en: 'father' },
  daughter: { es: 'hija', en: 'daughter' }, son: { es: 'hijo', en: 'son' },
  grandmother: { es: 'abuela', en: 'grandmother' }, grandfather: { es: 'abuelo', en: 'grandfather' },
  granddaughter: { es: 'nieta', en: 'granddaughter' }, grandson: { es: 'nieto', en: 'grandson' },
  greatgm: { es: 'bisabuela', en: 'great-grandmother' }, greatgf: { es: 'bisabuelo', en: 'great-grandfather' },
  wife: { es: 'esposa', en: 'wife' }, husband: { es: 'marido', en: 'husband' }, partner: { es: 'pareja', en: 'partner' },
  sister: { es: 'hermana', en: 'sister' }, brother: { es: 'hermano', en: 'brother' },
  aunt: { es: 'tía', en: 'aunt' }, uncle: { es: 'tío', en: 'uncle' }, cousin: { es: 'primo/a', en: 'cousin' },
}
const ART: Partial<Record<RelType, string>> = { mother: 'la', father: 'el', daughter: 'la', son: 'el', grandmother: 'la', grandfather: 'el', granddaughter: 'la', grandson: 'el', greatgm: 'la', greatgf: 'el', wife: 'la', husband: 'el', partner: 'la', sister: 'la', brother: 'el', aunt: 'la', uncle: 'el', cousin: 'el/la' }

function joinNames(ns: GraphNode[], lang: 'es' | 'en'): string {
  const names = ns.map((n) => displayName(n, lang))
  if (names.length <= 1) return names[0] ?? ''
  const sep = lang === 'es' ? ' y ' : ' and '
  return names.slice(0, -1).join(', ') + sep + names[names.length - 1]
}

/** Resolve an ES/EN relational query, or null if it isn't one. */
export function resolveRelationalQuery(text: string, lang: 'es' | 'en'): string | null {
  const t = text.trim().replace(/[?¿!.]+$/g, '')
  let relWord: string | null = null
  let nameRaw: string | null = null

  if (lang === 'es') {
    const m = t.match(/(?:qui[eé]n es\s+)?(?:la|el|los|las)?\s*([a-záéíóúñ]+)\s+de\s+([\wáéíóúñ֐-׿'-]+)/i)
    if (m) { relWord = m[1]!; nameRaw = m[2]! }
  } else {
    // "Ofir's mother" / "who is Mor's granddaughter" (possessive — "who is" optional)
    let m = t.match(/(?:who(?:'s| is)\s+)?([\w֐-׿-]+)'s\s+([a-z-]+)/i)
    if (m) { nameRaw = m[1]!; relWord = m[2]! }
    else { m = t.match(/([a-z-]+)\s+of\s+([\w֐-׿'-]+)/i); if (m) { relWord = m[1]!; nameRaw = m[2]! } } // "mother of Mor"
  }
  if (!relWord || !nameRaw) return null
  const type = mapRel(relWord, lang)
  if (!type) return null
  const target = findNode(nameRaw)
  if (!target) return null

  const targets = resolveTargets(target, type)
  const tName = displayName(target, lang)
  const noun = NOUN[type][lang]
  if (targets.length === 0) {
    // Honest: never invent a relative that doesn't exist.
    return lang === 'es' ? `${tName} no tiene ${noun}.` : `${tName} has no ${noun}.`
  }
  const names = joinNames(targets, lang)
  if (lang === 'es') return `${capES(ART[type] ?? 'la')} ${noun} de ${tName} es ${names}.`
  return `${tName}'s ${noun} is ${names}.`
}

function capES(a: string): string { return a.charAt(0).toUpperCase() + a.slice(1) }
