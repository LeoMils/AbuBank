/**
 * Regression: a spouse query in POSSESSIVE form is answered from the family graph,
 * not punted to the LLM (which could invent a husband/wife for a real relative).
 *
 * Ground truth — knowledge/family_graph.json:
 *   Ofir (אופיר, female) partner = גלעד ;  Eili (עילי, male) partner = ירדן.
 *
 * Before the fix: the controller answered "מי הבעל של אופיר" (→ גלעד) but PUNTED
 * "מי בעלה של אופיר" and "מי אשתו של עילי" to the LLM, because the family REL partner
 * pattern matched "ה?בעל של" / "ה?אישה של" but NOT the possessive suffix forms
 * "בעלה" (her-husband) / "אשתו" (his-wife). The spouse is the most common family
 * relation, so this is a real free-conversation + truthfulness gap (§14.11 / §47).
 *
 * First divergence: familyReasoning REL partner pattern; classifier then falls to `general`.
 * Deterministic, pure-local — no LLM. Feminine/masculine data unchanged.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { answerFamilyRelation } from './familyReasoning'
import { ExecutiveCognitiveController } from './executiveCognitiveController'
import { IDLE_RUNTIME, type RuntimeState } from './cognitiveRuntime'
import { saveAppointments } from '../AbuCalendar/service'
import type { FullTurnTools } from './runtimeFullTurn'

class Mem { private s=new Map<string,string>(); getItem(k:string){return this.s.has(k)?this.s.get(k)!:null} setItem(k:string,v:string){this.s.set(k,String(v))} removeItem(k:string){this.s.delete(k)} clear(){this.s.clear()} key(i:number){return [...this.s.keys()][i]??null} get length(){return this.s.size} }
const tools: FullTurnTools = { llm: async (i:string)=>`[LLM] ${i.slice(0,40)}`, online: async ()=>({ ok:true, answer:'x' }) }
async function ask(text: string) {
  ;(globalThis as unknown as { localStorage: Mem }).localStorage = new Mem()
  saveAppointments([])
  const state: RuntimeState = IDLE_RUNTIME
  const now = new Date('2026-06-24T20:00:00')
  return ExecutiveCognitiveController.handleTurn({ ...state, conv: state.conv }, text, { messages: [{ role: 'user', content: text }], now }, tools)
}

describe('possessive spouse forms resolve from the family graph', () => {
  it('answerFamilyRelation("מי בעלה של אופיר") → partner גלעד', () => {
    const r = answerFamilyRelation('מי בעלה של אופיר')
    expect(r).not.toBeNull()
    expect(r!.relation).toBe('partner')
    expect(r!.known).toBe(true)
    expect(r!.results).toContain('גלעד')
  })
  it('answerFamilyRelation("מי אשתו של עילי") → partner ירדן', () => {
    const r = answerFamilyRelation('מי אשתו של עילי')
    expect(r).not.toBeNull()
    expect(r!.relation).toBe('partner')
    expect(r!.results).toContain('ירדן')
  })
  it('non-regression: "מי הבעל של אופיר" still → גלעד', () => {
    expect(answerFamilyRelation('מי הבעל של אופיר')?.results).toContain('גלעד')
  })

  describe('through the real controller (not punted to the LLM)', () => {
    beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-06-24T20:00:00')) })
    afterEach(() => { vi.useRealTimers(); delete (globalThis as { localStorage?: unknown }).localStorage })

    it('"מי בעלה של אופיר" is answered deterministically with גלעד', async () => {
      const r = await ask('מי בעלה של אופיר')
      expect(r.source).not.toBe('llm')
      expect(r.intent).toBe('family')
      expect(r.display).toContain('גלעד')
    })
    it('"מי אשתו של עילי" is answered deterministically with ירדן', async () => {
      const r = await ask('מי אשתו של עילי')
      expect(r.source).not.toBe('llm')
      expect(r.display).toContain('ירדן')
    })
  })
})
