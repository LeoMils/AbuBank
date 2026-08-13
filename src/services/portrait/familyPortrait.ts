/*
 * familyPortrait.ts — THE COMPANION BRAIN (Phase 3): what Abu HOLDS in her head.
 * ════════════════════════════════════════════════════════════════════════════
 * Abu should KNOW her family and friends, not look them up — that is the difference between a
 * friend and a clerk. This generates a warm PROSE portrait of everything durable (family,
 * friends, the life history, and the shape of what is unknown) FROM the data files, so it is
 * always consistent with the source of truth and adding a person stays a data-only edit.
 *
 * It leans on the hand-written human fields already in the data — relationship_hebrew,
 * occupation, location, and the descriptive notes read like a friend describing the family —
 * and tiers them: the closest circle in full warmth, distant branches a line each. Everyone is
 * present; not everyone is equal. Measured limit: session.instructions holds ≥200,000 chars, so
 * a ~12k portrait fits with ~15x headroom (the old 10k cap was a misdiagnosis; see COMPANION-BRAIN).
 */
import familyData from '../../../knowledge/family_data.json'
import historyData from '../../../knowledge/life_history.json'

interface RawPerson {
  canonical_name?: string
  hebrew_name?: string
  relationship_hebrew?: string
  role?: string
  occupation?: string
  location?: string
  origin?: string
  notes?: string
  deceased?: boolean
  name_uncertain?: boolean
}
interface HistoryEntry { topic: string; summary: string }

/** Tiers of the store, closest-to-Martita first. Each renders at a different warmth. */
const NUCLEAR = ['matriarch', 'deceased', 'children', 'children_related', 'grandchildren_mor', 'grandchildren_leo', 'grandchildren_spouses', 'great_grandchildren'] as const
const FRIENDS = ['close_friends'] as const
const EXTENDED = ['extended_family'] as const

function group(data: { family: Record<string, unknown> }, name: string): RawPerson[] {
  const v = data.family[name]
  const list = Array.isArray(v) ? v : v ? [v] : []
  return (list as RawPerson[]).filter((p) => p && (p.hebrew_name || p.canonical_name))
}

/** Trim a note to its warm descriptive core: drop operator meta (⚠ …, "לא להמציא", spelling/
 *  verification asides, privacy notes) and over-long tails, keep the human description. */
function warmNote(note: string | undefined, maxLen: number): string {
  if (!note) return ''
  let n = note.replace(/\r?\n/g, ' ').trim()
  n = n.replace(/⚠[^.]*\.?/g, '')
  // drop parentheticals and sentences that are editor meta, not Abu's speech
  n = n.replace(/\([^)]*(?:לא להמציא|לא להסיק|לאמת|איות|תמלול|מאומת|הושמט|פרטיות|רגיש)[^)]*\)/g, '')
  n = n.replace(/[^.!?]*(?:לא להמציא|לא להסיק|לאמת|איות ה?שם|תמלול נשמע|הושמט[ו]? בכוונה)[^.!?]*[.!?]/g, '')
  // normalise punctuation artefacts left by the removals
  n = n.replace(/\(\s*\)/g, '').replace(/\s+([.,;)])/g, '$1').replace(/[(]\s*[.;,]/g, '').replace(/\s{2,}/g, ' ').trim()
  n = n.replace(/^[\s.,;)]+/, '').replace(/[\s.,;(]+$/, '').trim()
  if (n.length > maxLen) { const cut = n.slice(0, maxLen); const sp = cut.lastIndexOf(' '); n = (sp > 20 ? cut.slice(0, sp) : cut).trim() + '…' }
  return n
}

const relOf = (p: RawPerson): string => (p.relationship_hebrew ?? p.role ?? '').trim()

/** One person as a warm sentence. `noteLen` sets the tier's detail budget (0 = name+relation only). */
function personLine(p: RawPerson, noteLen: number): string {
  const name = (p.hebrew_name ?? p.canonical_name ?? '').trim()
  const rel = relOf(p)
  const facts: string[] = []
  if (p.occupation) facts.push(p.occupation.trim())
  if (p.location) facts.push(p.location.trim())
  const head = rel ? `${name} — ${rel}` : name
  const note = warmNote(p.notes, noteLen)
  const factStr = noteLen > 0 && facts.length ? ` (${facts.join('; ')})` : ''
  const noteStr = noteLen > 0 && note ? `. ${note}` : ''
  // exactly one terminal mark: keep a truncation ellipsis, else a single period
  const body = `${head}${factStr}${noteStr}`.replace(/\s+([.,;)])/g, '$1').trim()
  return /…$/.test(body) ? body : body.replace(/[.\s]*$/, '') + '.'
}

/**
 * The full prose portrait Abu holds in her head. Pure over the data files, so it is always in
 * sync with the source of truth and regression-lockable. Sectioned and tiered for warmth.
 */
export function buildFamilyPortrait(
  data: { family: Record<string, unknown> } = familyData as { family: Record<string, unknown> },
  history: { history?: HistoryEntry[] } = historyData as { history?: HistoryEntry[] },
): string {
  const out: string[] = []

  // ── The family Abu knows (nuclear circle in full warmth) ──
  out.push('# מי המשפחה של מרתה (את יודעת את זה — לא צריך לבדוק)')
  const nuclear: string[] = []
  for (const g of NUCLEAR) for (const p of group(data, g)) {
    if (g === 'matriarch') continue // Martita herself is the "you" of the conversation
    nuclear.push(personLine(p, 220))
  }
  out.push(nuclear.join(' '))
  out.push('')

  // ── The extended family (a line each; everyone reachable, nobody "unrelated") ──
  const extended = group(data, EXTENDED[0]).map((p) => personLine(p, 90))
  if (extended.length) {
    out.push('# המשפחה המורחבת (מרתה, מנדוסה, וצד של פפי)')
    out.push(extended.join(' '))
    out.push('')
  }

  // ── The friends (warm; "who are my friends?" must have an answer) ──
  const friends = group(data, FRIENDS[0]).map((p) => personLine(p, 160))
  if (friends.length) {
    out.push('# החברים של מרתה')
    out.push(friends.join(' '))
    out.push('')
  }

  // ── The life history, as story (Abu recalls it in the flow of talk) ──
  const entries = Array.isArray(history.history) ? history.history : []
  if (entries.length) {
    out.push('# סיפור החיים של מרתה (את מכירה את הסיפור)')
    out.push(entries.map((e) => e.summary.replace(/\r?\n/g, ' ').trim()).join(' '))
    out.push('')
  }

  // ── The shape of what is unknown (she owns her ignorance) ──
  const open = (data.family as unknown as { open_questions?: Array<{ question?: string }> })
  const oq = ((familyData as unknown as { open_questions?: Array<{ question?: string }> }).open_questions) ?? []
  void open
  if (oq.length) {
    out.push('# מה עדיין לא ידוע (אם ישאלו — לומר בחום שאת לא בטוחה, לא להמציא)')
    out.push(oq.map((q) => q.question).filter(Boolean).slice(0, 12).join('; ') + '.')
    out.push('')
  }

  return out.join('\n').trim()
}
