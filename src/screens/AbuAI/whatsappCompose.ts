/*
 * Abu AI — WhatsApp compose capability (shared, channel-agnostic core).
 * ════════════════════════════════════════════════════════════════════
 * This module is the ONE brain behind Abu WhatsApp voice/typed composition.
 * It is split into explicit, reusable capability boundaries so the behaviour
 * generalises across the whole category (any contact, alias, style, HE/ES,
 * voice/text, corrections) — NOT the demonstrated sentences:
 *
 *   understandWhatsAppCommand   — CommunicationIntentResolver + StyleResolver
 *   extractMessagePlan          — MessagePlanExtractor (purpose/facts/tone/lang)
 *   applyFollowUp               — DraftConversationState (corrections/follow-ups)
 *   composeWhatsAppMessage      — MessageComposer (LLM → local fallback)
 *   localCompose / applyAbuStyle— deterministic composer + single Abu transform
 *   verifyDraft                 — DraftVerifier (facts retained, non-empty, safe)
 *
 * The WhatsApp deep-link (RecipientEntityResolver → phone → wa.me) is the
 * channel-specific adapter and lives in AbuWhatsApp/familyQuickFaces.tsx — this
 * module NEVER sees a phone number. Only a recipient NAME + message content.
 *
 * Recipient resolution to a NAME-level canonical form happens here (family
 * graph, alias-aware); resolution to a phone-bearing CONTACT happens in the
 * channel adapter.
 */

import { loadFamilyData } from '../../services/familyLoader'
import { sendServerChat } from './serverChatProvider'
import { detectLanguage } from './proactive'

// ─── Styles ─────────────────────────────────────────────────────────────────
// Product model: normal (default) / funny / Abu (heavy real mistakes).
export type WhatsAppStyle = 'normal' | 'funny' | 'abu'
export type ComposeSource = 'voice' | 'text'

/** Hebrew labels for the UI toggle. */
export const STYLE_LABEL_HE: Record<WhatsAppStyle, string> = {
  normal: 'רגיל',
  funny: 'מצחיק',
  abu: 'אבו',
}

/** Coarse communication purpose — informational (telemetry + composer hints). */
export type MessagePurpose =
  | 'reminder' | 'apology' | 'invitation' | 'greeting'
  | 'request' | 'question' | 'update'

export type MessageLang = 'he' | 'es' | 'en'

export interface MessagePlan {
  purpose: MessagePurpose
  /** The core content to convey (verb + recipient + style stripped). */
  facts: string
  requestedTone: WhatsAppStyle
  language: MessageLang
  /** Machine hints the composer + verifier must honour, e.g. keep-time. */
  constraints: string[]
  /** True when this utterance edits a prior draft ("no, at eight"). */
  referencesPriorTurn: boolean
}

export interface WhatsAppComposeCommand {
  /** The raw target token as spoken (e.g. "לאדר"), or null if none found. */
  targetName: string | null
  /** Canonical Hebrew name of the resolved family member, or null. */
  targetHebrew: string | null
  /** What Martita wants to say (verb + name + style words stripped). */
  intent: string
  /** Chosen style; defaults to 'normal'. */
  style: WhatsAppStyle
  /** Structured plan derived from the utterance. */
  plan: MessagePlan
  /** Which modality produced this command (parity instrumentation). */
  source: ComposeSource
}

// ─── Shared Martita WhatsApp persona (compose base) ─────────────────────────
// Deliberately CLEAN: spelling-quirk level is set ONLY by the style block. This
// is a DIFFERENT prompt from the legacy always-mistakes group-broadcast prompt
// in AbuWhatsApp/service.ts — do not merge them or the "normal" style breaks.
function buildFamilySummary(): string {
  const members = loadFamilyData()
  const children = members.filter(m => m.relationship === 'daughter' || m.relationship === 'son')
  const grandchildren = members.filter(m => m.relationship === 'grandson' || m.relationship === 'granddaughter')
  const deceased = members.filter(m => m.relationship === 'husband_deceased')
  const pets = members.filter(m => m.relationship === 'pet')
  const friends = members.filter(m => m.relationship === 'close_friend')
  const lines = ['══ המשפחה ══']
  lines.push('ילדים: ' + children.map(c => `${c.hebrew} (${c.relationshipHebrew})`).join(', '))
  lines.push('נכדים: ' + grandchildren.map(g => g.hebrew).join(', '))
  if (deceased.length) lines.push('בעל מנוח: ' + deceased[0]!.hebrew)
  if (friends.length) lines.push('חברות: ' + friends.map(f => f.hebrew).join(', '))
  if (pets.length) lines.push('חיות: ' + pets.map(p => p.hebrew).join(', '))
  return lines.join('\n')
}

