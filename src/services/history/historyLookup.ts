/*
 * historyLookup.ts — FIX 3: a retrieval path for LIFE HISTORY and PLACES.
 * ════════════════════════════════════════════════════════════════════════════
 * History and places are not people and had NO retrieval path — the facts lived as prose
 * in knowledge (martita_personality.yaml) that no tool ever read, so Mendoza, the store,
 * the aliyah, and the Ulpan friendships were simply unreachable. This gives history its own
 * tool (history_lookup), exactly as people_lookup serves people: it reads the structured
 * knowledge/life_history.json and returns ONLY grounded summaries (with confidence), or an
 * honest not_found. It NEVER invents — an unknown stays unknown.
 */
import historyData from '../../../knowledge/life_history.json'

export interface HistoryEntry {
  id: string
  topic: string
  era: string
  place: string
  people: string[]
  summary: string
  confidence: string
  source: string
}

interface RawHistory { history?: HistoryEntry[] }

export function loadHistory(data: RawHistory = historyData as RawHistory): HistoryEntry[] {
  return Array.isArray(data.history) ? data.history : []
}

/** Query synonyms → the eras they select, so a natural ask ("ספרי לי על מנדוסה", "איך עליתם
 *  ארצה", "החנות") reaches the right entries. Deterministic and data-light. */
const ERA_KEYWORDS: Array<{ re: RegExp; eras: string[] }> = [
  { re: /מנדוס|mendoza|קאסה|casa milstein|החנות במנדוסה/i, eras: ['mendoza'] },
  { re: /עלי[יה]|עלית|1977|אולפן|נתניה|איטליה|רומא|פירנצ/i, eras: ['aliyah'] },
  { re: /בת ?ים|בלפור|ז'בוטינסק|רמת הנשיא/i, eras: ['bat_yam'] },
  { re: /חנות|עסק|גלנטריה|מכיר|עבוד|קמעונ/i, eras: ['work'] },
  { re: /ילדות|נולד|לידה|בואנוס איירס|הורים|אמא ואבא|אחים/i, eras: ['childhood'] },
  { re: /נעורים|צעיר|מרקוס/i, eras: ['youth'] },
  { re: /ארגנטינ|argentina/i, eras: ['childhood', 'youth', 'mendoza'] },
  { re: /היסטורי|סיפור החיים|חיים שלך|העבר שלך|מאיפה את|קורות חיים/i, eras: ['childhood', 'youth', 'mendoza', 'aliyah', 'bat_yam', 'work', 'legacy'] },
]

const HEBREW_PREFIX = /^[הבלמושכ]/

function tokens(q: string): string[] {
  return q.normalize('NFC').toLowerCase().split(/[\s,.?!"']+/).filter((t) => t.length >= 3)
    .map((t) => (HEBREW_PREFIX.test(t) && t.length > 3 ? t.slice(1) : t))
}

export interface HistoryHit { topic: string; era: string; place: string; summary: string; confidence: string }

/**
 * Look up life history by a free-text query. Returns the matching grounded entries (topic +
 * summary + place + confidence), best first, or not_found. Matching is deterministic: an era
 * keyword selects its entries; otherwise a token overlap against topic/place/people/summary.
 * Never fabricates — no match is an honest not_found, never a guessed memory.
 */
export function historyLookup(query: string, data: RawHistory = historyData as RawHistory): { status: 'ok'; entries: HistoryHit[] } | { status: 'not_found' } {
  const entries = loadHistory(data)
  if (entries.length === 0) return { status: 'not_found' }
  const q = (query ?? '').normalize('NFC').trim()
  if (!q) return { status: 'not_found' }

  // 1) era-keyword selection
  const selectedEras = new Set<string>()
  for (const { re, eras } of ERA_KEYWORDS) if (re.test(q)) for (const e of eras) selectedEras.add(e)

  const toHit = (e: HistoryEntry): HistoryHit => ({ topic: e.topic, era: e.era, place: e.place, summary: e.summary, confidence: e.confidence })

  if (selectedEras.size > 0) {
    const hits = entries.filter((e) => selectedEras.has(e.era)).map(toHit)
    if (hits.length > 0) return { status: 'ok', entries: hits }
  }

  // 2) token overlap fallback (place / person / topic / summary)
  const qs = tokens(q)
  const scored = entries.map((e) => {
    const hay = `${e.topic} ${e.place} ${e.people.join(' ')} ${e.summary}`.toLowerCase()
    const score = qs.reduce((n, t) => n + (hay.includes(t) ? 1 : 0), 0)
    return { e, score }
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score)

  if (scored.length === 0) return { status: 'not_found' }
  return { status: 'ok', entries: scored.map((x) => toHit(x.e)) }
}
