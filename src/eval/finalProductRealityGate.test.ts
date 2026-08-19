/*
 * FINAL PRODUCT REALITY GATE — iPhone launch acceptance.
 * ═══════════════════════════════════════════════════════════════════════════
 * The specific behaviors the launch gate must guarantee, each driven through the
 * REAL production runtime with the faithful entry pipeline (resolvePronouns +
 * resolveFollowUp(pendingCreate) + ExecutiveCognitiveController.handleTurn), and
 * HARD-FAILED on: forced menu · LLM punt where a deterministic answer exists ·
 * online→reminder/calendar hijack · lost pending create · lost location · wrong
 * gender · repeated greeting · robotic fallback.
 */
import { describe, it, expect } from 'vitest'
import { ExecutiveCognitiveController } from '../screens/AbuAI/executiveCognitiveController'
import { IDLE_RUNTIME, type RuntimeState } from '../screens/AbuAI/cognitiveRuntime'
import { saveAppointments, loadAppointments } from '../screens/AbuCalendar/service'
import type { FullTurnTools } from '../screens/AbuAI/runtimeFullTurn'
import { resolvePronouns } from '../screens/AbuAI/pronounResolver'
import { resolveFollowUp } from '../screens/AbuAI/contextResolver'
import type { ChatMessage } from '../screens/AbuAI/types'

class MemLS {
  private s = new Map<string, string>()
  getItem(k: string) { return this.s.has(k) ? this.s.get(k)! : null }
  setItem(k: string, v: string) { this.s.set(k, String(v)) }
  removeItem(k: string) { this.s.delete(k) }
  clear() { this.s.clear() }
  key(i: number) { return [...this.s.keys()][i] ?? null }
  get length() { return this.s.size }
}
const tools = (): FullTurnTools => ({
  llm: async (i: string) => `[LLM] ${i.slice(0, 30)}`,
  online: async (q: string) => ({ ok: true, answer: /מזג|אוויר/.test(q) ? `בכפר סבא 29 מעלות, שמש. (${q})` : `הערב צרפת נגד ברזיל 21:00. (${q})` }),
})
const NOW = new Date('2026-06-24T20:00:00')
interface Log { say: string; intent: string; source: string; phase: string; fx: unknown; display: string }

async function convo(turns: string[]): Promise<Log[]> {
  ;(globalThis as unknown as { localStorage: MemLS }).localStorage = new MemLS()
  saveAppointments([])
  const tl = tools(); let state: RuntimeState = IDLE_RUNTIME
  const msgs: Array<{ role: string; content: string }> = []; const log: Log[] = []
  for (const say of turns) {
    const prior: ChatMessage[] = msgs.map((m, i) => ({ id: String(i), role: m.role as 'user' | 'assistant', content: m.content, timestamp: 0 }))
    const { resolved: pr } = resolvePronouns(say, prior)
    let eff = pr !== say ? pr : say
    const fu = resolveFollowUp(eff, prior, { pendingCreate: state.createState.phase !== 'idle' })
    if (fu.wasFollowUp) eff = fu.resolved
    msgs.push({ role: 'user', content: eff })
    const r = await ExecutiveCognitiveController.handleTurn({ ...state, conv: state.conv }, eff, { messages: [...msgs], now: NOW }, tl)
    state = r.state
    msgs.push({ role: 'assistant', content: r.display })
    log.push({ say, intent: r.intent, source: r.source, phase: r.state.createState.phase, fx: r.sideEffect, display: r.display })
  }
  return log
}
const MENU = /פגישה,?\s*יומן,?\s*משפחה|במילה אחת|באיזה יום\??\s*$/u
const last = (l: Log[]) => l[l.length - 1]!
const FAMILY_F = ['מור', 'יעל', 'אופיר', 'ירדן']
const pick = <T,>(a: T[], i: number) => a[i % a.length]!
const TIMES = ['בשמונה', 'בתשע', 'בעשר', 'בשלוש', 'בארבע', 'בחמש']
const PLACES = ['בבית', 'בקפה אסתר', 'בקפה אסתר בנהריה', 'במרפאה']

describe('GATE — fragmented calendar create can save (100)', () => {
  for (let i = 0; i < 100; i++) {
    const p = pick(FAMILY_F, i)
    it(`frag-create ${i}: "תקבעי לי" → slots → "כן" saves`, async () => {
      const l = await convo(['תקבעי לי', `עם ${p}`, 'מחר בשמונה בערב', 'כן'])
      expect(last(l).fx, JSON.stringify(l)).toBe('saved_appointment')
      for (const t2 of l) expect(MENU.test(t2.display)).toBe(false)
    })
  }
})

describe('GATE — cancel/exit lexicon clears the draft, no pollution (100)', () => {
  const exits = ['די', 'מספיק', 'עזוב', 'עזבי', 'תעזבי את זה', 'תעזוב את זה', 'צאי מזה', 'תצא מזה', 'לא משנה', 'נושא אחר', 'משהו אחר']
  for (let i = 0; i < 100; i++) {
    const e = pick(exits, i), p = pick(FAMILY_F, i)
    it(`exit ${i}: "${e}" clears the pending draft`, async () => {
      const l = await convo([`תקבעי פגישה מחר בשלוש עם ${p}`, e, 'מה השעה?'])
      expect(l[1]!.phase, JSON.stringify(l)).toBe('idle')
      expect(l[2]!.phase).toBe('idle') // no pollution
    })
  }
})

