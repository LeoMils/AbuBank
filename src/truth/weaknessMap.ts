/*
 * WEAKNESS MAP — the mistake notebook, mined from reality (Constitution §5).
 * ════════════════════════════════════════════════════════════════════════
 * Auto-classify every real miss (from the flight-recorder / recordTurn reality) into a
 * failure ARCHETYPE tagged by domain + language. An archetype is domain-AGNOSTIC: the
 * SAME detector runs across calendar, family, memory, online. A fix must therefore close
 * the archetype across ALL domains and BOTH languages — proven by cross-domain probes and
 * new mirrors generated around it, locked forever.
 *
 * Pure + deterministic (detectors + miner + probe DEFINITIONS). The controller run for the
 * cross-domain probes lives in the test (keeps this module runtime-light).
 */
export type Archetype =
  | 'answer-not-the-question' // asked X, got a fraction (e.g. which-day → only the hour)
  | 'phrase-not-resolved'     // a relation phrase echoed literally / punted to the LLM instead of resolved
  | 'fabricated-fact'         // a family fact asserted via the LLM (invention risk)
  | 'capability-denial'       // "לא הצלחתי / לא הבנתי / תגידי שוב" when it should have answered
  | 'repeated'                // the user re-asked the same thing (the prior turn did not satisfy)
  | 'rejected'                // the user said the answer was wrong (frustration / קטסטרופה)

export type Domain = 'calendar' | 'family' | 'memory' | 'online' | 'other'
export type Lang = 'he' | 'es'

export interface TurnObs { input: string; reply: string; source: string; intent?: string }
export interface ArchetypeHit { archetype: Archetype; turnIndex: number; input: string; domain: Domain; lang: Lang; detail: string }

const HE = /[֐-׿]/
export const langOf = (s: string): Lang => (HE.test(s) ? 'he' : 'es')
export function domainOf(intent?: string, input = ''): Domain {
  const i = (intent ?? '').toLowerCase()
  if (/calendar|event|appointment|reminder/.test(i) || /פגישה|תור|יומן|ביומן/.test(input)) return 'calendar'
  if (/family|relation|who/.test(i) || /קשר|אמא|אבא|אח |אחות|בן |בת |נכד|חתן|כלה|של\s/.test(input)) return 'family'
  if (/memory|recall/.test(i) || /תזכרי|זוכרת|תשכחי/.test(input)) return 'memory'
  if (/online|search|web/.test(i)) return 'online'
  return 'other'
}

/** A relation phrase "<role> של <name>" the reply is expected to RESOLVE, not echo. */
export function extractRelationPhrase(input: string): string | null {
  const m = input.match(/(ה?(?:חתן|כלה|בן|בת|אח|אחות|אמא|אבא|סבא|סבתא|בעל|אישה|אשת|גיס|גיסה|דוד|דודה|נכד|נכדה)[א-ת]*\s+של\s+[א-ת]{2,})/u)
  return m?.[1]?.trim() ?? null
}

// ── pure detectors (one archetype each) ──────────────────────────────────────
export function isCapabilityDenial(reply: string): boolean {
  return /לא הצלחתי|לא הבנתי|תגידי(?:\s+לי)?\s+שוב|לא בטוחה בקשר|רגע,?\s+אני רוצה להבין|לא אנחש/u.test(reply)
}
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
export function isPhraseNotResolved(input: string, reply: string, source: string): boolean {
  const phrase = extractRelationPhrase(input)
  if (!phrase) return false
  // Missed when it: punted to the LLM, denied capability, or echoed the literal phrase AS
  // the scheduled/answered person ("עם <phrase>" / the phrase used where a real name belongs).
  // A reply that NAMES the resolved person ("החתן של רפי הוא גלעד") is NOT a miss even though
  // it restates the phrase.
  if (source === 'llm' || isCapabilityDenial(reply)) return true
  return new RegExp(`(?:עם|אצל)\\s+${escapeRe(phrase)}`).test(reply)
}
export function isPartialWhichDay(input: string, reply: string): boolean {
  const asksDay = /באיזה\s+יום|איזה\s+יום|(?<![א-ת])מתי(?![א-ת])/u.test(input)
  if (!asksDay) return false
  const hasHour = /\d{1,2}:\d{2}|בשעה/u.test(reply)
  const hasDay = /יום\s+(?:ראשון|שני|שלישי|רביעי|חמישי|שישי)|שבת|מחר|היום|\d{1,2}\s+ב(?:ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)/u.test(reply)
  return hasHour && !hasDay
}
export function isFabricatedFamilyFact(input: string, source: string): boolean {
  return source === 'llm' && domainOf(undefined, input) === 'family'
}
export function isRejection(reply: string, nextInput?: string): boolean {
  return !!nextInput && /טועה|טעות|קטסטרופה|לא נכון|אתה לא|את לא מבינה|נמאס/u.test(nextInput)
}

