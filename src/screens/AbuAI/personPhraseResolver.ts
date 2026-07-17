/*
 * Person-phrase resolver — "החתן של רפי" → the REAL person (גלעד).
 * ════════════════════════════════════════════════════════════════
 * When a calendar create names a person by a RELATION PHRASE ("פגישה עם החתן של
 * רפי"), the meeting must be scheduled with the resolved person (גלעד), not the
 * literal phrase (Leo device failure #1). This COMPOSES the family graph edges to
 * resolve any relation — blood AND in-laws (חתן/כלה/חם/חמות/גיס/גיסה) — a general
 * mechanism, not a phrase list. Returns null when unknown or ambiguous (never guesses).
 *
 * Pure: reads the family graph via loadGraph. No LLM, no fetch.
 */
import { loadGraph, findNode, type GraphNode } from './familyGraph'

type G = 'female' | 'male' | 'unknown'
const isF = (n: GraphNode) => n.gender === 'female'
const isM = (n: GraphNode) => n.gender === 'male'

function byHe(nodes: GraphNode[], he: string): GraphNode | null { return nodes.find((n) => n.hebrew === he) ?? null }
function nodesOf(nodes: GraphNode[], arr: string[]): GraphNode[] { return arr.map((h) => byHe(nodes, h)).filter((n): n is GraphNode => !!n) }
function uniq(xs: GraphNode[]): GraphNode[] { const s = new Set<string>(); return xs.filter((n) => (s.has(n.hebrew) ? false : (s.add(n.hebrew), true))) }

/** People who are `rel` of `target`, composed from graph edges. [] when none/unknown. */
function relativesOf(nodes: GraphNode[], target: GraphNode, rel: string): GraphNode[] {
  const N = (arr: string[]) => nodesOf(nodes, arr)
  const parents = N(target.parentsHe)
  const children = N(target.childrenHe)
  const spouses = N([...target.spousesHe, ...target.partnersHe])
  const exSpouses = N(target.exSpousesHe)
  const siblings = (): GraphNode[] => {
    const out: GraphNode[] = []; const seen = new Set([target.hebrew])
    for (const p of parents) for (const c of N(p.childrenHe)) if (!seen.has(c.hebrew)) { seen.add(c.hebrew); out.push(c) }
    return out
  }
  const spousesMF = (n: GraphNode, g?: G) => N([...n.spousesHe, ...n.partnersHe]).filter((s) => !g || s.gender === g)

  switch (true) {
    // ── in-laws (composition of a marriage edge with a blood edge) ──
    case /^חתן$/u.test(rel): // son-in-law: male spouse of a child
      return uniq(children.flatMap((c) => spousesMF(c, 'male')))
    case /^כלה$/u.test(rel): // daughter-in-law: female spouse of a child
      return uniq(children.flatMap((c) => spousesMF(c, 'female')))
    case /^חם$/u.test(rel): // father-in-law: father of the spouse
      return uniq(spouses.flatMap((sp) => N(sp.parentsHe).filter(isM)))
    case /^חמות$/u.test(rel): // mother-in-law: mother of the spouse
      return uniq(spouses.flatMap((sp) => N(sp.parentsHe).filter(isF)))
    case /^גיס$/u.test(rel): // brother-in-law: male sibling of spouse, OR male spouse of sibling
      return uniq([...spouses.flatMap((sp) => N(sp.parentsHe).flatMap((p) => N(p.childrenHe)).filter((s) => isM(s) && s.hebrew !== sp.hebrew)),
        ...siblings().flatMap((s) => spousesMF(s, 'male'))])
    case /^גיסה$/u.test(rel): // sister-in-law: female sibling of spouse, OR female spouse of sibling
      return uniq([...spouses.flatMap((sp) => N(sp.parentsHe).flatMap((p) => N(p.childrenHe)).filter((s) => isF(s) && s.hebrew !== sp.hebrew)),
        ...siblings().flatMap((s) => spousesMF(s, 'female'))])
    // ── spouse ──
    case /^(בעל|בעלה)$/u.test(rel): return uniq(spouses.filter(isM))
    case /^(אישה|אשת|אשתו|אישתו)$/u.test(rel): return uniq(spouses.filter(isF))
    case /^(בן[- ]?זוג|בן[- ]?הזוג)$/u.test(rel): return uniq(spouses.filter(isM))
    case /^(בת[- ]?זוג|בת[- ]?הזוג)$/u.test(rel): return uniq(spouses.filter(isF))
    case /^(גרוש|גרושה)$/u.test(rel): return uniq(exSpouses)
    // ── blood ──
    case /^(אמא|אימא|אם)$/u.test(rel): return uniq(parents.filter(isF))
    case /^(אבא|אב)$/u.test(rel): return uniq(parents.filter(isM))
    case /^בת$/u.test(rel): return uniq(children.filter(isF))
    case /^בן$/u.test(rel): return uniq(children.filter(isM))
    case /^אח$/u.test(rel): return uniq(siblings().filter(isM))
    case /^אחות$/u.test(rel): return uniq(siblings().filter(isF))
    case /^(סבא)$/u.test(rel): return uniq(parents.flatMap((p) => N(p.parentsHe)).filter(isM))
    case /^(סבתא)$/u.test(rel): return uniq(parents.flatMap((p) => N(p.parentsHe)).filter(isF))
    case /^(נכד)$/u.test(rel): return uniq(children.flatMap((c) => N(c.childrenHe)).filter(isM))
    case /^(נכדה)$/u.test(rel): return uniq(children.flatMap((c) => N(c.childrenHe)).filter(isF))
    default: return []
  }
}

/**
 * Resolve "ה?<rel> של <name>" to the single real person's Hebrew name, or null when
 * it is not a relation phrase / the person is unknown / the result is ambiguous
 * (more than one person — we do NOT guess which).
 */
export function resolvePersonPhrase(phrase: string): string | null {
  const t = (phrase ?? '').trim()
  const m = t.match(/^ה?([א-ת][א-ת"׳'\- ]*?)\s+של\s+(.+)$/u)
  if (!m) return null
  const rel = m[1]!.replace(/^ה/, '').trim()
  const target = findNode(m[2]!.trim())
  if (!target) return null
  const res = relativesOf(loadGraph(), target, rel)
  return res.length === 1 ? res[0]!.hebrew : null
}
