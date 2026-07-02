/*
 * Domain Planner + plugin architecture:
 *  - plugins self-select via match(); the planner runs participants' reason()
 *  - MULTIPLE plugins may participate in one turn (side-effects/patches merged)
 *  - a NEW domain works by registration alone — the controller is never edited
 *  - plugins never emit; the controller produces the final (finalized) answer
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { planWith, registerPlugin } from './domainPlanner'
import type { DomainPlugin, PluginContext } from './domainPlugin'
import { ExecutiveCognitiveController } from './executiveCognitiveController'
import { IDLE_RUNTIME } from './cognitiveRuntime'
import { isFinalized } from './runtimeTrace'
import type { FullTurnTools } from './runtimeFullTurn'

class MemoryLocalStorage {
  private store = new Map<string, string>()
  getItem(k: string): string | null { return this.store.has(k) ? this.store.get(k)! : null }
  setItem(k: string, v: string): void { this.store.set(k, String(v)) }
  removeItem(k: string): void { this.store.delete(k) }
  clear(): void { this.store.clear() }
  key(i: number): string | null { return [...this.store.keys()][i] ?? null }
  get length(): number { return this.store.size }
}

const NOW = new Date(2026, 6, 3, 9, 0, 0)
const ctx = (input: string): PluginContext => ({ input, now: NOW, messages: [], state: IDLE_RUNTIME })

const pingPlugin: DomainPlugin = {
  name: 'ping', domains: ['demo'],
  match(c) { return c.input.includes('פינג') ? 0.8 : 0 },
  reason() { return { handled: true, answer: 'פונג — התוסף עובד.', confidence: 0.8 } },
}
const observerPlugin: DomainPlugin = {
  name: 'observer', domains: ['demo'],
  match(c) { return c.input.includes('פינג') ? 0.3 : 0 },   // also participates, lower priority
  reason() { return { handled: true, answer: 'נצפה.', confidence: 0.3 } },
}

describe('Domain Planner (isolated)', () => {
  it('only matching plugins participate', () => {
    const plan = planWith([pingPlugin], ctx('שלום'))
    expect(plan.participants).toEqual([])
    expect(plan.primary).toBeNull()
  })
  it('MULTIPLE plugins participate; primary = highest confidence', () => {
    const plan = planWith([observerPlugin, pingPlugin], ctx('שלחי פינג'))
    expect(plan.participants.sort()).toEqual(['observer', 'ping'])
    expect(plan.primaryPlugin).toBe('ping')      // 0.8 > 0.3
    expect(plan.primary?.answer).toContain('פונג')
  })
  it('merges side-effects across handled participants', () => {
    const a: DomainPlugin = { name: 'a', domains: ['x'], match: () => 1, reason: () => ({ handled: true, answer: 'א', sideEffect: 'deleted', confidence: 0.9 }) }
    const b: DomainPlugin = { name: 'b', domains: ['x'], match: () => 1, reason: () => ({ handled: true, answer: 'ב', sideEffect: 'updated', confidence: 0.5 }) }
    const plan = planWith([a, b], ctx('משהו'))
    expect(plan.sideEffects.sort()).toEqual(['deleted', 'updated'])
  })
})

describe('adding a domain without changing the controller', () => {
  beforeEach(() => { ;(globalThis as unknown as { localStorage: MemoryLocalStorage }).localStorage = new MemoryLocalStorage() })

  it('a newly-registered plugin is used by the Executive Controller — no controller edits', async () => {
    registerPlugin(pingPlugin) // register into the GLOBAL registry the controller uses
    const tools: FullTurnTools = { llm: async () => 'x', online: async () => ({ ok: true, answer: 'x' }) }
    const r = await ExecutiveCognitiveController.handleTurn(IDLE_RUNTIME, 'שלחי פינג בבקשה', { messages: [], now: NOW }, tools)
    expect(r.display).toContain('פונג')      // the plugin's candidate, finalized by the controller
    expect(isFinalized(r.trace)).toBe(true)   // controller produced the final answer
  })
})
