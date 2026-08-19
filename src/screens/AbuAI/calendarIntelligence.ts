/*
 * Smart Calendar Intelligence (Phase 3)
 * ═════════════════════════════════════
 * Understands a rambling, natural meeting request the way an assistant would —
 * not a slot-filler. It COMPOSES the proven `understandMeeting` discourse engine
 * (who / date / time / location / subject / purpose) and adds the two things it
 * did not reason about:
 *
 *   1. DURATION  — "שעתיים", "חצי שעה", "שלוש שעות", "45 דקות" → minutes + label.
 *   2. IMPORTANT DETAILS ("מה חשוב לזכור" / "פרטים חשובים") — the meaningful
 *      context clauses buried in the story: who is coming / not coming, why the
 *      time changed, why she is late, etc. NOT the raw transcript, NOT "notes".
 *
 * It also resolves two things a pure parser misses in real speech:
 *   • CONTEXTUAL LOCATION — "אצלה" + a known subject person → "אצל <person>".
 *   • EVENING INFERENCE   — an ambiguous hour ("שבע") with a late/return/evening
 *     cue resolves to PM (19:00), instead of silently guessing or asking.
 *
 * Deterministic + testable. General — driven by discourse cues, not by any one
 * example. The mission's Ofir utterance is a regression fixture, not a special
 * case in the code.
 */
import { understandMeeting, type MeetingObject } from './meetingIntelligence'
import { loadGraph } from './familyGraph'

export interface SmartMeeting extends MeetingObject {
  /** duration in minutes when stated ("שעתיים" → 120), else null. */
  durationMinutes: number | null
  /** human duration label ("שעתיים", "חצי שעה") for read-back, else null. */
  durationLabel: string | null
  /** the meaningful context clauses to remember — surfaced as "פרטים חשובים". */
  importantDetails: string[]
  /** whether we inferred PM from an evening/late cue (evidence trail). */
  inferredEvening: boolean
}

// ── Duration ───────────────────────────────────────────────────────────────
const HE_HOUR_COUNT: Record<string, number> = {
  'שעה': 1, 'שעתיים': 2, 'שלוש': 3, 'ארבע': 4, 'חמש': 5, 'שש': 6,
  'שבע': 7, 'שמונה': 8, 'תשע': 9, 'עשר': 10,
}

/**
 * Extract a stated duration. Requires a real duration cue so "בשעה שבע" (a
 * clock time) is never mistaken for "an hour long".
 */
export function extractDuration(text: string): { minutes: number | null; label: string | null } {
  const t = text
  // "שעתיים" — unambiguous 2 hours.
  if (/שעתיים/u.test(t)) return { minutes: 120, label: 'שעתיים' }
  // "חצי שעה" / "רבע שעה"
  if (/חצי\s+שעה/u.test(t)) return { minutes: 30, label: 'חצי שעה' }
  if (/רבע\s+שעה/u.test(t)) return { minutes: 15, label: 'רבע שעה' }
  // "שעה וחצי"
  if (/שעה\s+וחצי/u.test(t)) return { minutes: 90, label: 'שעה וחצי' }
  // "<n> שעות" (word or digit), plural → duration, not a clock time.
  const digitHours = t.match(/(\d{1,2})\s+שעות/u)
  if (digitHours) { const n = parseInt(digitHours[1]!, 10); if (n > 0 && n <= 12) return { minutes: n * 60, label: `${n} שעות` } }
  const wordHours = t.match(/(שלוש|ארבע|חמש|שש|שבע|שמונה|תשע|עשר)\s+שעות/u)
  if (wordHours) { const n = HE_HOUR_COUNT[wordHours[1]!]; if (n) return { minutes: n * 60, label: `${wordHours[1]} שעות` } }
  // "למשך שעה" / "שעה אחת" / "לשעה" (for an hour) — single-hour duration. The
  // "לשעה" guard excludes a clock reference ("לשעה עשר" = until ten).
  if (/(?:למשך|במשך)\s+שעה(?!\s*\S*\s*\d)/u.test(t) || /שעה\s+אחת/u.test(t) ||
      /(?<![א-ת])לשעה(?![א-ת])(?!\s*(?:\d|אחת|שתיים|שתים|שלוש|ארבע|חמש|שש|שבע|שמונה|תשע|עשר|וחצי))/u.test(t)) {
    return { minutes: 60, label: 'שעה' }
  }
  // "<n> דקות"
  const mins = t.match(/(\d{1,3})\s+דקות/u)
  if (mins) { const n = parseInt(mins[1]!, 10); if (n > 0 && n <= 600) return { minutes: n, label: `${n} דקות` } }
  return { minutes: null, label: null }
}

