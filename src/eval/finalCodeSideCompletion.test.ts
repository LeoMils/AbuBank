/*
 * FINAL CODE-SIDE COMPLETION GATE
 * ══════════════════════════════
 * One gate over every code-testable category, run through the REAL runtime. Zero
 * critical failures allowed. Physical mic/STT, physical TTS feel, and Leo's device
 * acceptance are the ONLY out-of-scope items.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { runGoldenCorpus, scoreByCategory } from './goldenAcceptanceCorpus'
import { runStress } from './productionStressHarness'
import { runFinalAcceptance } from './abuaiFinalProductionAcceptance'
import { createOnlineRuntime } from '../screens/AbuAI/onlineRuntimeV2'
const callOnlineWithRetry = (provider: (q: string) => Promise<{ ok: boolean; answer: string; reason?: string | null }>, query: string) => createOnlineRuntime().runQuery(query, provider)
import { relationOf, type RelationKind } from '../screens/AbuAI/familyRelationEngine'
import { loadGraph } from '../screens/AbuAI/familyGraph'
import { planDelivery, advance, resume } from '../screens/AbuAI/conversationDeliveryEngine'

class MemoryLocalStorage {
  private store = new Map<string, string>()
  getItem(k: string): string | null { return this.store.has(k) ? this.store.get(k)! : null }
  setItem(k: string, v: string): void { this.store.set(k, String(v)) }
  removeItem(k: string): void { this.store.delete(k) }
  clear(): void { this.store.clear() }
  key(i: number): string | null { return [...this.store.keys()][i] ?? null }
  get length(): number { return this.store.size }
}

const INVERSE: Partial<Record<RelationKind, RelationKind[]>> = {
  parent: ['child'], child: ['parent'], sibling: ['sibling'], spouse: ['spouse'],
  grandparent: ['grandchild'], grandchild: ['grandparent'], cousin: ['cousin'],
  uncle_aunt: ['nephew_niece'], nephew_niece: ['uncle_aunt', 'uncle_aunt_in_law'],
}

describe('FINAL Code-Side Completion Gate', () => {
  beforeEach(() => { ;(globalThis as unknown as { localStorage: MemoryLocalStorage }).localStorage = new MemoryLocalStorage() })

  it('Golden Corpus — every real iPhone failure stays impossible (0 failures)', async () => {
    const rows = await runGoldenCorpus()
    const sc = scoreByCategory(rows)
    // eslint-disable-next-line no-console
    console.log('[FINAL] golden ' + sc.map(c => `${c.cat}:${c.passed}/${c.total}`).join(' '))
    expect(rows.filter(r => !r.pass).map(r => r.id)).toEqual([])
  }, 60000)

  it('Stress/fuzz — 0 invariant violations over randomized mixed-domain conversations', async () => {
    const { turns, violations } = await runStress(300, 8)
    expect(turns).toBeGreaterThan(600)
    expect(violations.map(v => `${v.seed}#${v.turnIndex}:${v.detail}`)).toEqual([])
  }, 120000)

  it('Behavior acceptance — every layer meets its threshold (Calendar/Family/Online/Dialogue/Hebrew/Speech)', async () => {
    const s = await runFinalAcceptance()
    expect(s.byLayer.filter(l => !l.ok).map(l => `${l.layer}:${l.pct}%`)).toEqual([])
    expect(s.failures.map(f => f.id)).toEqual([])
  }, 120000)

  it('Family — no self-contradiction (inverse-consistent, computed from graph)', () => {
    const people = loadGraph().map(n => n.hebrew)
    const bad: string[] = []
    for (const a of people) for (const b of people) {
      if (a === b) continue
      const k = relationOf(a, b).kind
      const allowed = INVERSE[k]
      if (allowed && !allowed.includes(relationOf(b, a).kind)) bad.push(`${a}->${b}=${k}`)
    }
    expect(bad).toEqual([])
  })

  it('Online — retry-once + honest failure, no hallucination', async () => {
    let n = 0
    const ok = await callOnlineWithRetry(async () => { n++; return n === 1 ? { ok: false, answer: '', reason: 'timeout' } : { ok: true, answer: 'סרט ב-20:00' } }, 'q')
    expect(ok.ok).toBe(true); expect(ok.attempts).toBe(2)
    const fail = await callOnlineWithRetry(async () => ({ ok: false, answer: '', reason: 'provider_failed' }), 'q')
    expect(fail.ok).toBe(false); expect(fail.reason).toBe('provider_failed')
  })

  it('Speech delivery — chunked, resumable to exact next chunk, no markdown', () => {
    const d = planDelivery('משפט ראשון כאן. משפט שני כאן. משפט שלישי כאן ומשהו נוסף.')
    expect(d.chunks.length).toBeGreaterThan(1)
    const a = advance(d); const b = resume(a.state)
    expect(a.chunk).toBe(d.chunks[0]); expect(b.chunk).toBe(d.chunks[1])
    for (const c of d.chunks) expect(c).not.toMatch(/https?:\/\/|\]\(|[*_`#]/)
  })
})