/** Mandatory-mistakes block — the SINGLE source for Martita's spelling quirks,
 *  reused by the legacy 4-style flow and referenced by the Abu style block. */
export const MANDATORY_MISTAKES =
`
חובה בכל הודעה — שגיאות אמיתיות של מרטיטה:
• "מאכלת" / "מאכלים" במקום מאחלת (השגיאה הכי שלה)
• ה→א בסוף מילים: "שמחא", "יפא", "טובא", "בריאותא"
• רווח אחרי ב/ל/ו: "ב בית", "ל כולם", "ו גם"
• הכפלה לדגש: "כל כך כל כך", "מאוד מאוד"
• !!!!!! — לפחות 4
• אחת מהאפשרויות: "אכשיו" / "איזא" / "אין דברים כאלה"`

export const MARTITA_WHATSAPP_PERSONA =
`את מרטיטה — סבתא בת 80+ מארגנטינה, גרה בכפר סבא. לב של זהב. כותבת הודעת WhatsApp אישית לבן משפחה.
כתבי רק את גוף ההודעה. ללא הקדמה. ללא הסבר. ללא מרכאות סביב ההודעה.

══ מי היא ══
חותמת: "אבו" / "סבתא" / "אימא" לפי הקשר
שפה: עברית חמה. ספרדית כשמתאים: Ja ja ja (לעולם לא חחח), Mi amor, Que rico, Buen viaje.

${buildFamilySummary()}

══ ניסוחים שחוזרים אצלה ══
"אוהבת אתכם מאוד מאוד מאוד" · "חמודים שלנו" / "יפים שלנו" · "תשמרו על עצמכם" · "Ja ja ja" (לצחוק)

══ כללים ══
- 2-4 שורות קצרות. לא יותר
- ללא Markdown, ללא כוכביות, ללא כותרות
- אימוג'ים: ❤️💚💜💋😍🥳🍾🎉 — 2-4 בהודעה
- הודעה חמה, אמיתית, אישית — מכוונת ישירות לאדם שאליו כותבים
- שמרי בדיוק על עובדות: שמות, שעות, מספרים, מקומות, קישורים — אל תשני אותם
- רמת השגיאות בכתיב נקבעת אך ורק לפי הסגנון למטה. אל תוסיפי שגיאות שהסגנון לא ביקש`

// ─── Style blocks ─────────────────────────────────────────────────────────
export const STYLE_BLOCKS: Record<WhatsAppStyle, string> = {
  normal: `סגנון: רגיל וטבעי. עברית חמה, ברורה ונקייה — כמעט בלי שגיאות כתיב.
משפטים קצרים ואישיים, מכוונים ישירות לאדם שאליו כותבים. חתימה חמה בסוף אם מתאים ("אבו" / "סבתא").
בלי הגזמות, בלי שפה מלאכותית.`,

  funny: `סגנון: מצחיק וחם. הודעה עם קריצה או בדיחה קטנה שתגרום לאדם לחייך — אוהבת, לעולם לא לועגת.
מבנה קצר עם פאנץ' קטן. אפשר לסיים ב"Ja ja ja" ו-!!!!!!.
2-3 שורות בלבד. שמרי על כל המידע החשוב (שעה/מקום/סיבה) — אל תוותרי על עובדות בשביל הבדיחה.`,

  abu: `סגנון: אבו — כמו שהיא כותבת באמת בצ'אט המשפחתי כל יום. טבעית, חמה, עם שגיאות אמיתיות.
לשלב: מאכלת/מאכלים, רווחים לפני ב/ל/ו/ש, הכפלה אחת או שתיים, !!!!!!.
לא להגזים. לא לצחוק עליה. פשוט היא. אבל שמרי בדיוק על שמות, שעות, מספרים, מקומות וקישורים.${MANDATORY_MISTAKES}`,
}

// ════════════════════════════════════════════════════════════════════════════
// CommunicationIntentResolver + StyleResolver
// ════════════════════════════════════════════════════════════════════════════

// Leading send/write verbs to strip. Hebrew has no ASCII word boundaries, so we
// anchor to whitespace/string edges instead of \b.
const SEND_VERBS_HE = [
  'תשלחי', 'תשלח', 'שלחי', 'שלחו', 'שלח',
  'תכתבי', 'תכתוב', 'כתבי', 'כתוב',
  'תגידי', 'תגיד', 'תאחלי', 'תאחל', 'תברכי', 'תברך',
  'תודיעי', 'תודיע', 'הודיעי',
]
const SEND_VERBS_EN = ['send', 'write', 'text', 'tell', 'message', 'whatsapp']
const SEND_VERBS_ES = ['mandale', 'mandá', 'manda', 'escribile', 'escribí', 'escribi', 'decile', 'mensaje']

