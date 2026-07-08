/*
 * FINAL CONVERSATION QUALITY JUDGE — launch thresholds.
 * ═══════════════════════════════════════════════════════════════════════════
 * Runs representative conversations through the REAL runtime and scores every
 * assistant answer 0–5 with the deterministic Conversation Quality Judge. It is
 * honest about reach: it scores RUNTIME-COMPOSED (deterministic) answers for
 * tone/menu/hallucination; stubbed LLM prose is NOT tone-faked (that is device/
 * LLM-runtime). Thresholds are asserted on the runtime-composed answers.
 */
import { describe, it, expect } from 'vitest'
import { ExecutiveCognitiveController } from '../screens/AbuAI/executiveCognitiveController'
import { IDLE_RUNTIME, type RuntimeState } from '../screens/AbuAI/cognitiveRuntime'
import { saveAppointments } from '../screens/AbuCalendar/service'
import { resolvePronouns } from '../screens/AbuAI/pronounResolver'
import { resolveFollowUp } from '../screens/AbuAI/contextResolver'
import type { ChatMessage } from '../screens/AbuAI/types'
import { judgeTurn, judgeConversation, type JudgeInput } from './conversationQualityJudge'

class MemLS {
  private s = new Map<string, string>()
  getItem(k: string) { return this.s.has(k) ? this.s.get(k)! : null }
  setItem(k: string, v: string) { this.s.set(k, String(v)) }
  removeItem(k: string) { this.s.delete(k) }
  clear() { this.s.clear() }
  key() { return null }
  get length() { return this.s.size }
}
const tools = { llm: async (i: string) => `[LLM] ${i.slice(0, 30)}`, online: async (q: string) => ({ ok: true, answer: `בכפר סבא 29 מעלות, שמש. (${q})` }) }
const NOW = new Date('2026-06-24T20:00:00')

async function convo(turns: string[]): Promise<JudgeInput[]> {
  ;(globalThis as unknown as { localStorage: MemLS }).localStorage = new MemLS()
  saveAppointments([])
  let state: RuntimeState = IDLE_RUNTIME
  const msgs: Array<{ role: string; content: string }> = []; const out: JudgeInput[] = []
  for (const say of turns) {
    const prior: ChatMessage[] = msgs.map((m, i) => ({ id: String(i), role: m.role as 'user' | 'assistant', content: m.content, timestamp: 0 }))
    const { resolved: pr } = resolvePronouns(say, prior)
    let eff = pr !== say ? pr : say
    const fu = resolveFollowUp(eff, prior, { pendingCreate: state.createState.phase !== 'idle' })
    if (fu.wasFollowUp) eff = fu.resolved
    msgs.push({ role: 'user', content: eff })
    const r = await ExecutiveCognitiveController.handleTurn({ ...state, conv: state.conv }, eff, { messages: [...msgs], now: NOW }, tools)
    state = r.state
    msgs.push({ role: 'assistant', content: r.display })
    out.push({ say, intent: r.intent, source: r.source, display: r.display, onlineOk: r.source === 'online' ? true : null })
  }
  return out
}

async function categoryAverage(convos: string[][]): Promise<{ avg: number; p0: number; full: number }> {
  let sum = 0, n = 0, p0 = 0
  for (const c of convos) {
    const turns = await convo(c)
    for (const t of turns) {
      const v = judgeTurn(t)
      if (v.p0) p0++
      if (v.judged === 'full') { sum += v.score; n++ }
    }
  }
  return { avg: n ? sum / n : 5, p0, full: n }
}

describe('QUALITY JUDGE — launch thresholds (runtime-composed answers)', () => {
  it('CALENDAR usability ≥ 4.5, no P0', async () => {
    const r = await categoryAverage([
      ['תקבעי לי', 'עם מור', 'מחר בשמונה בערב', 'כן'],
      ['תקבעי לי פגישה עם יעל מחר בשלוש בקפה אסתר', 'כן', 'מתי הפגישה עם יעל?', 'באיזה שעה?'],
      ['תקבעי פגישה מחר בשלוש עם מור', 'די', 'מה מזג האוויר בכפר סבא?'],
      ['מה יש לי מחר?'],
    ])
    expect(r.p0).toBe(0)
    expect(r.avg, `avg=${r.avg} full=${r.full}`).toBeGreaterThanOrEqual(4.5)
  })

  it('MEMORY recall ≥ 4.2, no P0', async () => {
    const r = await categoryAverage([
      ['מי זאת מור?', 'מה מזג האוויר בכפר סבא?', 'עזוב', 'מה דיברנו קודם?'],
      ['מי זה רפי?', 'מה השעה?', 'מה דיברנו קודם?'],
    ])
    expect(r.p0).toBe(0)
    expect(r.avg).toBeGreaterThanOrEqual(4.2)
  })

  it('HEBREW composed answers ≥ 4.2, no P0 (family/time/exit/calendar)', async () => {
    const r = await categoryAverage([
      ['מי זאת מור?', 'מי זה רפי?', 'מי זאת אופיר?'],
      ['מה השעה?', 'איזה יום היום?'],
      ['תקבעי פגישה מחר בשלוש עם מור', 'מספיק'],
    ])
    expect(r.p0).toBe(0)
    expect(r.avg).toBeGreaterThanOrEqual(4.2)
  })

  it('SPANISH/mixed — no P0, no forced menu (prose is LLM/device, not tone-judged)', async () => {
    const r = await categoryAverage([
      ['Hola, ¿cómo estás?', 'gracias'],
      ['¿Qué tiempo hace en Kfar Saba?', '¿Y mañana?'],
    ])
    expect(r.p0).toBe(0)
  })

  it('OVERALL — no P0 across a mixed day; conversation-level judge does not fail', async () => {
    const day = await convo(['שלום', 'מי זאת מור?', 'תקבעי לי פגישה עם מור מחר בשמונה בערב בקפה אסתר', 'כן', 'מתי הפגישה עם מור?', 'באיזה שעה?', 'די', 'מה מזג האוויר בכפר סבא?', 'ומחר?', 'מה דיברנו קודם?', 'ביי'])
    const q = judgeConversation(day)
    expect(q.p0Count, JSON.stringify(day.map(d => d.display))).toBe(0)
    expect(q.avg).toBeGreaterThanOrEqual(4.2)
  })
})
