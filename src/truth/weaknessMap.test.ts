/*
 * WEAKNESS MAP — proof (c).
 * Proves: (1) the miner classifies Leo's REAL stale-round misses into archetypes tagged by
 * domain+language; (2) the detector is domain-AGNOSTIC (a planted literal-echo is flagged
 * regardless of domain); (3) an archetype FIXED in calendar (phrase-not-resolved) is caught
 * by a CROSS-DOMAIN probe in family — and one general mechanism (resolvePersonPhrase in the
 * family who-is path) closes it across BOTH domains, locked forever.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { ExecutiveCognitiveController } from '../screens/AbuAI/executiveCognitiveController'
import { IDLE_RUNTIME, type RuntimeState } from '../screens/AbuAI/cognitiveRuntime'
import { saveAppointments } from '../screens/AbuCalendar/service'
import type { FullTurnTools } from '../screens/AbuAI/runtimeFullTurn'
import { mineTranscript, summarize, classify, isPhraseNotResolved, phraseResolutionProbes, type TurnObs } from './weaknessMap'

const FIXED = new Date('2026-07-19T09:00:00')
beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FIXED) })
afterAll(() => { vi.useRealTimers() })
let storage: Record<string, string> = {}
beforeEach(() => {
  storage = {}
  vi.stubGlobal('localStorage', { getItem: (k: string) => storage[k] ?? null, setItem: (k: string, v: string) => { storage[k] = v }, removeItem: (k: string) => { delete storage[k] } })
  vi.stubGlobal('navigator', { onLine: true })
  saveAppointments([])
})
const TOOLS: FullTurnTools = { llm: async () => '[[LLM]]', online: async () => ({ ok: true, answer: 'x', reason: null }) }

// ── (1) mine Leo's REAL stale-round misses (verbatim from his export) ──
describe('WEAKNESS MAP — mines real misses into archetypes', () => {
  const REAL: TurnObs[] = [
    { input: 'מתי יש לי פגישה עם החתן של רפי?', reply: 'מה שיש לך עם החתן: פגישה עם החתן של רפי בשעה 21:25', source: 'deterministic', intent: 'calendar_search' },
    { input: 'באיזה יום יש נגישה עם החתן של רפי?', reply: 'לא הצלחתי לנסח את זה כמו שצריך. תגידי לי שוב מה חשוב לך?', source: 'llm', intent: 'general' },
    { input: 'מתי יש לי פגישה עם החתן של רפי?', reply: 'מה שיש לך עם החתן: פגישה עם החתן של רפי בשעה 21:25', source: 'deterministic', intent: 'calendar_search' },
    { input: 'הקשר בין הדין לערבל', reply: 'עדי הוא בן דוד של נועם, שניהם נכדים של Martita. נועם הוא אח של עדי.', source: 'llm', intent: 'general' },
    { input: 'אתה לא מפסיק לטעות, קטסטרופה טוטאלית', reply: 'אני מתנצלת על הבלבול.', source: 'llm', intent: 'general' },
  ]
  it('classifies the misses and tags them by domain + language', () => {
    const hits = mineTranscript(REAL)
    const map = summarize(hits)
    // eslint-disable-next-line no-console
    console.log('[WEAKNESS MAP]', JSON.stringify(map))
    const kinds = new Set(hits.map((h) => h.archetype))
    expect(kinds.has('answer-not-the-question')).toBe(true) // "מתי…" → only the hour
    expect(kinds.has('phrase-not-resolved')).toBe(true)     // relation phrase punted to the LLM
    expect(kinds.has('fabricated-fact')).toBe(true)         // family fact via the LLM
    expect(kinds.has('repeated')).toBe(true)                // she re-asked the same thing
    expect(kinds.has('rejected')).toBe(true)                // "קטסטרופה" after a bad answer
    expect(map.byDomain.calendar).toBeGreaterThanOrEqual(1)
    expect(map.byDomain.family).toBeGreaterThanOrEqual(1)
    expect(map.byLang.he).toBeGreaterThanOrEqual(1)
  })
})

// ── (2) the detector is domain-agnostic: a planted literal-echo is flagged ──
describe('WEAKNESS MAP — the archetype detector is domain-agnostic', () => {
  it('flags a phrase-not-resolved reply (echoed as the scheduled person, or punted) but NOT a resolved answer', () => {
    expect(isPhraseNotResolved('פגישה עם החתן של רפי', 'פגישה עם החתן של רפי מחר. נכון?', 'deterministic')).toBe(true) // echoed AS the person (Leo's calendar bug)
    expect(isPhraseNotResolved('פגישה עם החתן של רפי', '[[LLM]]', 'llm')).toBe(true)                                    // punted to the LLM
    expect(isPhraseNotResolved('מי החתן של רפי', 'לא הצלחתי להבין', 'deterministic')).toBe(true)                        // capability denial
    expect(isPhraseNotResolved('מי החתן של רפי', 'החתן של רפי הוא גלעד.', 'deterministic')).toBe(false)                 // RESOLVED → not a miss
    expect(classify({ input: 'מי החתן של רפי', reply: 'החתן של רפי הוא גלעד.', source: 'deterministic' })).toBeNull()  // resolved → NOT a miss
  })
})

// ── (3) CROSS-DOMAIN: the archetype closed in calendar must be closed in family too ──
async function reply(seq: string[]): Promise<string> {
  let state: RuntimeState = IDLE_RUNTIME
  let last = ''
  for (const text of seq) { const r = await ExecutiveCognitiveController.handleTurn(state, text, { messages: [], now: FIXED }, TOOLS); state = r.state; last = (r.display ?? '').replace(/\s+/g, ' ').trim() }
  return last
}
describe('WEAKNESS MAP — one general fix closes phrase-not-resolved across calendar AND family', () => {
  it('every cross-domain probe resolves the relation phrase (no literal echo, no LLM punt)', async () => {
    for (const p of phraseResolutionProbes()) {
      saveAppointments([])
      const out = await reply(p.turns)
      expect(out, `[${p.domain}/${p.lang}] «${p.turns.join(' ')}» → ${out}`).toContain(p.expectContains)
      expect(out).not.toContain(p.expectAbsent)
      // The SAME domain-agnostic detector confirms the archetype is CLOSED on this reply.
      const src = out.includes('[[LLM]]') ? 'llm' : 'deterministic'
      expect(isPhraseNotResolved(p.turns[p.turns.length - 1]!, out, src)).toBe(false)
    }
  })
})