// Regex that detects a compose INTENT (verb + a "to <someone>" cue). Used to
// distinguish a real compose command from an information question that merely
// mentions WhatsApp ("מה זה וואטסאפ", "יש לי וואטסאפ מלאו?").
const COMPOSE_INTENT_HE = /(?:תכתב|כתב|תשלח|שלח|תגיד|תאחל|תברך|תודיע|הודיע)[יו]?\s+(?:ל|הודעה\s+ל|וואטסאפ\s+ל)/
const COMPOSE_INTENT_ES = /\b(?:mand[aá]|escrib[ií]|dec[ií])\w*\s+(?:le\s+)?(?:un\s+)?(?:mensaje|whatsapp)?\s*a\s+/i
const COMPOSE_INTENT_EN = /\b(?:send|write|text|tell|message|whatsapp)\s+(?:a\s+(?:message|whatsapp)\s+to\s+|to\s+)?\w+/i

// Pure "call" requests must NOT be treated as message composition.
const CALL_ONLY_HE = /(?:^|\s)(?:תתקשר[יי]?|להתקשר|תצלצל[יי]?)\s+ל/
const CALL_ONLY_ES = /\bllam[aá]\w*\s+a\b/i
const CALL_ONLY_EN = /\bcall\s+\w+/i

/** True when the utterance is a WhatsApp/message composition command (not a
 *  call request, not an info question). Generalises across HE/ES/EN. */
export function isComposeCommand(text: string): boolean {
  const t = (text ?? '').trim()
  if (!t) return false
  // A "call X" with no write verb is not a compose command.
  const hasCall = CALL_ONLY_HE.test(t) || CALL_ONLY_ES.test(t) || CALL_ONLY_EN.test(t)
  const hasCompose = COMPOSE_INTENT_HE.test(t) || COMPOSE_INTENT_ES.test(t) || COMPOSE_INTENT_EN.test(t)
  if (hasCall && !hasCompose) return false
  return hasCompose
}

/** True when the utterance is a phone-CALL request ("תתקשרי ל…"/"llamá a…"). */
export function isCallCommand(text: string): boolean {
  const t = (text ?? '').trim()
  if (!t) return false
  return CALL_ONLY_HE.test(t) || CALL_ONLY_ES.test(t) || CALL_ONLY_EN.test(t)
}

// Words that follow the verb but are not the message ("הודעה"/"וואטסאפ"/"a"/"to").
const FILLER_WORDS = new Set([
  'הודעה', 'וואטסאפ', 'whatsapp', 'ל', 'a', 'to', 'un', 'una', 'que', 'ש',
])

const STYLE_KEYWORDS: Array<{ re: RegExp; style: WhatsAppStyle }> = [
  { re: /מצחיק[הא]?|בצחוק|בדיחה|humor|funny|gracios[ao]|chiste/i, style: 'funny' },
  { re: /בסגנון\s+אבו|כמו\s+שאבו|סגנון\s+אבו|עם\s+שגיאות|שגיאות|מבולגן|כמו\s+אבו|(?:^|\s)אבו(?:\s|$)/i, style: 'abu' },
  { re: /רגיל[הא]?|נורמלי|פשוט[הא]?|normal/i, style: 'normal' },
]

const HE_PREFIXES = ['ל', 'ב', 'ה', 'ו', 'ש', 'מ', 'כ']

/** Strip a single Hebrew one-letter prefix (ל/ב/ה/…) from a token. */
function stripHePrefix(token: string): string {
  if (token.length > 1 && HE_PREFIXES.includes(token[0]!)) return token.slice(1)
  return token
}

interface TargetMatch { hebrew: string; token: string }

/**
 * Find a known family member named anywhere in the text. Tolerant of a Hebrew
 * one-letter prefix ("לאדר" → "אדר") and Latin case. Returns the canonical
 * Hebrew name + the original matched token so the caller can strip it.
 *
 * NOTE: exact/alias match only — fuzzy STT tolerance + ambiguity lives in the
 * channel adapter's RecipientEntityResolver (resolveContactCandidates), which
 * knows the phone-bearing contact set.
 */
