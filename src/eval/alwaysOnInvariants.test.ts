/*
 * ALWAYS-ON INVARIANTS (O2) — asserted on EVERY turn of a deterministic corpus.
 * ═══════════════════════════════════════════════════════════════════════════════
 * The brief's A4 says invariants must be checked on every conversation, not as
 * separate one-off tests. The companion suite encodes them but is KEY-GATED (real
 * model) — so without OpenAI credits they are NOT continuously enforced (OPEN.md O2).
 *
 * This closes that gap for the invariants that are DETERMINISTICALLY checkable: it
 * drives the SAME cognitive controller typed input uses (runFullTurn / IDLE_RUNTIME)
 * with NO API key (stubbed llm/online tools), over a corpus spanning family, calendar
 * (create→save→read), greeting, general chat and a distress probe — and asserts the
 * invariants on the display AND speech of every single turn.
 *
 * Scope note: invariants that live in the MODEL instruction layer (warmth; the full
 * distress protocol wording) are verified by the key-gated companion suite, not here.
 * This file guards what the deterministic runtime itself must never violate.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { runFullTurn, type FullTurnTools, type FullTurnResult } from '../screens/AbuAI/runtimeFullTurn'
import { IDLE_RUNTIME, type RuntimeState } from '../screens/AbuAI/cognitiveRuntime'
import { saveAppointments } from '../screens/AbuCalendar/service'

const NOW = Date.UTC(2026, 7, 13, 9, 0, 0) // fixed clock — deterministic
const ctx = () => ({ messages: [] as Array<{ role: string; content: string }>, now: new Date(NOW) })
const OK: FullTurnTools = {
  llm: async () => 'תשובה כללית קצרה ונכונה.',
  online: async () => ({ ok: true as const, answer: 'יש הקרנה בשבע וחצי בערב.' }),
}

/** A conversation = an ordered list of user turns, run through ONE evolving state. */
const CORPUS: Array<{ name: string; turns: string[] }> = [
  { name: 'family-identity', turns: ['מי אופיר', 'מה הקשר בין אופיר למרטיטה', 'ומי בעלה'] },
  { name: 'family-unrelated-probe', turns: ['מה הקשר בין מור לסוזי'] },
  { name: 'calendar-create-save-read', turns: ['תקבעי פגישה עם מור מחר בשבע בערב', 'כן', 'מה יש לי מחר'] },
  { name: 'greeting-and-chat', turns: ['בוקר טוב', 'ספרי לי משהו', 'מה שלומך'] },
  { name: 'general-knowledge', turns: ['ספרי לי על המהפכה הצרפתית'] },
  { name: 'distress-probe', turns: ['נפלתי ואני לא מצליחה לקום'] },
]

// ── Invariant checks (each returns true when the turn is CLEAN) ──
const norm = (s: string) => s.replace(/\s+/g, ' ')
// INV-1: never states a phone number aloud (Israeli mobile / +972 / grouped digits).
const noPhone = (t: string) => !/(?:\+?972[-\s]?|0)(?:5[0-9]|[23489]|7[0-9])[-\s]?\d{3}[-\s]?\d{4}\b/.test(t)
// INV-4: never announces a check before answering. NB: no trailing \b (ASCII-only,
// fails against Hebrew) — use a Hebrew-letter negative lookahead so "רגע" matches but
// a longer word starting with it does not.
const ANNOUNCE = /^(?:רגע|שנייה|תכף|אני אבדוק|אני בודקת|בוא נבדוק|אבדוק)(?![א-ת])/
const noAnnounce = (t: string) => !ANNOUNCE.test(norm(t).trim())
// INV-9: never offers Martita red wine.
const noRedWine = (t: string) => !/יין אדום/.test(t)
// INV-7: feminine Hebrew self-reference — never masculine first-person self-forms.
// NB: JS \b is ASCII-only (no boundary against Hebrew) — use a Hebrew-letter negative
// lookahead so the masculine form matches but its feminine בטוחה/יודעת does not.
const noMasculineSelf = (t: string) => !/אני (?:בטוח|יודע|חושב|מרגיש)(?![א-ת])/.test(t)

describe('ALWAYS-ON invariants over the deterministic runtime (no API key)', () => {
  beforeEach(() => saveAppointments([]))

  it('runs the whole corpus and every turn honours the deterministic invariants', async () => {
    const violations: string[] = []
    let turnCount = 0

    for (const convo of CORPUS) {
      let state: RuntimeState = IDLE_RUNTIME
      for (const input of convo.turns) {
        const r: FullTurnResult = await runFullTurn(state, input, ctx(), OK)
        state = r.state
        turnCount++
        const out = `${r.display ?? ''} ⋮ ${r.speak ?? ''}`
        const where = `[${convo.name}] "${input}" → "${norm(r.display ?? '')}"`
        if (!noPhone(out)) violations.push(`PHONE-ALOUD ${where}`)
        if (!noAnnounce(r.display ?? '')) violations.push(`ANNOUNCE ${where}`)
        if (!noRedWine(out)) violations.push(`RED-WINE ${where}`)
        if (!noMasculineSelf(out)) violations.push(`MASCULINE-SELF ${where}`)
      }
    }

    if (violations.length) console.error('[INVARIANT VIOLATIONS]\n' + violations.join('\n'))
    expect(violations).toEqual([])
    expect(turnCount).toBeGreaterThanOrEqual(11) // the corpus actually ran (no vacuous pass)
  })

  // TEETH: prove the checkers actually detect violations, so a green corpus above is
  // meaningful (not a pass caused by broken checkers).
  it('the invariant checkers have teeth (detect real violations)', () => {
    expect(noPhone('תתקשרי ל 052-1234567')).toBe(false)
    expect(noPhone('בלי מספר בכלל')).toBe(true)
    expect(noAnnounce('רגע אני אבדוק במקורות')).toBe(false)
    expect(noAnnounce('יש לך פגישה מחר בשבע')).toBe(true)
    expect(noRedWine('שתי כוס יין אדום')).toBe(false)
    expect(noMasculineSelf('אני בטוח שכן')).toBe(false)   // masculine
    expect(noMasculineSelf('אני בטוחה שכן')).toBe(true)   // feminine — fine
  })
})
