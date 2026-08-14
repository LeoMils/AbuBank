/*
 * outputMonitor.ts — M2 post-turn output monitor (deterministic core).
 * ════════════════════════════════════════════════════════════════════════════
 * The realtime AUDIO path streams Abu's speech directly — there is NO pre-delivery
 * interception point (BRIEF_AUDIT). So the design is a POST-TURN monitor: after a turn
 * completes, run these DETERMINISTIC checks on the spoken transcript; a HARD violation
 * triggers ONE next-turn repair (liveSession), a SOFT one is logged for the interception
 * metric. Deterministic only here — zero false-positive risk (language script purity,
 * length, a named source, reading back on-screen text, a literal count). Classified checks
 * (distress→menu, method narration, invented entity detail) live elsewhere and must have
 * their false-positive rate measured before they gate anything.
 *
 * Pure + injected context, so it is unit-tested with no model and no realtime session.
 */

export type ViolationKind =
  | 'LANGUAGE_IMPURE' | 'TOO_LONG' | 'SOURCE_NAMED' | 'READ_BACK' | 'LITERAL_COUNT'
export type Severity = 'hard' | 'soft'
export interface Violation { kind: ViolationKind; severity: Severity; detail: string }

export interface MonitorContext {
  /** What Martita said this turn — sets the expected language + any literal instruction. */
  userText?: string
  /** Text already RENDERED on screen (a prepared message / card) she can read herself. */
  onScreenText?: string
  /** A story/joke/riddle/list — length is not penalised. */
  allowLong?: boolean
  maxWords?: number
}

const HEBREW_RE = /[֐-׿]/
const HEBREW_G = /[֐-׿]/g
const LATIN_WORD = /[A-Za-zÀ-ÿ]{2,}/g
/** Latin tokens allowed inside otherwise-Hebrew speech (names/brands Abu may say). */
const LATIN_OK = /^(abu|martita|whatsapp|ok|leo|mor|ela|pepe|chanel|bleu|edp|edt|ml)$/i

export function hebrewCount(s: string): number { return (s.match(HEBREW_G) ?? []).length }
export function latinWords(s: string): string[] { return (s.match(LATIN_WORD) ?? []).filter((w) => !LATIN_OK.test(w)) }

/** 'hebrew' | 'latin' | 'none' — the dominant script of a text (for language matching). */
export function dominantScript(text: string): 'hebrew' | 'latin' | 'none' {
  const heb = hebrewCount(text)
  const lat = (text.match(/[A-Za-zÀ-ÿ]/g) ?? []).length
  if (heb === 0 && lat === 0) return 'none'
  return heb >= lat ? 'hebrew' : 'latin'
}

/** Language purity: the answer's script must match the language Martita spoke in. A Hebrew
 *  turn answered with a RUN of ≥3 non-allowlisted Latin words (or dominantly Latin) is impure;
 *  a Latin (Spanish) turn answered dominantly in Hebrew script is impure. Conservative. */
export function detectLanguageImpurity(spoken: string, userText?: string): Violation | null {
  if (!spoken.trim()) return null
  const userScript = userText ? dominantScript(userText) : 'hebrew' // default expectation: Hebrew
  if (userScript === 'none') return null
  if (userScript === 'hebrew') {
    const lat = latinWords(spoken)
    if (dominantScript(spoken) === 'latin' || lat.length >= 3) {
      return { kind: 'LANGUAGE_IMPURE', severity: 'hard', detail: `Hebrew turn, Latin leak [${lat.slice(0, 4).join(', ')}]` }
    }
  } else if (userScript === 'latin') {
    if (dominantScript(spoken) === 'hebrew') {
      return { kind: 'LANGUAGE_IMPURE', severity: 'hard', detail: 'Spanish/Latin turn answered in Hebrew script' }
    }
  }
  return null
}

/** A named website/source/app, or a narrated lookup — the NO_SOURCES rule, on the spoken side. */
export function detectSourceNamed(spoken: string): Violation | null {
  const url = /https?:\/\/\S+|\bwww\.\S+|[-\w]+\.(?:co\.il|org\.il|gov\.il|ac\.il|com|net|org|io|ai|co|tv)\b/i
  // TRACK D · dot-less spoken domain: a transcriber drops the dots, so "seret.co.il" is heard as
  // "seret co il". A space-separated TLD pair (co il / gov il / com …) is a domain, not prose —
  // very low FP (this Latin pair does not occur in warm Hebrew or Spanish speech).
  const dotlessDomain = /\b(?:co|com|net|org|gov|ac|edu)\s+(?:il|uk|us|com)\b/i
  // TRACK D · a NAMED source by transliterated/Hebrew name (naming the source IS the defect),
  // plus "אתר" used as a provenance ("I saw it on the site of…"). Kept to real source names +
  // provenance phrasings so it does not fire on ordinary talk.
  const namedSource = /ויקיפדיה|ויקיפדיה|בגוגל|לפי\s*גוגל|וואלה|וויז|וייז|ynet|וינט|בוקינג|טריפאדווייזר|וישבוי|וויזבוי/i
  const narrated = /(לפי\s+ה?אתר|מצאתי\s+ב|בדקתי\s+ב|ראיתי\s+באתר|באתר\s+של|according to|found (?:it )?on|per the site)/i
  if (url.test(spoken)) return { kind: 'SOURCE_NAMED', severity: 'hard', detail: 'a URL/domain was spoken' }
  if (dotlessDomain.test(spoken)) return { kind: 'SOURCE_NAMED', severity: 'hard', detail: 'a dot-less spoken domain (e.g. "co il")' }
  if (namedSource.test(spoken)) return { kind: 'SOURCE_NAMED', severity: 'hard', detail: 'a named source/site was spoken' }
  if (narrated.test(spoken)) return { kind: 'SOURCE_NAMED', severity: 'hard', detail: 'narrated where the info came from' }
  return null
}

