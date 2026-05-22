/**
 * Free Speech Router — AbuBank first-pass domain classifier.
 *
 * Pure function. No API calls, no side effects, no imports from screen code.
 * Takes a transcript string and returns a FreeSpeechRoute describing which
 * domain should handle it, what action is likely intended, and how safe it
 * is to proceed without confirmation.
 *
 * This does NOT replace AbuAI's router.ts or AbuCalendar's semanticIntent.ts.
 * It sits upstream: transcript → freeSpeechRouter → domain-specific deep parser.
 */

import type {
  FreeSpeechRoute,
  FreeSpeechDomain,
  FreeSpeechAction,
  FreeSpeechSafety,
  FreeSpeechConfidence,
  FreeSpeechLanguage,
} from './freeSpeechTypes'

// ─── Language detection ─────────────────────────────────────────────────────

const HE_CHARS = /[\u0590-\u05FF]/
const ES_MARKERS = /\b(?:qu[eé]|c[oó]mo|cu[aá]ndo|d[oó]nde|hoy|ma[nñ]ana|tengo|ten[eé]s|llam[aá]|mand[aá]|agreg[aá]|agend[aá]|poneme|anot[aá]|record[aá]me|program[aá]|hablame|contame|buenas?|che|vos|dale|env[ií]a|escrib[ií]|mensaje|cita|turno|m[eé]dico|agenda|calendario)\b/i
const EN_MARKERS = /\b(?:what|when|where|who|how|please|call|send|open|tell|remind|schedule|today|tomorrow|upcoming|appointments?|book|text|message)\b/i

function detectLanguage(text: string): FreeSpeechLanguage {
  const hasHe = HE_CHARS.test(text)
  const hasEs = ES_MARKERS.test(text)
  const hasEn = EN_MARKERS.test(text)
  const count = [hasHe, hasEs, hasEn].filter(Boolean).length
  if (count === 0) return 'unknown'
  if (count >= 2) return 'mixed'
  if (hasHe) return 'he'
  if (hasEs) return 'es'
  return 'en'
}

// ─── Calendar patterns ──────────────────────────────────────────────────────

// Calendar QUERY — asking about existing events
// Hebrew calendar query — requires clear calendar context.
// The bare "מה יש ב" prefix was over-broad (matched "מה יש במקרר", "מה יש בטלוויזיה").
// Now "מה יש ב..." only matches when followed by יומן or a known schedule scope word.
const CAL_QUERY_HE = /מה יש לי|מה יש היום|מה קבעתי|מה קורה היום|מה קורה מחר|מה התוכנית|מה יש מחר|יש לי משהו|מתי (יש לי |ה)?(רופא|תור|פגישה|אירוע)|מתי התור|יש (אירוע|תור|פגישה).{0,12}ביומן|יום עמוס|פנוי השבוע|פנויה השבוע|מה היה לי|מה יש ב(יומן|שבוע הבא)|מה יש השבוע|מה יש שבוע הבא|הפגישות הקרובות|התורים הקרובים|האירועים הקרובים|איזה פגישות יש לי/i
const CAL_QUERY_ES = /qu[eé]\s+tengo|qu[eé]\s+ten[eé]s|cu[aá]ndo\s+tengo\s+(?:m[eé]dico|doctor|turno|cita)|calendario|agenda\s+(?:de\s+)?(?:hoy|ma[nñ]ana|la\s+semana)/i
const CAL_QUERY_EN = /what(?:'?s| do i have| is).{0,10}(?:today|tomorrow|this week|coming up|next|schedule|calendar|agenda)|upcoming\s+(?:appointments?|events?)|my\s+(?:calendar|agenda)|tomorrow(?:'?s)?\s+(?:schedule|calendar|agenda|appointments?)/i

// Calendar CREATE — requesting to add/schedule an event
const CAL_CREATE_HE = /תקבעי|תקבע|תוסיפי|תוסיף|תרשמי|תרשום|תזכירי|תכניסי|שימי|לשים|להוסיף|לקבוע|לרשום|לשמור|קבעי|רשמי|הוסיפי|הכניסי/i
// Spanish create verbs — imperative/voseo forms only.
// Word boundaries (\b) don't work reliably with accented chars in JS,
// so we use (?:^|\s) and (?:\s|$) as delimiters.
const CAL_CREATE_ES = /(?:^|\s)(?:agreg[aá]|agendá|poneme|anot[aá]|record[aá]me|program[aá])(?:\s|$)/i
// English create verbs — "schedule" only as verb (followed by "a/an/the/my" or noun).
// "tomorrow's schedule" uses "schedule" as noun → should NOT match create.
const CAL_CREATE_EN = /\b(?:add|create|set up|remind me to|put in|make)\s|(?:schedule|book)\s+(?:a|an|the|my|\w+\s+(?:appointment|meeting|event))/i

