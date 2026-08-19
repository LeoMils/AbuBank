/*
 * AbuAI B2.4 — voice-safe text shaper.
 *
 * The voice path feeds the grounded-answer string straight into the TTS
 * pipeline. Grounded family answers were multi-line profile dumps with
 * bullets and parenthetical details — the TTS rendered them as long,
 * robotic lists with awkward line-break pauses. This shaper produces a
 * spoken-language-safe variant:
 *
 *  • strips URLs (TTS reads them character by character)
 *  • strips bullet glyphs, leading dashes, and asterisks
 *  • collapses multi-line answers into single-line sentences
 *  • caps the result at 2 short sentences so the answer feels human
 *  • trims whitespace
 *
 * The text path is unchanged — it still renders the rich answer with
 * its full detail and (where applicable) sources. Only the spoken
 * surface gets trimmed.
 */

export function shapeVoiceSafe(text: string): string {
  if (!text) return ''

  let t = text

  // Strip URLs (http/https).
  t = t.replace(/https?:\/\/\S+/gi, '')

  // Strip "מקורות:" source section — not speakable
  t = t.replace(/מקורות:[\s\S]*$/i, '')
  t = t.replace(/sources:[\s\S]*$/i, '')

  // Strip Markdown headers / horizontal rules.
  t = t.replace(/^#+\s+/gm, '')
  t = t.replace(/^[-—=]{3,}\s*$/gm, '')

  // Strip bullet glyphs and leading list markers at line starts.
  t = t.replace(/^[•*]\s+/gm, '')
  t = t.replace(/^-\s+/gm, '')
  // Strip inline bullets too (some answers join bullets on one line).
  t = t.replace(/\s*•\s*/g, ' ')
  t = t.replace(/\s*\*\s*/g, ' ')
  // Strip leading inline "- " sequences (after newline collapse).
  t = t.replace(/(^|\.\s)-\s+/g, '$1')

  // Strip robotic filler phrases that sound bad when spoken
  t = t.replace(/על פי הנתונים,?\s*/gi, '')
  t = t.replace(/מצאתי עבורך,?\s*/gi, '')
  t = t.replace(/להלן\s*/gi, '')
  t = t.replace(/אם יש לך שאלות נוספות[^.]*[.!?]?\s*/gi, '')
  t = t.replace(/אם תצטרכי עוד משהו[^.]*[.!?]?\s*/gi, '')

  // Collapse newlines into sentence breaks.
  t = t.replace(/\n+/g, '. ')

  // Collapse runs of whitespace.
  t = t.replace(/\s+/g, ' ').trim()

  // Remove repeated "Martita" — once is enough for speech
  const martitaCount = (t.match(/Martita/gi) || []).length
  if (martitaCount > 1) {
    let found = 0
    t = t.replace(/Martita/gi, (match) => { found++; return found === 1 ? match : '' })
    t = t.replace(/\s+/g, ' ').trim()
  }

  // Cap at ≤ 2 short sentences — a spoken answer stays human, not a paragraph.
  // Protect a decimal point ("3.65", "36.5°") so the sentence splitter doesn't
  // read it as "3. 65". Mask with a private placeholder, split, then restore.
  const DOT = '' // Unicode private-use area — never appears in real text
  const masked = t.replace(/(\d)\.(\d)/g, `$1${DOT}$2`)
  const parts: string[] = []
  const re = /[^.!?]+[.!?]+/g
  let m: RegExpExecArray | null
  while ((m = re.exec(masked)) !== null) {
    parts.push(m[0].trim())
    if (parts.length >= 2) break
  }
  const capped = parts.length === 0 ? masked : parts.join(' ')
  return capped.trim().split(DOT).join('.')
}