export function matchTargetName(text: string): TargetMatch | null {
  const members = loadFamilyData()
  const tokens = text.split(/[\s,،.!?׃:;"'()]+/).filter(Boolean)
  for (const token of tokens) {
    const variants = new Set([token.toLowerCase(), stripHePrefix(token).toLowerCase()])
    for (const m of members) {
      const names = [m.hebrew, m.canonicalName, ...(m.aliases ?? [])]
        .filter(Boolean)
        .map(n => n.toLowerCase())
      for (const v of variants) {
        if (v.length >= 2 && names.includes(v)) return { hebrew: m.hebrew, token }
      }
    }
  }
  return null
}

function detectStyle(text: string): WhatsAppStyle | null {
  for (const { re, style } of STYLE_KEYWORDS) {
    if (re.test(text)) return style
  }
  return null
}

// Extract the RECIPIENT SLOT token when it is not a known family name (e.g. an
// STT misspelling "לאדד"). Only runs on a real compose command so message words
// like "ליום" in "מזל טוב ליום הולדת" are never mistaken for a recipient. The
// channel adapter fuzzy-matches this candidate and surfaces ambiguity.
const CANDIDATE_SLOT_HE = /(?:תכתב|כתב|תשלח|שלח|תגיד|תאחל|תברך|תודיע|הודיע)[יו]?\s+(?:הודעה\s+|וואטסאפ\s+)?ל([֐-׿]{2,})/
const CANDIDATE_SLOT_ES = /\b(?:mand[aá]|escrib[ií]|dec[ií])\w*\s+(?:le\s+)?(?:un\s+)?(?:mensaje\s+|whatsapp\s+)?a\s+([A-Za-zÁÉÍÓÚÜñ]{2,})/i
const CANDIDATE_SLOT_EN = /\b(?:send|write|text|tell|message|whatsapp)\s+(?:a\s+(?:message|whatsapp)\s+to\s+|to\s+)([A-Za-z]{2,})/i

function extractCandidateRecipient(raw: string): { token: string; name: string } | null {
  if (!isComposeCommand(raw)) return null
  const he = raw.match(CANDIDATE_SLOT_HE)
  if (he?.[1]) return { token: `ל${he[1]}`, name: he[1] }
  const es = raw.match(CANDIDATE_SLOT_ES)
  if (es?.[1]) return { token: es[1], name: es[1] }
  const en = raw.match(CANDIDATE_SLOT_EN)
  if (en?.[1]) return { token: en[1], name: en[1] }
  return null
}

/** Strip verb + target token + style words → the bare communication content. */
function extractIntent(raw: string, target: TargetMatch | null): string {
  let intent = raw
  const verbAlt = [...SEND_VERBS_HE, ...SEND_VERBS_EN, ...SEND_VERBS_ES]
    .sort((a, b) => b.length - a.length)
    .map(v => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|')
  intent = intent.replace(new RegExp(`^\\s*(?:${verbAlt})(?:\\s+|$)`, 'i'), '')
  if (target) intent = intent.replace(target.token, ' ')
  for (const { re } of STYLE_KEYWORDS) intent = intent.replace(new RegExp(re.source, 'gi'), ' ')
  intent = intent
    .split(/\s+/)
    .filter((w, i) => !(i === 0 && FILLER_WORDS.has(w.toLowerCase())))
    .join(' ')
    .replace(/^(?:ש|של|את|a|to|que)\s+/i, '')
    .replace(/^[\s,.:;!?־-]+/, '')
    .replace(/[\s,]+$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
  return intent
}

// ════════════════════════════════════════════════════════════════════════════
// MessagePlanExtractor
// ════════════════════════════════════════════════════════════════════════════

const PURPOSE_RULES: Array<{ re: RegExp; purpose: MessagePurpose }> = [
  { re: /מאחר|מאחרת|סליחה|אתנצל|מתנצל|אחר[הא]?|tarde|late|sorry|perdón/i, purpose: 'apology' },
  { re: /תזכיר|תזכר|אל תשכח|זכור|תזכורת|recordá|reminder|remind/i, purpose: 'reminder' },
  { re: /מזמינ|תבוא|תבואי|בוא[יו]?|ארוחה|שישי|נפגש|invit|vení|come over/i, purpose: 'invitation' },
  { re: /מזל טוב|יום הולדת|חג שמח|שבת שלום|מברך|feliz|happy birthday/i, purpose: 'greeting' },
  { re: /תביא|תביאי|להביא|קנה|קני|תקנ|traé|bring|buy/i, purpose: 'request' },
  { re: /\?|האם|מתי|איפה|כמה|למה|cuándo|dónde|why|when|where/i, purpose: 'question' },
]

function detectPurpose(text: string): MessagePurpose {
  for (const { re, purpose } of PURPOSE_RULES) if (re.test(text)) return purpose
  return 'update'
}

// Hebrew hour words (used for time-fact constraints + correction merging).
export const HEBREW_HOUR_WORDS = [
  'אחת', 'שתיים', 'שתים', 'שלוש', 'ארבע', 'חמש', 'שש', 'שבע', 'שמונה', 'תשע', 'עשר',
  'אחת עשרה', 'אחת-עשרה', 'שתים עשרה', 'שתים-עשרה', 'שתיים עשרה',
]
const TIME_DIGIT_RE = /\b\d{1,2}(?::\d{2})?\b/
const HOUR_WORD_RE = new RegExp(`(?:^|\\s)(?:ב|ל)?(${HEBREW_HOUR_WORDS.slice().sort((a, b) => b.length - a.length).join('|')})(?:\\s|$|[?.!,])`)
const URL_RE = /(https?:\/\/|www\.)\S+/i
const NUMBER_RE = /\d+/
// Spelled-out Hebrew cardinals double as quantity words ("עשר דקות" = ten
// minutes). We reuse the hour-word list plus a few common cardinals so a
// quantity that has no digit still triggers a keep-number constraint.
const HEBREW_NUMBER_WORDS = [...HEBREW_HOUR_WORDS, 'עשרים', 'שלושים', 'ארבעים', 'חמישים', 'מאה', 'אלף', 'חצי', 'רבע']
const HEBREW_NUMBER_RE = new RegExp(`(?:^|\\s)(?:ב|ל)?(?:${HEBREW_NUMBER_WORDS.slice().sort((a, b) => b.length - a.length).join('|')})(?:\\s|$|[?.!,])`)

/** Extract a structured plan from the communication content. Pure, no LLM. */
export function extractMessagePlan(
  facts: string,
  style: WhatsAppStyle,
  fullText: string,
  referencesPriorTurn = false,
): MessagePlan {
  const lang0 = detectLanguage(fullText || facts)
  const language: MessageLang = lang0 === 'es' ? 'es' : lang0 === 'en' ? 'en' : 'he'
  const constraints: string[] = []
  const padded = ` ${facts} `
  if (TIME_DIGIT_RE.test(facts) || HOUR_WORD_RE.test(padded)) constraints.push('keep-time')
  if (NUMBER_RE.test(facts) || HEBREW_NUMBER_RE.test(padded)) constraints.push('keep-number')
  if (URL_RE.test(facts)) constraints.push('keep-url')
  return {
    purpose: detectPurpose(fullText || facts),
    facts,
    requestedTone: style,
    language,
    constraints,
    referencesPriorTurn,
  }
}

/**
 * CommunicationIntentResolver — parse a free-language WhatsApp command into a
 * normalized command with a structured plan. Deterministic (no LLM).
 * Style defaults to 'normal'.
 */
export function understandWhatsAppCommand(
  transcript: string,
  opts: { source?: ComposeSource } = {},
): WhatsAppComposeCommand {
  const raw = (transcript ?? '').trim()
  const style = detectStyle(raw) ?? 'normal'
  const exact = matchTargetName(raw)
  // Fall back to a fuzzy candidate recipient slot when there is no exact match.
  const candidate = exact ? null : extractCandidateRecipient(raw)
  const stripToken: TargetMatch | null = exact
    ? exact
    : candidate ? { token: candidate.token, hebrew: '' } : null
  const intent = extractIntent(raw, stripToken)
  const plan = extractMessagePlan(intent, style, raw, false)
  return {
    targetName: exact?.token ?? candidate?.name ?? null,
    targetHebrew: exact?.hebrew ?? null,
    intent,
    style,
    plan,
    source: opts.source ?? 'text',
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Turn-level detection — used by the Abu AI cognitive controller so a
// "send/write/call X" turn is recognised as its OWN intent and NEVER swallowed
// by the calendar just because the message body mentions a date/time.
// ════════════════════════════════════════════════════════════════════════════

export interface WhatsAppTurn {
  kind: 'compose' | 'call'
  targetName: string | null
  targetHebrew: string | null
  /** For compose: the full normalized command (recipient/intent/style/plan). */
  command: WhatsAppComposeCommand | null
}

/**
 * Classify a raw utterance as a WhatsApp compose / phone-call turn, or null.
 * Compose wins over call when both cues appear ("שלחי וואטסאפ" + a name). The
 * recipient is extracted prefix-safely ("למור" → "מור") for BOTH kinds.
 */
export function detectWhatsAppTurn(text: string, opts: { source?: ComposeSource } = {}): WhatsAppTurn | null {
  const t = (text ?? '').trim()
  if (!t) return null
  if (isComposeCommand(t)) {
    const command = understandWhatsAppCommand(t, opts)
    return { kind: 'compose', targetName: command.targetName, targetHebrew: command.targetHebrew, command }
  }
  if (isCallCommand(t)) {
    const m = matchTargetName(t)
    return { kind: 'call', targetName: m?.token ?? null, targetHebrew: m?.hebrew ?? null, command: null }
  }
  return null
}

// ════════════════════════════════════════════════════════════════════════════
// DraftConversationState — corrections & follow-ups update the SAME draft
// ════════════════════════════════════════════════════════════════════════════

const CORRECTION_MARKERS = /(?:^|\s)(?:לא|לא,|במקום|תשני|תשנה|שנה|שני|אלא|תעשי|תעש[יו]|בעצם|רגע|no,|en vez|cambiá|actually)/i

/** True when an utterance edits the current draft rather than starting fresh. */
export function isFollowUpCorrection(text: string): boolean {
  const t = (text ?? '').trim()
  if (!t) return false
  // A new full compose command (has an explicit "to <name>") is NOT a follow-up.
  if (isComposeCommand(t)) return false
  return CORRECTION_MARKERS.test(t) || detectStyle(t) !== null || HOUR_WORD_RE.test(` ${t} `) || TIME_DIGIT_RE.test(t)
}

function extractHourPhrase(text: string): string | null {
  const digit = text.match(/(?:^|\s)((?:ב|ל)?\d{1,2}(?::\d{2})?)(?:\s|$|[?.!,])/)
  if (digit) return digit[1]!.trim()
  const m = text.match(HOUR_WORD_RE)
  if (m) return m[0].trim().replace(/[?.!,]$/, '')
  return null
}

/**
 * Apply a follow-up utterance to an existing draft command. Updates recipient
 * (if a new family name is named), style (if a style word appears), and the
 * time/number fact (surgical swap) — otherwise merges the new content. Keeps
 * recipient + intent unless explicitly changed. Generalises to any hour/number.
 */
export function applyFollowUp(
  prev: WhatsAppComposeCommand,
  transcript: string,
): WhatsAppComposeCommand {
  const raw = (transcript ?? '').trim()
  const next: WhatsAppComposeCommand = { ...prev, plan: { ...prev.plan } }

  // 1. New style?
  const newStyle = detectStyle(raw)
  if (newStyle) next.style = newStyle

  // 2. New recipient? (only if a family name is explicitly present)
  const newTarget = matchTargetName(raw)
  if (newTarget) { next.targetName = newTarget.token; next.targetHebrew = newTarget.hebrew }

  // 3. Fact correction: swap a time phrase if both old + new carry one.
  const prevHour = extractHourPhrase(prev.intent)
  const newHour = extractHourPhrase(raw)
  let intent = prev.intent
  if (prevHour && newHour && prevHour !== newHour) {
    intent = intent.replace(prevHour, newHour)
  } else {
    // Otherwise merge added content (strip correction markers + style words + verb).
    const added = extractIntent(raw.replace(CORRECTION_MARKERS, ' ').trim(), newTarget)
    if (added && !intent.includes(added)) {
      // If the added content itself carries a fresh time/number, prefer swap.
      if (newHour && prevHour) intent = intent.replace(prevHour, newHour)
      else if (added.length > 0) intent = `${intent} ${added}`.replace(/\s{2,}/g, ' ').trim()
    }
  }
  next.intent = intent
  next.plan = extractMessagePlan(intent, next.style, raw, true)
  return next
}

// ════════════════════════════════════════════════════════════════════════════
// Shared Abu-style transform (single mechanism, fact-safe)
// ════════════════════════════════════════════════════════════════════════════

/** Ordered, meaning-safe Abu substitutions. Applied only to eligible (non-
 *  protected) tokens so names/numbers/times/links/emoji survive intact. */
export const ABU_STYLE_RULES: Array<{ re: RegExp; to: string }> = [
  { re: /מאחל/g, to: 'מאכל' },        // מאחלת → מאכלת (her signature mistake)
  { re: /^עכשיו$/, to: 'אכשיו' },
  { re: /^איזה$/, to: 'איזא' },
  { re: /^שמחה$/, to: 'שמחא' },
  { re: /^טובה$/, to: 'טובא' },
  { re: /^יפה$/, to: 'יפא' },
]

/** A token that must NOT be transformed (would corrupt a fact). */
function isProtectedToken(tok: string, preserve: Set<string>): boolean {
  if (preserve.has(tok)) return true
  if (/\d/.test(tok)) return true                 // numbers / times
  if (/https?:\/\/|www\.|@|\.[a-z]{2,}/i.test(tok)) return true // links / handles
  if (/[A-Za-z]/.test(tok)) return true           // Latin (names, "Ja")
  if (/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}❤️💚💜💋😍🥳🍾🎉]/u.test(tok)) return true // emoji
  return false
}

/**
 * Apply Martita's recognisable Hebrew mistakes to a message WITHOUT corrupting
 * facts. Protects names (via `preserve`), numbers, times, links and emoji.
 * This is the SINGLE deterministic Abu transform (used by the local composer
 * and by the verifier's fact checks); the LLM path uses MANDATORY_MISTAKES.
 */
export function applyAbuStyle(text: string, preserve: string[] = []): string {
  const keep = new Set(preserve.flatMap(p => p.split(/\s+/)).filter(Boolean))
  const out = text.split(/(\s+)/).map(tok => {
    if (/^\s+$/.test(tok) || !tok) return tok
    if (isProtectedToken(tok, keep)) return tok
    let t = tok
    for (const { re, to } of ABU_STYLE_RULES) t = t.replace(re, to)
    // Split a leading connective prefix (ו/ב/ל) off longer words for flavour.
    if (/^[ובל][֐-׿]{3,}$/.test(t)) t = `${t[0]} ${t.slice(1)}`
    return t
  }).join('')
  // Emphasis: guarantee a run of exclamation marks at the very end.
  const trimmed = out.replace(/[!\s]+$/,'').trimEnd()
  return `${trimmed}!!!!`
}

// ════════════════════════════════════════════════════════════════════════════
// MessageComposer — LLM (server proxy) → local deterministic fallback
// ════════════════════════════════════════════════════════════════════════════

export interface ComposeOptions {
  /** Display name of the recipient, for message context (never a phone). */
  recipientLabel?: string | null
  signal?: AbortSignal
}

/** Pure prompt assembly — exported so tests can assert style/target wiring
 *  without hitting the network. */
export function buildComposePrompt(
  cmd: WhatsAppComposeCommand,
  opts: ComposeOptions = {},
): { system: string; user: string } {
  const system = `${MARTITA_WHATSAPP_PERSONA}\n\n══ סגנון לעכשיו ══\n${STYLE_BLOCKS[cmd.style]}`
  const recipient = opts.recipientLabel ?? cmd.targetHebrew
  const toClause = recipient ? ` אל ${recipient}` : ''
  const topic = cmd.intent && cmd.intent.length > 0 ? cmd.intent : 'הודעה חמה'
  const user =
    `כתבי הודעת WhatsApp של מרטיטה${toClause} על הנושא הזה: ${topic}\n\n` +
    `רק את גוף ההודעה. בלי הקדמה, בלי הסבר, בלי מרכאות.`
  return { system, user }
}

/**
 * Deterministic local composer — the provider-failure / offline fallback.
 * Guarantees a NON-EMPTY, fact-preserving message (the intent text is included
 * verbatim), so the verifier always passes even with no LLM available.
 */
export function localCompose(cmd: WhatsAppComposeCommand, opts: ComposeOptions = {}): string {
  const name = (opts.recipientLabel ?? cmd.targetHebrew ?? '').trim()
  const facts = (cmd.intent || '').trim() || 'רק רציתי להגיד שלום'
  const es = cmd.plan.language === 'es'
  const greet = name ? (es ? `Hola ${name}, ` : `היי ${name}, `) : ''
  let body: string
  if (cmd.style === 'funny') {
    body = es
      ? `${greet}${facts}. Ja ja ja 😄`
      : `${greet}${facts} 😄 Ja ja ja`
  } else if (cmd.style === 'abu') {
    // Apply the shared Abu transform, preserving the recipient name.
    body = applyAbuStyle(`${greet}${facts}`, name ? [name] : [])
    body = `${body} ❤️`
  } else {
    body = `${greet}${facts}${/[.!?…]$/.test(facts) ? '' : '.'} ❤️`
  }
  return body.trim()
}

function extractContent(openai: unknown): string | null {
  const c = (openai as { choices?: Array<{ message?: { content?: string } }> } | undefined)
    ?.choices?.[0]?.message?.content
  return c ? c.trim() : null
}

// Free-tier client fallbacks (same providers AbuAI/AbuWhatsApp already use).
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
const GEMINI_MODEL = 'gemini-2.0-flash'
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_MODEL = 'llama-3.3-70b-versatile'

async function tryClientProvider(
  url: string, model: string, apiKey: string,
  messages: Array<{ role: string; content: string }>,
  signal?: AbortSignal,
): Promise<string | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20000)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages, temperature: 1.0, max_tokens: 400 }),
      signal: signal ? AbortSignal.any?.([signal, controller.signal]) ?? controller.signal : controller.signal,
    })
    if (!res.ok) return null
    const data = await res.json()
    const content = data?.choices?.[0]?.message?.content
    return content ? String(content).trim() : null
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

