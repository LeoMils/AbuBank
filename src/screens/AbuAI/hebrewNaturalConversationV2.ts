/*
 * Hebrew Natural Conversation v2
 * ══════════════════════════════
 * A final quality layer over the user-visible Hebrew answer. It PRESERVES facts and
 * structured data — it only blocks robotic filler, repairs known broken-Hebrew forms,
 * collapses doubled words, shapes tone (no fake cheerfulness / childishness), and
 * produces a shorter speech-safe version. Deterministic + pure. A NO-OP on already-clean
 * text (so it never regresses green outputs). Physical TTS voice feel is device-only.
 */

export interface HebrewContext { domain?: 'calendar' | 'family' | 'online' | 'frustration' | 'general'; forDetail?: boolean }
export interface HebrewValidation { ok: boolean; issues: string[] }

// ── forbidden robotic filler → removed (facts never touched) ──
const FORBIDDEN: Array<{ re: RegExp; to: string; issue: string }> = [
  { re: /\s*אני\s+כאן\s+כדי\s+לעזור\S*\.?/gu, to: '', issue: 'robotic: אני כאן כדי לעזור' },
  { re: /(?:^|[.\s,])אם\s+תרצי[,.]?(?=\s|$)/gu, to: ' ', issue: 'filler: אם תרצי' },
  { re: /תגידי\s+ב?מילה\s+אחת/gu, to: 'תגידי לי', issue: 'childish: תגידי מילה אחת' },
  { re: /\s*יופי\s+של\s+שאלה!?/gu, to: '', issue: 'fake cheer: יופי של שאלה' },
  { re: /\s*אני\s+כאן\s+בשבילך\S*\.?/gu, to: '', issue: 'robotic: אני כאן בשבילך' },
]

// ── broken Hebrew → repaired ──
const BROKEN: Array<{ re: RegExp; to: string; issue: string }> = [
  { re: /(?<![א-ת])אני\s+תבדוק(?![א-ת])/gu, to: 'אבדוק', issue: 'agreement: אני תבדוק' },
  { re: /(?<![א-ת])אני\s+תעשה(?![א-ת])/gu, to: 'אעשה', issue: 'agreement: אני תעשה' },
  { re: /(?<![א-ת])אני\s+תלך(?![א-ת])/gu, to: 'אלך', issue: 'agreement: אני תלך' },
  { re: /(?<![א-ת])תקבילי\s+(פגישה|תור)/gu, to: 'תקבעי $1', issue: 'verb: תקבילי' },
  { re: /(?<![א-ת])אחורה\s+צהריים(?![א-ת])/gu, to: 'אחר הצהריים', issue: 'phrase: אחורה צהריים' },
  { re: /(?<![א-ת])לך\s+היום\?/gu, to: 'לך יש היום?', issue: 'phrase: לך היום?' },
]

// collapse an immediately-duplicated word ("פגישה פגישה" → "פגישה").
const DUP = /(?<![א-ת])([א-ת]{2,})\s+\1(?![א-ת])/gu

export function blockForbiddenPhrases(answer: string): string {
  let out = answer
  for (const { re, to } of FORBIDDEN) out = out.replace(re, to)
  return out
}

export function detectBrokenHebrew(answer: string): string[] {
  const issues: string[] = []
  for (const { re, issue } of BROKEN) if (new RegExp(re.source, 'u').test(answer)) issues.push(issue)
  return issues
}

export function validateHebrewAnswer(answer: string, _ctx?: HebrewContext): HebrewValidation {
  const issues: string[] = []
  for (const { re, issue } of FORBIDDEN) if (new RegExp(re.source, 'u').test(answer)) issues.push(issue)
  issues.push(...detectBrokenHebrew(answer))
  return { ok: issues.length === 0, issues }
}

/** Repair the user-visible Hebrew (facts preserved). No-op on clean text. */
export function rewriteHebrewAnswer(answer: string, _ctx?: HebrewContext): string {
  if (!answer) return answer
  let out = blockForbiddenPhrases(answer)
  for (const { re, to } of BROKEN) out = out.replace(re, to)
  out = out.replace(DUP, '$1')
  // tidy the spacing/punctuation the removals may leave behind — never touch content.
  return out.replace(/\s{2,}/gu, ' ').replace(/\s+([.,!?])/gu, '$1').replace(/([.,!?])\1+/gu, '$1').trim()
}

export function applyTone(answer: string, ctx?: HebrewContext): string { return rewriteHebrewAnswer(answer, ctx) }

/** A shorter, easier-to-say version for speech: strip markdown/URLs, keep the first 1–2
 *  sentences (unless the user asked for detail). Never longer than the display. */
export function shapeForSpeech(answer: string, ctx?: HebrewContext): string {
  const clean = rewriteHebrewAnswer(answer, ctx)
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/https?:\/\/\S+/g, '').replace(/[*_`#]/g, '').replace(/\s{2,}/gu, ' ').trim()
  if (ctx?.forDetail) return clean
  const sentences = clean.split(/(?<=[.!?])\s+/u).filter(Boolean)
  const short = sentences.slice(0, 2).join(' ').trim()
  return short.length && short.length <= clean.length ? short : clean
}

// ── domain wording ──
const FAIL: Record<string, string> = {
  provider_failed: 'ניסיתי לבדוק אונליין וזה נפל. שננסה שוב?',
  timeout: 'לקח לזה יותר מדי זמן ונקטע. שננסה שוב?',
  save_failed: 'הפגישה לא נשמרה. תנסי שוב ואני איתך.',
  default: 'לא הצלחתי עכשיו. שננסה שוב?',
}
export function formatFailure(reason: string | null | undefined, _ctx?: HebrewContext): string { return FAIL[reason ?? 'default'] ?? FAIL.default! }
export function formatOnlineFailure(providerReason: string | null | undefined): string { return FAIL[providerReason ?? 'default'] ?? FAIL.default! }
export function formatCalendarConfirmation(event: { title?: string | null; date?: string | null; time?: string | null; location?: string | null }): string {
  const parts = [event.title ?? 'פגישה', event.date ?? '', event.time ? `בשעה ${event.time}` : '', event.location ?? ''].filter(Boolean)
  return `קבעתי: ${parts.join(', ')}.`.replace(/,\s*\./, '.')
}
export function formatFamilyAnswer(answer: string, _relationContext?: unknown): string { return rewriteHebrewAnswer(answer, { domain: 'family' }) } // facts + gender preserved