/** Classify a single observed turn into ONE archetype (highest-priority first), or null. */
export function classify(obs: TurnObs): Archetype | null {
  if (isPartialWhichDay(obs.input, obs.reply)) return 'answer-not-the-question'
  if (isPhraseNotResolved(obs.input, obs.reply, obs.source)) return 'phrase-not-resolved'
  if (isFabricatedFamilyFact(obs.input, obs.source)) return 'fabricated-fact'
  if (isCapabilityDenial(obs.reply)) return 'capability-denial'
  return null
}

/** Mine a whole transcript (Leo's export shape) into archetype hits, tagged by domain+lang. */
export function mineTranscript(turns: TurnObs[]): ArchetypeHit[] {
  const hits: ArchetypeHit[] = []
  const seen = new Map<string, number>()
  for (let i = 0; i < turns.length; i++) {
    const t = turns[i]!
    const norm = t.input.replace(/\s+/g, ' ').trim()
    const domain = domainOf(t.intent, t.input)
    const lang = langOf(t.input)
    const a = classify(t)
    if (a) hits.push({ archetype: a, turnIndex: i, input: t.input, domain, lang, detail: t.reply.slice(0, 60) })
    // repeated: the same question re-asked → the prior answer did not satisfy.
    if (seen.has(norm)) hits.push({ archetype: 'repeated', turnIndex: i, input: t.input, domain, lang, detail: `first asked at turn ${seen.get(norm)}` })
    else seen.set(norm, i)
    // rejected: the NEXT turn expresses the answer was wrong.
    const next = turns[i + 1]
    if (next && isRejection(t.reply, next.input)) hits.push({ archetype: 'rejected', turnIndex: i, input: t.input, domain, lang, detail: next.input.slice(0, 50) })
  }
  return hits
}

export interface WeaknessMap { total: number; byArchetype: Record<string, number>; byDomain: Record<string, number>; byLang: Record<string, number> }
export function summarize(hits: ArchetypeHit[]): WeaknessMap {
  const inc = (m: Record<string, number>, k: string) => { m[k] = (m[k] ?? 0) + 1 }
  const byArchetype: Record<string, number> = {}, byDomain: Record<string, number> = {}, byLang: Record<string, number> = {}
  for (const h of hits) { inc(byArchetype, h.archetype); inc(byDomain, h.domain); inc(byLang, h.lang) }
  return { total: hits.length, byArchetype, byDomain, byLang }
}

// ── cross-domain probes: the SAME archetype, probed across domains + languages ──
export interface CrossProbe { archetype: Archetype; domain: Domain; lang: Lang; turns: string[]; expectContains: string; expectAbsent: string }
/** "phrase-not-resolved" probed in BOTH calendar and family — a relation phrase must resolve
 *  to the person (גלעד / ירדן), never echo the literal phrase or punt to the LLM. */
export function phraseResolutionProbes(): CrossProbe[] {
  return [
    // calendar (fixed in Cycle 50): create + search resolve the phrase.
    { archetype: 'phrase-not-resolved', domain: 'calendar', lang: 'he', turns: ['תקבעי פגישה עם החתן של רפי מחר בשלוש'], expectContains: 'גלעד', expectAbsent: 'החתן של רפי' },
    // family who-is: the SAME phrase must resolve here too (this cycle's cross-domain fix).
    { archetype: 'phrase-not-resolved', domain: 'family', lang: 'he', turns: ['מי החתן של רפי'], expectContains: 'גלעד', expectAbsent: '[[LLM]]' },
    { archetype: 'phrase-not-resolved', domain: 'family', lang: 'he', turns: ['מי הכלה של רפי'], expectContains: 'ירדן', expectAbsent: '[[LLM]]' },
  ]
}