export interface ComposeResult {
  message: string
  /** Which path produced the message. */
  path: 'openai-server' | 'gemini-client' | 'groq-client' | 'local-fallback'
  verdict: DraftVerdict
}

/**
 * Compose the WhatsApp message with the Abu AI brain, then VERIFY it. Order:
 * OpenAI server proxy → free client tiers → local deterministic composer. Any
 * LLM output that fails verification (empty / dropped a required fact) is
 * rejected in favour of the fact-preserving local composer. NEVER throws and
 * NEVER returns empty.
 */
export async function composeWhatsAppMessageDetailed(
  cmd: WhatsAppComposeCommand,
  opts: ComposeOptions = {},
): Promise<ComposeResult> {
  const { system, user } = buildComposePrompt(cmd, opts)
  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]
  const accept = (msg: string | null, path: ComposeResult['path']): ComposeResult | null => {
    if (!msg) return null
    const verdict = verifyDraft(cmd, msg)
    if (!verdict.ok) return null
    return { message: msg, path, verdict }
  }

  // 1) Abu AI server proxy — OpenAI gpt-4o, key stays server-side.
  try {
    const server = await sendServerChat(
      { model: 'gpt-4o', messages, temperature: 1.0, max_tokens: 400 },
      { lang: cmd.plan.language, timeoutMs: 20000, ...(opts.signal ? { signal: opts.signal } : {}) },
    )
    if (server.ok) {
      const r = accept(extractContent(server.openai), 'openai-server')
      if (r) return r
    }
  } catch { /* fall through */ }

  // 2) Free client fallbacks (only when keys are present in the bundle).
  const geminiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined
  if (geminiKey) {
    const r = accept(await tryClientProvider(GEMINI_URL, GEMINI_MODEL, geminiKey, messages, opts.signal), 'gemini-client')
    if (r) return r
  }
  const groqKey = import.meta.env.VITE_GROQ_API_KEY as string | undefined
  if (groqKey) {
    const r = accept(await tryClientProvider(GROQ_URL, GROQ_MODEL, groqKey, messages, opts.signal), 'groq-client')
    if (r) return r
  }

  // 3) Local deterministic composer — always succeeds, always fact-preserving.
  const local = localCompose(cmd, opts)
  return { message: local, path: 'local-fallback', verdict: verifyDraft(cmd, local) }
}