// ── Important details ────────────────────────────────────────────────────────
function tidy(s: string): string {
  return s.replace(/\s+/g, ' ').replace(/^[\s,.;:–-]+/, '').replace(/[\s,.;:]+$/, '').trim()
}

/**
 * Surface the meaningful context a person buries in a rambling request: who can
 * or cannot come, why the time changed, why she is late. Discourse-cue driven —
 * NOT tied to any single utterance.
 */
export function extractImportantDetails(text: string): string[] {
  const details: string[] = []
  const add = (s: string | null | undefined) => { const v = s ? tidy(s) : ''; if (v.length >= 3 && !details.includes(v)) details.push(v) }

  // 1) Someone will NOT be able to come ("גלעד לא יוכל להגיע").
  const absent = text.matchAll(/([א-ת]{2,})\s+לא\s+(?:יוכל|תוכל|יכול|יכולה|מגיע[ה]?|יגיע|תגיע)\s*(?:להגיע|לבוא|להיות)?/gu)
  for (const m of absent) add(`${m[1]} לא יוכל/תוכל להגיע`.replace('יוכל/תוכל', /ה$/.test(m[1]!) ? 'תוכל' : 'יוכל'))

  // 2) A time change / correction ("בשעה שבע ולא שבע וחצי", "במקום") — BOTH sides
  // must be time-like, so "התקשר אליי ולא נעים לי" is never mistaken for a time fix.
  const HOURW = '(?:\\d{1,2}(?::\\d{2})?|אחת עשרה|שתים עשרה|אחת|שתיים|שתים|שלוש|ארבע|חמש|שש|שבע|שמונה|תשע|עשר)(?:\\s+(?:וחצי|ורבע))?'
  const timeFix = text.match(new RegExp(`(?:בשעה\\s+)?(${HOURW})\\s+(?:ולא|במקום)\\s+(${HOURW})`, 'u'))
  if (timeFix) add(`להגיע ב${tidy(timeFix[1]!)} במקום ${tidy(timeFix[2]!)}`)

  // 2b) Someone SAID they'll arrive / might be late ("גלעד אמר שהוא יגיע בחמש,
  // אבל אולי הוא יכול לאחר קצת") — a real detail to remember.
  const said = text.match(/([א-ת]{2,})\s+אמר[הת]?\s+ש([^.?!]+)/u)
  if (said) add(`${said[1]} ${tidy(said[2]!)}`)

  // 2c) Someone will ARRIVE at/around a time ("גלעד יגיע כנראה רק בחמש") — keep the
  // whole clause so the arrival time and hedge ("כנראה רק") are preserved.
  const arrives = text.match(/(?<![א-ת])([א-ת]{2,})\s+(?:כנראה\s+|אולי\s+)?(?:יגיע|תגיע|יבוא|תבוא|מגיע[ה]?)[^.?!]*/u)
  if (arrives) add(tidy(arrives[0]))

  // 3) Running late / returning late ("תחזור קצת יותר מאוחר", "מאוחר מהעבודה").
  const late = text.match(/(?:([א-ת]{2,})\s+)?(?:תחזור|יחזור|מגיע[ה]?|חוזר[ת]?)\s+[^.?!,]*מאוחר[^.?!,]*/u)
    ?? (/(?:מאוחר\s+מהעבודה|מאוחר\s+יותר|יותר\s+מאוחר)/u.test(text) ? [text.match(/[^.?!,]*מאוחר[^.?!,]*/u)?.[0] ?? 'מאוחר'] as unknown as RegExpMatchArray : null)
  if (late) add(tidy((late[0] ?? '').replace(/^\s*(?:אמרה\s+לי\s+ש?|אמר\s+לי\s+ש?)/u, '')))

  // 4) Explicit reason clauses ("כי ...") that are not already captured.
  for (const m of text.matchAll(/(?:^|\s)כי\s+([^.?!,]+)/gu)) {
    const clause = tidy(m[1]!)
    // skip pure filler; keep substantive reasons.
    if (clause.length >= 4 && !details.some(d => d.includes(clause) || clause.includes(d))) add(clause)
  }

  return details
}

// ── Contextual location + evening inference ──────────────────────────────────
const EVENING_CUE = /מאוחר|בערב|בלילה|תחזור|יחזור|אחרי\s+העבודה|מהעבודה|אחרי\s+ה?עבודה/u
const AMBIGUOUS_HOUR = /(?<![א-ת])(שבע|שמונה|תשע|עשר|שש|חמש|ארבע|שלוש|שתיים|אחת)(?![א-ת])/u