// Calendar scheduling context (strengthens create/query when combined with time/date words)
const CAL_CONTEXT = /תור|פגישה|אירוע|רופא|רופאה|דוקטור|appointment|meeting|doctor|dentist|m[eé]dico|turno|cita/i

// ─── WhatsApp / messaging patterns ─────────────────────────────────────────

const WA_SEND_HE = /שלחי?\s+(?:הודעה|וואטסאפ|whatsapp)|וואטסאפ\s+ל|לשלוח\s+(?:הודעה|וואטסאפ)|תכתבי\s+ל|לכתוב\s+ל/i
const WA_SEND_ES = /mand[aá](?:le|la|lo)?\s+(?:un\s+)?(?:whatsapp|mensaje)|envi[aá](?:le)?\s+(?:un\s+)?(?:whatsapp|mensaje)|escrib[ií](?:le|r)\s/i
const WA_SEND_EN = /\b(?:send\s+(?:a\s+)?(?:whatsapp|message|text)\b|whatsapp\s+\w+|text\s+\w+|write\s+to\b)/i

// ─── Contact / call patterns ────────────────────────────────────────────────

const CALL_HE = /תתקשרי?\s+ל|להתקשר\s+ל/
const CALL_ES = /\bllam[aá](?:la|le|lo)?\s+a\b|\bllamar\s+a\b/i
const CALL_EN = /\bcall\s+(?:my\s+)?\w+/i

// ─── Navigation patterns ───────────────────────────────────────────────────

const NAV_HE = /פתחי|תפתחי|לפתוח|תעברי ל|לעבור ל|קחי אותי ל|חזרי ל|תחזרי ל|לחזור ל/i
const NAV_ES = /\babr[ií]\b|\babrime\b|\bllev[aá]me\s+a\b|\bvolver\s+a\b/i
const NAV_EN = /\b(?:open|go to|take me to|switch to|back to|show me)\b/i

// Known screen/feature names for navigation
const NAV_TARGETS = /משחקים|games|juegos|הגדרות|settings|configuraci[oó]n|בית|home|inicio|יומן|calendar|calendario|הודעות|messages|mensajes/i

// ─── Personal / family / AbuAI patterns ─────────────────────────────────────

