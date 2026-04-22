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
  /^מה התוכנית/,
  /^מה עושים/,
  /^מתי יש לי/,
  /^יש לי משהו/,
]

export function isScheduleQuery(text: string): boolean {
  const t = text.trim()
  return QUERY_PATTERNS.some(p => p.test(t))
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