function knownPersonIn(text: string): string | null {
  try {
    for (const n of loadGraph()) {
      if (n.hebrew.length >= 2 && text.includes(n.hebrew)) return n.hebrew
      for (const a of n.matchNames) if (a.length >= 2 && text.includes(a)) return n.hebrew
    }
  } catch { /* graph unavailable */ }
  return null
}

/** "אצלה"/"אצלו" + a known subject person → "אצל <person>". Never invents. */
export function resolveContextualLocation(text: string, who: string | null): string | null {
  if (!/אצל[הו]/u.test(text)) return null
  const person = who ?? knownPersonIn(text)
  return person ? `אצל ${person}` : null
}

// ── Engine entry ─────────────────────────────────────────────────────────────
/**
 * Full smart understanding: `understandMeeting` + duration + important details +
 * contextual location + evening inference. Never invents who/where/when.
 */
export function understandMeetingSmart(raw: string): SmartMeeting {
  const base = understandMeeting(raw)
  const text = base.cleanedTranscript || raw || ''

  // WHO recovery: a known family name mentioned as the sentence subject
  // ("אופיר אמרה לי") that the base parser missed (no עם/אצל cue).
  let who = base.who
  if (!who) { const p = knownPersonIn(text); if (p) who = p }
  // Initiator override: the SENTENCE-INITIAL "<Name> ביקשה/ביקש/אמרה/אמר ש…" is the
  // person the meeting is WITH ("אופיר ביקשה שאבוא" → who = אופיר). Only replaces a
  // missing who or the speaker herself (מרטיטה) — never a real "עם X" participant,
  // so "…עם אופיר… גלעד אמר ש…" keeps who = אופיר.
  const initiator = text.match(/^\s*([א-ת]{2,})\s+(?:ביקש[הת]?|אמר[הת]?)\s+ש/u)?.[1]
  if (initiator && (!base.who || base.who === 'מרטיטה')) { const p = knownPersonIn(initiator); if (p) who = p }

  // Contextual location for a pronoun venue: "אצלה" → "אצל אופיר", AND "אצלה בבית"
  // → "אצל אופיר בבית" (resolve the pronoun in place, preserving trailing text).
  let location = base.location
  const locPerson = who ?? knownPersonIn(text)
  if (location && /(?<![א-ת])אצל[הוםן](?![א-ת])/u.test(location) && locPerson) {
    location = location.replace(/(?<![א-ת])אצל[הוםן](?![א-ת])/u, `אצל ${locPerson}`)
  } else if (!location) {
    location = resolveContextualLocation(text, who) ?? location
  }
  // "אליה/אליו הביתה" / "אליה לבית" (to her/his home) → that person's home.
  if (!location && who && /(?<![א-ת])אלי[הו]\s+(?:ה?ביתה|לבית)/u.test(text)) location = `אצל ${who} הביתה`

  // Evening inference: an ambiguous hour + a late/return/evening cue → PM.
  let time = base.time
  let inferredEvening = false
  if ((!time || /^0[1-9]:|^1[01]:/.test(time)) && AMBIGUOUS_HOUR.test(text) && EVENING_CUE.test(text)) {
    const hourWord = text.match(AMBIGUOUS_HOUR)?.[1]
    const HOURS: Record<string, number> = { 'אחת': 1, 'שתיים': 2, 'שלוש': 3, 'ארבע': 4, 'חמש': 5, 'שש': 6, 'שבע': 7, 'שמונה': 8, 'תשע': 9, 'עשר': 10 }
    const h = hourWord ? HOURS[hourWord] : undefined
    if (h && h < 12) { time = `${String(h + 12).padStart(2, '0')}:00`; inferredEvening = true }
  }

  const { minutes, label } = extractDuration(text)
  const importantDetails = extractImportantDetails(text)

  // Recompute missing/clarification with the enriched who/time.
  const missing: Array<'who' | 'date' | 'time'> = []
  if (!who && !base.title) missing.push('who')
  if (!base.date) missing.push('date')
  if (!time) missing.push('time')
  const clarificationQuestion =
    missing.includes('who') ? 'עם מי לקבוע?'
    : missing.includes('date') ? 'באיזה יום?'
    : missing.includes('time') ? 'באיזו שעה?'
    : !location ? 'איפה לקבוע את זה?'   // where is required unless explicitly skipped
    : null

  return {
    ...base,
    who,
    time,
    location,
    durationMinutes: minutes,
    durationLabel: label,
    importantDetails,
    inferredEvening,
    missing,
    needsClarification: missing.length > 0 || (!location && clarificationQuestion !== null),
    clarificationQuestion,
  }
}
