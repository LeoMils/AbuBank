/*
 * FULL-PERSON CHAPTERS — the ledger holds a chapter per person (Constitution §2).
 * Proves end-to-end via the REAL controller: a stated personal fact (residence / work /
 * preference) is written through THE LAWS gate (with provenance + date) and Abu then
 * ANSWERS the personal question from the chapter; the whole chapter is renderable; the
 * curator supersedes a moved residence (latest wins, no fact lost).
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { ExecutiveCognitiveController } from '../screens/AbuAI/executiveCognitiveController'
import { IDLE_RUNTIME, type RuntimeState } from '../screens/AbuAI/cognitiveRuntime'
import { saveAppointments } from '../screens/AbuCalendar/service'
import type { FullTurnTools } from '../screens/AbuAI/runtimeFullTurn'
import { LedgerService, memoryStore } from './ledgerService'
import { extractChange } from './conversationIntake'
import { renderLedgerHebrew } from './ledgerView'
import type { Ledger, LedgerPerson } from './familyLaws'

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
async function run(seq: string[]) {
  let state: RuntimeState = IDLE_RUNTIME
  const out: Array<{ input: string; source: string; display: string }> = []
  for (const text of seq) {
    const r = await ExecutiveCognitiveController.handleTurn(state, text, { messages: [], now: FIXED }, TOOLS)
    state = r.state
    out.push({ input: text, source: r.source, display: (r.display ?? '').replace(/\s+/g, ' ').trim() })
  }
  return out
}

describe('PERSON CHAPTER — write a personal fact → answerable from the chapter', () => {
  it('residence: "תזכרי שדני גר בתל אביב" → "איפה גר דני" answers from the chapter', async () => {
    const [w, ask] = await run(['תזכרי שדני גר בתל אביב', 'איפה גר דני'])
    expect(w!.display).toContain('רשמתי')
    expect(ask!.source).not.toBe('llm')
    expect(ask!.display).toContain('תל אביב')
  })

  it('work + preference stack in the same chapter and each is answerable', async () => {
    const [, , , work, , pref] = await run([
      'תזכרי שדני גר בתל אביב', 'תזכרי שדני עובד בגוגל', 'איפה עובד דני',
      'איפה עובד דני', 'תזכרי שדני אוהב כדורגל', 'מה דני אוהב',
    ])
    expect(work!.display).toContain('גוגל')
    expect(pref!.display).toContain('כדורגל')
  })
})

describe('PERSON CHAPTER — provenance + date, view, and curator supersession', () => {
  it('extractChange parses a residence fact with kind + source (date stamped at write)', () => {
    expect(extractChange('דני גר בתל אביב')).toEqual({ op: 'addFact', id: 'דני', fact: { kind: 'residence', value: 'תל אביב', source: 'conversation', at: 0 } })
  })

  it('the chapter renders into the Hebrew ledger view with its provenance', () => {
    const P = (id: string, extra: Partial<LedgerPerson> = {}): LedgerPerson => ({ id, name: id, gender: 'unknown', parents: [], spouses: [], exSpouses: [], aliases: [], ...extra })
    const seed = (): Ledger => new Map([['דני', P('דני', { facts: [{ kind: 'residence', value: 'תל אביב', source: 'conversation', at: 1 }] })]])
    const svc = new LedgerService(memoryStore(), seed)
    const view = svc.renderHebrew()
    expect(view).toContain('דני')
    expect(view).toContain('תל אביב')
    expect(view).toContain('conversation')
  })

  it('a MOVED residence supersedes the old (latest wins, no fact deleted)', () => {
    const P = (id: string): LedgerPerson => ({ id, name: id, gender: 'unknown', parents: [], spouses: [], exSpouses: [], aliases: [] })
    const svc = new LedgerService(memoryStore(), () => new Map([['דני', P('דני')]]))
    svc.writeFact({ op: 'addFact', id: 'דני', fact: { kind: 'residence', value: 'תל אביב', source: 'conversation', at: 1 } }, 1)
    svc.writeFact({ op: 'addFact', id: 'דני', fact: { kind: 'residence', value: 'חיפה', source: 'conversation', at: 2 } }, 2)
    const r = svc.curate()
    expect(r.actions.some((a) => a.kind === 'supersede')).toBe(true)
    const facts = svc.ledger().get('דני')!.facts!.filter((f) => f.kind === 'residence')
    expect(facts).toHaveLength(1)
    expect(facts[0]!.value).toBe('חיפה') // latest residence wins
  })
})
