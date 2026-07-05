/*
 * Semantic Intelligence Engine (v2)
 * ═════════════════════════════════
 * Sits immediately AFTER STT and BEFORE every downstream engine. It does NOT trust the
 * transcript — STT produces substitutions / dropped / duplicated / mis-spaced words.
 * Two responsibilities:
 *
 *  1. recoverTranscript(text) — repair imperfect speech into a canonical utterance
 *     using a DATA-DRIVEN semantic lexicon (STT confusions + Hebrew morphology +
 *     conversational shortcuts), not scattered regex. Downstream engines (Conversation
 *     Engine v2, Calendar Builder v2, Family, Online) see the clean utterance.
 *
 *  2. resolveSemanticIntent(text, ctx) — a SCORED intent model with context fusion
 *     (pending action, known family names, calendar/live cues). Emits intent +
 *     confidence + alternatives + reason + a clarification flag. Intent emerges from
 *     fused signals, never from regex ORDER.
 */
import { findNode } from './familyGraph'

export interface SemanticContext {
  hasPending: boolean
  recentAssistant?: string[]
}

export interface RecoveryResult {
  text: string
  original: string
  corrections: Array<{ from: string; to: string; kind: string }>
}

// ── data-driven recovery lexicon ──────────────────────────────────────────────
// Each row: a corrupted/short form → its canonical form. Applied as whole-token or
// anchored-phrase substitutions. Kept as DATA so the vocabulary grows without new code.
interface LexRow { re: RegExp; to: string; kind: string }
const LEXICON: LexRow[] = [
  // STT drops/merges the scheduling verb "תקבע לי / קבעי לי" → "קלי" before a cal noun.
  { re: /^\s*ק(?:ב?לי|יל?י)(?=\s+(?:פגישה|תור|ל?פגוש|לי\b|אירוע|מפגש))/u, to: 'קבעי לי', kind: 'stt-verb' },
  // "תיקבע/תיקבעי" (STT extra yod) → "תקבע/תקבעי".
  { re: /(?<![א-ת])תיקבע(י)?(?![א-ת])/u, to: 'תקבעי', kind: 'morphology' },
  // "who is" morphology: זאת / זו → זה, so "מי זאת אופיר" reads as "מי זה אופיר".
  { re: /(?<![א-ת])מי\s+ז(?:את|ו)(?=\s)/u, to: 'מי זה', kind: 'morphology' },
  // duplicated word ("פגישה פגישה") — collapse.
  { re: /(?<![א-ת])(\S+)\s+\1(?![א-ת])/u, to: '$1', kind: 'dedup' },
]

/** Repair an imperfect transcript into a canonical utterance. Deterministic + pure. */
export function recoverTranscript(raw: string): RecoveryResult {
  const original = raw
  let text = raw
  const corrections: RecoveryResult['corrections'] = []
  for (const { re, to, kind } of LEXICON) {
    const m = text.match(re)
    if (!m) continue
    const replaced = text.replace(re, to)
    if (replaced !== text) { corrections.push({ from: m[0], to: replaced.slice(m.index ?? 0, (m.index ?? 0) + to.length), kind }); text = replaced }
  }
  return { text: text.replace(/\s{2,}/gu, ' ').trim(), original, corrections }
}

// ── scored intent model (context fusion) ──────────────────────────────────────
export type SemanticIntent =
  | 'calendar_create' | 'calendar_search' | 'calendar_read' | 'calendar_delete'
  | 'family' | 'online' | 'date' | 'general'

export interface SemanticResult {
  intent: SemanticIntent
  confidence: number
  alternatives: Array<{ intent: SemanticIntent; score: number }>
  reason: string
  needsClarification: boolean
  recovered: string
}

