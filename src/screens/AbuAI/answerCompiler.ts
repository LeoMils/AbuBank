/*
 * AbuAI Answer Compiler (B2.2)
 *
 * Pure function. Given the user input + an EvidencePacket + persona +
 * optional content-world choice, returns a short, warm, adult answer
 * suitable for either text bubble or TTS.
 *
 * Truth rules (enforced here):
 *   • If the packet is a tool error → return the "I cannot check right
 *     now" copy in the user's language.
 *   • If the packet kind is personal/current and has no facts → return
 *     "I did not find anything" copy.
 *   • The compiler NEVER invents facts beyond `evidence.facts`.
 *   • Open conversation may use the content-world opening + gentle
 *     options (deterministic seeds — no LLM invention).
 */

import type { EvidencePacket } from './evidencePacket'
import { hasFacts, hasSources, isToolFailure } from './evidencePacket'
import type { ContentWorldChoice, ContentLanguage } from './contentWorldEngine'

export type Lang = ContentLanguage

export interface PersonaContext {
  /** Caller-provided language hint; otherwise inferred from the packet. */
  lang?: Lang
  /** Whether the runtime asked for an extra follow-up question. */
  allowFollowUp?: boolean
}

export interface CompiledAnswer {
  text: string
  /** True when `text` is the user-facing failure copy and the caller
   *  should NOT speak it confidently in voice. */
  isFailureCopy: boolean
  /** Sources lifted from the packet, only for renderable surfaces. */
  sources: ReadonlyArray<{ title: string; url?: string }>
}

const NOT_FOUND: Record<Lang, string> = {
  he: 'לא מצאתי.',
  es: 'No encontré nada.',
  en: 'I did not find anything.',
  mixed: 'לא מצאתי.',
}

const TOOL_ERROR: Record<Lang, string> = {
  he: 'אני לא מצליחה לבדוק כרגע.',
  es: 'No puedo comprobarlo ahora mismo.',
  en: 'I cannot check right now.',
  mixed: 'אני לא מצליחה לבדוק כרגע.',
}

const CHECKED_PREFIX: Record<Lang, string> = {
  he: 'בדקתי עכשיו: ',
  es: 'Lo miré recién: ',
  en: 'Just checked: ',
  mixed: 'בדקתי עכשיו: ',
}

function resolveLang(packet: EvidencePacket, persona: PersonaContext): Lang {
  return persona.lang ?? 'he'
}

function safeJoinFacts(facts: ReadonlyArray<string>): string {
  // Trim each fact, drop empties, join with newlines. No markdown.
  const cleaned = facts.map((f) => (f || '').trim()).filter((f) => f.length > 0)
  return cleaned.join('\n')
}

/**
 * Build a short, warm answer. Pure — no LLM, no fetch.
 *
 * Tone: adult-to-adult, intelligent, never childish, never therapist.
 * One follow-up only for content / open / proactive content paths.
 */
export function compileHumanAnswer(
  _input: string,
  evidence: EvidencePacket,
  persona: PersonaContext = {},
  contentWorld?: ContentWorldChoice,
): CompiledAnswer {
  const lang = resolveLang(evidence, persona)
  const sources = hasSources(evidence) ? (evidence.sources ?? []).slice(0, 3) : []

  // 1. Tool failure — honest, short, never speculative.
  if (isToolFailure(evidence)) {
    return { text: TOOL_ERROR[lang], isFailureCopy: true, sources: [] }
  }

  // 2. No-evidence personal/current request.
  if ((evidence.kind === 'calendar' || evidence.kind === 'family' || evidence.kind === 'contacts'
       || evidence.kind === 'weather' || evidence.kind === 'online')
      && !hasFacts(evidence)) {
    return { text: NOT_FOUND[lang], isFailureCopy: true, sources: [] }
  }

  // 3. Calendar / family / contacts — use facts verbatim.
  if (evidence.kind === 'calendar' || evidence.kind === 'family' || evidence.kind === 'contacts') {
    return {
      text: safeJoinFacts(evidence.facts),
      isFailureCopy: false,
      sources: [],
    }
  }

  // 4. Weather / online — current info; prefix with a "just checked"
  // frame so Martita knows it is fresh. Append sources for the renderer.
  if (evidence.kind === 'weather' || evidence.kind === 'online') {
    const body = safeJoinFacts(evidence.facts)
    return {
      text: `${CHECKED_PREFIX[lang]}${body}`,
      isFailureCopy: false,
      sources,
    }
  }

  // 5. Open conversation — use the content-world opening + gentle options
  // when available. Stays deterministic.
  if (evidence.kind === 'open' && contentWorld) {
    const lines: string[] = []
    if (contentWorld.suggestedOpening) lines.push(contentWorld.suggestedOpening)
    if (persona.allowFollowUp && contentWorld.gentleOptions.length > 0) {
      lines.push(contentWorld.gentleOptions.slice(0, 3).map((o) => `• ${o}`).join('\n'))
    }
    if (lines.length === 0) lines.push(openFallback(lang))
    return { text: lines.join('\n\n'), isFailureCopy: false, sources: [] }
  }

  // 6. Open conversation without a content-world choice — gentle fallback.
  if (evidence.kind === 'open') {
    return { text: openFallback(lang), isFailureCopy: false, sources: [] }
  }

  // 7. kind === 'none' without any content world.
  return { text: NOT_FOUND[lang], isFailureCopy: true, sources: [] }
}

function openFallback(lang: Lang): string {
  switch (lang) {
    case 'es': return 'Acá estoy. ¿De qué te gustaría hablar?'
    case 'en': return 'I am here. What would you like to talk about?'
    case 'mixed': return 'אני כאן. ¿de qué te gustaría hablar?'
    case 'he':
    default:    return 'אני כאן. על מה בא לך לדבר?'
  }
}
