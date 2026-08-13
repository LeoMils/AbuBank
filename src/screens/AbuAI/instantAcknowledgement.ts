/*
 * AbuAI Instant Acknowledgement (B2.2)
 *
 * A tiny, human, NON-factual opener for the PURELY CONVERSATIONAL modes only.
 *
 * Tool-backed and content-LOOKUP modes return '' (empty = STAY SILENT). Announcing a
 * check before doing it ("רגע, אבדוק אונליין", "Dale, lo miro un segundo") is the
 * announce-before-checking anti-pattern the live path forbids: Abu calls the tool FIRST
 * and stays silent, and the grounded answer is her first words. The empty acks are
 * enforced by announceBeforeChecking.guard.test.ts so a "checking" ack can never be
 * re-seeded here (this table was the codebase seed of those exact phrases).
 *
 * Pure function — deterministic mapping from {source-or-content-mode, language} to a
 * short ack string (or '').
 */

import type { AbuAISource } from './sourceRouter'
import type { ContentMode, ContentLanguage } from './contentWorldEngine'

export type Lang = ContentLanguage
export type AckTarget = AbuAISource | ContentMode

const ACKS: Record<string, Record<Lang, string>> = {
  // Tool-backed and content-LOOKUP modes: NO pre-answer line (empty = stay silent).
  calendar_tool:  { he: '', es: '', en: '', mixed: '' },
  family_tool:    { he: '', es: '', en: '', mixed: '' },
  contacts_tool:  { he: '', es: '', en: '', mixed: '' },
  weather_api:    { he: '', es: '', en: '', mixed: '' },
  online_search:  { he: '', es: '', en: '', mixed: '' },
  practical_help: { he: '', es: '', en: '', mixed: '' },
  film_series:    { he: '', es: '', en: '', mixed: '' },
  music:          { he: '', es: '', en: '', mixed: '' },
  cooking:        { he: '', es: '', en: '', mixed: '' },
  theatre_poetry: { he: '', es: '', en: '', mixed: '' },
  news_world:     { he: '', es: '', en: '', mixed: '' },
  local_activity: { he: '', es: '', en: '', mixed: '' },
  podcast:        { he: '', es: '', en: '', mixed: '' },
  memories:       { he: '', es: '', en: '', mixed: '' },
  // Purely CONVERSATIONAL openers — warm, present, NOT a promise to check anything.
  open_conversation:    { he: 'בוא נדבר.',        es: 'Sí, te cuento algo lindo.', en: 'Sure, let me share something.',   mixed: 'בוא נדבר, te cuento.' },
  proactive_content:    { he: 'יש לי משהו נחמד.', es: 'Tengo algo tranquilo.',     en: 'I have something gentle for us.', mixed: 'יש לי משהו נחמד.' },
  curious_facts:        { he: 'יש לי אחת חמודה.', es: 'Tengo una linda.',          en: 'I have a sweet one.',             mixed: 'יש לי אחת חמודה.' },
  riddles_games:        { he: 'בואי ננסה משהו קצר.', es: 'Probemos algo cortito.', en: 'Let us try a short one.',         mixed: 'בואי ננסה משהו קצר.' },
  light_culture_gossip: { he: 'יש לי משהו קליל.', es: 'Tengo algo livianito.',     en: 'I have something light.',         mixed: 'יש לי משהו קליל.' },
  open_chat:            { he: 'אני כאן.',         es: 'Acá estoy.',                en: 'I am here.',                      mixed: 'אני כאן.' },
}

/**
 * Return a short ack for a given source or content mode in the preferred language, or ''
 * for tool-backed / lookup modes (Abu stays silent and lets the grounded answer be first).
 * Never makes a factual claim; never announces a check before doing it.
 */
export function getInstantAcknowledgement(target: AckTarget, language: Lang = 'he'): string {
  const row = ACKS[target as string]
  if (!row) return ACKS.open_chat![language] ?? ACKS.open_chat!.he
  return row[language] ?? row.he
}
