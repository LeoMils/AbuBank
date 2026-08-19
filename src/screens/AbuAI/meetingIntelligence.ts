/*
 * Meeting Intelligence Engine
 * ═══════════════════════════
 * Martita never speaks in fields. She rambles, explains, corrects herself, and
 * buries the meeting inside a story. A form-parser copies words into slots and
 * fails. This engine instead UNDERSTANDS intent at the discourse level.
 *
 *   Voice → STT → Semantic understanding → Entity extraction → Temporal reasoning
 *        → Context resolution → Event synthesis → Validation → (confirm) → save
 *
 * The transcript is EVIDENCE (kept as rawTranscript). The saved event is the
 * synthesized UNDERSTANDING: a clean title, a topic subject, a one-line purpose,
 * clean notes — never the raw transcript.
 *
 * What this layer adds on top of the entity parsers:
 *  - Cross-clause temporal reasoning: a period word in one clause ("בערב") and
 *    an hour in another ("בסביבות שמונה") resolve together → 20:00.
 *  - Purpose / topic synthesis: "כי אנחנו צריכים לסגור את הסכם השכירות לפני
 *    שהדיירים מגיעים" → subject "שכירות", purpose = the clean reason.
 *  - Narrative discarding: "בוא נעשה את זה", "אז ככה", "אני חושבת ש…" never reach
 *    the title or notes.
 *  - Missing-field reasoning: location missing → empty (never invented); person
 *    or time missing → one short clarification question.
 *
 * Deterministic + rule/discourse based — no network, fully testable. This is the
 * grounding/offline layer; an LLM understanding provider could be layered ABOVE
 * it in production for open-ended phrasing, but temporal resolution and the
 * no-invention validation must stay deterministic regardless (calendar-date
 * integrity). No LLM is wired here today — every result above is rule-derived.
 */
import {
  cleanTranscript,
  parseCreateDate,
  parseHebrewTimeDetailed,
  extractTitle,
  type CreateDraft,
} from './calendarCreate'
import { extractEventDetails } from './eventExtractor'
import { loadGraph } from './familyGraph'
import { recoverHebrewStt, type SttCorrection } from './sttSemanticRecovery'

export interface MeetingObject {
  who: string | null
  date: string | null        // YYYY-MM-DD
  time: string | null        // HH:MM
  location: string | null    // never invented
  subject: string | null     // topic noun ("שכירות")
  purpose: string | null     // WHY, clean ("לסגור את הסכם השכירות לפני הדיירים")
  title: string | null       // synthesized ("פגישה עם אלכסנדרה")
  notes: string | null       // clean one-line summary, NOT the transcript
  rawTranscript: string
  cleanedTranscript: string
  confidence: number
  missing: Array<'who' | 'date' | 'time'>
  needsClarification: boolean
  clarificationQuestion: string | null
  /** STT slips repaired from context before extraction (evidence trail). */
  corrections: SttCorrection[]
}

// ── small shared helpers ────────────────────────────────────────────────────
function tidy(s: string): string {
  return s.replace(/\s+/g, ' ').replace(/^[\s,.;:–-]+/, '').replace(/[\s,.;:]+$/, '').trim()
}

// Filler lead-ins that carry no meeting meaning — dropped from purpose/notes.
const PURPOSE_FILLER = /^(?:אנחנו\s+(?:צריכים|רוצים|חייבים)|אני\s+(?:צריכ[הא]?|רוצ[הא]?|חייב[הת]?)|צריכים|רוצ[הא]?|כדאי\s+ש\S*|בוא[י) ]*\s*נ\S+)\s+/u

// Hebrew "root-ה" nouns whose leading ה is NOT a definite article — must not be
// stripped ("הסכם" = agreement, not "the …").
const ROOT_HE = new Set([
  'הסכם', 'הורים', 'הצעה', 'הזדמנות', 'הרצאה', 'הופעה', 'הנחה', 'הסעה',
  'הדרכה', 'הסבר', 'הספד', 'הריון', 'היכרות', 'הישג', 'הרגל', 'הסדר',
])

function stripArticle(word: string): string {
  if (ROOT_HE.has(word)) return word
  return word.replace(/^ה(?=[א-ת])/u, '')
}

/** Clean a topic noun-phrase into a tidy subject. */
function cleanSubject(s: string): string {
  let v = tidy(s)
  // strip a leading article on the FIRST word only (root-ה nouns survive)
  const parts = v.split(/\s+/)
  if (parts.length > 0) parts[0] = stripArticle(parts[0]!)
  v = parts.join(' ')
  v = v.replace(/\s+של\s+/u, ' ') // "שכירות של הבית" → "שכירות הבית"
  return tidy(v)
}

