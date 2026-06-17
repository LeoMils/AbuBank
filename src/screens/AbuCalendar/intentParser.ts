export interface ParsedIntent {
  intent: 'create_event' | 'query_schedule' | 'unknown'
  title: string
  date: string | null
  time: string | null
  emoji: string
  personName: string | null
  confidence: number
}

const QUERY_PATTERNS = [
  /^מה (יש|קורה) לי/,
  /^מה ביומן/,
  /^מה מחכה/,
  // Singular "התוכנית" and plural "התוכניות" share the prefix "תוכני";
  // gating on it lets "מה התוכניות שלי השבוע" route to schedule_query.
  /^מה ה?תוכני/,
  /^מה מתוכנן/,
  /^מה עושים/,
  /^מתי יש לי/,
  /^יש לי משהו/,
]

export function isScheduleQuery(text: string): boolean {
  const t = text.trim()
  return QUERY_PATTERNS.some(p => p.test(t))
}

// Family question patterns: "מי הבעל של X", "מי האח של X", "מי הילדים של X".
// Routed as family_query — never saves, never auto-creates anything.
// Allow optional ה prefix on every noun so "מי האחות של X" and "מי אחות של X" both match.
const FAMILY_RELATION_NOUN = /(?:ה?בעל|בעלה|ה?אשה|אשת|בן\s+הזוג|ה?אחות|ה?אח|ה?בת|ה?בן|ה?בנות|ה?בנים|ה?ילדים|ה?אמא|ה?אבא|ה?נכד|ה?נכדה|ה?נכדים)/
const FAMILY_QUERY_RE = new RegExp(`^(?:מי(?:\\s+הם|\\s+היא|\\s+הוא)?\\s+)${FAMILY_RELATION_NOUN.source}(?:\\s+של\\s+)`)

export function isFamilyQuery(text: string): boolean {
  const t = text.trim()
  return FAMILY_QUERY_RE.test(t)
}

export function extractQueryTimeframe(text: string): { scope: 'today' | 'tomorrow' | 'week' | 'specific'; date?: string } {
  const t = text.trim()
  if (/מחר/.test(t)) return { scope: 'tomorrow' }
  if (/השבוע|שבוע/.test(t)) return { scope: 'week' }
  if (/היום|עכשיו/.test(t) || !/(מחר|שבוע|חודש)/.test(t)) return { scope: 'today' }
  return { scope: 'today' }
}

export function validateParsedIntent(parsed: ParsedIntent): { valid: boolean; missing: string[] } {
  const missing: string[] = []
  if (!parsed.title || parsed.title.trim().length === 0) missing.push('title')
  if (!parsed.date) missing.push('date')
  if (!parsed.time) missing.push('time')

  return {
    valid: missing.length === 0 && parsed.confidence >= 0.7,
    missing,
  }
}

export function buildClarificationQuestion(missing: string[]): string | null {
  if (missing.length === 0) return null
  if (missing.includes('date') && missing.includes('time')) return 'מתי זה? תגידי לי תאריך ושעה.'
  if (missing.includes('date')) return 'באיזה תאריך?'
  if (missing.includes('time')) return 'באיזה שעה?'
  if (missing.includes('title')) return 'מה האירוע?'
  return 'לא הבנתי. תנסי שוב בבקשה.'
}

export function buildConfirmationText(parsed: ParsedIntent): string {
  const parts: string[] = []
  parts.push(parsed.title)
  if (parsed.date) {
    const d = new Date(parsed.date)
    const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
    const today = new Date()
    const diff = Math.round((d.getTime() - today.getTime()) / 86400000)
    let dateStr: string
    if (diff === 0) dateStr = 'היום'
    else if (diff === 1) dateStr = 'מחר'
    else dateStr = `יום ${dayNames[d.getDay()] ?? ''}, ${d.getDate()}/${d.getMonth() + 1}`
    parts.push(dateStr)
  }
  if (parsed.time) {
    const [h, m] = parsed.time.split(':').map(Number)
    if (h !== undefined && m !== undefined) {
      parts.push(`ב-${h}:${String(m).padStart(2, '0')}`)
    }
  }
  return `לקבוע ${parts.join(' ')}?`
}
