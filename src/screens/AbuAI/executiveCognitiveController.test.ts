import { describe, it, expect } from 'vitest'
import { ExecutiveCognitiveController } from './executiveCognitiveController'
import { IDLE_RUNTIME } from './cognitiveRuntime'
import { isFinalized } from './runtimeTrace'
import { isEmittable } from './noBypassRuntimeGuard'
import type { FullTurnTools } from './runtimeFullTurn'

const NOW = new Date(2026, 6, 2, 9, 0, 0)
const T: FullTurnTools = { llm: async () => 'תשובה קצרה.', online: async () => ({ ok: true, answer: 'תוצאה' }) }

describe('Executive Cognitive Controller — the single authority', () => {
  it('returns a controller-stamped, finalized, emittable answer', async () => {
    const r = await ExecutiveCognitiveController.handleTurn(IDLE_RUNTIME, 'איזה יום היום', { messages: [], now: NOW }, T)
    expect(r.controller).toBe('executive-cognitive-controller')
    expect(isFinalized(r.trace)).toBe(true)
    expect(isEmittable(r)).toBe(true)
    expect(r.display).toContain('יום חמישי')
  })
  it('drives every domain through one entry (family/online/general/frustration)', async () => {
    for (const [input, check] of [
      ['מה הקשר בין לאו לאנאבל', /דוד רבא/],
      ['מה הסרטים בכפר סבא', /./],
      ['את לא עונה למה ששאלתי', /./],
    ] as const) {
      const r = await ExecutiveCognitiveController.handleTurn(IDLE_RUNTIME, input, { messages: [], now: NOW }, T)
      expect(isFinalized(r.trace)).toBe(true)
      expect(check.test(r.display)).toBe(true)
    }
  })
})
