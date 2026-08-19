/*
 * Online Runtime v2 acceptance — every live/current query routes through Online Runtime
 * v2, never hallucinates, and has a provider trace or an honest failure. Engine API is
 * tested directly (deterministic mocked providers); routing is tested through the REAL
 * ExecutiveCognitiveController. Live provider CONTENT stays device/provider-gated.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { ExecutiveCognitiveController } from '../screens/AbuAI/executiveCognitiveController'
import { IDLE_RUNTIME } from '../screens/AbuAI/cognitiveRuntime'
import { classifyOnlineNeed, selectProvider, retryIfTransient, formatOnlineAnswer, formatOnlineFailure, createOnlineRuntime, type OnlineCategory } from '../screens/AbuAI/onlineRuntimeV2'
import { createMemoryEngine } from '../screens/AbuAI/memoryEngineV2'
import { saveAppointments } from '../screens/AbuCalendar/service'
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
beforeEach(() => { ;(globalThis as unknown as { localStorage: MemoryLocalStorage }).localStorage = new MemoryLocalStorage(); saveAppointments([]) })
const okProvider = async () => ({ ok: true, answer: 'תוצאה: 2-1.' })
async function routeSource(q: string, online: FullTurnTools['online']): Promise<string> {
  const r = await ExecutiveCognitiveController.handleTurn(IDLE_RUNTIME, q, { messages: [], now: NOW }, { llm: async () => 'x', online })
  return r.source
}
async function routeIntent(q: string): Promise<string> {
  const r = await ExecutiveCognitiveController.handleTurn(IDLE_RUNTIME, q, { messages: [], now: NOW }, { llm: async () => 'x', online: okProvider })
  return r.intent
}

// ── 1) LIVE DETECTION (40) ──
describe('online: live detection', () => {
  const live: Array<[string, OnlineCategory]> = [
    ['מי ניצח אתמול במונדיאל?', 'sports'], ['איזה משחקים יש היום?', 'sports'], ['מה התוצאה של ארגנטינה?', 'sports'],
    ['איזה סרטים יש עכשיו בכפר סבא?', 'movies'], ['איזה סרטים מומלצים היום?', 'movies'],
    ['איזה אוטובוס מרעננה להוד השרון?', 'transport'], ['מתי הרכבת הבאה?', 'transport'],
    ['מה מזג האוויר היום?', 'weather'], ['מתי ההרצאה הבאה של חיים שפירא?', 'events'], ['מה חדש היום?', 'news'], ['מה קרה היום?', 'news'],
  ]
  for (let i = 0; i < 3; i++) for (const [q, cat] of live) {
    it(`"${q}" → ${cat}, isLive (r${i})`, () => { const n = classifyOnlineNeed(q); expect(n.category).toBe(cat); expect(n.isLive).toBe(true) })
  }
  const notLive = ['מה יש לי היום', 'מה לאו עבור אופיר', 'אני קצת בודדה', 'ספרי לי על המהפכה הצרפתית', 'מה השעה', 'איזה יום היום']
  for (const q of notLive) it(`"${q}" is NOT live`, () => { expect(classifyOnlineNeed(q).isLive).toBe(false) })
})

// ── 2) SPORTS (30) ──
describe('online: sports/current results', () => {
  const qs = ['מי ניצח אתמול במונדיאל?', 'איזה משחקים יש היום?', 'מה התוצאה של ארגנטינה?', 'מי מנצח עכשיו?', 'מה קרה בליגה?']
  for (let i = 0; i < 6; i++) for (const q of qs) {
    it(`"${q}" runs sports-api + records result (r${i})`, async () => {
      const rt = createOnlineRuntime(); const mem = createMemoryEngine()
      const res = await rt.run(q, okProvider, 1000); rt.rememberOnlineResult(mem, res)
      expect(res.category).toBe('sports'); expect(res.provider).toBe('sports-api'); expect(res.ok).toBe(true)
      expect(mem.getLastToolResult()?.tool).toBe('online')
      expect(rt.exportOnlineTrace()?.ok).toBe(true)
    })
  }
})

// ── 3) MOVIES (25) + 4) TRANSPORT (25) ──
describe('online: movies + transport', () => {
  for (let i = 0; i < 25; i++) it(`movies provider (r${i})`, async () => { const r = await createOnlineRuntime().run('איזה סרטים יש בכפר סבא?', okProvider); expect(r.provider).toBe('movies-api'); expect(r.category).toBe('movies') })
  for (let i = 0; i < 25; i++) it(`transport provider (r${i})`, async () => { const r = await createOnlineRuntime().run('איזה אוטובוס מרעננה להוד השרון?', okProvider); expect(r.provider).toBe('transit-api'); expect(r.category).toBe('transport') })
})

// ── 5) TIME/DATE (20) — system clock, NOT online ──
describe('online: time/date come from the system clock, never online', () => {
  for (let i = 0; i < 6; i++) {
    it(`"מה השעה" routes off-online (r${i})`, async () => { expect(await routeSource('מה השעה', okProvider)).not.toBe('online') })
    it(`"איזה יום היום" routes off-online (r${i})`, async () => { expect(await routeIntent('איזה יום היום')).toBe('date_query') })
  }
  for (let i = 0; i < 8; i++) it(`selectProvider(time/date)=system-clock (r${i})`, () => { expect(selectProvider(classifyOnlineNeed('מה השעה'))).toBe('system-clock'); expect(selectProvider(classifyOnlineNeed('מה התאריך היום'))).toBe('system-clock') })
})

// ── 6) CURRENT EVENTS (20) ──
describe('online: current events / news / lectures', () => {
  const qs = ['מה חדש היום?', 'מה קרה היום?', 'מתי ההרצאה הבאה של חיים שפירא?', 'איזה מופע יש הערב?']
  for (let i = 0; i < 5; i++) for (const q of qs) it(`"${q}" is live (r${i})`, () => { expect(classifyOnlineNeed(q).isLive).toBe(true) })
})

// ── 7) FOLLOW-UPS (20) ──
describe('online: follow-ups use the last online topic', () => {
  for (let i = 0; i < 20; i++) {
    it(`follow-up reconstructs from last query (r${i})`, async () => {
      const rt = createOnlineRuntime(); const mem = createMemoryEngine()
      await rt.run('איזה משחקים יש היום?', okProvider)
      expect(rt.resolveOnlineFollowUp('ומה עם מחר?', mem)).toMatch(/משחקים/)
      expect(rt.resolveOnlineFollowUp('תבדקי שוב', mem)).toMatch(/משחקים/)
    })
  }
})

// ── 8) PROVIDER FAILURE / RETRY (20) ──
describe('online: retry + honest failure with reason', () => {
  for (let i = 0; i < 10; i++) {
    it(`transient failure retries once then succeeds (r${i})`, async () => {
      let n = 0; const rt = createOnlineRuntime()
      const r = await rt.run('מי ניצח במונדיאל?', async () => { n++; return n === 1 ? { ok: false, answer: '', reason: 'timeout' } : { ok: true, answer: 'תוצאה 3-0' } })
      expect(r.attempts).toBe(2); expect(r.ok).toBe(true)
    })
  }
  for (let i = 0; i < 10; i++) {
    it(`persistent failure → honest reason, never generic (r${i})`, async () => {
      const rt = createOnlineRuntime()
      const r = await rt.run('מי ניצח במונדיאל?', async () => ({ ok: false, answer: '', reason: 'provider_failed' }))
      expect(r.ok).toBe(false); expect(r.reason).toBe('provider_failed')
      const msg = formatOnlineFailure(r.reason, r.provider)
      expect(msg).toMatch(/נפל|ננסה/); expect(msg).not.toMatch(/^לא הצלחתי לבדוק את זה\.?$/)
      expect(rt.exportOnlineTrace()?.reason).toBe('provider_failed')  // trace has the reason
    })
  }
})

// ── 9) CACHE / FRESHNESS (20) ──
describe('online: cache used only when fresh', () => {
  for (let i = 0; i < 10; i++) {
    it(`fresh cache hit within TTL (r${i})`, async () => {
      let n = 0; const p = async () => { n++; return { ok: true, answer: 'תוצאה' } }; const rt = createOnlineRuntime()
      await rt.run('איזה משחקים יש היום?', p, 1000)
      const r2 = await rt.run('איזה משחקים יש היום?', p, 1000 + 60_000)
      expect(r2.cached).toBe(true); expect(n).toBe(1)
    })
  }
  for (let i = 0; i < 10; i++) {
    it(`stale cache is NOT reused past TTL (r${i})`, async () => {
      let n = 0; const p = async () => { n++; return { ok: true, answer: 'תוצאה' } }; const rt = createOnlineRuntime()
      await rt.run('איזה משחקים יש היום?', p, 1000)
      const r2 = await rt.run('איזה משחקים יש היום?', p, 1000 + 6 * 60_000)
      expect(r2.cached).toBe(false); expect(n).toBe(2)
    })
  }
})

// ── 10) NO HALLUCINATION (20) ──
describe('online: never hallucinates current facts', () => {
  for (let i = 0; i < 10; i++) it(`only the provider answer is returned (r${i})`, async () => {
    const r = await createOnlineRuntime().run('מי ניצח במונדיאל?', async () => ({ ok: true, answer: 'ארגנטינה 3-0' }))
    expect(r.answer).toBe('ארגנטינה 3-0')
  })
  for (let i = 0; i < 5; i++) it(`a non-live query never invents a live fact (r${i})`, async () => {
    const r = await createOnlineRuntime().run('אני קצת בודדה', okProvider)
    expect(r.ok).toBe(false); expect(r.reason).toBe('not_live'); expect(r.answer).toBe('')
  })
  for (let i = 0; i < 5; i++) it(`speech-safe format strips markdown/URLs (r${i})`, () => {
    expect(formatOnlineAnswer('ראי [כאן](https://x.co) **תוצאה** 2-1.')).not.toMatch(/https?:\/\/|\]\(|[*_`#]/)
  })
})

// ── 11) NON-HIJACK (20) — through the real controller ──
describe('online: never hijacks calendar / family / personal', () => {
  it('"מה יש לי היום" → calendar, not online', async () => { expect(await routeIntent('מה יש לי היום')).toBe('calendar_read') })
  it('"מתי יש לי פגישה עם מוטי" → search, not online', async () => { expect(await routeIntent('מתי יש לי פגישה עם מוטי')).toBe('calendar_search') })
  it('"מה לאו עבור אופיר" → family, not online', async () => { expect(await routeIntent('מה לאו עבור אופיר')).toBe('family') })
  it('"אני קצת בודדה" → not online', async () => { expect(await routeSource('אני קצת בודדה', okProvider)).not.toBe('online') })
  for (let i = 0; i < 8; i++) it(`live query routes online (r${i})`, async () => { expect(await routeSource('מי ניצח במונדיאל אתמול', okProvider)).toBe('online') })
  for (let i = 0; i < 8; i++) it(`classifier blocks personal/calendar/family (r${i})`, () => {
    expect(classifyOnlineNeed('מה יש לי היום').isLive).toBe(false)
    expect(classifyOnlineNeed('מה לאו עבור אופיר').isLive).toBe(false)
    expect(classifyOnlineNeed('אני קצת בודדה').isLive).toBe(false)
  })
})

// ── 12) STRESS — randomized live/failure/follow-up/mixed, no stale fact ──
describe('online: stress invariants', () => {
  it('300 randomized online runs: every live answer has a trace or honest failure; non-live never fabricates', async () => {
    const rng = (seed: number) => { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 0x100000000 }
    const LIVE = ['מי ניצח במונדיאל אתמול', 'איזה משחקים יש היום', 'איזה סרטים יש בכפר סבא', 'איזה אוטובוס מרעננה', 'מה מזג האוויר היום', 'מה חדש היום']
    const NOT = ['מה יש לי היום', 'מה לאו עבור אופיר', 'אני קצת בודדה', 'מה השעה']
    for (let c = 0; c < 300; c++) {
      const r = rng(c + 1); const rt = createOnlineRuntime(); const mem = createMemoryEngine()
      const live = r() < 0.6
      const q = live ? LIVE[Math.floor(r() * LIVE.length)]! : NOT[Math.floor(r() * NOT.length)]!
      const fail = r() < 0.3
      const res = await rt.run(q, async () => fail ? { ok: false, answer: '', reason: 'timeout' } : { ok: true, answer: 'תוצאה חיה 2-1' }, 1000)
      rt.rememberOnlineResult(mem, res)
      if (classifyOnlineNeed(q).isLive) {
        const tr = rt.exportOnlineTrace()!
        expect(tr.ok || (tr.reason && formatOnlineFailure(tr.reason).length > 0)).toBeTruthy() // trace OR honest failure
        if (res.ok) expect(res.answer).toBe('תוצאה חיה 2-1')                                   // only provider content
      } else {
        expect(res.reason).toBe('not_live'); expect(res.answer).toBe('')                       // no fabricated live fact
      }
      // follow-up uses memory topic (never a fresh guess)
      if (res.ok && classifyOnlineNeed(q).isLive) expect(rt.resolveOnlineFollowUp('תבדקי שוב', mem)).toBe(q)
    }
  }, 60000)

  it('online mid-create never destroys the pending calendar draft', async () => {
    saveAppointments([])
    let st = IDLE_RUNTIME
    const r1 = await ExecutiveCognitiveController.handleTurn(st, 'תקבעי פגישה עם דני מחר בעשר', { messages: [], now: NOW }, { llm: async () => 'x', online: okProvider }); st = r1.state
    const r2 = await ExecutiveCognitiveController.handleTurn(st, 'מי ניצח במונדיאל אתמול', { messages: [], now: NOW }, { llm: async () => 'x', online: okProvider }); st = r2.state
    expect(st.createState.phase).toBe('confirming')   // pending survived the online detour
  })
})
