/*
 * Regression: a NEW create supersedes a pending draft — in EITHER language.
 * ════════════════════════════════════════════════════════════════════════
 * First divergence (browser E2E vs preview, docs/eval/PREVIEW_EVIDENCE_0125.md):
 * with a Hebrew create left on a pending "נכון?", a Spanish create
 * ("agendá una reunión con Gabi …") rendered a Spanish confirm for Gabi BUT the
 * createState draft stayed on the stale Hebrew person (גלעד). classifySignalV2's
 * new-create detector was Hebrew-only → the Spanish create was misread as a
 * side_question → side_keep restored the stale draft, so the next "dale, agendalo"
 * SAVED גלעד (in Hebrew), not Gabi. A confirm must save what was read back.
 *
 * Generalized: a genuine new create while a draft is pending MUST replace the draft
 * (person/date/place from the new utterance) and confirm/save in the new create's
 * language — for He→Es, Es→He, and same-language.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { ExecutiveCognitiveController } from './executiveCognitiveController'
import { IDLE_RUNTIME, type RuntimeState } from './cognitiveRuntime'
import { saveAppointments, loadAppointments } from '../AbuCalendar/service'
import type { FullTurnTools } from './runtimeFullTurn'

const FIXED = new Date('2026-06-24T09:00:00')
beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FIXED) })
afterAll(() => { vi.useRealTimers() })
let storage: Record<string, string> = {}
beforeEach(() => {
  storage = {}
  vi.stubGlobal('localStorage', { getItem: (k: string) => storage[k] ?? null, setItem: (k: string, v: string) => { storage[k] = v }, removeItem: (k: string) => { delete storage[k] } })
  vi.stubGlobal('navigator', { onLine: true })
  saveAppointments([])
})
const TOOLS: FullTurnTools = { llm: async () => 'תשובה קצרה.', online: async () => ({ ok: true, answer: 'x', reason: null }) }
const HE = /[֐-׿]/
const RAMBLE = 'אז תשמעי, דיברתי היום עם החתן של רפי, והוא סיפר לי שהוא טס לניו יורק בשבוע הבא, ואנחנו רוצים להיפגש מחר בשלוש אחר הצהריים בבית קפה טולדנו כדי לדבר על הטיול המשפחתי'

async function run(seq: string[]) {
  let state: RuntimeState = IDLE_RUNTIME
  const msgs: Array<{ role: string; content: string }> = []
  const out: Array<{ display: string; side: string | null; person: string | null }> = []
  for (const text of seq) {
    const r = await ExecutiveCognitiveController.handleTurn(state, text, { messages: msgs, now: FIXED }, TOOLS)
    state = r.state
    msgs.push({ role: 'user', content: text }); if (r.display) msgs.push({ role: 'assistant', content: r.display })
    out.push({ display: (r.display ?? '').replace(/\s+/g, ' ').trim(), side: r.sideEffect ?? null, person: state.createState?.draft?.person ?? null })
  }
  return out
}

describe('cross-language draft supersession', () => {
  it('He pending draft → Es create replaces it; confirm SAVES Gabi in Spanish (not stale גלעד)', async () => {
    const [, esCreate, esConfirm] = await run([RAMBLE, 'agendá una reunión con Gabi mañana a las tres', 'dale, agendalo'])
    // The Es create must REPLACE the draft — the read-back is Gabi, in Spanish.
    expect(esCreate!.display).toContain('Gabi')
    expect(esCreate!.display).not.toContain('גלעד')
    expect(HE.test(esCreate!.display)).toBe(false) // Spanish create → no Hebrew leak
    // Confirm SAVES what was read back (Gabi), not the stale Hebrew draft.
    expect(esConfirm!.side).toBe('saved_appointment')
    expect(esConfirm!.display).toContain('Gabi')
    expect(esConfirm!.display).not.toContain('גלעד')
    expect(HE.test(esConfirm!.display)).toBe(false)
    const saved = loadAppointments()
    expect(saved.length).toBe(1)
    expect(JSON.stringify(saved)).toContain('Gabi')
    expect(JSON.stringify(saved)).not.toContain('גלעד')
  })

  it('Es pending draft → He create replaces it; confirm saves the Hebrew person', async () => {
    const [, heCreate, heConfirm] = await run([
      'agendá una reunión con Gabi mañana a las tres',
      'תקבעי פגישה עם מור מחר בארבע',
      'כן',
    ])
    expect(heCreate!.display).toContain('מור')
    expect(heCreate!.display).not.toContain('Gabi')
    expect(heConfirm!.side).toBe('saved_appointment')
    const saved = loadAppointments()
    expect(saved.length).toBe(1)
    expect(JSON.stringify(saved)).toContain('מור')
    expect(JSON.stringify(saved)).not.toContain('Gabi')
  })
})
