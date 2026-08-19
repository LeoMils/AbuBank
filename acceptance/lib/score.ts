/*
 * Shared deterministic conversation scoring for the acceptance harnesses.
 *
 * These checks score the STRUCTURE of a response that Martita would actually
 * see (anti-robotic, anti-patronizing, correct perspective, correct language,
 * no menu, no raw output). They do NOT score real-model felt warmth — that is
 * the single Martita-subjective sliver. Everything here is executable and pure.
 */

export const HEBREW = /[֐-׿]/
export const SPANISH_MARK = /[áéíóúüñ¿¡]/i
// Iberian/neutral forms we explicitly avoid in Rioplatense.
export const IBERIAN_BAD = /\b(vale|coger|vosotros|os\s|tú\s|contigo|podéis|tenéis|sois)\b/i
// Patronizing / childish register (Hebrew + Spanish + English).
export const PATRONIZING =
  /(יופי של שאלה|איזה יופי|כל הכבוד|שאלה מצוינת|ילדה טובה|מותק שלי|muy bien, eh|como sos grande|good job|great job|well done)/i
// Customer-support / robotic register.
export const SUPPORT_ROBOTIC =
  /(אשמח לעזור|איך אפשר לעזור|יש עוד משהו|אני כאן אם תצטרכי|על פי הנתונים|במאגר|according to the data|how can i help|happy to help|is there anything else)/i
// AbuAI speaks TO Martita — never ABOUT her in the third person, never claims her
// family as its own ("שלי").
export const THIRD_PERSON_MARTITA =
  /(ל-?Martita\s|למרטיטה\s+(יש|צריכ|תור|קבוע)|מרטיטה\s+(יש לה|צריכה|קבעה)|a\s+Martita\s+le)/i
export const WRONG_POSSESSIVE = /\b(שלי)\b/ // in a family/calendar answer addressed to her, must be "שלך"
// Menu/list shape (numbered or bulleted) — never unless she asked for options.
export const MENU = /(^|\n)\s*(\d+[.)]\s|[-•*]\s)/
// Obvious raw output that must never reach her.
export const RAW_OUTPUT = /([{}]|"role"|"content"|undefined|null,|errorCode|sk-|Bearer\s|stack)/
// Fake-therapy register (clinical reflection, "how does that make you feel").
export const FAKE_THERAPY =
  /(איך זה גורם לך להרגיש|איך את מרגישה עם זה|זה לגיטימי להרגיש|אני מבינה איך את מרגישה|c[oó]mo te hace sentir|c[oó]mo te sent[ií]s con eso|es v[aá]lido sentir|entiendo c[oó]mo te sent[ií]s|how does that make you feel|it'?s valid to feel|i understand how you feel)/i
// Fake intimacy / over-claimed closeness AbuAI cannot truthfully have.
export const FAKE_INTIMACY =
  /(אני אוהבת אותך|אני תמיד אהיה לידך|נצח ביחד|te quiero mucho|te amo|siempre voy a estar a tu lado|i love you|i'?ll always be here for you forever)/i

export interface ScoreOpts {
  lang: 'he' | 'es'
  /** Family/calendar answers must use her POV ("שלך") and never "שלי". */
  perspectiveSensitive?: boolean
  /** Allow Latin family names + a trailing Spanish sentence when the user mixed languages. */
  allowMixed?: boolean
  /** Emotional/companion turn: also reject fake-therapy and fake-intimacy register. */
  companion?: boolean
}

export interface TurnScore {
  text: string
  dims: Record<string, boolean>
  pass: boolean
  fails: string[]
}

/** Score a single produced response. Returns pass + the failing dimensions. */
export function scoreResponse(text: string, opts: ScoreOpts): TurnScore {
  const t = (text ?? '').trim()
  const dims: Record<string, boolean> = {
    non_empty: t.length > 0,
    not_patronizing: !PATRONIZING.test(t),
    not_robotic: !SUPPORT_ROBOTIC.test(t),
    not_third_person: !THIRD_PERSON_MARTITA.test(t),
    no_menu: !MENU.test(t),
    no_raw_output: !RAW_OUTPUT.test(t),
  }
  if (opts.lang === 'he') {
    // Hebrew answer must contain Hebrew (Latin family names are fine).
    dims.is_hebrew = HEBREW.test(t)
  } else {
    // Spanish answer must not leak Hebrew unless the user mixed languages.
    dims.no_hebrew_leak = opts.allowMixed ? true : !HEBREW.test(t)
    dims.not_iberian = !IBERIAN_BAD.test(t)
  }
  if (opts.perspectiveSensitive) {
    dims.correct_perspective = opts.lang === 'he' ? !WRONG_POSSESSIVE.test(t) : true
  }
  if (opts.companion) {
    dims.not_fake_therapy = !FAKE_THERAPY.test(t)
    dims.not_fake_intimacy = !FAKE_INTIMACY.test(t)
  }
  const fails = Object.entries(dims).filter(([, v]) => !v).map(([k]) => k)
  return { text: t, dims, pass: fails.length === 0, fails }
}

export interface HarnessReport {
  title: string
  rows: Array<{ id: string; cat: string; user: string; got: string; pass: boolean; fails: string[] }>
}

export function renderReport(r: HarnessReport): { md: string; pass: number; fail: number } {
  let pass = 0, fail = 0
  const lines = [`# ${r.title}`, '',
    '_Deterministic structural scoring (anti-robotic / anti-patronizing / perspective / language / no-menu / no-raw). Real-model felt warmth is Martita-subjective and not scored here._', '',
    '| ID | Cat | User | Response | Result | Fails |', '|----|-----|------|----------|--------|-------|']
  for (const row of r.rows) {
    if (row.pass) pass++; else fail++
    lines.push(`| ${row.id} | ${row.cat} | ${row.user.replace(/\|/g, '/')} | ${row.got.replace(/\n/g, ' / ').replace(/\|/g, '/')} | ${row.pass ? '✅' : '❌'} | ${row.fails.join(', ')} |`)
  }
  lines.push('', `**Total ${r.rows.length} · pass ${pass} · fail ${fail}**`)
  return { md: lines.join('\n'), pass, fail }
}