const PERSONAL_HE = /מי (זה|זאת|זו|הוא|היא)\s|מי ה(בן|בת|נכד|נכדה)|הנכד שלי|הנכדה שלי|הבן שלי|הבת שלי|הילדים שלי|הנכדים שלי|איך קוראים ל|מה הקשר (של|עם|בין)|מתי (יום ה?הולדת|ה?אזכרה|יום ה?זיכרון)|איפה .+ גר/i
const PERSONAL_ES = /qui[eé]n\s+es|h[aá]blame\s+de|c[oó]ntame\s+de|contame\s+de|cu[aá]ndo\s+(?:es\s+el\s+)?cumplea[nñ]os/i
const PERSONAL_EN = /\bwho(?:'?s| is)\s|tell\s+me\s+about\s|when(?:'?s| is)\s+(?:\w+'?s?\s+)?birthday/i

// ─── Greeting / general conversation ────────────────────────────────────────

const GREETING_HE = /^(שלום|היי|בוקר טוב|ערב טוב|מה שלומך|מה נשמע|מה קורה|אהלן)\s*[?!.]*$/i
const GREETING_ES = /^(hola|buenas?|buen d[ií]a|buenas (?:tardes|noches)|c[oó]mo (?:est[aá]s|and[aá]s)|che|qu[eé] tal)\s*[?!.]*$/i
const GREETING_EN = /^(hi|hello|hey|good (?:morning|evening|afternoon)|how are you|what'?s up)\s*[?!.]*$/i

// ─── Router ─────────────────────────────────────────────────────────────────

function normalizeText(text: string): string {
  return text.trim().replace(/\s+/g, ' ')
}

/**
 * Classify a speech transcript into a domain, action, confidence, and safety.
 *
 * Pure function — no side effects, no network calls.
 * Returns a FreeSpeechRoute that downstream handlers use to decide what to do.
 */
export function routeFreeSpeech(transcript: string): FreeSpeechRoute {
  const text = normalizeText(transcript)
  const language = detectLanguage(text)
  const reasons: string[] = []

  if (!text || text.length < 2) {
    return {
      domain: 'unclear',
      action: 'clarify',
      confidence: 'low',
      safety: 'clarify',
      language,
      reasons: ['empty or too short'],
      normalizedText: text,
    }
  }

  // ── WhatsApp / messaging (write action — check early) ──
  if (WA_SEND_HE.test(text) || WA_SEND_ES.test(text) || WA_SEND_EN.test(text)) {
    reasons.push('messaging verb detected')
    return {
      domain: 'whatsapp',
      action: 'send_message',
      confidence: 'high',
      safety: 'requires_confirmation',
      language,
      reasons,
      normalizedText: text,
    }
  }

  // ── Call contact (also write-ish — routes to whatsapp domain for contact) ──
  if (CALL_HE.test(text) || CALL_ES.test(text) || CALL_EN.test(text)) {
    reasons.push('call verb detected')
    return {
      domain: 'whatsapp',
      action: 'send_message',
      confidence: 'high',
      safety: 'requires_confirmation',
      language,
      reasons,
      normalizedText: text,
    }
  }

  // ── Calendar CREATE (write action — must come before calendar query) ──
  const hasCreateVerb =
    CAL_CREATE_HE.test(text) || CAL_CREATE_ES.test(text) || CAL_CREATE_EN.test(text)
  const hasCalContext = CAL_CONTEXT.test(text)

  if (hasCreateVerb) {
    reasons.push('calendar create verb detected')
    if (hasCalContext) reasons.push('calendar context words present')
    return {
      domain: 'calendar',
      action: 'create',
      confidence: hasCalContext ? 'high' : 'medium',
      safety: 'requires_confirmation',
      language,
      reasons,
      normalizedText: text,
    }
  }

  // ── Calendar QUERY (read action) ──
  if (CAL_QUERY_HE.test(text) || CAL_QUERY_ES.test(text) || CAL_QUERY_EN.test(text)) {
    reasons.push('calendar query pattern matched')
    return {
      domain: 'calendar',
      action: 'query',
      confidence: 'high',
      safety: 'read_only',
      language,
      reasons,
      normalizedText: text,
    }
  }

  // ── Navigation ──
  const hasNavVerb = NAV_HE.test(text) || NAV_ES.test(text) || NAV_EN.test(text)
  const hasNavTarget = NAV_TARGETS.test(text)

  if (hasNavVerb && hasNavTarget) {
    reasons.push('navigation verb + known target')
    return {
      domain: 'navigation',
      action: 'navigate',
      confidence: 'high',
      safety: 'read_only',
      language,
      reasons,
      normalizedText: text,
    }
  }

  if (hasNavVerb) {
    reasons.push('navigation verb detected, target unclear')
    return {
      domain: 'navigation',
      action: 'navigate',
      confidence: 'medium',
      safety: 'clarify',
      language,
      reasons,
      normalizedText: text,
    }
  }

  // ── Personal / family queries (AbuAI domain) ──
  if (PERSONAL_HE.test(text) || PERSONAL_ES.test(text) || PERSONAL_EN.test(text)) {
    reasons.push('personal/family question pattern')
    return {
      domain: 'abuai',
      action: 'answer',
      confidence: 'high',
      safety: 'read_only',
      language,
      reasons,
      normalizedText: text,
    }
  }

  // ── Greetings → general (AbuAI handles, read-only) ──
  if (GREETING_HE.test(text) || GREETING_ES.test(text) || GREETING_EN.test(text)) {
    reasons.push('greeting detected')
    return {
      domain: 'general',
      action: 'answer',
      confidence: 'high',
      safety: 'read_only',
      language,
      reasons,
      normalizedText: text,
    }
  }

  // ── Fallback: if it has calendar context words, lean toward calendar query ──
  if (hasCalContext) {
    reasons.push('calendar context words present, no strong verb')
    return {
      domain: 'calendar',
      action: 'query',
      confidence: 'medium',
      safety: 'read_only',
      language,
      reasons,
      normalizedText: text,
    }
  }

  // ── Default: general conversation for AbuAI ──
  // Short utterances with no clear domain → unclear
  if (text.length < 8) {
    reasons.push('short utterance, no domain match')
    return {
      domain: 'unclear',
      action: 'clarify',
      confidence: 'low',
      safety: 'clarify',
      language,
      reasons,
      normalizedText: text,
    }
  }

  // Longer text with no matched pattern → general conversation (AbuAI handles)
  reasons.push('no specific domain pattern matched, routing to general')
  return {
    domain: 'general',
    action: 'answer',
    confidence: 'medium',
    safety: 'read_only',
    language,
    reasons,
    normalizedText: text,
  }
}