// ── 1. Temporal reasoning (cross-clause) ────────────────────────────────────
const HOUR_WORD = '(?:אחת עשרה|שתים עשרה|אחת|שתיים|שתים|שלוש|ארבע|חמש|שש|שבע|שמונה|תשע|עשר)'
const PERIOD_WORD = /בבוקר|אחר[י]?\s+הצהריים|אחה"צ|אחה״צ|אחהצ|בצהריים|בערב|בלילה/

/**
 * Resolve the time even when the hour and the AM/PM period live in DIFFERENT
 * clauses ("מחרתיים בערב … בסביבות שמונה" → 20:00). Falls back to the direct
 * parse. Never invents a time it cannot justify.
 */
export function resolveMeetingTime(text: string): { time: string | null; ambiguous: boolean } {
  const base = parseHebrewTimeDetailed(text)
  if (base.time && !base.ambiguous) return { time: base.time, ambiguous: false }

  const period = text.match(PERIOD_WORD)?.[0]
  if (period) {
    const hw = text.match(new RegExp(`(?<![א-ת])(${HOUR_WORD})(?![א-ת])`, 'u'))?.[1]
    if (hw) {
      const r = parseHebrewTimeDetailed(`ב${hw} ${period}`)
      if (r.time) return { time: r.time, ambiguous: false }
    }
    const digit = text.match(/(?:בסביבות|בערך|בשעה)?\s*(\d{1,2})(?![:.\d])/)?.[1]
    if (digit) {
      const r = parseHebrewTimeDetailed(`בשעה ${digit} ${period}`)
      if (r.time) return { time: r.time, ambiguous: false }
    }
  }
  return { time: base.time, ambiguous: base.ambiguous }
}

// ── 2. Purpose + subject synthesis ──────────────────────────────────────────
// Action verbs that introduce the meeting's purpose/topic.
// NOTE: scheduling verbs (לקבוע / לתאם / לסדר) are deliberately EXCLUDED — they
// are the action, not the meeting's topic ("לקבוע עם מור" must not yield a
// subject of "עם מור").
const PURPOSE_VERB = '(?:לסגור|לסיים|לחתום|לחתום\\s+על|לדבר|לדון|לשוחח|לשאול|להחליט|לבדוק|לטפל|להתייעץ|לחגוג|לארגן)'

/**
 * Understand WHY the meeting exists (purpose) and WHAT it is about (subject).
 * Reads a reason clause ("כי/כדי/בגלל …") or a purpose-verb clause
 * ("…לדבר על X", "…לסגור את X"), drops conversational filler, and returns a
 * clean purpose plus a topic-noun subject.
 */
export function understandPurpose(text: string): { purpose: string | null; subject: string | null } {
  let clause: string | null = null

  // Reason clause first ("כי/כדי/בגלל …") — capture up to the next sentence end.
  const reason = text.match(/(?:^|\s)(?:כי|כדי|בגלל)\s+([^.?!]+)/u)
  if (reason?.[1]) clause = reason[1]

  // Otherwise a bare purpose-verb clause ("…לדבר על השכירות").
  if (!clause) {
    const verbClause = text.match(new RegExp(`(?:^|\\s)((?:${PURPOSE_FILLER.source.replace(/^\^/, '')})?${PURPOSE_VERB}\\s+[^.?!]+)`, 'u'))
    if (verbClause?.[1]) clause = verbClause[1]
  }

  // A "לפני/אחרי …" timing clause carries the WHY ("לפני שהדיירים נכנסים",
  // "לפני הטיסה לאיטליה"). It is the purpose when nothing stronger exists, and a
  // NOUN-phrase form ("הטיסה לאיטליה") can also seed the subject.
  const beforeAfter = text.match(/(?<![א-ת])(לפני|אחרי)\s+(ש?[^.?!,]+)/u)
  const beforeAfterNoun = beforeAfter && !/^ש/u.test(beforeAfter[2]!.trim())
    ? cleanSubject(beforeAfter[2]!.replace(/\s+(?:עם|ב|ל)\s.*$/u, ''))
    : null

  // Clean the purpose into short human notes: drop the filler lead-in AND a
  // redundant pronoun object ("לדבר איתה על…" → "לדבר על…").
  let purpose: string | null = clause
    ? tidy(clause.replace(PURPOSE_FILLER, '').replace(/\s+(?:איתה|איתו|איתם|איתן|אותה|אותו|אותם|אותן)(?=\s)/gu, ''))
    : null
  if (!purpose && beforeAfter) purpose = tidy(`${beforeAfter[1]} ${beforeAfter[2]}`)

  // Subject = the topic noun. Prefer an explicit topic marker ("…על הבדיקות" →
  // "בדיקות", skipping a pronoun object like "אותה"); otherwise the noun right
  // after the purpose verb ("לסגור את הסכם השכירות"); otherwise the "לפני/אחרי"
  // noun ("הטיסה לאיטליה"). Cut before a trailing temporal/sub-clause.
  let subject: string | null = null
  if (clause) {
    const topic = clause.match(/(?:על|בנושא|לגבי|בעניין)\s+([^.?!]+)/u)?.[1]
      ?? clause.match(new RegExp(`${PURPOSE_VERB}\\s+(?:את\\s+|ל)?([^.?!]+)`, 'u'))?.[1]
    if (topic) {
      const cut = topic.replace(/\s+(?:לפני|אחרי|כי|כדי|עם|בגלל|ש[א-ת]).*$/u, '')
      const s = cleanSubject(cut)
      if (s.length >= 2) subject = s
    }
  }
  if (!subject && beforeAfterNoun && beforeAfterNoun.length >= 2) subject = beforeAfterNoun

  return { purpose: purpose && purpose.length >= 2 ? purpose : null, subject }
}