/** Over-long spoken answer (word count), unless a story/joke/list is allowed. */
export function detectTooLong(spoken: string, allowLong = false, maxWords = 45): Violation | null {
  if (allowLong) return null
  const words = spoken.trim().split(/\s+/).filter(Boolean).length
  if (words > maxWords) return { kind: 'TOO_LONG', severity: 'soft', detail: `${words} words > ${maxWords}` }
  return null
}

/** Reading back text already on screen (a prepared message/card): a contiguous ≥8-word (or
 *  ≥50-char) chunk of the on-screen text echoed in the spoken answer. */
export function detectReadBack(spoken: string, onScreenText?: string): Violation | null {
  if (!onScreenText || onScreenText.trim().length < 30) return null
  // TRACK D · normalise away punctuation as well as whitespace, so a read-back that only differs
  // by dropped commas/periods (the transcriber does not punctuate) is still caught. A read-back
  // broken by an INSERTED word remains uncatchable by a contiguous-run check — see the corpus gap.
  const norm = (s: string) => s.replace(/[,.;:!?"'()\-–—]/g, '').replace(/\s+/g, ' ').trim()
  const screen = norm(onScreenText), said = norm(spoken)
  const words = screen.split(' ')
  for (let n = words.length; n >= 8; n--) {
    for (let i = 0; i + n <= words.length; i++) {
      const chunk = words.slice(i, i + n).join(' ')
      if (chunk.length >= 50 && said.includes(chunk)) {
        return { kind: 'READ_BACK', severity: 'soft', detail: `echoed ${n} on-screen words` }
      }
    }
  }
  return null
}

const HEB_NUM: Record<string, number> = { אפס: 0, אחת: 1, אחד: 1, שתיים: 2, שניים: 2, שלוש: 3, ארבע: 4, חמש: 5, שש: 6, שבע: 7, שמונה: 8, תשע: 9, עשר: 10 }
/** A literal "count from N to M" instruction, executed correctly. The device defect: asked
 *  1→5, Abu counted 0→5. Parses digits or Hebrew number-words; requires the exact sequence. */
export function detectLiteralCount(spoken: string, userText?: string): Violation | null {
  if (!userText) return null
  // Number tokens are digits or Hebrew number-WORDS (≥2 letters) — a 1-letter "מ" is the
  // "from" preposition (מ-1), not a number, and must not be captured as the start value.
  const m = userText.match(/(?:תספרי|ספרי|count)\D*?(\d+|[א-ת]{2,})\s*(?:עד|-|to|until)\s*(\d+|[א-ת]{2,})/i)
  if (!m) return null
  const toNum = (t: string): number | null => (/^\d+$/.test(t) ? Number(t) : (t in HEB_NUM ? HEB_NUM[t]! : null))
  const from = toNum(m[1]!), to = toNum(m[2]!)
  if (from === null || to === null || to < from || to - from > 30) return null
  // Numbers the answer actually said, in order — digits OR Hebrew number-words.
  const nums = (spoken.match(/\d+|[א-ת]{2,}/g) ?? []).map(toNum).filter((n): n is number => n !== null)
  if (nums.length === 0) return null // no counting attempt to grade
  const want: number[] = []
  for (let i = from; i <= to; i++) want.push(i)
  const hasSeq = want.every((n) => nums.includes(n))
  const startedWrong = nums[0] !== from
  if (!hasSeq || startedWrong) {
    return { kind: 'LITERAL_COUNT', severity: 'hard', detail: `asked ${from}..${to}, said [${nums.slice(0, 8).join(',')}]` }
  }
  return null
}

/** Run every deterministic check on a completed spoken turn. */
export function monitorTurn(spoken: string, ctx: MonitorContext = {}): Violation[] {
  const out: Violation[] = []
  const lang = detectLanguageImpurity(spoken, ctx.userText); if (lang) out.push(lang)
  const src = detectSourceNamed(spoken); if (src) out.push(src)
  const long = detectTooLong(spoken, ctx.allowLong, ctx.maxWords); if (long) out.push(long)
  const rb = detectReadBack(spoken, ctx.onScreenText); if (rb) out.push(rb)
  const cnt = detectLiteralCount(spoken, ctx.userText); if (cnt) out.push(cnt)
  return out
}

/** The HARD violations that justify one next-turn repair (a redo genuinely helps and is safe).
 *  Soft violations are logged for the interception metric but never trigger a redo. */
export function repairableViolations(violations: Violation[]): Violation[] {
  return violations.filter((v) => v.severity === 'hard')
}

/** The Hebrew repair instruction for a set of hard violations — ONE short corrective redo. */
export function buildRepairInstruction(violations: Violation[]): string | null {
  const kinds = new Set(violations.filter((v) => v.severity === 'hard').map((v) => v.kind))
  if (kinds.size === 0) return null
  const parts: string[] = []
  if (kinds.has('LANGUAGE_IMPURE')) parts.push('עני שוב באותה תשובה בעברית בלבד')
  if (kinds.has('SOURCE_NAMED')) parts.push('בלי לנקוב בשום אתר, אפליקציה או מקור, ובלי לספר איפה בדקת')
  if (kinds.has('LITERAL_COUNT')) parts.push('ועשי בדיוק מה שהתבקשת, מהמספר הנכון')
  if (parts.length === 0) return null
  return `תקני את עצמך בקצרה: ${parts.join(', ')}. משפט אחד קצר, בחום, בלי להתנצל יותר מדי ובלי להזכיר תקלה.`
}
