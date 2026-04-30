import { parseLocally } from './localParser'

export interface DraftLike {
  title: string
  date: string | null
  time: string | null
  emoji: string
  location?: string | null
  notes?: string | null
}

export type CorrectionKind = 'cancel' | 'update' | 'confirm' | 'clarify' | 'unrelated'

export interface CorrectionResult {
  kind: CorrectionKind
  updates: Partial<DraftLike>
  ambiguousTime: boolean
}

const NA = '(?![\\u0590-\\u05FF])'

const NEGATION_PATTERNS = [
  new RegExp(`^לא${NA}`),
  new RegExp(`^זה\\s+לא\\s+נכון${NA}`),
  new RegExp(`^לא\\s+נכון${NA}`),
  /^לא\s*,/,
  new RegExp(`^לא\\s+זה${NA}`),
]

// Vague rejections — user is rejecting but hasn't said what's wrong.
// We must ask a clarifying question rather than silently cancelling.
const VAGUE_REJECTION_PATTERNS = [
  new RegExp(`^זה\\s+לא\\s+נכון${NA}`),
  new RegExp(`^לא\\s+נכון${NA}`),
  new RegExp(`^לא\\s+ככה${NA}`),
  new RegExp(`^זה\\s+לא\\s+זה${NA}`),
  new RegExp(`^זה\\s+טעות${NA}`),
  new RegExp(`^זה\\s+לא\\s+מה\\s+שאמרתי${NA}`),
]

// "זה לא A, זה B" / "לא A, B" — strip the wrong claim and parse only B.
const CORRECTION_PAIR_PATTERNS = [
  /^זה\s+לא\s+[^,]+,\s*זה\s+(.+)$/,
  /^זה\s+לא\s+[^,]+,\s*(.+)$/,
  /^לא\s+[^,]+,\s*זה\s+(.+)$/,
  /^לא\s+[^,]+,\s*(.+)$/,
]

const CONFIRM_PATTERNS = [
  new RegExp(`^כן${NA}`),
  new RegExp(`^אוקיי${NA}`),
  new RegExp(`^בסדר${NA}`),
  new RegExp(`^נכון${NA}`),
  new RegExp(`^זה נכון${NA}`),
  new RegExp(`^שמרי${NA}`),
  new RegExp(`^תשמרי${NA}`),
  new RegExp(`^לקבוע${NA}`),
]

const TITLE_HINT_PATTERNS = [
  /התכוונתי\s+(?:ל|לעשות|לקבוע)?\s*(.+)$/,
  /זה\s+לא\s+(.+?)(?:,|$)/,
  /זה\s+(?:בעצם\s+)?(.+?)(?:,|$)/,
]

const TITLE_REPLACEMENT_LEAD = /^(?:זה|זאת|זאתי|זה בעצם)\s+/

function inheritPeriod(currentTime: string | null, newTime: string, ambiguous: boolean): string {
  if (!ambiguous || !currentTime) return newTime
  const [curHStr] = currentTime.split(':')
  const [newHStr, newMStr] = newTime.split(':')
  const curH = Number(curHStr)
  const newH = Number(newHStr)
  const newM = Number(newMStr)
  if (Number.isNaN(curH) || Number.isNaN(newH)) return newTime
  if (curH >= 12 && newH >= 1 && newH <= 11) {
    return `${String(newH + 12).padStart(2, '0')}:${String(newM).padStart(2, '0')}`
  }
  return newTime
}

export function parseCorrection(
  text: string,
  current: DraftLike,
  todayISO: string,
): CorrectionResult {
  const trimmed = text.trim()
  if (!trimmed) return { kind: 'unrelated', updates: {}, ambiguousTime: false }

  const isNegation = NEGATION_PATTERNS.some(re => re.test(trimmed))
  const isConfirm = CONFIRM_PATTERNS.some(re => re.test(trimmed))
  const isVague = VAGUE_REJECTION_PATTERNS.some(re => re.test(trimmed))

  let stripped = trimmed
  for (const re of CORRECTION_PAIR_PATTERNS) {
    const m = trimmed.match(re)
    if (m && m[1]) { stripped = m[1].trim(); break }
  }
  if (stripped === trimmed && isNegation) {
    stripped = stripped.replace(/^לא\s*,?\s*(?:זה לא נכון\s*,?\s*)?(?:זה לא\s*,?\s*)?/, '').trim()
  }

  const local = parseLocally(stripped, todayISO)
  const updates: Partial<DraftLike> = {}

  if (local.time) {
    updates.time = inheritPeriod(current.time, local.time, local.ambiguousTime)
  }
  if (local.date) updates.date = local.date
  if (local.location) updates.location = local.location
  if (local.notes) updates.notes = local.notes

  let titleUpdate: string | null = null
  if (!isVague) {
    for (const re of TITLE_HINT_PATTERNS) {
      const m = stripped.match(re)
      if (m && m[1]) {
        const candidate = m[1].trim().replace(TITLE_REPLACEMENT_LEAD, '')
          .replace(/[.!?]+$/, '').trim()
        if (candidate && candidate.length >= 2 && candidate !== current.title) {
          titleUpdate = candidate
          break
        }
      }
    }
  }
  if (titleUpdate && local.location) {
    let t = titleUpdate
    t = t.replace(/\s+ברחוב\s+[֐-׿][֐-׿\s'"\-־]*?(?:\s+\d{1,4})?\s*$/, '')
    t = t.replace(/\s+בכתובת\s+[֐-׿][֐-׿\s'"\-־]*?(?:\s+\d{1,4})?\s*$/, '')
    t = t.replace(/\s+ב[֐-׿][֐-׿\s\-]*$/, '')
    t = t.trim()
    if (t.length >= 2) titleUpdate = t
  }
  if (titleUpdate) updates.title = titleUpdate

  if (Object.keys(updates).length > 0) {
    return { kind: 'update', updates, ambiguousTime: local.ambiguousTime && !updates.time }
  }
  if (isVague) {
    return { kind: 'clarify', updates: {}, ambiguousTime: false }
  }
  if (isConfirm) {
    return { kind: 'confirm', updates: {}, ambiguousTime: false }
  }
  if (isNegation) {
    // Bare "לא" alone — definite cancel
    return { kind: 'cancel', updates: {}, ambiguousTime: false }
  }
  return { kind: 'unrelated', updates: {}, ambiguousTime: false }
}

export function applyCorrection(current: DraftLike, updates: Partial<DraftLike>): DraftLike {
  return { ...current, ...updates }
}