/**
 * Resolve WHO when the base parser dropped a real name that happens to start
 * with a preposition letter ("לאו"/"לאה" begin with ל). We only accept the
 * candidate if it is a KNOWN family member, so we never invent a person.
 */
export function resolveWho(text: string, basePerson: string | null): string | null {
  if (basePerson) return basePerson
  // "…עם X", "…אצל X", or a meeting verb + "את X" ("לראות את מור", "לפגוש את לאו").
  const cand = text.match(/(?<![֐-׿])(?:עם|אצל)\s+([א-ת]{2,})/u)?.[1]
    ?? text.match(/(?:לראות|לפגוש|לבקר|להיפגש)\s+את\s+([א-ת]{2,})/u)?.[1]
  if (!cand) return null
  try {
    const graph = loadGraph()
    const hit = graph.find(n => n.hebrew === cand || n.matchNames.includes(cand.toLowerCase()))
    if (hit) return hit.hebrew
  } catch { /* graph unavailable — do not invent */ }
  return null
}

// ── 3. Title synthesis (narrative-aware) ────────────────────────────────────
const NARRATIVE_TITLE = /להיפגש|להפגש|אני\s+צריכ|אני\s+חייב|אנחנו\s+צריכ|בא\s+לי|אז\s+ככה|^ככה|תשמעי|שמעי|אני\s+חושב|כדאי\s+ש|לפני\s+ש|אחרי\s+ש|בוא[י) ]|נעשה|לשבת|משהו/u

/**
 * A clean human title. For a person-meeting we say "פגישה עם <who>" (or keep
 * an "אצל <who>" visit). We only override the base title when it is missing or
 * narrative-contaminated — a narrative marker, a comma, or an over-long phrase
 * (a real title is short) — so clean short inputs keep their existing titles
 * ("תור לרופא", "אצל אופיר", "קניות", "תור אצל התופרת").
 */
export function synthesizeTitle(text: string, who: string | null, baseTitle: string | null): string | null {
  // A person-meeting title is just "פגישה עם <who>" — drop any residual before OR
  // after ("…הולכים", "פגישה ביומן ל עם גבי"). The activity lives in subject/notes.
  if (who && baseTitle) {
    const meetingForm = `פגישה עם ${who}`
    if (baseTitle.startsWith(meetingForm) && baseTitle.length > meetingForm.length) return meetingForm
    // noise between "פגישה" and "עם <who>" (Hebrew names carry no regex specials)
    if (new RegExp(`פגישה.{0,24}עם\\s+${who}(?![א-ת])`, 'u').test(baseTitle)) return meetingForm
  }
  const wordy = !!baseTitle && (baseTitle.includes(',') || baseTitle.trim().split(/\s+/).length > 5)
  const contaminated = !baseTitle || NARRATIVE_TITLE.test(baseTitle) || wordy
  if (!contaminated) return baseTitle
  if (who) {
    if (new RegExp(`אצל\\s+${who}`, 'u').test(text)) return `אצל ${who}`
    return `פגישה עם ${who}`
  }
  return baseTitle // nothing better to offer — leave as-is for clarification
}

