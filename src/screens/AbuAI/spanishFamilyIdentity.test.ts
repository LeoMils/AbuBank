/**
 * Regression (CONVERSATION_GAP_MAP G2): a Spanish family identity query
 * ("quién es Mor") must be answered from the family graph, in Spanish, NOT punted
 * to the LLM. The controller classified it as `general` → LLM (risking an invented
 * family fact); the Hebrew "מי זאת אופיר" already worked. `describeRelation(...,'es')`
 * renders Spanish, so this is a routing + language-threading fix, not a new reasoner.
 *
 * Asserted THROUGH the real controller (source !== 'llm'). Evidence class: CODE.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ExecutiveCognitiveController } from './executiveCognitiveController'
import { IDLE_RUNTIME, type RuntimeState } from './cognitiveRuntime'
import { saveAppointments } from '../AbuCalendar/service'
import type { FullTurnTools } from './runtimeFullTurn'

class Mem { private s=new Map<string,string>(); getItem(k:string){return this.s.has(k)?this.s.get(k)!:null} setItem(k:string,v:string){this.s.set(k,String(v))} removeItem(k:string){this.s.delete(k)} clear(){this.s.clear()} key(i:number){return [...this.s.keys()][i]??null} get length(){return this.s.size} }
const tools: FullTurnTools = { llm: async (i:string)=>`[LLM] ${i.slice(0,40)}`, online: async ()=>({ ok:true, answer:'x' }) }
const HEBREW = /[֐-׿]/
async function ask(text: string) {
  ;(globalThis as unknown as { localStorage: Mem }).localStorage = new Mem()
  saveAppointments([])
  const state: RuntimeState = IDLE_RUNTIME
  const now = new Date('2026-06-24T20:00:00')
  return ExecutiveCognitiveController.handleTurn({ ...state, conv: state.conv }, text, { messages: [{ role: 'user', content: text }], now }, tools)
}

describe('Spanish family identity queries are grounded (G2)', () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-06-24T20:00:00')) })
  afterEach(() => { vi.useRealTimers(); delete (globalThis as { localStorage?: unknown }).localStorage })

  it('"quién es Mor" → Spanish family answer from the graph, not the LLM', async () => {
    const r = await ask('quién es Mor')
    expect(r.source).not.toBe('llm')
    expect(r.intent).toBe('family')
    expect(r.display).not.toMatch(HEBREW)       // Spanish, no Hebrew
    expect(r.display).toMatch(/Mor/)
    expect(r.display).toMatch(/madre|hija/i)    // Martita is Mor's mother ⟺ Mor is her daughter
  })

  it('"quién es Ofir" → Spanish, grandmother/granddaughter', async () => {
    const r = await ask('quién es Ofir')
    expect(r.source).not.toBe('llm')
    expect(r.display).not.toMatch(HEBREW)
    expect(r.display).toMatch(/abuela|nieta/i)
  })

  it('non-regression: Hebrew "מי זאת אופיר" still answered from the graph', async () => {
    const r = await ask('מי זאת אופיר')
    expect(r.source).not.toBe('llm')
    expect(r.intent).toBe('family')
    expect(r.display).toMatch(/אופיר/)
  })
})
