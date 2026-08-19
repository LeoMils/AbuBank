/*
 * sttVariants.ts — GENERATE the spellings speech recognition realistically returns for a
 * canonical Hebrew string (P0 input oracle). Deterministic, no hand-written per-name lists.
 * ════════════════════════════════════════════════════════════════════════════
 * The Gilad defect: the dataset spells "גלעד"; the device heard "גילעד" (an inserted yud) and
 * the resolver returned not_found. A test that feeds names spelled exactly as the dataset stores
 * them is circular. This models what STT actually does to Hebrew names — insert/drop the optional
 * vowel letters yud (י) and vav (ו), swap final/base letter forms, swap the sibilants and gutturals
 * it confuses, add a grammatical prefix, mangle spacing — so the resolver is tested against inputs
 * NOT taken verbatim from its own source.
 */

const FINALS: Record<string, string> = { 'כ': 'ך', 'מ': 'ם', 'נ': 'ן', 'פ': 'ף', 'צ': 'ץ' }
const INV_FINALS: Record<string, string> = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' }

/** Realistic STT variants of a canonical Hebrew name — never includes the verbatim input. */
export function sttVariants(name: string): string[] {
  const base = name.normalize('NFC').trim()
  if (!base) return []
  const chars = [...base]
  const out = new Set<string>()

  // matres lectionis: insert yud (i/e) and vav (o/u) INTERIOR — between two consonants, never
  // after the last letter, never adjacent to an existing mater (that is gibberish no STT emits).
  const isMater = (c?: string) => c === 'י' || c === 'ו'
  for (let i = 1; i < chars.length; i++) {
    if (chars[i - 1] === ' ' || chars[i] === ' ') continue
    if (isMater(chars[i - 1]) || isMater(chars[i])) continue
    out.add([...chars.slice(0, i), 'י', ...chars.slice(i)].join(''))
    out.add([...chars.slice(0, i), 'ו', ...chars.slice(i)].join(''))
  }
  // matres lectionis: drop an existing yud / vav (first occurrence each)
  if (base.includes('י')) out.add(base.replace('י', ''))
  if (base.includes('ו')) out.add(base.replace('ו', ''))

  // final-form ↔ base at the last letter (STT often emits the base form mid-string logic)
  const last = chars[chars.length - 1]!
  if (FINALS[last]) out.add(chars.slice(0, -1).join('') + FINALS[last])
  if (INV_FINALS[last]) out.add(chars.slice(0, -1).join('') + INV_FINALS[last])

  // sibilants + gutturals the transcriber confuses (first occurrence)
  for (const [from, to] of [['ז', 'ס'], ['ש', 'ס'], ['ח', 'כ'], ['ט', 'ת'], ['ב', 'ו'], ['ק', 'כ']] as const) {
    if (base.includes(from)) out.add(base.replace(from, to))
  }

  // a grammatical prefix (STT keeps "the/to <name>")
  out.add('ה' + base)
  out.add('ל' + base)

  // spacing for multi-word names
  if (base.includes(' ')) { out.add(base.replace(/ /g, '')); out.add(base.replace(/ +/g, '  ')) }

  out.delete(base) // STANDING RULE: never assert on the verbatim source spelling
  return [...out].filter((v) => v.length >= 2 && v !== base)
}