// ── 4. Notes (clean summary, never the transcript) ──────────────────────────
function synthesizeNotes(purpose: string | null, baseNotes: string | null | undefined): string | null {
  // Prefer the synthesized purpose — it is already a clean one-liner.
  if (purpose) return purpose
  // Otherwise tidy the base note and reject obvious multi-sentence transcript dumps.
  if (!baseNotes) return null
  const cleaned = tidy(baseNotes.replace(PURPOSE_FILLER, ''))
  // Drop trailing narrative ("… בוא נעשה את זה …") — keep the first sentence.
  const firstSentence = cleaned.split(/[.?!]/)[0]!.trim()
  return firstSentence.length >= 2 ? firstSentence : null
}

// ── 5. Engine entry ─────────────────────────────────────────────────────────

/**
 * Refine a base CreateDraft with discourse-level understanding. Used by
 * startCreate so the create state machine and every existing test keep working,
 * while long/messy speech gets the full semantic treatment. Pure.
 */
export function refineMeeting(base: CreateDraft, cleanedText: string): CreateDraft {
  const d: CreateDraft = { ...base }

  // WHO recovery for family names the base parser dropped ("…עם לאו").
  if (!d.person) {
    const who = resolveWho(cleanedText, null)
    if (who) d.person = who
  }

  // Temporal: fill / fix when the base parse came up empty or ambiguous.
  if (!d.time || d.ambiguousTime) {
    const rt = resolveMeetingTime(cleanedText)
    if (rt.time) { d.time = rt.time; d.ambiguousTime = rt.ambiguous }
  }

  // Purpose + subject understanding.
  const { purpose, subject } = understandPurpose(cleanedText)
  if (purpose) d.purpose = purpose
  if (subject && !d.subject) d.subject = subject

  // Notes = clean summary, never the raw transcript.
  d.notes = synthesizeNotes(purpose ?? d.purpose ?? null, d.notes)

  // Title = clean, narrative-stripped.
  d.title = synthesizeTitle(cleanedText, d.person ?? null, d.title ?? null)
  return d
}

/**
 * Full engine: raw utterance → understood MeetingObject. The transcript is kept
 * as evidence; every other field is synthesized understanding. Validation marks
 * missing critical fields (who / date / time) and proposes ONE short
 * clarification — and NEVER invents a location.
 */
export function understandMeeting(raw: string): MeetingObject {
  const rawTranscript = raw ?? ''
  // Clean fillers, then repair obvious Hebrew STT slips from context BEFORE
  // extraction. The repaired text is what we parse and store; the raw transcript
  // stays as evidence.
  const recovered = recoverHebrewStt(cleanTranscript(rawTranscript))
  const cleanedTranscript = recovered.text

  // Base entity extraction (who / where / topic / base-notes) + date.
  const ev = extractEventDetails(cleanedTranscript)
  const who = resolveWho(cleanedTranscript, ev.person)
  const date = parseCreateDate(cleanedTranscript)
  const { time } = resolveMeetingTime(cleanedTranscript)
  const baseTitle = extractTitle(ev.residualText) ?? (who ? `פגישה עם ${who}` : null)

  const { purpose, subject } = understandPurpose(cleanedTranscript)
  const finalSubject = subject ?? ev.subject ?? null
  const title = synthesizeTitle(cleanedTranscript, who, baseTitle)
  const notes = synthesizeNotes(purpose, ev.notes)

  // Validation — critical fields. Location is OPTIONAL and never invented.
  const missing: Array<'who' | 'date' | 'time'> = []
  if (!who && !title) missing.push('who')
  if (!date) missing.push('date')
  if (!time) missing.push('time')

  const clarificationQuestion =
    missing.includes('who') ? 'עם מי לקבוע?'
    : missing.includes('date') ? 'באיזה יום?'
    : missing.includes('time') ? 'באיזו שעה?'
    : null

  // Confidence — completeness-weighted, minus any context-gated STT guess.
  let confidence = 1
  if (missing.includes('who')) confidence -= 0.3
  if (missing.includes('date')) confidence -= 0.35
  if (missing.includes('time')) confidence -= 0.3
  confidence -= recovered.confidencePenalty
  confidence = Math.max(0, Math.min(1, Number(confidence.toFixed(2))))

  return {
    who,
    date,
    time,
    location: ev.location, // null when nothing was said — never invented
    subject: finalSubject,
    purpose,
    title,
    notes,
    rawTranscript,
    cleanedTranscript,
    confidence,
    missing,
    needsClarification: missing.length > 0,
    clarificationQuestion,
    corrections: recovered.corrections,
  }
}