const CREATE_VERB = /(?<![א-ת])(?:תקבע|קבע|קבעי|תוסיפ|תרשמ|רשמ|להוסיף|לקבוע|תזמנ)/u
const CAL_NOUN = /(?:פגישה|תור|מפגש|ביקור|אירוע|ארוחה|ארוחת|קפה)/u
const HAVE = /(?<![א-ת])יש\s+לי(?![א-ת])/u
const WHEN = /(?<![א-ת])(?:מתי|באיזה\s+יום)/u
const READ = /(?:מה\s+יש\s+לי|מה\s+ה?תוכניות|יומן)/u
const DELETE = /(?<![א-ת])(?:תבטל|בטל|תמחק|מחק|למחוק|לבטל)/u
const FAMILY = /(?<![א-ת])(?:מי\s+ז[הא]\s+\S+|מה\s+הקשר\s+בין|(?:מה|מי)\s+\S+\s+עבור\s+\S+|מי\s+ה(?:סבא|סבתא|דוד|דודה|אבא|אמא|אח|אחות|בעל|אישה)\s+של)/u
const LIVE = /(?:משחק|סרט|מזג\s+אוויר|מונדיאל|אוטובוס|רכבת|חדשות|תוצא|ליגה|הופע|קולנוע)/u
const DATE = /(?:מה\s+השעה|מה\s+התאריך|איזה\s+יום\s+היום)/u

/** Fuse all signals into a ranked intent decision. */
export function resolveSemanticIntent(raw: string, ctx: SemanticContext): SemanticResult {
  const { text: recovered } = recoverTranscript(raw)
  const t = recovered
  const scores: Record<SemanticIntent, number> = {
    calendar_create: 0, calendar_search: 0, calendar_read: 0, calendar_delete: 0,
    family: 0, online: 0, date: 0, general: 0.15,
  }
  const reasons: Partial<Record<SemanticIntent, string>> = {}
  const bump = (i: SemanticIntent, s: number, why: string) => { scores[i] += s; if (s > 0) reasons[i] = why }

  if (DATE.test(t)) bump('date', 0.9, 'clock query')
  if (LIVE.test(t)) bump('online', 0.85, 'live-info cue')
  if (DELETE.test(t) && CAL_NOUN.test(t)) bump('calendar_delete', 0.9, 'delete + calendar noun')
  if (WHEN.test(t) && (CAL_NOUN.test(t) || HAVE.test(t))) bump('calendar_search', 0.85, 'when + meeting')
  if (HAVE.test(t) && CAL_NOUN.test(t)) bump('calendar_search', 0.8, 'have + meeting → search not create')
  if (READ.test(t) && /(?:היום|מחר|השבוע|הערב)/u.test(t)) bump('calendar_read', 0.85, 'agenda read')
  if (CREATE_VERB.test(t) && CAL_NOUN.test(t)) bump('calendar_create', 0.9, 'schedule verb + noun')
  else if (CREATE_VERB.test(t)) bump('calendar_create', 0.55, 'schedule verb')
  if (FAMILY.test(t)) bump('family', 0.85, 'relation/identity query')
  // context fusion: two known family names with no calendar verb lean family.
  const names = (t.match(/[א-ת]{2,}/gu) ?? []).filter(w => findNode(w))
  if (new Set(names).size >= 2 && !CREATE_VERB.test(t) && !HAVE.test(t)) bump('family', 0.4, 'two known family names')
  // pending action makes a fresh create less likely (Conversation v2 owns the draft).
  if (ctx.hasPending) scores.calendar_create *= 0.5

  const ranked = (Object.entries(scores) as Array<[SemanticIntent, number]>).sort((a, b) => b[1] - a[1])
  const [intent, top] = ranked[0]!
  const total = ranked.reduce((s, [, v]) => s + v, 0) || 1
  const confidence = Math.min(1, top / total + (top - (ranked[1]?.[1] ?? 0)) * 0.3)
  return {
    intent, confidence,
    alternatives: ranked.slice(1, 4).filter(([, s]) => s > 0.1).map(([i, s]) => ({ intent: i, score: Math.round(s * 100) / 100 })),
    reason: reasons[intent] ?? 'weak signals → general',
    needsClarification: confidence < 0.35 && intent !== 'general',
    recovered,
  }
}
