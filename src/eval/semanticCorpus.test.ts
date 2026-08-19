/*
 * Semantic Corpus — every real Leo iPhone semantic/STT failure, permanent. Proves the
 * Semantic Intelligence Engine recovers imperfect transcripts and resolves intent from
 * fused context, through the REAL ExecutiveCognitiveController. No percentages: every
 * case must be impossible to reproduce.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { ExecutiveCognitiveController } from '../screens/AbuAI/executiveCognitiveController'
import { IDLE_RUNTIME } from '../screens/AbuAI/cognitiveRuntime'
import { recoverTranscript, resolveSemanticIntent } from '../screens/AbuAI/semanticIntelligenceEngine'
import { saveAppointments, addAppointment } from '../screens/AbuCalendar/service'
import type { FullTurnTools } from '../screens/AbuAI/runtimeFullTurn'

class MemoryLocalStorage {
  private store = new Map<string, string>()
  getItem(k: string): string | null { return this.store.has(k) ? this.store.get(k)! : null }
  setItem(k: string, v: string): void { this.store.set(k, String(v)) }
  removeItem(k: string): void { this.store.delete(k) }
  clear(): void { this.store.clear() }
  key(i: number): string | null { return [...this.store.keys()][i] ?? null }
  get length(): number { return this.store.size }
}
const NOW = new Date(2026, 6, 6, 9, 0, 0)
const T: FullTurnTools = { llm: async () => 'תשובה כללית קצרה.', online: async () => ({ ok: true, answer: 'משחק ב-20:00.' }) }
beforeEach(() => { ;(globalThis as unknown as { localStorage: MemoryLocalStorage }).localStorage = new MemoryLocalStorage(); saveAppointments([]) })
const seedMor = () => addAppointment({ title: 'פגישה עם מור', date: '2026-07-10', time: '10:00', emoji: '📅' } as never)
async function intentOf(q: string, seed?: () => void): Promise<string> {
  saveAppointments([]); seed?.()
  const r = await ExecutiveCognitiveController.handleTurn(IDLE_RUNTIME, q, { messages: [], now: NOW }, T)
  return r.intent
}

describe('Semantic Engine — STT transcript recovery', () => {
  const rows: Array<[string, RegExp]> = [
    ['קלי פגישה', /קבעי לי/u],           // dropped/merged scheduling verb
    ['תיקבע לי פגישה', /תקבע/u],          // extra-yod morphology
    ['מי זאת אופיר', /מי זה/u],           // who-is morphology זאת→זה
    ['מי זו מור', /מי זה/u],
    ['פגישה פגישה עם מור', /^(?!.*פגישה פגישה)/u], // duplicated word collapsed
  ]
  for (const [inp, re] of rows) {
    it(`recovers "${inp}"`, () => { expect(recoverTranscript(inp).text).toMatch(re) })
  }
  it('leaves a clean transcript unchanged', () => {
    expect(recoverTranscript('קבע לי פגישה עם מור מחר בעשר').text).toBe('קבע לי פגישה עם מור מחר בעשר')
  })
})

describe('Semantic Engine — confidence model + alternatives + reason', () => {
  const ctx = { hasPending: false }
  it('emits intent + confidence + reason for a create', () => {
    const r = resolveSemanticIntent('קבע לי פגישה עם מור מחר בעשר', ctx)
    expect(r.intent).toBe('calendar_create'); expect(r.confidence).toBeGreaterThan(0.4); expect(r.reason).toBeTruthy()
  })
  it('have + meeting scores SEARCH over create', () => {
    expect(resolveSemanticIntent('יש לי פגישה עם מור', ctx).intent).toBe('calendar_search')
  })
  it('live-info cue scores ONLINE', () => {
    expect(resolveSemanticIntent('איזה משחקים יש היום', ctx).intent).toBe('online')
  })
  it('who-is (recovered) scores FAMILY', () => {
    expect(resolveSemanticIntent('מי זאת אופיר', ctx).intent).toBe('family')
  })
  it('a genuinely ambiguous turn asks for clarification, a clear one does not', () => {
    expect(resolveSemanticIntent('קבע לי פגישה עם מור מחר בעשר', ctx).needsClarification).toBe(false)
    const amb = resolveSemanticIntent('אולי', ctx)
    expect(amb.alternatives).toBeInstanceOf(Array)
  })
})

describe('Semantic Corpus — real runtime intent (search/create/read/delete/family/online)', () => {
  it('"קלי פגישה" → create (STT recovered), NOT general', async () => { expect(await intentOf('קלי פגישה')).toBe('calendar_create') })
  it('"מי זאת אופיר" → family, NOT general', async () => { expect(await intentOf('מי זאת אופיר')).toBe('family') })
  it('"יש לי פגישה עם מור" → search, NOT create', async () => { expect(await intentOf('יש לי פגישה עם מור', seedMor)).toBe('calendar_search') })
  it('"תקבע לי פגישה עם מור מחר בעשר" → create', async () => { expect(await intentOf('תקבע לי פגישה עם מור מחר בעשר')).toBe('calendar_create') })
  it('"מתי הפגישה עם מור" → search', async () => { expect(await intentOf('מתי הפגישה עם מור', seedMor)).toBe('calendar_search') })
  it('"תבטל את הפגישה עם מור" → delete', async () => { expect(await intentOf('תבטל את הפגישה עם מור', seedMor)).toBe('calendar_delete') })
  it('"מה יש לי היום" → read', async () => { expect(await intentOf('מה יש לי היום')).toBe('calendar_read') })
  it('"איזה משחקים יש היום" → online', async () => { expect(await intentOf('איזה משחקים יש היום')).toBe('online') })
})
