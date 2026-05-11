/*
 * AbuAI Instant Acknowledgement (B2.2)
 *
 * Returns a tiny, human, NON-factual sentence used while the runtime is
 * waiting for a real answer (tool call, online search, LLM). No fake
 * results, no childish tone, no commitment to a specific outcome.
 *
 * Pure function — deterministic mapping from {source-or-content-mode,
 * language} to a short ack string.
 */

import type { AbuAISource } from './sourceRouter'
import type { ContentMode, ContentLanguage } from './contentWorldEngine'

export type Lang = ContentLanguage
export type AckTarget = AbuAISource | ContentMode

const ACKS: Record<string, Record<Lang, string>> = {
  // Sources
  calendar_tool:  { he: 'רגע, פותחת את היומן.',           es: 'Un segundo, abro la agenda.',          en: 'One moment, opening your calendar.',          mixed: 'רגע, abro la agenda.' },
  family_tool:    { he: 'רגע, בודקת ברשימת המשפחה.',      es: 'Sí, miro la lista de la familia.',     en: 'One moment, checking the family list.',       mixed: 'רגע, miro la lista.' },
  contacts_tool:  { he: 'רגע, מסתכלת באנשי הקשר.',         es: 'Un segundo, miro tus contactos.',      en: 'One moment, checking your contacts.',         mixed: 'רגע, miro contactos.' },
  weather_api:    { he: 'רגע, אבדוק את מזג האוויר.',       es: 'Dale, miro el clima un segundo.',      en: 'One second, checking the weather.',           mixed: 'רגע, miro el clima.' },
  online_search:  { he: 'רגע, אבדוק אונליין.',             es: 'Dale, lo miro un segundo.',            en: 'One moment, checking online.',                mixed: 'רגע, lo miro un segundo.' },
  open_conversation: { he: 'בוא נדבר.',                    es: 'Sí, te cuento algo lindo.',            en: 'Sure, let me share something.',               mixed: 'בוא נדבר, te cuento.' },
  proactive_content: { he: 'יש לי משהו נחמד.',             es: 'Tengo algo tranquilo, te tiro.',       en: 'I have something gentle for us.',             mixed: 'יש לי משהו, te tiro.' },
  practical_help: { he: 'רגע, אעזור.',                     es: 'Dale, te ayudo.',                      en: 'One moment, let me help.',                    mixed: 'רגע, te ayudo.' },

  // Content modes
  film_series:    { he: 'רגע, מסדרת המלצה.',               es: 'Un segundo, te sugiero algo.',         en: 'One moment, putting a suggestion together.',  mixed: 'רגע, te sugiero algo.' },
  music:          { he: 'רגע, חושבת על משהו לשמוע.',       es: 'Pensando algo para escuchar.',         en: 'Thinking of something to listen to.',         mixed: 'רגע, algo para escuchar.' },
  cooking:        { he: 'רגע, חושבת על מתכון.',            es: 'Un segundo, pienso una receta.',       en: 'One moment, thinking of a recipe.',           mixed: 'רגע, una receta.' },
  theatre_poetry: { he: 'רגע, יש לי משהו יפה.',            es: 'Tengo algo bonito, dame un segundo.',  en: 'I have something nice, one moment.',          mixed: 'רגע, algo bonito.' },
  news_world:    { he: 'רגע, אבדוק מהר.',                   es: 'Lo miro rápido.',                      en: 'I will check quickly.',                       mixed: 'רגע, lo miro rápido.' },
  curious_facts:  { he: 'יש לי אחת חמודה.',                 es: 'Tengo una linda.',                     en: 'I have a sweet one.',                         mixed: 'יש לי אחת, tengo una.' },
  riddles_games:  { he: 'בואי ננסה משהו קצר.',              es: 'Probemos algo cortito.',               en: 'Let us try a short one.',                     mixed: 'נסה קצר, vamos cortito.' },
  light_culture_gossip: { he: 'יש לי משהו קליל.',           es: 'Tengo algo livianito.',                en: 'I have something light.',                     mixed: 'משהו קליל, livianito.' },
  memories:       { he: 'נחמד שהזכרת — רגע.',              es: 'Lindo que lo nombres — un segundo.',   en: 'Nice that you mentioned it — one moment.',    mixed: 'רגע, lindo recuerdo.' },
  local_activity: { he: 'אבדוק מה קרוב עכשיו.',             es: 'Busco algo cerca.',                    en: 'I will check what is nearby.',                mixed: 'busco cerca, אבדוק.' },
  podcast:        { he: 'רגע, אסדר רעיון.',                 es: 'Te tiro algo en un segundo.',          en: 'Pulling an idea together, one moment.',       mixed: 'רגע, te tiro algo.' },
  open_chat:      { he: 'אני כאן.',                         es: 'Acá estoy.',                           en: 'I am here.',                                   mixed: 'אני כאן, acá estoy.' },
}

/**
 * Return a short ack for a given source or content mode in the
 * preferred language. Never makes a factual claim.
 */
export function getInstantAcknowledgement(target: AckTarget, language: Lang = 'he'): string {
  const row = ACKS[target as string] ?? ACKS.open_chat!
  return row[language] ?? row.he ?? 'אני כאן.'
}