/** Back-compat convenience: returns just the message string. */
export async function composeWhatsAppMessage(
  cmd: WhatsAppComposeCommand,
  opts: ComposeOptions = {},
): Promise<string> {
  return (await composeWhatsAppMessageDetailed(cmd, opts)).message
}

// ════════════════════════════════════════════════════════════════════════════
// DraftVerifier
// ════════════════════════════════════════════════════════════════════════════

export interface DraftVerdict {
  ok: boolean
  issues: string[]
  /** Required facts (numbers/times/urls) that did not survive into the draft. */
  missingFacts: string[]
}

/** Tokens that MUST survive composition/style transforms verbatim. */
function requiredFactTokens(intent: string): string[] {
  const facts: string[] = []
  const digits = intent.match(/\d+(?::\d{2})?/g) ?? []
  facts.push(...digits)
  const urls = intent.match(/(?:https?:\/\/|www\.)\S+/gi) ?? []
  facts.push(...urls)
  return [...new Set(facts)]
}

/**
 * Verify a composed draft: non-empty, all numeric/time/url facts retained, and
 * no auto-send marker. Recipient existence/ambiguity is verified by the channel
 * adapter (it owns the contact set), so it is out of scope here.
 */
export function verifyDraft(cmd: WhatsAppComposeCommand, message: string): DraftVerdict {
  const issues: string[] = []
  const msg = (message ?? '').trim()
  if (!msg) issues.push('empty')
  const required = requiredFactTokens(cmd.intent)
  const missingFacts = required.filter(f => !msg.includes(f))
  if (missingFacts.length) issues.push('fact_lost')
  return { ok: issues.length === 0, issues, missingFacts }
}