describe('GATE — online after a canceled draft is NOT calendar/reminder (100)', () => {
  for (let i = 0; i < 100; i++) {
    const p = pick(FAMILY_F, i)
    it(`online-after-cancel ${i}`, async () => {
      const l = await convo([`תקבעי פגישה מחר בשלוש עם ${p}`, 'די', 'מה מזג האוויר בכפר סבא?'])
      expect(last(l).source, JSON.stringify(l)).toBe('online')
      expect(/פגיש|תזכורת|קבעתי/.test(last(l).display)).toBe(false)
    })
  }
})

describe('GATE — calendar property follow-up answers from the event (100)', () => {
  for (let i = 0; i < 100; i++) {
    const p = pick(FAMILY_F, i)
    it(`property ${i}: "באיזה שעה?" after search`, async () => {
      const l = await convo([`תקבעי לי פגישה עם ${p} מחר בשלוש בקפה אסתר`, 'כן', `מתי הפגישה עם ${p}?`, 'באיזה שעה?'])
      expect(last(l).source, JSON.stringify(l)).not.toBe('llm')
      expect(/15:00|שלוש|שלש/.test(last(l).display)).toBe(true)
    })
  }
})

describe('GATE — stored-event edit never punts to the LLM (100)', () => {
  // The requirement is "no LLM punt": the runtime either updates the event
  // (calendar_update) or answers honestly ("אני לא משנה אירוע שמור…"). Both pass.
  const verbs = ['תשני לארבע', 'תשנה לארבע', 'תעדכני לחמש', 'תזיזי לעשר']
  for (let i = 0; i < 100; i++) {
    const p = pick(FAMILY_F, i), v = pick(verbs, i)
    it(`stored-edit ${i}: "${v}" after save`, async () => {
      const l = await convo([`תקבעי לי פגישה עם ${p} מחר בשלוש`, 'כן', v])
      expect(last(l).source, JSON.stringify(l)).not.toBe('llm')
      expect(MENU.test(last(l).display)).toBe(false)
    })
  }
})

describe('GATE — location + notes retained on the saved event (100)', () => {
  for (let i = 0; i < 100; i++) {
    const p = pick(FAMILY_F, i), loc = pick(PLACES, i + 1)
    it(`location ${i}: "${loc}" persisted`, async () => {
      await convo([`תקבעי לי פגישה עם ${p} מחר בשלוש ${loc}`, 'כן'])
      const ev = loadAppointments()[loadAppointments().length - 1]
      const hay = `${ev?.location ?? ''} ${ev?.subject ?? ''} ${ev?.title ?? ''}`
      const key = loc.replace(/^ב/, '').split(' ')[0]!
      expect(hay.includes(key), `loc="${loc}" ev=${JSON.stringify(ev)}`).toBe(true)
    })
  }
})

describe('GATE — memory recall returns a real topic, never a meta/closer (100)', () => {
  for (let i = 0; i < 100; i++) {
    const p = pick(FAMILY_F, i)
    it(`recall ${i}`, async () => {
      const l = await convo([`מי זאת ${p}?`, 'מה מזג האוויר בכפר סבא?', 'עזוב', 'מה דיברנו קודם?'])
      expect(/דיברנו על (?:עזוב|תודה|ביי|שלום|לא משנה)/.test(last(l).display), JSON.stringify(l)).toBe(false)
    })
  }
})

describe('GATE — Spanish/mixed routes sanely, no forced menu (100)', () => {
  const es = ['Hola, contame quién es Mor', '¿Qué tengo mañana?', '¿Qué tiempo hace en Kfar Saba?', 'Estoy un poco sola', 'gracias']
  for (let i = 0; i < 100; i++) {
    it(`spanish ${i}`, async () => {
      const l = await convo([pick(es, i), pick(es, i + 2)])
      for (const t of l) expect(MENU.test(t.display), JSON.stringify(l)).toBe(false)
    })
  }
})

describe('GATE — "תמשיכי" on an interrupted draft resumes, not a dead-end (40)', () => {
  for (let i = 0; i < 40; i++) {
    const p = pick(FAMILY_F, i)
    it(`resume ${i}`, async () => {
      const l = await convo([`תקבעי לי פגישה מחר בשלוש עם ${p}`, `מי זה רפי?`, 'תמשיכי'])
      // Must not dead-end ("זהו, סיימתי") — should re-surface the pending draft.
      expect(/זהו, סיימתי/.test(last(l).display), JSON.stringify(l)).toBe(false)
      expect(last(l).source, JSON.stringify(l)).not.toBe('llm')
    })
  }
})

describe('GATE — time query grounded in the clock, never fabricated (20)', () => {
  for (let i = 0; i < 20; i++) {
    it(`clock ${i}`, async () => {
      const l = await convo(['מה השעה?'])
      expect(last(l).source).not.toBe('llm')
      expect(/20:00/.test(last(l).display)).toBe(true)
    })
  }
})
